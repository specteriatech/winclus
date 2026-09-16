// Motor multilingüe: en una página en inglés el panel sale en inglés (pestañas, secciones, interruptores, modo
// fácil, avisos y voz), data-ui="es" lo fuerza en español, un sitio puede añadir un idioma con
// window.WinclusIdiomas, y lo no traducido sale en español. Uso: node prueba_idiomas.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores
const path = require("path");
const fs = require("fs");

const BASE = fs.readFileSync(path.join(__dirname, "pagina-prueba.html"), "utf8");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }
function pagina(nombre, html) { const p = path.join(__dirname, nombre); fs.writeFileSync(p, html); return "file:///" + p.replace(/\\/g, "/"); }

(async () => {
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  const leer = () => page.evaluate(() => ({
    tabs: Array.from(Winclus.caja.querySelectorAll('[role="tab"]')).map((b) => b.textContent),
    seccion: Winclus.caja.querySelector("#wcl-panel-ver h2").textContent,
    sw: Winclus.caja.querySelector('label[for="wcl-oscuro"]').textContent,
    boton: Winclus.caja.querySelector(".wcl-btn").getAttribute("aria-label"),
    lang: Winclus.caja.host.getAttribute("lang"),
    facil: Array.from(Winclus.caja.querySelectorAll(".wcl-facil button")).map((b) => b.textContent).filter((t) => /🔊/.test(t))[0] || "",
  }));

  // --- página en inglés ---
  const EN = pagina("pagina-prueba-en.html", BASE.replace('<html lang="es">', '<html lang="en">'));
  await page.goto(EN);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { window.__voz = []; speechSynthesis.speak = (u) => window.__voz.push(u.lang + ":" + u.text); Winclus.abrir(); });
  let r = await leer();
  comprobar(r.tabs.join(",") === "See,Hear,Pointer,Clicks,Type,More" && r.seccion === "See better" && r.sw === "Dark mode" && r.boton === "Open Winclus accessibility" && r.lang === "en", "en una página en inglés el panel sale en inglés", JSON.stringify(r));
  await page.evaluate(() => { Winclus.caja.getElementById("wcl-facil").click(); });
  r = await leer();
  comprobar(/Read the page/.test(r.facil), "el modo fácil también", r.facil);
  await page.evaluate(() => { Winclus.mover(300, 400); Winclus.clic(); });
  await page.waitForTimeout(100);
  const aviso = await page.evaluate(() => Winclus.caja.querySelector(".wcl-vivo").textContent);
  comprobar(aviso === "Click", "los avisos se traducen", aviso);
  await page.evaluate(() => Winclus.decir("Barrido activado"));
  const voz = await page.evaluate(() => window.__voz[window.__voz.length - 1]);
  comprobar(voz === "en:Scanning on", "la voz del panel habla en inglés con voz en inglés", voz);

  // --- data-ui fuerza español en una página en inglés ---
  const EN_ES = pagina("pagina-prueba-en-es.html", BASE.replace('<html lang="es">', '<html lang="en">').replace('<script src="../../../web/widget.js">', '<script src="../../../web/widget.js" data-ui="es">'));
  await page.goto(EN_ES);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => Winclus.abrir());
  r = await leer();
  comprobar(r.tabs[0] === "Ver" && r.lang === "es", "data-ui=\"es\" fuerza el español", r.tabs.join(","));

  // --- idioma añadido por el sitio ---
  const PT = pagina("pagina-prueba-pt.html", BASE.replace('<html lang="es">', '<html lang="pt-BR">').replace('<script src="../../../web/widget.js">', '<script>window.WinclusIdiomas = { pt: { "Ver": "Ver", "Oír": "Ouvir", "Puntero": "Ponteiro", "Ver mejor": "Ver melhor" } };</script><script src="../../../web/widget.js">'));
  await page.goto(PT);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => Winclus.abrir());
  r = await leer();
  comprobar(r.tabs[1] === "Ouvir" && r.seccion === "Ver melhor" && r.sw === "Modo oscuro" && r.lang === "pt", "un idioma añadido con WinclusIdiomas se usa, y lo no traducido queda en español", JSON.stringify(r));

  // --- idioma sin diccionario: español ---
  const FR = pagina("pagina-prueba-fr.html", BASE.replace('<html lang="es">', '<html lang="fr">'));
  await page.goto(FR);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => Winclus.abrir());
  r = await leer();
  comprobar(r.tabs[0] === "Ver" && r.lang === "es", "sin diccionario para el idioma de la página, el panel sale en español");

  ["pagina-prueba-en.html", "pagina-prueba-en-es.html", "pagina-prueba-pt.html", "pagina-prueba-fr.html"].forEach((f) => { try { fs.unlinkSync(path.join(__dirname, f)); } catch (e) {} });
  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
