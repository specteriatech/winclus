// «Otro idioma» (0.6.19): la barra de accesibilidad de la sede electrónica debe dejar cambiar el idioma (Res. MinTIC
// 2893 de 2020, Anexo 1, 4.3.2 b). Winclus lleva a las versiones que el sitio tiene en otros idiomas: por
// <link rel="alternate" hreflang>, por enlaces con hreflang, por un selector con lang cuyo texto es el nombre del
// idioma, o por data-idiomas en el script. Si no hay ninguna, explica cómo traducir con el navegador y no envía la
// página a nadie. El botón se ve nada más abrir el panel sencillo. Uso: node prueba_otro_idioma.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

function pagina(nombre, cabeza, cuerpo, atributos) {
  fs.writeFileSync(path.join(__dirname, nombre), '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Trámites</title>' + cabeza + '</head><body><main><h1>Trámites</h1>' + cuerpo +
    '</main><script src="/widget.js" ' + (atributos || "") + '></script></body></html>');
}

(async () => {
  pagina("idioma-alternas.html", '<link rel="alternate" hreflang="es" href="/pruebas/idioma-alternas.html"><link rel="alternate" hreflang="en" href="/en/tramites"><link rel="alternate" hreflang="x-default" href="/"><link rel="alternate" hreflang="pt-BR" href="https://ejemplo.gov.co/pt/"><link rel="alternate" hreflang="en-GB" href="/en-gb/tramites">', "<p>Texto.</p>");
  pagina("idioma-selector.html", "", '<nav><a lang="en" href="/en/">English</a> · <a lang="fr" href="/fr/">Français</a></nav><p><a lang="en" href="/articulo-en-ingles">Read the article</a></p>');
  pagina("idioma-atributo.html", "", "<p>Texto.</p>", 'data-idiomas="nas=/nasa/, en=https://ejemplo.gov.co/en/"');
  pagina("idioma-nada.html", "", '<p>Texto sin otras versiones. <a href="/otra">Otra página</a></p>');

  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 700));
  const nav = await chromium.launch();
  const errores = [];
  async function abrir(nombre) {
    const ctx = await nav.newContext();
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errores.push(nombre + ": " + String(e)));
    const peticiones = []; page.on("request", (r) => peticiones.push(r.url()));
    await page.goto("http://127.0.0.1:8765/pruebas/" + nombre);
    await page.waitForFunction(() => window.Winclus);
    await page.evaluate(() => Winclus.abrir());
    await page.waitForTimeout(200);
    return { ctx, page, peticiones };
  }
  const botones = (page) => page.evaluate(() => [...Winclus.caja.querySelectorAll("#wcl-idiomas-inicio button")].map((b) => ({ t: b.textContent, lang: b.getAttribute("lang") })));

  // 1. Enlaces alternativos del <head>: salen todos menos el idioma propio y x-default, sin repetir el inglés
  let { ctx, page } = await abrir("idioma-alternas.html");
  const vis = await page.evaluate(() => { const b = Winclus.caja.getElementById("wcl-otro-idioma"); const r = b.getBoundingClientRect(); return { sencillo: Winclus.caja.querySelector(".sencillo") !== null, alto: r.height, ancho: r.width, exp: b.getAttribute("aria-expanded") }; });
  comprobar(vis.sencillo && vis.alto >= 44 && vis.ancho > 0 && vis.exp === "false", "«Otro idioma» se ve nada más abrir el panel sencillo, con 44 px de alto", JSON.stringify(vis));
  await page.evaluate(() => Winclus.caja.getElementById("wcl-otro-idioma").click());
  let b = await botones(page);
  const lista = await page.evaluate(() => Winclus.idiomasDelSitio());
  comprobar(b.length === 2 && b.some((x) => /English|Inglés/i.test(x.t) && x.lang === "en") && b.some((x) => /Portugu/i.test(x.t) && x.lang === "pt-BR"), "con hreflang: un botón por idioma, sin el propio ni x-default ni el inglés repetido", JSON.stringify(b));
  comprobar(lista.find((x) => x.codigo === "en").url === "http://127.0.0.1:8765/en/tramites", "la dirección se resuelve contra la página", JSON.stringify(lista));
  comprobar(await page.evaluate(() => Winclus.caja.getElementById("wcl-otro-idioma").getAttribute("aria-expanded") === "true"), "el botón dice si la lista está abierta (aria-expanded)");
  await page.route("**/en/tramites", (r) => r.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en"><title>Services</title><p>Services</p>' }));
  await page.evaluate(() => [...Winclus.caja.querySelectorAll("#wcl-idiomas-inicio button")].find((x) => x.lang === "en").click());
  await page.waitForURL("**/en/tramites", { timeout: 5000 }).catch(() => {});
  comprobar(page.url().endsWith("/en/tramites"), "pulsar el idioma lleva a esa versión del sitio", page.url());
  await ctx.close();

  // 2. Selector de idioma con lang: cuenta si el texto es el nombre del idioma; un artículo en inglés no
  ({ ctx, page } = await abrir("idioma-selector.html"));
  let l = await page.evaluate(() => Winclus.idiomasDelSitio());
  comprobar(l.length === 2 && l.find((x) => x.codigo === "en").url.endsWith("/en/") && l.some((x) => x.codigo === "fr"), "un selector <a lang> con el nombre del idioma cuenta; el enlace a un artículo en inglés, no", JSON.stringify(l));
  await ctx.close();

  // 3. data-idiomas en el script (para sitios sin hreflang); un código que el navegador no nombra se muestra tal cual
  ({ ctx, page } = await abrir("idioma-atributo.html"));
  l = await page.evaluate(() => Winclus.idiomasDelSitio());
  comprobar(l.length === 2 && l[0].codigo === "nas" && l[0].url.endsWith("/nasa/") && l[1].url === "https://ejemplo.gov.co/en/", "data-idiomas del script también cuenta", JSON.stringify(l));
  await ctx.close();

  // 4. Sin otras versiones: explica cómo traducir con el navegador y no pide nada a ningún traductor
  let pet;
  ({ ctx, page, peticiones: pet } = await abrir("idioma-nada.html"));
  await page.evaluate(() => Winclus.caja.getElementById("wcl-otro-idioma").click());
  const txt = await page.evaluate(() => Winclus.caja.getElementById("wcl-idiomas-inicio").textContent);
  comprobar((await botones(page)).length === 0 && /Traducir/.test(txt) && /Chrome/.test(txt) && /Safari/.test(txt) && /Firefox/.test(txt), "sin otras versiones, explica cómo traducir con Chrome, Edge, Safari y Firefox", txt.slice(0, 90));
  comprobar(!pet.some((u) => /translat|traduc/i.test(u)), "y no envía la página a ningún servicio de traducción", pet.filter((u) => !/127\.0\.0\.1/.test(u)).join(" ").slice(0, 120));
  // la sección de la pestaña Ver dice lo mismo
  const ver = await page.evaluate(() => { Winclus.vistaCompleta(true); return [...Winclus.caja.querySelectorAll(".wcl-sec")].find((s) => /Idioma de la página/.test(s.textContent)); });
  comprobar(await page.evaluate(() => [...Winclus.caja.querySelectorAll(".wcl-sec")].some((s) => /Idioma de la página/.test(s.textContent) && /Traducir/.test(s.textContent))), "la pestaña Ver tiene la sección «Idioma de la página»");
  await ctx.close();

  // 5. Con tus palabras: «quiero la página en inglés» abre la lista
  ({ ctx, page } = await abrir("idioma-alternas.html"));
  await page.evaluate(() => { const i = Winclus.caja.querySelector('input[id^="wcl-que"]'); i.value = "quiero la página en inglés"; i.parentNode.querySelector("button").click(); });
  await page.waitForTimeout(200);
  const g = await page.evaluate(() => ({ exp: Winclus.caja.getElementById("wcl-otro-idioma").getAttribute("aria-expanded"), n: Winclus.caja.querySelectorAll("#wcl-idiomas-inicio button").length, r: Winclus.caja.getElementById("wcl-respuesta").textContent }));
  comprobar(g.exp === "true" && g.n === 2 && /también en/.test(g.r), "decir «quiero la página en inglés» abre la lista y dice qué idiomas hay", JSON.stringify(g));
  await ctx.close();

  // 6. En inglés, el panel lo dice en inglés
  pagina("idioma-en.html", "", "<p>Text.</p>", 'data-ui="en"');
  ({ ctx, page } = await abrir("idioma-en.html"));
  const en = await page.evaluate(() => Winclus.caja.getElementById("wcl-otro-idioma").textContent);
  comprobar(/Another language/.test(en), "con el panel en inglés, el botón dice «Another language»", en);
  await ctx.close();

  comprobar(errores.length === 0, "sin errores de JavaScript", errores.slice(0, 2).join(" | "));
  await nav.close(); servidor.kill();
  ["idioma-alternas.html", "idioma-selector.html", "idioma-atributo.html", "idioma-nada.html", "idioma-en.html"].forEach((f) => { try { fs.unlinkSync(path.join(__dirname, f)); } catch (e) {} });
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
