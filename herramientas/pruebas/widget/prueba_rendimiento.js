// Rendimiento: la inferencia de la cara va a la tasa de la cámara (cuadros nuevos), no a la del refresco
// de pantalla, y en modo ahorro a 15 por segundo como mucho. Usa el servidor local (servidor.js) y la
// cámara simulada (camara-falsa.html, 30 cuadros por segundo) con el detector de web/mediapipe.
// Uso: node prueba_rendimiento.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores
const { spawn } = require("child_process");
const path = require("path");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  const nav = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    localStorage.setItem("winclus.ajustes", JSON.stringify({ voz_activa: false, camara_ver: false }));
    localStorage.setItem("winclus.consentimiento_camara", JSON.stringify({ fecha: "prueba", version: "prueba" }));
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("error de página:", String(e)));
  await page.goto("http://127.0.0.1:8765/pruebas/camara-falsa.html");
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => Winclus.abrir());
  await page.evaluate(() => Winclus.vistaCompleta(true));   // las pestañas salen con «Ver más opciones»
  await page.click("#wcl-tab-cara");
  await page.evaluate(() => Winclus.activarCamara());
  try {
    await page.waitForFunction(() => Winclus.deteccion && Winclus.deteccion.inferencias > 5, null, { timeout: 60000 });
  } catch (e) {
    console.log("no arrancó la cámara simulada: " + (await page.evaluate(() => Winclus.caja.getElementById("wcl-estado").textContent)));
    await nav.close(); servidor.kill(); process.exit(1);
  }

  async function medir(ms) {
    return page.evaluate(async (ms) => {
      const v = Winclus.caja.querySelector(".wcl-video");
      const q0 = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality().totalVideoFrames : -1;
      const i0 = Winclus.deteccion.inferencias, t0 = performance.now();
      let raf = 0; const cuenta = () => { raf++; if (performance.now() - t0 < ms) requestAnimationFrame(cuenta); }; requestAnimationFrame(cuenta);
      await new Promise((r) => setTimeout(r, ms));
      const s = (performance.now() - t0) / 1000;
      const q1 = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality().totalVideoFrames : -1;
      return { inferencias: (Winclus.deteccion.inferencias - i0) / s, refrescos: raf / s, cuadros: q0 >= 0 ? (q1 - q0) / s : -1, rvfc: "requestVideoFrameCallback" in v };
    }, ms);
  }
  const normal = await medir(3000);
  console.log("normal: " + normal.inferencias.toFixed(1) + " inferencias/s, " + normal.refrescos.toFixed(1) + " refrescos/s, " + (normal.cuadros >= 0 ? normal.cuadros.toFixed(1) : "?") + " cuadros/s de cámara, rVFC=" + normal.rvfc);
  comprobar(normal.rvfc, "el navegador avisa de cada cuadro nuevo (requestVideoFrameCallback)");
  if (normal.cuadros >= 0) comprobar(normal.inferencias <= normal.cuadros * 1.15 + 1, "no se infiere más veces que cuadros entrega la cámara", normal.inferencias.toFixed(1) + " ≤ " + normal.cuadros.toFixed(1));
  else comprobar(normal.inferencias <= 32, "no se infiere más de ~30 veces por segundo (cámara a 30)", normal.inferencias.toFixed(1) + "/s");

  await page.evaluate(() => { Winclus.ajustes.ahorro = true; });
  await page.waitForTimeout(300);
  const ahorro = await medir(3000);
  console.log("ahorro: " + ahorro.inferencias.toFixed(1) + " inferencias/s");
  // En un equipo lento (CI sin GPU) ni el modo normal llega a 15/s: entonces basta con que el ahorro no infiera más que el normal
  comprobar(ahorro.inferencias <= 16 && (ahorro.inferencias >= 5 || ahorro.inferencias <= normal.inferencias + 0.5), "en modo ahorro se infiere unas 15 veces por segundo (o no más que en modo normal si el equipo es lento)", ahorro.inferencias.toFixed(1) + "/s frente a " + normal.inferencias.toFixed(1) + "/s en normal");
  await page.evaluate(() => { Winclus.ajustes.ahorro = false; });
  const sw = await page.evaluate(() => !!Winclus.caja.getElementById("wcl-ahorro"));
  comprobar(sw, "hay interruptor «Gastar menos batería» (modo ahorro) en el panel");

  await nav.close();
  servidor.kill();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
