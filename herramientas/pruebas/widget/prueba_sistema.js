// Respeto a las preferencias del sistema y al idioma de la página (EN 301 549 11.7, WCAG 3.1.1), y cursor grande:
// con prefers-reduced-motion se activan solos «pausar animaciones» y «modo calma» salvo que la persona los haya
// tocado; con prefers-contrast: more, el alto contraste; la página en inglés se lee con una voz en inglés; el
// cursor grande pone un cursor SVG en toda la página. Uso: node prueba_sistema.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();

  // --- reducir movimiento y más contraste, sin nada guardado ---
  let ctx = await nav.newContext({ reducedMotion: "reduce", contrast: "more" });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  let page = await ctx.newPage();
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  let a = await page.evaluate(() => ({ anim: Winclus.ajustes.animaciones, calma: Winclus.ajustes.calma, contraste: Winclus.ajustes.contraste, claseAnim: document.documentElement.classList.contains("wcl-anim"), filtro: getComputedStyle(document.documentElement).filter }));
  comprobar(a.anim && a.calma && a.claseAnim, "prefers-reduced-motion activa pausar animaciones y modo calma", JSON.stringify(a));
  comprobar(a.contraste && /contrast/.test(a.filtro), "prefers-contrast: more activa el alto contraste", a.filtro);
  await ctx.close();

  // --- lo guardado manda ---
  ctx = await nav.newContext({ reducedMotion: "reduce", contrast: "more" });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  await ctx.addInitScript(() => localStorage.setItem("winclus.ajustes", JSON.stringify({ animaciones: false, calma: false, contraste: false })));
  page = await ctx.newPage();
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  a = await page.evaluate(() => ({ anim: Winclus.ajustes.animaciones, calma: Winclus.ajustes.calma, contraste: Winclus.ajustes.contraste }));
  comprobar(!a.anim && !a.calma && !a.contraste, "si la persona los apagó en el widget, el sistema no los vuelve a encender", JSON.stringify(a));
  await ctx.close();

  // --- sin preferencias: nada se activa solo ---
  ctx = await nav.newContext({ reducedMotion: "no-preference" });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  page = await ctx.newPage();
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  a = await page.evaluate(() => ({ anim: Winclus.ajustes.animaciones, calma: Winclus.ajustes.calma, contraste: Winclus.ajustes.contraste }));
  comprobar(!a.anim && !a.calma && !a.contraste, "sin preferencias del sistema no se activa nada", JSON.stringify(a));

  // --- idioma de la página ---
  await page.evaluate(() => { window.__u = []; speechSynthesis.speak = (u) => window.__u.push({ lang: u.lang, texto: u.text.slice(0, 30) }); });
  await page.evaluate(() => Winclus.leer());
  await page.evaluate(() => Winclus.decir("hola"));
  let u = await page.evaluate(() => window.__u);
  comprobar(u.length === 2 && /^es/.test(u[0].lang) && /^es/.test(u[1].lang), "página en español: se lee en español", JSON.stringify(u));
  await ctx.close();

  ctx = await nav.newContext();

  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  page = await ctx.newPage();
  // el idioma se lee al cargar el widget: misma página con lang="en", generada al vuelo junto a la original
  const fs = require("fs"), EN = path.join(__dirname, "pagina-prueba-en.html");
  fs.writeFileSync(EN, fs.readFileSync(path.join(__dirname, "pagina-prueba.html"), "utf8").replace('<html lang="es">', '<html lang="en">'));
  await page.goto("file:///" + EN.replace(/\\/g, "/"));
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { window.__u = []; speechSynthesis.speak = (u) => window.__u.push({ lang: u.lang, texto: u.text.slice(0, 30) }); });
  await page.evaluate(() => Winclus.leer());
  await page.evaluate(() => Winclus.decir("hola"));
  u = await page.evaluate(() => window.__u);
  comprobar(u.length === 2 && /^en/.test(u[0].lang) && /^en/.test(u[1].lang), "página en inglés: el contenido y el panel se leen en inglés (el panel sigue el idioma de la página)", JSON.stringify(u));

  // --- cursor grande ---
  await page.evaluate(() => Winclus.abrir());
  await page.evaluate(() => Winclus.caja.getElementById("wcl-cursor_grande").click());
  await page.waitForTimeout(100);
  const cur = await page.evaluate(() => ({ body: getComputedStyle(document.body).cursor.slice(0, 40), enlace: getComputedStyle(document.querySelector("a")).cursor.slice(0, 40), boton: getComputedStyle(Winclus.caja.querySelector(".wcl-btn")).cursor.slice(0, 40), guardado: JSON.parse(localStorage.getItem("winclus.ajustes")).cursor_grande }));
  comprobar(/^url\("data:image\/svg/.test(cur.body) && /^url\(/.test(cur.enlace) && /^url\(/.test(cur.boton) && cur.guardado === true, "cursor grande: cursor SVG en la página, los enlaces y el widget, y queda guardado", JSON.stringify(cur));
  await page.evaluate(() => Winclus.caja.getElementById("wcl-cursor_grande").click());
  await page.waitForTimeout(100);
  comprobar((await page.evaluate(() => getComputedStyle(document.body).cursor)) === "auto", "al apagarlo vuelve el cursor normal");
  await ctx.close();
  try { fs.unlinkSync(EN); } catch (e) {}

  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
