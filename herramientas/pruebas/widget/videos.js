// Graba vídeos cortos (webm, sin audio) del widget en acción con Chromium: barrido con un pulsador, tablero de
// pictogramas y «Explicar en fácil». Salen en web/video/ y se enlazan desde demo.html como evidencia visual.
// Uso: node videos.js
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const RAIZ = path.resolve(__dirname, "../../..");
const SALIDA = path.join(RAIZ, "web/video");
const PAGINA = "file:///" + path.resolve(__dirname, "pagina-tramite.html").replace(/\\/g, "/");

async function grabar(nombre, ajustes, pasos) {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 960, height: 600 }, recordVideo: { dir: SALIDA, size: { width: 960, height: 600 } } });
  await ctx.addInitScript((a) => localStorage.setItem("winclus.ajustes", JSON.stringify(a)), Object.assign({ voz_activa: false }, ajustes));
  const page = await ctx.newPage();
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.waitForTimeout(600);
  await pasos(page);
  await page.waitForTimeout(800);
  const video = page.video();
  await ctx.close();
  const tmp = await video.path();
  const final = path.join(SALIDA, nombre + ".webm");
  fs.renameSync(tmp, final);
  await nav.close();
  console.log(nombre + ".webm " + Math.round(fs.statSync(final).size / 1024) + " KB");
}

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  await grabar("barrido", { barrido: true, barrido_ms: 700 }, async (page) => {
    await page.evaluate(() => { const c = document.createElement("input"); c.id = "campo"; c.placeholder = "Nombre"; document.querySelector("main").appendChild(c); });
    await page.waitForFunction(() => document.getElementById("campo").classList.contains("wcl-barrido"), null, { timeout: 15000 });
    await page.keyboard.press("Space");
    await page.waitForTimeout(1600);
    await page.keyboard.press("Space");   // fila
    await page.waitForTimeout(1500);
    await page.keyboard.press("Space");   // tecla
    await page.waitForTimeout(1500);
  });
  await grabar("pictogramas", {}, async (page) => {
    await page.evaluate(() => { Winclus.abrir(); Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /pictogramas/i.test(b.textContent)).click(); });
    await page.waitForTimeout(1500);
    const toca = async (cat, n) => { await page.evaluate((c) => { Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .cats button")).find((b) => b.textContent === c).click(); }, cat); await page.waitForTimeout(700); await page.evaluate((x) => { Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .rejilla .picto")).find((b) => b.getAttribute("aria-label") === x).click(); }, n); await page.waitForTimeout(900); };
    await toca("Personas", "yo"); await toca("Acciones", "necesito"); await toca("Básico", "ayuda");
    await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .acciones button")).find((b) => b.textContent === "Decir").click(); });
    await page.waitForTimeout(1200);
  });
  await grabar("lenguaje-claro", {}, async (page) => {
    await page.evaluate(() => Winclus.orden("lectura fácil"));
    await page.waitForTimeout(1500);
    await page.evaluate(() => Winclus.caja.querySelector(".wcl-limpia-texto").scrollTo({ top: 300, behavior: "smooth" }));
    await page.waitForTimeout(1500);
    await page.evaluate(() => Winclus.caja.querySelector('[data-a="facil"]').click());
    await page.waitForTimeout(1500);
  });
})();
