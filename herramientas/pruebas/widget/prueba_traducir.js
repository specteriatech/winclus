// Traducción automática del contenido (0.8.2): data-traducir → «Otro idioma» traduce la página con el servicio del sitio (simulado).
// Uso: node prueba_traducir.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const base = fs.readFileSync(path.join(__dirname, "pagina-prueba.html"), "utf8").replace('src="../../../web/widget.js"', 'src="/widget.js"');
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  const nav = await chromium.launch();
  const abrir = async (nombre, extra, servicio) => {
    fs.writeFileSync(path.join(__dirname, nombre), base.replace('src="/widget.js"', 'src="/widget.js"' + (extra || "")).replace("<main", '<main><p id="fijo" translate="no">No traducir esto</p><img id="img" src="x.png" alt="Una foto del parque"><input id="campo" placeholder="Escribe tu nombre"><code id="codigo">let x = 1;</code><p id="parrafo">Hola mundo</p></main><main'));
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
    const page = await ctx.newPage();
    const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
    const pedidos = [];
    await page.route("**/traducir-simulado", async (route) => {
      const c = JSON.parse(route.request().postData()); pedidos.push(c);
      if (servicio === "falla") return route.fulfill({ status: 500, body: "no" });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ textos: c.textos.map((t) => "[" + c.a + "] " + t.toUpperCase()) }) });
    });
    await page.goto("http://127.0.0.1:8765/pruebas/" + nombre);
    await page.waitForFunction(() => window.Winclus, null, { timeout: 20000 });
    await page.evaluate(() => { localStorage.setItem("winclus.visto", "1"); Winclus.abrir(); });
    return { page, ctx, errores, pedidos };
  };
  const estado = (page) => page.evaluate(() => ({
    parrafo: document.getElementById("parrafo").textContent, fijo: document.getElementById("fijo").textContent, alt: document.getElementById("img").getAttribute("alt"), placeholder: document.getElementById("campo").getAttribute("placeholder"), codigo: document.getElementById("codigo").textContent,
    lang: document.documentElement.lang, h1: document.querySelector("h1") ? document.querySelector("h1").textContent : "",
    panel: Winclus.caja.querySelector(".wcl-panel").textContent.includes("[EN]") || Winclus.caja.querySelector(".wcl-panel").textContent.includes("[en]"),
    botones: [...Winclus.caja.querySelectorAll(".wcl-panel button")].map((b) => b.textContent.trim()).filter((t) => /Traducir esta página|Volver al idioma original|Otro idioma/.test(t)),
    hayTraducirA: !!Winclus.caja.querySelector(".wcl-traducir-sel"),
  }));

  // 1. con servicio: se ofrece, traduce, deshace
  let { page, ctx, errores, pedidos } = await abrir("pagina-prueba-trad1.html", ' data-traducir="/traducir-simulado"');
  await page.evaluate(() => { [...Winclus.caja.querySelectorAll(".wcl-panel button")].find((b) => /Otro idioma/.test(b.textContent)).click(); });
  let e = await estado(page);
  comprobar(errores.length === 0 && e.hayTraducirA && e.botones.some((t) => /Traducir esta página/.test(t)), "con data-traducir, «Otro idioma» ofrece «Traducir esta página» con un desplegable de idiomas", e.botones.join(" | "));
  const opciones = await page.evaluate(() => [...Winclus.caja.querySelector(".wcl-traducir-sel").options].map((o) => o.value));
  comprobar(opciones.length === 17 && !opciones.includes("es") && opciones.includes("en") && opciones.includes("ar"), "17 idiomas de destino, sin el propio de la página", opciones.join(","));
  await page.evaluate(() => { [...Winclus.caja.querySelectorAll(".wcl-traducir-sel")].forEach((s) => { s.value = "en"; }); [...Winclus.caja.querySelectorAll(".wcl-panel button")].find((b) => /Traducir esta página/.test(b.textContent)).click(); });
  await page.waitForFunction(() => document.documentElement.lang === "en", null, { timeout: 8000 });
  e = await estado(page);
  comprobar(e.parrafo === "[en] HOLA MUNDO" && /^\[en\] /.test(e.h1) && e.lang === "en", "traduce los textos de la página y cambia el lang a «en»", e.parrafo + " · " + e.h1.slice(0, 30));
  comprobar(e.alt === "[en] UNA FOTO DEL PARQUE" && e.placeholder === "[en] ESCRIBE TU NOMBRE", "traduce alt y placeholder", e.alt + " · " + e.placeholder);
  comprobar(e.fijo === "No traducir esto" && e.codigo === "let x = 1;" && !e.panel, "respeta translate=\"no\", el código y el panel de Winclus", e.fijo + " · " + e.codigo);
  comprobar(pedidos.length >= 1 && pedidos.every((p) => p.de === "es" && p.a === "en" && Array.isArray(p.textos) && p.textos.length <= 60), "manda lotes de hasta 60 textos con de/a", pedidos.length + " lote(s), " + pedidos.reduce((s, p) => s + p.textos.length, 0) + " textos");
  comprobar(e.botones.some((t) => /Volver al idioma original/.test(t)), "tras traducir ofrece «Volver al idioma original»", e.botones.join(" | "));
  await page.evaluate(() => { [...Winclus.caja.querySelectorAll(".wcl-panel button")].find((b) => /Volver al idioma original/.test(b.textContent)).click(); });
  await page.waitForFunction(() => document.documentElement.lang === "es", null, { timeout: 5000 });
  e = await estado(page);
  comprobar(e.parrafo === "Hola mundo" && e.alt === "Una foto del parque" && e.placeholder === "Escribe tu nombre" && e.lang === "es" && !/^\[en\]/.test(e.h1), "«Volver al idioma original» restaura textos, atributos y lang", e.parrafo + " · " + e.h1.slice(0, 30));
  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await ctx.close();

  // 2. el servicio falla: la página queda como estaba
  ({ page, ctx, errores, pedidos } = await abrir("pagina-prueba-trad2.html", ' data-traducir="/traducir-simulado"', "falla"));
  await page.evaluate(() => Winclus.traducirPagina("fr"));
  await page.waitForTimeout(800);
  e = await estado(page);
  comprobar(e.parrafo === "Hola mundo" && e.lang === "es" && errores.length === 0, "si el servicio falla, la página queda como estaba y no hay errores", e.parrafo + " · " + e.lang);
  await ctx.close();

  // 3. sin data-traducir: ni opción ni peticiones
  ({ page, ctx, errores, pedidos } = await abrir("pagina-prueba-trad3.html", ""));
  await page.evaluate(() => { [...Winclus.caja.querySelectorAll(".wcl-panel button")].find((b) => /Otro idioma/.test(b.textContent)).click(); });
  e = await estado(page);
  const texto = await page.evaluate(() => Winclus.caja.querySelector(".wcl-panel").textContent);
  comprobar(!e.hayTraducirA && !e.botones.some((t) => /Traducir esta página/.test(t)) && /navegador puede traducirla/.test(texto) && pedidos.length === 0, "sin data-traducir no sale la opción, se explica el navegador y no se manda nada");
  await ctx.close();

  await nav.close();
  servidor.kill();
  for (let i = 1; i <= 3; i++) try { fs.unlinkSync(path.join(__dirname, "pagina-prueba-trad" + i + ".html")); } catch (e) {}
  console.log(fallos ? "\n" + fallos + " fallo(s)" : "\nTodo bien");
  process.exit(fallos ? 1 : 0);
})();
