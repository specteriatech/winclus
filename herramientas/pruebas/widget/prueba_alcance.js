// «Ajustar el puntero a lo que puedo mover» (0.6.18), para la ELA que avanza y para el cansancio. Con la cara
// simulada y MediaPipe de verdad: la persona mueve poco la cabeza durante la medición; Winclus sube la velocidad y,
// después, ese mismo movimiento pequeño cruza la pantalla (antes no). Si el movimiento es mínimo, ni al máximo
// alcanza y Winclus propone los ojos o un pulsador. Sin cámara, lo dice. Uso: node prueba_alcance.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

async function nueva(nav) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    localStorage.setItem("winclus.ajustes", JSON.stringify({ voz_activa: false, camara_ver: false, modo_puntero: "cabeza", menu_ojos: false, velocidad: 20, gestos_activos: false }));
    localStorage.setItem("winclus.consentimiento_camara", JSON.stringify({ fecha: "prueba", version: "prueba" }));
  });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8765/pruebas/camara-falsa.html");
  await page.waitForFunction(() => window.Winclus);
  return { ctx, page };
}
// Lleva la cabeza de un lado al otro con la amplitud dada y devuelve cuánto se ha movido el puntero
async function barrer(page, a) {
  await page.evaluate((x) => { sim.dx = -x; }, a); await page.waitForTimeout(1200);
  const p0 = await page.evaluate(() => Winclus.puntero.x);
  await page.evaluate((x) => { sim.dx = x; }, a); await page.waitForTimeout(1500);
  const p1 = await page.evaluate(() => Winclus.puntero.x);
  return Math.abs(p1 - p0);
}
async function medir(page, a) {   // durante los 8 s de la medición, la cabeza va y viene con esa amplitud
  const ok = await page.evaluate(() => Winclus.ajustarAlcance());
  const t0 = Date.now();
  while (Date.now() - t0 < 8600) {
    const k = Math.floor((Date.now() - t0) / 700) % 4;
    await page.evaluate(([x, k]) => { sim.dx = [-x, x, 0, 0][k]; sim.dy = [0, 0, -x * 0.7, x * 0.7][k]; }, [a, k]);
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => { sim.dx = 0; sim.dy = 0; });
  await page.waitForTimeout(400);
  return ok;
}

(async () => {
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 700));
  const nav = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const errores = [];

  // Sin cámara: lo dice y no hace nada
  let { ctx, page } = await nueva(nav);
  page.on("pageerror", (e) => errores.push(String(e)));
  const sin = await page.evaluate(() => ({ ok: Winclus.ajustarAlcance(), estado: Winclus.caja.getElementById("wcl-estado").textContent }));
  comprobar(sin.ok === false && /activa la cámara/.test(sin.estado), "sin cámara, dice que primero hay que activarla", sin.estado.slice(0, 70));
  await page.evaluate(() => Winclus.activarCamara());
  await page.waitForFunction(() => Winclus.deteccion && Winclus.deteccion.inferencias > 10, null, { timeout: 60000 });
  await page.waitForTimeout(2500);

  // Movimiento pequeño (5 px de la foto): a la velocidad de siempre no cruza la pantalla
  const antes = await barrer(page, 5);
  const ok = await medir(page, 5);
  const v = await page.evaluate(() => Winclus.ajustes.velocidad);
  const despues = await barrer(page, 5);
  comprobar(ok && v > 20, "con poco movimiento, la medición sube la velocidad", "velocidad 20 → " + v);
  comprobar(antes < 1280 * 0.5 && despues > 1280 * 0.6, "y ese mismo movimiento pequeño pasa a cruzar la pantalla", "recorrido " + Math.round(antes) + " px → " + Math.round(despues) + " px");
  await ctx.close();

  // Movimiento mínimo: ni al máximo alcanza → propone los ojos o un pulsador
  ({ ctx, page } = await nueva(nav));
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.evaluate(() => Winclus.activarCamara());
  await page.waitForFunction(() => Winclus.deteccion && Winclus.deteccion.inferencias > 10, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await medir(page, 1.5);
  const r = await page.evaluate(() => { const e = Winclus.caja.querySelector(".wcl-elegir"); return { v: Winclus.ajustes.velocidad, opciones: e && e.style.display === "block" ? [...e.querySelectorAll("button")].map((b) => b.textContent) : [] }; });
  comprobar(r.v === 60 && r.opciones.some((t) => /Con los ojos/.test(t)) && r.opciones.some((t) => /Con un pulsador/.test(t)), "con movimiento mínimo, pone el máximo y propone los ojos o un pulsador", JSON.stringify(r));
  await page.evaluate(() => [...Winclus.caja.querySelectorAll(".wcl-elegir button")].find((b) => /Con un pulsador/.test(b.textContent)).click());
  comprobar(await page.evaluate(() => Winclus.ajustes.barrido === true), "elegir «Con un pulsador» enciende el barrido");
  await ctx.close();

  comprobar(errores.length === 0, "sin errores de JavaScript", errores.slice(0, 2).join(" | "));
  await nav.close(); servidor.kill();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
