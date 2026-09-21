// ELA con ventilación (etapa 4B): ¿el control con la cara sigue funcionando con una mascarilla oronasal puesta?
// Cara simulada (camara-falsa.html) con MediaPipe de verdad; la mascarilla se dibuja sobre nariz, boca y barbilla con
// los puntos que el propio detector da de esa cara. Cada caso en una página nueva: primero el puntero (reposo y
// movimiento de la cabeza), después el parpadeo, para que un caso no contamine al siguiente. Comprueba que, con la
// mascarilla puesta desde el inicio o después, se detecta la cara, el puntero reposa al centro y sigue a la cabeza a
// los dos lados, y el parpadeo da la misma señal que sin mascarilla. Es una simulación: falta una mascarilla real
// (con tubo, correas, otro color) delante de una cámara. Uso: node prueba_mascarilla.js
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

async function caso(nav, conMascara, ponerDespues) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    localStorage.setItem("winclus.ajustes", JSON.stringify({ voz_activa: false, camara_ver: false, modo_puntero: "cabeza", menu_ojos: false }));
    localStorage.setItem("winclus.consentimiento_camara", JSON.stringify({ fecha: "prueba", version: "prueba" }));
  });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8765/pruebas/camara-falsa.html");
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => Winclus.activarCamara());
  await page.waitForFunction(() => Winclus.deteccion && Winclus.deteccion.inferencias > 10 && Winclus.deteccion.lm, null, { timeout: 60000 });
  const geo = await page.evaluate(() => {
    const lm = Winclus.deteccion.lm, P = (i) => [lm[i].x * 640, lm[i].y * 480];
    const ojo = (a, b) => { const p = P(a), q = P(b), rx = Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.62; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, rx, rx * 0.55]; };
    const iz = P(234), de = P(454), puente = P(6), barbilla = P(152), bajoIz = P(172), bajoDe = P(397);
    return { mascara: [[iz[0] + 10, puente[1]], [puente[0], puente[1] - 12], [de[0] - 10, puente[1]], [bajoDe[0], bajoDe[1]], [barbilla[0], barbilla[1] + 14], [bajoIz[0], bajoIz[1]]], ojos: [ojo(33, 133), ojo(362, 263)] };
  });
  if (conMascara && !ponerDespues) {   // ya lleva la mascarilla al encender la cámara
    await page.evaluate((m) => { Winclus.desactivarCamara(); sim.mascara = m; }, geo.mascara);
    await page.waitForTimeout(500);
    await page.evaluate(() => Winclus.activarCamara());
    await page.waitForFunction(() => Winclus.deteccion.inferencias > 10, null, { timeout: 60000 });
  }
  if (ponerDespues) await page.evaluate((m) => { sim.mascara = m; }, geo.mascara);
  await page.waitForTimeout(2500);
  const r = await page.evaluate(async () => {
    const m = []; const t0 = performance.now(); while (performance.now() - t0 < 1500) { m.push(!!Winclus.deteccion.cara); await new Promise((s) => setTimeout(s, 50)); }
    return m.filter(Boolean).length / m.length;
  });
  const pos = () => page.evaluate(() => [Math.round(Winclus.puntero.x), Math.round(Winclus.puntero.y)]);
  const p0 = await pos();
  await page.evaluate(() => { sim.dx = -40; }); await page.waitForTimeout(1500); const p1 = await pos();
  await page.evaluate(() => { sim.dx = 40; }); await page.waitForTimeout(1500); const p2 = await pos();
  await page.evaluate(() => { sim.dx = 0; }); await page.waitForTimeout(1500); const p3 = await pos();
  const parp = await page.evaluate(async (ojos) => {
    const media = async () => { let s = 0, n = 0; const t0 = performance.now(); while (performance.now() - t0 < 500) { const b = Winclus.deteccion.bs || {}; s += ((b.eyeBlinkLeft || 0) + (b.eyeBlinkRight || 0)) / 2; n++; await new Promise((r) => setTimeout(r, 40)); } return s / n; };
    sim.ojos = ojos; const a = await media(); sim.parpadeo = true; await new Promise((r) => setTimeout(r, 150)); const c = await media(); sim.parpadeo = false;
    return [+a.toFixed(2), +c.toFixed(2)];
  }, geo.ojos);
  await ctx.close();
  return { cara: Math.round(r * 100) + "%", reposo: p0, izquierda: p1, derecha: p2, vuelta: p3, parpadeo_abiertos_cerrados: parp };
}

(async () => {
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 700));
  const nav = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const base = await caso(nav, false);
  const bien = (r) => parseInt(r.cara, 10) >= 95 && Math.abs(r.reposo[0] - 640) < 160 && r.izquierda[0] > r.reposo[0] + 200 && r.derecha[0] < r.reposo[0] - 200;
  const senal = (r) => r.parpadeo_abiertos_cerrados[1] - r.parpadeo_abiertos_cerrados[0];
  comprobar(bien(base) && senal(base) > 0.1, "sin mascarilla: cara detectada, puntero al centro y a los dos lados, parpadeo con señal", JSON.stringify(base));
  for (const [nombre, despues] of [["con la mascarilla puesta desde el inicio", false], ["con la mascarilla puesta después", true]]) {
    const r = await caso(nav, true, despues);
    comprobar(bien(r), nombre + ": se detecta la cara, el puntero reposa al centro y sigue a la cabeza a los dos lados", JSON.stringify({ cara: r.cara, reposo: r.reposo, izquierda: r.izquierda, derecha: r.derecha }));
    comprobar(senal(r) > senal(base) * 0.7, nombre + ": el parpadeo da la misma señal que sin mascarilla (el clic por parpadeo sirve)", senal(r).toFixed(2) + " frente a " + senal(base).toFixed(2));
  }
  await nav.close(); servidor.kill();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
