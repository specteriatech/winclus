// Aislamiento: en una página con estilos agresivos (button{all:unset}, fuentes gigantes) y CSP estricta con
// nonce, el widget (en shadow root) conserva su aspecto y sus <style> llevan el nonce del <script>.
// Uso: node prueba_aislamiento.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-hostil.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errores = [];
  await page.addInitScript(() => { window.__csp = []; document.addEventListener("securitypolicyviolation", (e) => { window.__csp.push(e.violatedDirective + " " + (e.sourceFile || "").replace(/^.*\//, "") + ":" + e.lineNumber + " " + (e.sample || "").slice(0, 60)); }); });
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus, null, { timeout: 15000 }).catch(() => {});
  const cargado = await page.evaluate(() => !!window.Winclus);
  comprobar(cargado, "el widget carga con CSP estricta (script con nonce)");
  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  const violaciones = await page.evaluate(() => window.__csp);
  comprobar(violaciones.length === 0, "sin violaciones de CSP al cargar", violaciones.join(" | "));
  if (!cargado) { await nav.close(); process.exit(1); }

  const nonces = await page.evaluate(() => {
    const doc = Array.from(document.head.querySelectorAll("style")).filter((s) => /wcl-/.test(s.textContent)).map((s) => s.nonce || "");
    const som = Array.from(Winclus.caja.querySelectorAll("style")).map((s) => s.nonce || "");
    return { doc, som, sombra: Winclus.caja !== document && !!Winclus.caja.host };
  });
  comprobar(nonces.sombra, "las piezas del widget están en un shadow root");
  comprobar(nonces.doc.length >= 2 && nonces.doc.every((n) => n === "prueba123"), "los <style> del documento llevan el nonce", JSON.stringify(nonces.doc));
  comprobar(nonces.som.length >= 2 && nonces.som.every((n) => n === "prueba123"), "los <style> del shadow root llevan el nonce", JSON.stringify(nonces.som));

  await page.evaluate(() => Winclus.abrir());
  await page.waitForTimeout(200);
  const estilos = await page.evaluate(() => {
    const cs = (s) => getComputedStyle(Winclus.caja.querySelector(s));
    const b = cs(".wcl-btn"), sw = cs(".wcl-sw"), cab = cs(".wcl-cab"), est = cs(".wcl-estado"), sitio = getComputedStyle(document.getElementById("boton-sitio"));
    return { btn: { w: b.width, h: b.height, radio: b.borderRadius, bg: b.backgroundColor }, sw: { bg: sw.backgroundColor, w: sw.width }, cab: { fs: cab.fontSize, color: cab.color }, est: { fs: est.fontSize, color: est.color }, sitio: { bg: sitio.backgroundColor } };
  });
  comprobar(estilos.btn.w === "60px" && estilos.btn.h === "60px" && estilos.btn.radio !== "0px", "el botón flotante conserva tamaño y forma pese a button{all:unset}", JSON.stringify(estilos.btn));
  comprobar(estilos.sw.bg === "rgb(136, 146, 166)" && estilos.sw.w === "46px", "el interruptor conserva su color y tamaño", JSON.stringify(estilos.sw));
  comprobar(estilos.est.fs !== "40px" && estilos.est.color !== "rgb(255, 0, 0)", "los textos del panel no heredan los 40 px rojos del sitio", JSON.stringify(estilos.est));
  comprobar(estilos.sitio.bg === "rgba(0, 0, 0, 0)", "el botón del sitio sigue con sus estilos (el widget no le pone los suyos)", JSON.stringify(estilos.sitio));

  // modo oscuro dentro del shadow root: el panel se ve normal y sigue en pantalla
  await page.evaluate(() => { Winclus.caja.getElementById("wcl-oscuro").click(); });
  await page.waitForTimeout(150);
  const osc = await page.evaluate(() => { const r = Winclus.caja.querySelector(".wcl-btn").getBoundingClientRect(); return { x: r.left, y: r.top, filtro: getComputedStyle(Winclus.caja.querySelector(".wcl-panel")).filter, html: getComputedStyle(document.documentElement).filter }; });
  comprobar(osc.x > 0 && osc.y > 0 && /invert/.test(osc.filtro) && /invert/.test(osc.html), "modo oscuro: la página se invierte y el panel se des-invierte dentro del shadow root", JSON.stringify(osc));
  await page.evaluate(() => Winclus.teclado());
  await page.waitForTimeout(200);
  const violacionesUso = await page.evaluate(() => window.__csp);
  comprobar(violacionesUso.length === 0, "sin violaciones de CSP al abrir panel, modo oscuro y teclado", violacionesUso.join(" | "));

  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
