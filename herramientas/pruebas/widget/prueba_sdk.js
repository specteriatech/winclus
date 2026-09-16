// SDK: el web component <winclus-widget> carga el widget del mismo origen y pasa sus atributos (posición,
// cámara, idioma, relevo); la guía de integración existe y enlaza lo importante; el plugin de WordPress y el
// módulo de Drupal tienen los archivos y cabeceras esperados. Uso: node prueba_sdk.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores
const path = require("path");
const fs = require("fs");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-sdk.html").replace(/\\/g, "/");
const RAIZ = path.resolve(__dirname, "../../..");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1280, height: 800 } });
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus, null, { timeout: 15000 }).catch(() => {});
  const r = await page.evaluate(() => {
    if (!window.Winclus) return { cargado: false };
    const s = document.querySelector("script[data-winclus]"), b = Winclus.caja.querySelector(".wcl-btn").getBoundingClientRect();
    return { cargado: true, src: s.src, data: Object.assign({}, s.dataset), izquierda: b.left < 200, cam: !!Winclus.caja.querySelector("#wcl-panel-cara button"), texto: Winclus.caja.getElementById("wcl-panel-cara").textContent, relevo: /Centro de Relevo/.test(Winclus.caja.getElementById("wcl-panel-oir").textContent) };
  });
  comprobar(r.cargado && /widget\.js$/.test(r.src || ""), "<winclus-widget> carga widget.js del mismo origen", r.src);
  comprobar(r.cargado && r.data.posicion === "izquierda" && r.data.camara === "no" && r.data.idioma === "es-MX" && r.data.relevo === "no", "los atributos pasan como data-*", JSON.stringify(r.data));
  comprobar(r.cargado && r.izquierda, "posicion=\"izquierda\" pone el botón a la izquierda");
  comprobar(r.cargado && /desactivado en esta página/.test(r.texto) && !r.relevo, "camara=\"no\" y relevo=\"no\" se aplican");
  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();

  const guia = fs.readFileSync(path.join(RAIZ, "web/integrar.html"), "utf8");
  comprobar(/widget-0\.\d+\.\d+\.js/.test(guia) && /nonce/.test(guia) && /winclus-widget/.test(guia) && /WordPress/.test(guia) && /Drupal/.test(guia) && /GOV\.CO/i.test(guia) && /data-explicar/.test(guia) && /auditar\.js/.test(guia), "la guía de integración cubre versión fija, CSP, web component, WordPress, Drupal, GOV.CO, IA y Winclus Audit");
  const wp = fs.readFileSync(path.join(RAIZ, "integraciones/wordpress/winclus/winclus.php"), "utf8");
  comprobar(/Plugin Name: Winclus/.test(wp) && /wp_enqueue_script/.test(wp) && /data-posicion/.test(wp) && /register_setting/.test(wp), "el plugin de WordPress tiene cabecera, encola el script con data-* y ajustes");
  const dr = ["winclus.info.yml", "winclus.libraries.yml", "winclus.module"].map((f) => fs.readFileSync(path.join(RAIZ, "integraciones/drupal/winclus", f), "utf8"));
  comprobar(/type: module/.test(dr[0]) && /widget-0\.\d+\.\d+\.js/.test(dr[1]) && /hook_page_attachments|winclus_page_attachments/.test(dr[2]), "el módulo de Drupal declara la librería externa y la adjunta a todas las páginas");
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
