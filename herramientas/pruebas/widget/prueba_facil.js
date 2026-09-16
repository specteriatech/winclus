// «Explícame esta página»: en la lectura limpia, «Explicar en fácil» cambia la jerga por palabras corrientes con
// glosario al pasar el cursor, parte las frases largas y pone lo importante primero; con data-explicar usa un
// servicio de IA (simulado) y si falla vuelve a las reglas; «Leer en voz alta» resalta palabra a palabra;
// «¿Dónde estoy?» dice título, ruta, sección y encabezados. Uso: node prueba_facil.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores
const path = require("path");
const fs = require("fs");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-tramite.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  let ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  let page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { window.__voz = []; speechSynthesis.speak = (u) => { window.__voz.push(u.text); window.__u = u; }; });

  // --- ¿Dónde estoy? ---
  const donde = await page.evaluate(() => { Winclus.abrir(); Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /Dónde estoy/.test(b.textContent)).click(); return Winclus.caja.getElementById("wcl-estado").textContent; });
  comprobar(/Estás en: Trámite de subsidio/.test(donde) && /Ruta: Inicio › Trámites › Vivienda/.test(donde) && /3 encabezados/.test(donde) && /% de la página/.test(donde), "«¿Dónde estoy?» dice título, ruta, encabezados y avance", donde);

  // --- explicar en fácil por reglas ---
  await page.evaluate(() => { Winclus.cerrar(); Winclus.orden("explícame esta página"); });
  await page.waitForTimeout(200);
  const facil = await page.evaluate(() => { const c = Winclus.caja.querySelector(".wcl-limpia-texto"); return { html: c.innerHTML, texto: c.innerText, abbr: Array.from(c.querySelectorAll("abbr")).slice(0, 3).map((a) => a.textContent + "=" + a.title), boton: Winclus.caja.querySelector('[data-a="facil"]').textContent }; });
  comprobar(/De qué va esta página/.test(facil.texto) && /Lo más importante/.test(facil.texto), "hay resumen: de qué va y lo más importante");
  comprobar(/entregar/.test(facil.texto) && !/\bradicar\b/i.test(facil.texto.replace(/radicar: /g, "")) && /corregir/.test(facil.texto), "la jerga se cambia por palabras corrientes (radicar → entregar, subsanar → corregir)");
  comprobar(facil.abbr.length >= 3 && facil.abbr.some((a) => /^entregar=radicar: /.test(a)), "las palabras cambiadas llevan el término original y su explicación", facil.abbr.join(" | "));
  const largas = facil.texto.split(/\n+/).filter((l) => /^[A-ZÁÉÍÓÚ]/.test(l) && !/^(De qué|Lo más|Pasos|Todo el|Versión)/.test(l)).filter((l) => l.split(" ").length > 30);
  comprobar(largas.length === 0, "no quedan frases de más de 30 palabras", largas.length ? largas[0].slice(0, 80) : "");
  comprobar(/Pasos o lista/.test(facil.texto) && /rellenar/.test(facil.texto), "las listas de requisitos se mantienen como pasos y con palabras claras");
  comprobar(facil.boton === "Ver el original", "el botón pasa a «Ver el original»");
  await page.evaluate(() => Winclus.caja.querySelector('[data-a="facil"]').click());
  const orig = await page.evaluate(() => Winclus.caja.querySelector(".wcl-limpia-texto").innerText);
  comprobar(/radicar la solicitud/.test(orig), "«Ver el original» devuelve el texto tal cual");

  // --- leer con resaltado palabra a palabra ---
  await page.evaluate(() => Winclus.caja.querySelector('[data-a="leer"]').click());
  const res = await page.evaluate(() => { const u = window.__u; const t = u.text; const i = t.indexOf("radicar"); u.onboundary({ name: "word", charIndex: i }); const a = Winclus.caja.querySelector(".wcl-limpia .w.act"); return { palabras: Winclus.caja.querySelectorAll(".wcl-limpia .w").length, act: a && a.textContent, lang: u.lang }; });
  comprobar(res.palabras > 50 && res.act === "radicar" && res.lang === "es", "al leer, la palabra que suena se resalta", JSON.stringify(res));

  // --- con servicio de IA (simulado) ---
  await ctx.close();
  ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  page = await ctx.newPage();
  const IA = path.join(__dirname, "pagina-tramite-ia.html");
  fs.writeFileSync(IA, fs.readFileSync(path.join(__dirname, "pagina-tramite.html"), "utf8").replace('<script src="../../../web/widget.js">', '<script src="../../../web/widget.js" data-explicar="https://ia.ejemplo/explicar">'));
  let pedido = null;
  await page.route("https://ia.ejemplo/explicar", async (route) => { pedido = JSON.parse(route.request().postData()); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ texto: "# Resumen\n\nPuedes pedir dinero para tu casa. Entrega los papeles en la web." }) }); });
  await page.goto("file:///" + IA.replace(/\\/g, "/"));
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { Winclus.orden("lectura fácil"); });
  await page.waitForTimeout(400);
  const ia = await page.evaluate(() => Winclus.caja.querySelector(".wcl-limpia-texto").innerText);
  comprobar(pedido && /radicar/.test(pedido.texto) && pedido.idioma === "es", "se envía el texto de la página al servicio configurado", pedido ? Object.keys(pedido).join(",") : "sin petición");
  comprobar(/Resumen/.test(ia) && /Puedes pedir dinero para tu casa/.test(ia) && /inteligencia artificial/.test(ia), "se muestra la explicación del servicio con aviso de IA", ia.slice(0, 80));
  await page.unroute("https://ia.ejemplo/explicar");
  await page.route("https://ia.ejemplo/explicar", (route) => route.fulfill({ status: 500, body: "error" }));
  await page.evaluate(() => { Winclus.caja.querySelector('[data-a="facil"]').click(); Winclus.caja.querySelector('[data-a="facil"]').click(); });
  await page.waitForTimeout(400);
  const caida = await page.evaluate(() => Winclus.caja.querySelector(".wcl-limpia-texto").innerText);
  comprobar(/hecha por reglas/.test(caida), "si el servicio falla, se usan las reglas");
  try { fs.unlinkSync(IA); } catch (e) {}

  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
