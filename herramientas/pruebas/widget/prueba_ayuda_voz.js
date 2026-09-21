// «Pedir ayuda» y «Mis frases con mi voz» (0.6.17), para la ELA avanzada. Pedir ayuda: aviso en toda la pantalla,
// sin destellos (el color no cambia), con la voz «Necesito ayuda», que para cualquier tecla, clic o gesto; también
// con palabras («socorro»). Banco de mensajes: se graba una frase con el micrófono (el simulado de Chromium) y, al
// decirla, suena la grabación y NO la voz sintética; otra frase sin grabar sí va por la voz sintética; la grabación
// sigue al recargar; «Borrar» y «Restablecer todo» la quitan. Uso: node prueba_ayuda_voz.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 700));
  const nav = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await nav.newContext();
  await ctx.grantPermissions(["microphone"], { origin: "http://127.0.0.1:8765" });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  await ctx.addInitScript(() => {
    window.__voz = []; speechSynthesis.speak = (u) => { window.__voz.push(u.text); setTimeout(() => { if (u.onend) u.onend({}); }, 5); };
    window.__play = 0; const p = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { if (this.src && this.src.startsWith("blob:")) window.__play++; return p.apply(this, arguments); };
  });
  const page = await ctx.newPage();
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto("http://127.0.0.1:8765/index.html");
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { localStorage.setItem("winclus.visto", "1"); Winclus.abrir(); });

  // --- Pedir ayuda ---
  await page.evaluate(() => { window.__voz = []; Winclus.caja.getElementById("wcl-pedir-ayuda").click(); });
  await page.waitForTimeout(400);
  const c1 = await page.evaluate(() => { const e = Winclus.caja.querySelector(".wcl-ayuda-grande"); return e && { rol: e.getAttribute("role"), texto: e.textContent, fondo: getComputedStyle(e).backgroundColor, cubre: e.getBoundingClientRect().width >= innerWidth - 1 }; });
  await page.waitForTimeout(1300);
  const c2 = await page.evaluate(() => { const e = Winclus.caja.querySelector(".wcl-ayuda-grande"); return e && getComputedStyle(e).backgroundColor; });
  const voz1 = await page.evaluate(() => window.__voz.join(" | "));
  comprobar(c1 && c1.rol === "alertdialog" && /Necesito ayuda/.test(c1.texto) && c1.cubre, "«Pedir ayuda a quien esté cerca» pone el aviso en toda la pantalla", JSON.stringify(c1));
  comprobar(c1 && c1.fondo === c2, "el aviso no destella: el color no cambia (epilepsia fotosensible)", c1 && c1.fondo + " → " + c2);
  comprobar(/Necesito ayuda/.test(voz1), "y la voz dice «Necesito ayuda»", voz1);
  await page.keyboard.press("Space"); await page.waitForTimeout(200);
  comprobar(await page.evaluate(() => !Winclus.caja.querySelector(".wcl-ayuda-grande")), "cualquier tecla lo para");
  await page.evaluate(() => { Winclus.pedirAyuda(); });
  await page.waitForTimeout(900);
  await page.evaluate(() => Winclus.clic());
  comprobar(await page.evaluate(() => !Winclus.caja.querySelector(".wcl-ayuda-grande")), "el gesto de clic de la cámara también lo para");
  await page.evaluate(() => { const i = Winclus.caja.getElementById("wcl-que"); i.value = "socorro"; i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
  await page.waitForTimeout(200);
  comprobar(await page.evaluate(() => !!Winclus.caja.querySelector(".wcl-ayuda-grande")), "decir «socorro» en la caja también pide ayuda");
  await page.evaluate(() => Winclus.pararAyuda());

  // --- Mis frases con mi voz ---
  await page.evaluate(() => { Winclus.vistaCompleta(true); Winclus.caja.getElementById("wcl-tab-oir").click(); const i = Winclus.caja.getElementById("wcl-grab-texto"); i.value = "Tengo sed"; Winclus.caja.getElementById("wcl-grabar").click(); });
  await page.waitForFunction(() => /Parar/.test(Winclus.caja.getElementById("wcl-grabar").textContent), null, { timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => Winclus.caja.getElementById("wcl-grabar").click());
  await page.waitForFunction(() => Winclus.grabaciones().length === 1, null, { timeout: 10000 }).catch(() => {});
  let g = await page.evaluate(() => ({ lista: Winclus.grabaciones(), ui: [...Winclus.caja.querySelectorAll("#wcl-grab-lista li")].map((l) => l.textContent) }));
  comprobar(g.lista.length === 1 && g.lista[0] === "Tengo sed" && g.ui.some((t) => /Tengo sed/.test(t)), "se graba «Tengo sed» con el micrófono y sale en la lista", JSON.stringify(g));

  await page.evaluate(() => { window.__voz = []; window.__play = 0; Winclus.hablarPersona("tengo sed."); });
  await page.waitForTimeout(300);
  let r = await page.evaluate(() => ({ play: window.__play, voz: window.__voz.join(" | ") }));
  comprobar(r.play === 1 && !/sed/i.test(r.voz), "al decir «tengo sed» suena la grabación con su voz, no la voz sintética", JSON.stringify(r));
  await page.evaluate(() => { window.__voz = []; window.__play = 0; Winclus.hablarPersona("Tengo frío"); });
  await page.waitForTimeout(200);
  r = await page.evaluate(() => ({ play: window.__play, voz: window.__voz.join(" | ") }));
  comprobar(r.play === 0 && /frío/.test(r.voz), "una frase sin grabar sigue con la voz sintética", JSON.stringify(r));

  await page.reload(); await page.waitForFunction(() => window.Winclus); await page.waitForTimeout(500);
  comprobar((await page.evaluate(() => Winclus.grabaciones())).join() === "Tengo sed", "la grabación sigue al volver a la página");

  await page.evaluate(() => { Winclus.abrir(); Winclus.vistaCompleta(true); Winclus.caja.getElementById("wcl-tab-oir").click(); [...Winclus.caja.querySelectorAll("#wcl-grab-lista button")].find((b) => /Borrar/.test(b.getAttribute("aria-label"))).click(); });
  await page.waitForTimeout(300);
  comprobar((await page.evaluate(() => Winclus.grabaciones())).length === 0, "«Borrar» la quita");

  // Restablecer todo también las borra
  await page.evaluate(() => { const i = Winclus.caja.getElementById("wcl-grab-texto"); i.value = "Gracias"; Winclus.caja.getElementById("wcl-grabar").click(); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => Winclus.caja.getElementById("wcl-grabar").click());
  await page.waitForFunction(() => Winclus.grabaciones().length === 1, null, { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => { Winclus.caja.getElementById("wcl-tab-mas").click(); const b = [...Winclus.caja.querySelectorAll("button")].find((x) => /Restablecer todo/.test(x.textContent)); b.click(); const c = [...Winclus.caja.querySelectorAll("button")].find((x) => /^Sí/.test(x.textContent.trim())); if (c) c.click(); });
  await page.waitForTimeout(400);
  await page.reload(); await page.waitForFunction(() => window.Winclus); await page.waitForTimeout(500);
  comprobar((await page.evaluate(() => Winclus.grabaciones())).length === 0, "«Restablecer todo» borra también las frases con su voz");

  comprobar(errores.length === 0, "sin errores de JavaScript", errores.slice(0, 2).join(" | "));
  await nav.close(); servidor.kill();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
