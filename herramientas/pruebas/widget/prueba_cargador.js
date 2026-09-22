// Cargador ligero (22-sep-2026, 0.7.0): widget.js pesa unos 3 KB y trae winclus-widget.min.js cuando la página ya se pintó
// (después de «load»), o enseguida si la persona ya usa Winclus (ajustes guardados, cámara que sigue, perfil en el enlace).
// Pasa los atributos data-* y el nonce, Alt+Mayús+W abre el panel aunque el widget aún no haya llegado, cargarlo dos
// veces no duplica nada, y la versión del cargador es la del widget. Uso: node prueba_cargador.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const path = require("path");
const fs = require("fs");

const WEB = path.resolve(__dirname, "../../../web");
const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
const HOSTIL = "file:///" + path.resolve(__dirname, "pagina-hostil.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const cargador = fs.readFileSync(path.join(WEB, "widget.js"), "utf8"), completo = fs.readFileSync(path.join(WEB, "winclus-widget.js"), "utf8"), min = fs.readFileSync(path.join(WEB, "winclus-widget.min.js"), "utf8");
  const kb = Buffer.byteLength(cargador, "utf8") / 1024;
  comprobar(kb < 6, "el cargador pesa menos de 6 KB", kb.toFixed(1) + " KB");
  const v = (s) => (s.match(/var VERSION = "([^"]+)"/) || [])[1];
  comprobar(v(cargador) && v(cargador) === v(completo) && new RegExp("Winclus widget " + v(completo).replace(/\./g, "\\.")).test(min.slice(0, 200)), "cargador, código legible y minificado llevan la misma versión", v(cargador) + " / " + v(completo) + " / " + min.slice(0, 40));
  comprobar(/Apache 2\.0/.test(min.slice(0, 300)) && /winclus-widget\.js/.test(min.slice(0, 300)), "el minificado conserva la licencia y dice dónde está el código legible");
  comprobar(Buffer.byteLength(min, "utf8") < Buffer.byteLength(completo, "utf8") * 0.75, "el minificado pesa al menos un 25 % menos que el legible", Math.round(Buffer.byteLength(min, "utf8") / 1024) + " frente a " + Math.round(Buffer.byteLength(completo, "utf8") / 1024) + " KB");

  const nav = await chromium.launch();
  // 1. sin ajustes guardados: el widget llega después de «load»
  let ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  let page = await ctx.newPage();
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(PAGINA, { waitUntil: "domcontentloaded" });
  const alPrincipio = await page.evaluate(() => ({ cargador: !!window.WinclusCargador, widget: !!window.Winclus, pedido: !!document.querySelector("script[data-winclus]") }));
  await page.waitForFunction(() => window.Winclus, null, { timeout: 15000 });
  const despues = await page.evaluate(() => ({ version: Winclus.version, src: document.querySelector("script[data-winclus]").getAttribute("src"), boton: !!Winclus.caja.querySelector(".wcl-btn"), cargador: WinclusCargador.version }));
  comprobar(alPrincipio.cargador && !alPrincipio.widget, "en DOMContentLoaded solo está el cargador; el widget todavía no", JSON.stringify(alPrincipio));
  comprobar(/winclus-widget\.min\.js$/.test(despues.src) && despues.boton && despues.version === despues.cargador, "después de cargar la página llega winclus-widget.min.js del mismo origen y monta el botón", JSON.stringify(despues));
  await ctx.close();

  // 2. con ajustes guardados: se pide enseguida, sin esperar a «load»
  ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  await ctx.addInitScript(() => { localStorage.setItem("winclus.ajustes", JSON.stringify({ texto: 150 })); });
  page = await ctx.newPage();
  await page.goto(PAGINA, { waitUntil: "domcontentloaded" });
  const conAjustes = await page.evaluate(() => !!document.querySelector("script[data-winclus]"));
  await page.waitForFunction(() => window.Winclus);
  const texto = await page.evaluate(() => Winclus.ajustes.texto);
  comprobar(conAjustes && texto === 150, "quien ya usa Winclus no espera: el widget se pide antes de «load» y aplica sus ajustes", conAjustes + " / texto " + texto);
  await ctx.close();

  // 3. atajo antes de que llegue: Alt+Mayús+W pide el widget y abre el panel al llegar
  ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  await ctx.route("**/winclus-widget.min.js", async (route) => { await new Promise((r) => setTimeout(r, 800)); route.continue(); });   // red lenta
  page = await ctx.newPage();
  await page.goto(PAGINA, { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Alt+Shift+KeyW");
  const pedidoPorAtajo = await page.evaluate(() => !!document.querySelector("script[data-winclus]") && !window.Winclus);
  await page.waitForFunction(() => window.Winclus && Winclus.caja.querySelector(".wcl-panel.abierto"), null, { timeout: 15000 });
  comprobar(pedidoPorAtajo, "Alt+Mayús+W antes de que llegue el widget lo pide y abre el panel cuando llega");
  await ctx.close();

  // 4. atributos data-* y nonce pasan al widget; CSP estricta de la página hostil
  ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  page = await ctx.newPage();
  const csp = []; page.on("console", (m) => { if (/Content Security Policy/.test(m.text())) csp.push(m.text().slice(0, 120)); });
  await page.goto(HOSTIL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { const s = document.querySelector('script[src*="widget.js"]'); s.dataset.posicion = "izquierda"; s.dataset.camara = "no"; });   // antes de que el cargador pida el widget (llega tras load)
  await page.waitForFunction(() => window.Winclus, null, { timeout: 15000 });
  const hostil = await page.evaluate(() => { const s = document.querySelector("script[data-winclus]"); return { posicion: s.dataset.posicion, camara: s.dataset.camara, nonce: s.nonce, lado: getComputedStyle(Winclus.caja.querySelector(".wcl-btn")).left !== "auto", tabCara: !!(Winclus.caja.querySelector("#wcl-tab-cara") && Winclus.caja.querySelector("#wcl-tab-cara").offsetParent) || /Activar cámara/.test(Winclus.caja.textContent) }; });
  comprobar(hostil.posicion === "izquierda" && hostil.camara === "no" && hostil.nonce === "prueba123" && !hostil.tabCara, "los atributos data-* y el nonce del <script> pasan al widget completo", JSON.stringify(hostil));
  comprobar(csp.length === 0, "con CSP estricta con nonce no hay violaciones al cargar en dos pasos", csp.join(" | "));

  // 5. dos cargadores en la misma página: un solo widget
  await page.evaluate(() => new Promise((r) => { const s = document.createElement("script"); s.src = document.querySelector('script[src*="widget.js"]').src; s.onload = r; s.onerror = r; document.body.appendChild(s); }));
  await page.waitForTimeout(500);
  const dobles = await page.evaluate(() => ({ scripts: document.querySelectorAll("script[data-winclus]").length, botones: document.querySelectorAll(".wcl-root").length }));
  comprobar(dobles.scripts === 1 && dobles.botones === 1, "cargar widget.js dos veces no duplica el widget", JSON.stringify(dobles));
  await ctx.close();

  comprobar(errores.length === 0, "sin errores de JavaScript", errores.join(" | "));
  await nav.close();
  console.log(fallos ? "\n" + fallos + " comprobación(es) fallida(s)" : "\nTodo bien");
  process.exit(fallos ? 1 : 0);
})();
