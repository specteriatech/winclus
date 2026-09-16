// Corrección de color: los filtros SVG existen de verdad (SVGFilterElement, no HTMLUnknownElement) y cada
// uno cambia los píxeles de la página. Nació el 16-sep-2026: el <svg> se creaba con createElement y los
// filtros nunca habían funcionado. Uso: node prueba_daltonismo.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 600, height: 400 } });
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { const d = document.createElement("div"); d.style.cssText = "position:fixed;left:0;top:0;width:100px;height:100px;background:rgb(255,0,0);z-index:5"; document.body.appendChild(d); });
  const tipos = await page.evaluate(() => ["protan", "deutan", "tritan", "gris"].map((n) => { const f = document.getElementById("wcl-f-" + n); return n + ":" + (f ? f.constructor.name : "no existe"); }));
  comprobar(tipos.every((t) => /SVGFilterElement/.test(t)), "los cuatro filtros son SVGFilterElement", tipos.join(", "));
  const base = await page.screenshot({ clip: { x: 10, y: 10, width: 4, height: 4 } });
  for (const [nombre, etiqueta] of [["protan", /Protan/], ["deutan", /Deuter/], ["tritan", /Tritan/], ["gris", /grises/]]) {
    await page.evaluate((re) => { Winclus.abrir(); Array.from(Winclus.caja.querySelectorAll(".wcl-opc button")).find((b) => new RegExp(re).test(b.textContent)).click(); }, etiqueta.source);
    await page.waitForTimeout(250);
    const filtro = await page.evaluate(() => getComputedStyle(document.documentElement).filter + " " + getComputedStyle(document.body).filter);   // Firefox: url(#…) va en <body> y «gris» es grayscale(1) en <html>
    const ahora = await page.screenshot({ clip: { x: 10, y: 10, width: 4, height: 4 } });
    comprobar((filtro.indexOf("wcl-f-" + nombre) >= 0 || (nombre === "gris" && /grayscale/.test(filtro))) && !ahora.equals(base), "el filtro " + nombre + " se aplica y cambia el rojo de la página", filtro);
  }
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll(".wcl-opc button")).find((b) => /Ninguna/.test(b.textContent)).click(); });
  await page.waitForTimeout(250);
  const fin = await page.screenshot({ clip: { x: 10, y: 10, width: 4, height: 4 } });
  comprobar(fin.equals(base), "«Ninguna» devuelve los colores originales");
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
