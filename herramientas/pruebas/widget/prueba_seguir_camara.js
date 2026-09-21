// La cámara sigue encendida al pasar de una página a otra (0.6.15). Antes, la cámara se apagaba al salir de cada
// página y nada la volvía a encender: quien no tiene manos perdía el control a cada enlace. Ahora la página siguiente
// del mismo sitio la reanuda, pero SOLO con las tres cosas a la vez: consentimiento de Winclus, permiso del navegador
// ya concedido y la cámara encendida al salir. Se comprueba también cada caso en que NO debe encenderse.
// Cámara simulada de Chromium. Uso: node prueba_seguir_camara.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }
const ORIGEN = "http://127.0.0.1:8765";

(async () => {
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 700));
  const nav = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const errores = [];

  async function contexto(permiso) {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
    if (permiso) await ctx.grantPermissions(["camera"], { origin: ORIGEN });
    await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
    await ctx.addInitScript(() => { window.__voz = []; speechSynthesis.speak = (u) => { window.__voz.push(u.text); setTimeout(() => { if (u.onend) u.onend({}); }, 5); }; });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errores.push(String(e)));
    return { ctx, page };
  }
  const video = (page) => page.evaluate(() => { const v = Winclus.caja.querySelector("video.wcl-video"); return !!(v && v.srcObject && v.srcObject.active); });
  const ir = async (page, url, espera) => { await page.goto(ORIGEN + url); await page.waitForFunction(() => window.Winclus); await page.waitForTimeout(espera || 6000); };
  const encender = async (page) => {
    await page.evaluate(() => Winclus.activarCamara());
    try { await page.waitForFunction(() => { const v = Winclus.caja.querySelector("video.wcl-video"); return v && v.srcObject && v.srcObject.active; }, null, { timeout: 60000 }); }
    catch (e) { throw new Error("no se encendió: " + await page.evaluate(() => Winclus.caja.getElementById("wcl-estado").textContent)); }
  };
  const consentir = (page) => page.evaluate(() => localStorage.setItem("winclus.consentimiento_camara", JSON.stringify({ fecha: "prueba", version: "prueba" })));

  // 1. Caso principal: encendida en una página, sigue encendida en la siguiente y al recargar
  let { ctx, page } = await contexto(true);
  await ir(page, "/index.html", 500); await consentir(page);
  comprobar(!(await video(page)), "al entrar por primera vez la cámara no se enciende sola");
  await encender(page);
  await ir(page, "/guia.html", 100);
  const volvio = await page.waitForFunction(() => { const v = Winclus.caja.querySelector("video.wcl-video"); return v && v.srcObject && v.srcObject.active; }, null, { timeout: 30000 }).then(() => true, () => false);
  comprobar(volvio, "tras seguir un enlace, la cámara vuelve a encenderse sola");
  await page.waitForTimeout(300);
  const aviso = await page.evaluate(() => [...Winclus.caja.querySelectorAll("*")].some((e) => e.children.length === 0 && /Cámara encendida otra vez, como la dejaste/.test(e.textContent) && getComputedStyle(e).display !== "none"));
  comprobar(aviso, "y se ve en pantalla «Cámara encendida otra vez, como la dejaste.»");
  const voz = await page.evaluate(() => window.__voz.join(" "));
  comprobar(/se ha vuelto a encender sola porque la dejaste encendida/.test(voz) && /Apagar cámara/.test(voz), "y lo dice en voz alta, con cómo apagarla", voz.slice(0, 90));
  await page.waitForTimeout(5000);
  await page.reload(); await page.waitForFunction(() => window.Winclus); await page.waitForTimeout(6000);
  comprobar(await video(page), "al recargar la página, también");

  // 2. Apagarla a mano la olvida: la página siguiente no la enciende
  await page.evaluate(() => Winclus.desactivarCamara());
  await ir(page, "/manual.html");
  comprobar(!(await video(page)), "si la apagas con «Apagar cámara», la página siguiente no la enciende");

  // 3. Con el interruptor «Seguir con la cámara al cambiar de página» apagado, no se reanuda
  await encender(page);
  await page.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-cara").click(); Winclus.caja.getElementById("wcl-camara_seguir").click(); Winclus.cerrar(); });
  const sw = await page.evaluate(() => ({ marcado: Winclus.caja.getElementById("wcl-camara_seguir").getAttribute("aria-checked"), ayuda: !!Winclus.caja.getElementById("wcl-camara_seguir").closest(".wcl-fila") }));
  await ir(page, "/glosario.html");
  comprobar(sw.marcado === "false" && !(await video(page)), "con el interruptor apagado, la cámara no se reanuda", JSON.stringify(sw));
  await page.evaluate(() => { Winclus.ajustes.camara_seguir = true; });

  // 4. «Restablecer todo» también la olvida
  await page.evaluate(() => { localStorage.setItem("winclus.camara_seguir", "true"); });
  await page.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-mas").click(); const b = [...Winclus.caja.querySelectorAll("button")].find((x) => /Restablecer todo/.test(x.textContent)); b.click(); const c = [...Winclus.caja.querySelectorAll("button")].find((x) => /Sí, restablecer|Sí, borrar|Confirmar|Sí/.test(x.textContent) && x !== b); if (c) c.click(); });
  const tras = await page.evaluate(() => localStorage.getItem("winclus.camara_seguir"));
  comprobar(tras === null, "«Restablecer todo» borra el recuerdo de la cámara", String(tras));
  await ctx.close();

  // 5. Sin consentimiento de Winclus, nunca se enciende sola (aunque el recuerdo exista)
  ({ ctx, page } = await contexto(true));
  await ir(page, "/index.html", 500);
  await page.evaluate(() => localStorage.setItem("winclus.camara_seguir", "true"));
  await ir(page, "/guia.html");
  comprobar(!(await video(page)), "sin el consentimiento de Winclus no se enciende sola");
  await ctx.close();

  // 6. Sin el permiso del navegador ya concedido, no se enciende (no se pregunta sin que la persona lo pida)
  ({ ctx, page } = await contexto(false));
  await ir(page, "/index.html", 500); await consentir(page);
  await page.evaluate(() => localStorage.setItem("winclus.camara_seguir", "true"));
  const pedido = [];
  await page.exposeFunction("__pedirCamara", () => pedido.push(1));
  await ir(page, "/guia.html");
  const estado = await page.evaluate(() => navigator.permissions.query({ name: "camera" }).then((p) => p.state));
  comprobar(estado !== "granted" && !(await video(page)), "si el navegador no ha concedido ya el permiso, no se enciende ni se pregunta", "permiso: " + estado);
  await ctx.close();

  comprobar(errores.length === 0, "sin errores de JavaScript", errores.slice(0, 2).join(" | "));
  await nav.close(); servidor.kill();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
