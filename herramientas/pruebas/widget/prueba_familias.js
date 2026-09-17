// Hoja de ruta por familias (docs/hoja-ruta-familias.md). Bloque 1, paridad con los overlays (0.6.3): tipo de letra
// («Legible» Verdana, «Para dislexia» OpenDyslexic servida desde winclus.com/fuentes), espacio entre renglones,
// texto alineado a la izquierda y zoom de toda la página; todo se aplica a la página anfitriona, no al widget, se
// guarda, aparece en «Lo que tienes activado» y se apaga con «Apagar todo lo activado». Uso: node prueba_familias.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const path = require("path");
const fs = require("fs");

const RAIZ = path.resolve(__dirname, "../../..");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto("file:///" + path.join(__dirname, "pagina-prueba.html").replace(/\\/g, "/"));
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-ver").click(); });
  const opc = (re) => page.evaluate((r) => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-ver .wcl-opc button")).find((b) => new RegExp(r).test(b.textContent)).click(); }, re);
  const mas = (clave, n) => page.evaluate(([k, veces]) => { const b = Winclus.caja.querySelector("#wcl-l-" + k).parentNode.querySelectorAll(".wcl-mm button")[1]; for (let i = 0; i < veces; i++) b.click(); }, [clave, n]);

  // --- tipo de letra ---
  await opc("^Legible$");
  let r = await page.evaluate(() => ({ clase: document.documentElement.classList.contains("wcl-letra-legible"), fuente: getComputedStyle(document.querySelector("p")).fontFamily, panel: getComputedStyle(Winclus.caja.querySelector(".wcl-panel h2")).fontFamily, guardado: JSON.parse(localStorage.getItem("winclus.ajustes")).letra }));
  comprobar(r.clase && /Verdana/.test(r.fuente) && !/Verdana/.test(r.panel) && r.guardado === "legible", "«Legible» pone Verdana en la página, no en el panel, y se guarda", JSON.stringify(r).slice(0, 200));
  await opc("Para dislexia");
  r = await page.evaluate(() => ({ clase: document.documentElement.classList.contains("wcl-letra-dislexia"), fuente: getComputedStyle(document.querySelector("p")).fontFamily, face: Array.from(document.styleSheets).some((s) => { try { return Array.from(s.cssRules).some((c) => c instanceof CSSFontFaceRule && /OpenDyslexic/.test(c.style.fontFamily) && /winclus\.com\/fuentes\/OpenDyslexic-Regular\.woff2/.test(c.style.getPropertyValue("src"))); } catch (e) { return false; } }) }));
  comprobar(r.clase && /OpenDyslexic/.test(r.fuente) && r.face, "«Para dislexia» pide OpenDyslexic desde winclus.com/fuentes (con Verdana de reserva)", JSON.stringify(r));
  comprobar(fs.existsSync(path.join(RAIZ, "web/fuentes/OpenDyslexic-Regular.woff2")) && fs.existsSync(path.join(RAIZ, "web/fuentes/OpenDyslexic-Bold.woff2")) && /Open Font License/.test(fs.readFileSync(path.join(RAIZ, "web/fuentes/LEEME.txt"), "utf8")), "las fuentes OpenDyslexic (regular y negrita) están en web/fuentes con su licencia OFL");
  await opc("La del sitio");

  // --- espacio entre renglones ---
  await mas("interlineado", 5);
  r = await page.evaluate(() => { const p = document.querySelector("p"), cs = getComputedStyle(p); return { clase: document.documentElement.classList.contains("wcl-interlineado"), lh: +(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(2), valor: Winclus.ajustes.interlineado }; });
  comprobar(r.clase && r.valor === 150 && r.lh === 1.5, "«Espacio entre renglones» al 150 % da interlineado 1,5 en la página", JSON.stringify(r));

  // --- alineación ---
  await page.evaluate(() => { document.querySelector("p").style.textAlign = "justify"; Winclus.caja.getElementById("wcl-alinear").click(); });
  r = await page.evaluate(() => getComputedStyle(document.querySelector("p")).textAlign);
  comprobar(r === "left", "«Texto alineado a la izquierda» quita el justificado", r);

  // --- zoom de toda la página ---
  await mas("zoom_pagina", 5);
  r = await page.evaluate(() => ({ zoom: document.body.style.zoom, valor: Winclus.ajustes.zoom_pagina, boton: Winclus.caja.querySelector(".wcl-btn").getBoundingClientRect().right <= window.innerWidth + 1, panel: Winclus.caja.querySelector(".wcl-panel").getBoundingClientRect().right <= window.innerWidth + 1 }));
  comprobar(r.zoom === "1.5" && r.valor === 150 && r.boton && r.panel, "«Zoom de toda la página» al 150 % escala el <body> y el widget sigue dentro de la pantalla", JSON.stringify(r));

  // --- lo activado y apagar todo ---
  r = await page.evaluate(() => { Winclus.caja.getElementById("wcl-tab-inicio").click(); return Array.from(Winclus.caja.querySelectorAll("#wcl-panel-inicio .wcl-activo li")).map((l) => l.textContent); });
  comprobar(["Texto a la izquierda", "Espacio entre renglones", "Zoom de la página"].every((t) => r.includes(t)), "«Lo que tienes activado» lista los tres ajustes nuevos", r.join(" | "));
  r = await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-inicio .wcl-big")).find((b) => /Apagar todo/.test(b.textContent)).click(); const h = document.documentElement; return { clases: ["wcl-letra-legible", "wcl-letra-dislexia", "wcl-alinear", "wcl-interlineado"].filter((c) => h.classList.contains(c)), zoom: document.body.style.zoom, a: Winclus.ajustes }; });
  comprobar(r.clases.length === 0 && r.zoom === "" && r.a.letra === "no" && !r.a.alinear && r.a.interlineado === 100 && r.a.zoom_pagina === 100, "«Apagar todo lo activado» los quita", JSON.stringify(r.clases) + " " + r.zoom);

  // --- se conservan al recargar ---
  await page.evaluate(() => { Winclus.ajustes.letra = "legible"; Winclus.ajustes.zoom_pagina = 120; localStorage.setItem("winclus.ajustes", JSON.stringify(Winclus.ajustes)); });
  await page.reload(); await page.waitForFunction(() => window.Winclus);
  r = await page.evaluate(() => ({ clase: document.documentElement.classList.contains("wcl-letra-legible"), zoom: document.body.style.zoom }));
  comprobar(r.clase && r.zoom === "1.2", "al recargar se aplican los ajustes guardados", JSON.stringify(r));

  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
