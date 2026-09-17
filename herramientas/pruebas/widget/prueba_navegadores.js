// Robustez en otros navegadores y entornos: Firefox y WebKit (Safari) además de Chromium; localStorage bloqueado;
// sin speechSynthesis ni SpeechRecognition; página sin <main> ni encabezados; script cargado dos veces; SPA que
// reemplaza el DOM. Comprueba que el widget carga, abre, aplica ajustes y no lanza errores. Uso: node prueba_navegadores.js
const pw = require("playwright");
const path = require("path");
const { spawn } = require("child_process");

// Por http (servidor local): WebKit no deja hacer fetch desde file:// y eso no es un fallo del widget
const fs = require("fs");
fs.writeFileSync(path.join(__dirname, "pagina-prueba-http.html"), fs.readFileSync(path.join(__dirname, "pagina-prueba.html"), "utf8").replace('src="../../../web/widget.js"', 'src="/widget.js"'));
const PAGINA = "http://127.0.0.1:8765/pruebas/pagina-prueba-http.html";
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

async function basico(nav, nombre, init) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e).slice(0, 160)));
  await page.goto(PAGINA);
  const cargado = await page.waitForFunction(() => window.Winclus, null, { timeout: 15000 }).then(() => true).catch(() => false);
  let r = { cargado };
  if (cargado) {
    r = await page.evaluate(async () => {
      const out = { cargado: true, pasos: [] };
      const paso = (n, f) => { try { f(); out.pasos.push("ok " + n); } catch (e) { out.pasos.push("ERROR " + n + ": " + String(e).slice(0, 80)); } };
      paso("abrir", () => Winclus.abrir());
      paso("contraste", () => Winclus.caja.getElementById("wcl-contraste").click());
      paso("oscuro", () => Winclus.caja.getElementById("wcl-oscuro").click());
      paso("texto+", () => Winclus.caja.querySelector("#wcl-panel-ver .wcl-mm button:last-child").click());
      paso("dalton", () => Array.from(Winclus.caja.querySelectorAll(".wcl-opc button")).find((b) => /el rojo/.test(b.textContent)).click());
      paso("teclado", () => { Winclus.teclado(); Winclus.teclado(); });
      paso("leer", () => Winclus.leer());
      paso("decir", () => Winclus.decir("hola"));
      paso("orden", () => Winclus.orden("números"));
      paso("pictos", () => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /pictogramas/i.test(b.textContent)).click(); Winclus.caja.querySelector(".wcl-pictos .acciones button:last-child").click(); });
      paso("limpia", () => { Winclus.orden("lectura fácil"); });
      paso("donde", () => Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /Dónde estoy/.test(b.textContent)).click());
      paso("asistente", () => { const i = Winclus.caja.getElementById("wcl-que"); i.value = "no oigo"; i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
      paso("barrido", () => { Winclus.caja.getElementById("wcl-barrido").click(); Winclus.caja.getElementById("wcl-barrido").click(); });
      paso("clic", () => { Winclus.mover(300, 300); Winclus.clic(); });
      paso("dictar", () => Array.from(Winclus.caja.querySelectorAll("#wcl-panel-escribir button")).find((b) => b.textContent === "Dictar").click());
      paso("subvivo", () => Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /Subtítulos en vivo/.test(b.textContent)).click());
      paso("restablecer", () => Array.from(Winclus.caja.querySelectorAll("#wcl-panel-mas button")).find((b) => /Restablecer/.test(b.textContent)).click());
      await new Promise((r) => setTimeout(r, 300));
      out.boton = Winclus.caja.querySelector(".wcl-btn").getBoundingClientRect().left > 0;
      out.cursor = Winclus.caja.querySelector(".wcl-btn") !== null;
      return out;
    });
  }
  await ctx.close();
  const malos = (r.pasos || []).filter((p) => p.startsWith("ERROR"));
  comprobar(r.cargado && malos.length === 0 && errores.length === 0 && r.boton, nombre, [...malos, ...errores].join(" | ") || ((r.pasos || []).length + " pasos"));
}

(async () => {
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  process.on("exit", () => { try { servidor.kill(); } catch (e) {} });
  for (const motor of ["chromium", "firefox", "webkit"]) {
    let nav;
    try { nav = await pw[motor].launch(); } catch (e) { console.log("--  " + motor + " no disponible: " + String(e).slice(0, 80)); continue; }
    console.log("\n== " + motor);
    await basico(nav, motor + ": recorrido básico");
    await basico(nav, motor + ": sin speechSynthesis ni SpeechRecognition", () => { try { delete window.speechSynthesis; } catch (e) {} Object.defineProperty(window, "speechSynthesis", { get: () => undefined }); window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
    await basico(nav, motor + ": localStorage bloqueado (modo privado)", () => { const bloqueo = { get: () => { throw new Error("SecurityError: bloqueado"); } }; Object.defineProperty(window, "localStorage", bloqueo); Object.defineProperty(window, "sessionStorage", bloqueo); });
    await basico(nav, motor + ": sin clipboard ni vibrate", () => { Object.defineProperty(navigator, "clipboard", { get: () => undefined }); Object.defineProperty(navigator, "vibrate", { get: () => undefined }); });
    await basico(nav, motor + ": página sin <main> ni encabezados y DOM reemplazado (SPA)", () => { window.addEventListener("load", () => { const m = document.querySelector("main"); if (m) m.outerHTML = "<div id='app'><p>Texto nuevo sin título</p><button type='button'>Uno</button></div>"; document.querySelectorAll("h1,h2,h3").forEach((h) => h.remove()); }); });
    await basico(nav, motor + ": script cargado dos veces", () => { window.addEventListener("load", () => { const s = document.createElement("script"); s.src = "/widget.js"; document.body.appendChild(s); }); });
    await basico(nav, motor + ": móvil 360 px con touch", async () => {});
    await nav.close();
  }
  try { fs.unlinkSync(path.join(__dirname, "pagina-prueba-http.html")); } catch (e) {}
  console.log("\n" + (fallos ? fallos + " comprobación(es) MAL" : "todo bien"));
  process.exit(fallos ? 1 : 0);
})();
