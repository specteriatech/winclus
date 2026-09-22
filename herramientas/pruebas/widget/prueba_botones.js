// 0.8.0: lo que le faltaba al panel frente a los overlays. Ocultar imágenes del todo, saturación por grados, estructura de la
// página (títulos, zonas y enlaces con salto directo), información al pasar (title, alt, aria-label en grande), contraste
// inteligente (solo los textos que no llegan a 4,5:1 pasan a negro o blanco, con la lista para el sitio), botón a la
// izquierda o a la derecha, panel grande, y «Avisar de una barrera» al contacto del sitio. Uso: node prueba_botones.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-botones.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  await ctx.addInitScript(() => { window.__abiertos = []; window.open = (u) => { window.__abiertos.push(u); return null; }; });
  const page = await ctx.newPage();
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { localStorage.setItem("winclus.visto", "1"); Winclus.abrir(); Winclus.vistaCompleta(true); });
  const sw = (clave) => page.evaluate((k) => { Winclus.caja.getElementById("wcl-" + k).click(); }, clave);

  // --- ocultar imágenes ---
  await sw("ocultar_img");
  await page.evaluate(() => Winclus.abrir());   // refresca «Lo que tienes activado»
  let v = await page.evaluate(() => ({ img: getComputedStyle(document.getElementById("foto1")).visibility, boton: getComputedStyle(document.getElementById("guardar")).visibility, clase: document.documentElement.classList.contains("wcl-ocultarimg"), activo: [...Winclus.caja.querySelector(".wcl-activo").querySelectorAll("li")].map((l) => l.textContent) }));
  comprobar(v.img === "hidden" && v.boton === "visible" && v.clase && v.activo.includes("Imágenes ocultas"), "«Ocultar imágenes» esconde las imágenes del todo y lo dice en «Lo que tienes activado»", JSON.stringify(v));
  await sw("ocultar_img");

  // --- saturación ---
  await page.evaluate(() => { const f = Winclus.caja.getElementById("wcl-l-saturacion").parentElement; f.querySelectorAll("button")[0].click(); f.querySelectorAll("button")[0].click(); });
  v = await page.evaluate(() => ({ valor: Winclus.ajustes.saturacion, filtro: document.documentElement.style.filter }));
  comprobar(v.valor === 50 && /saturate\(0\.5\)/.test(v.filtro), "la saturación baja por grados y se aplica como filtro a toda la página", JSON.stringify(v));
  await page.evaluate(() => { const f = Winclus.caja.getElementById("wcl-l-saturacion").parentElement; f.querySelectorAll("button")[1].click(); f.querySelectorAll("button")[1].click(); });
  v = await page.evaluate(() => ({ valor: Winclus.ajustes.saturacion, filtro: document.documentElement.style.filter }));
  comprobar(v.valor === 100 && !/saturate/.test(v.filtro), "al volver a 100 no queda ningún filtro", JSON.stringify(v));

  // --- estructura de la página ---
  await page.evaluate(() => Winclus.estructura("titulos"));
  v = await page.evaluate(() => { const e = Winclus.caja.querySelector(".wcl-elegir"); return { visible: e.style.display === "block", titulo: e.querySelector("h2").textContent, items: [...e.querySelectorAll("button:not(.cerrar):not(.wcl-est-tabs button)")].map((b) => b.className + "|" + b.firstChild.textContent.trim()), tabs: [...e.querySelectorAll(".wcl-est-tabs button")].map((b) => b.textContent + ":" + b.getAttribute("aria-pressed")) }; });
  comprobar(v.visible && v.titulo === "Títulos de la página" && v.items.join(",") === "n1|Título principal,n2|Sección uno,n3|Sub sección,n2|Sección dos" && v.tabs.join(",") === "Títulos:true,Zonas:false,Enlaces:false", "la estructura lista los títulos con su nivel y sangría", JSON.stringify(v));
  await page.evaluate(() => { [...Winclus.caja.querySelectorAll(".wcl-elegir .wcl-est-tabs button")][1].click(); });
  v = await page.evaluate(() => [...Winclus.caja.querySelectorAll(".wcl-elegir button:not(.cerrar):not(.wcl-est-tabs button)")].map((b) => b.firstChild.textContent.trim()));
  comprobar(v.includes("Cabecera") && v.includes("Menú: Principal") && v.some((t) => /^Contenido principal/.test(t)) && v.includes("Sección: Noticias") && v.includes("Pie"), "la pestaña Zonas lista cabecera, menú, contenido, secciones con nombre y pie", v.join(" | "));
  await page.evaluate(() => { [...Winclus.caja.querySelectorAll(".wcl-elegir .wcl-est-tabs button")][2].click(); });
  v = await page.evaluate(() => [...Winclus.caja.querySelectorAll(".wcl-elegir button:not(.cerrar):not(.wcl-est-tabs button)")].map((b) => b.firstChild.textContent.trim()));
  comprobar(v.join(",") === "A,B,Contacto de accesibilidad", "la pestaña Enlaces lista los enlaces de la página", v.join(","));
  await page.evaluate(() => { Winclus.estructura("titulos"); [...Winclus.caja.querySelectorAll(".wcl-elegir button")].find((b) => /Sección dos/.test(b.textContent)).click(); });
  v = await page.evaluate(() => ({ cerrado: Winclus.caja.querySelector(".wcl-elegir").style.display === "none", foco: document.activeElement.textContent, tabindex: document.activeElement.getAttribute("tabindex") }));
  comprobar(v.cerrado && v.foco === "Sección dos" && v.tabindex === "-1", "tocar un título cierra la lista y lleva el foco allí", JSON.stringify(v));

  // --- información al pasar ---
  await sw("tooltips");
  await page.hover("#guardar");
  await page.waitForTimeout(100);
  v = await page.evaluate(() => { const t = Winclus.caja.querySelector(".wcl-tip"); return t && t.style.display === "block" ? t.textContent : null; });
  comprobar(v === "Guardar el formulario", "al pasar por un botón con solo un icono se ve su aria-label en grande", String(v));
  await page.hover("#foto1"); await page.waitForTimeout(100);
  const tipImg = await page.evaluate(() => Winclus.caja.querySelector(".wcl-tip").textContent);
  await page.hover("abbr"); await page.waitForTimeout(100);
  const tipAbbr = await page.evaluate(() => Winclus.caja.querySelector(".wcl-tip").textContent);
  await page.hover("p.bueno"); await page.waitForTimeout(100);
  const tipNada = await page.evaluate(() => Winclus.caja.querySelector(".wcl-tip").style.display);
  comprobar(tipImg === "Foto de la plaza" && /Peticiones, quejas/.test(tipAbbr) && tipNada === "none", "muestra el alt de las imágenes y el title de las abreviaturas, y nada donde no hay", tipImg + " | " + tipAbbr + " | " + tipNada);
  await page.focus("a[title]"); await page.waitForTimeout(100);
  v = await page.evaluate(() => Winclus.caja.querySelector(".wcl-tip").textContent);
  comprobar(v === "Ir a la sección A", "también al llegar con el teclado (foco)", v);
  await page.keyboard.press("Escape");
  v = await page.evaluate(() => Winclus.caja.querySelector(".wcl-tip").style.display);
  comprobar(v === "none", "Escape lo quita");
  await sw("tooltips");
  await page.evaluate(() => Winclus.abrir());   // Escape cerró el panel

  // --- contraste inteligente ---
  await sw("contraste_inteligente");
  await page.waitForTimeout(100);
  v = await page.evaluate(() => { const c = (id) => getComputedStyle(document.getElementById(id)).color; return { flojo: c("flojo"), grande: c("grande"), oscuro: c("oscuro"), foto: c("foto"), bueno: getComputedStyle(document.querySelector("p.bueno")).color, marcados: document.querySelectorAll("[data-wcl-ci]").length, pendiente: Winclus.pendientes().find((p) => p.tipo === "contraste") }; });
  comprobar(v.flojo === "rgb(0, 0, 0)" && v.oscuro === "rgb(255, 255, 255)", "el texto flojo sobre blanco pasa a negro y el flojo sobre oscuro a blanco", v.flojo + " | " + v.oscuro);
  comprobar(v.grande === "rgb(138, 138, 138)" && v.foto === "rgb(153, 153, 153)" && v.bueno === "rgb(16, 31, 61)", "el texto grande que llega a 3:1, el que va sobre una foto y el que ya contrasta no se tocan", v.grande + " | " + v.foto + " | " + v.bueno);
  comprobar(v.pendiente && /2 texto\(s\) con contraste insuficiente/.test(v.pendiente.que) && /#flojo/.test(v.pendiente.que), "la lista para el sitio anota los textos con poco contraste y su ratio", v.pendiente && v.pendiente.que.slice(0, 160));
  await page.evaluate(() => { document.getElementById("tarde").innerHTML = '<p class="flojo" id="tarde2">Llegó tarde y flojo.</p>'; });
  await page.waitForTimeout(800);
  v = await page.evaluate(() => getComputedStyle(document.getElementById("tarde2")).color);
  comprobar(v === "rgb(0, 0, 0)", "el texto que llega después también se contrasta", v);
  await sw("contraste_inteligente");
  v = await page.evaluate(() => ({ flojo: getComputedStyle(document.getElementById("flojo")).color, marcados: document.querySelectorAll("[data-wcl-ci]").length }));
  comprobar(v.flojo === "rgb(154, 154, 154)" && v.marcados === 0, "al apagarlo vuelven los colores del sitio", JSON.stringify(v));

  // --- botón a la izquierda y panel grande ---
  await page.evaluate(() => { [...Winclus.caja.querySelectorAll(".wcl-opc button")].find((b) => b.textContent === "Izquierda").click(); });
  v = await page.evaluate(() => { const b = Winclus.caja.querySelector(".wcl-btn"), r = b.getBoundingClientRect(); return { izq: r.left < 100, clase: Winclus.caja.host.classList.contains("wcl-izq"), panel: Winclus.caja.querySelector(".wcl-panel").getBoundingClientRect().left < 100 }; });
  comprobar(v.izq && v.clase && v.panel, "«Izquierda» pasa el botón y el panel al lado izquierdo", JSON.stringify(v));
  await page.evaluate(() => { [...Winclus.caja.querySelectorAll(".wcl-opc button")].find((b) => b.textContent === "Como lo puso el sitio").click(); });
  await sw("panel_grande");
  v = await page.evaluate(() => ({ grande: Winclus.caja.host.classList.contains("wcl-grande"), ancho: Winclus.caja.querySelector(".wcl-panel").getBoundingClientRect().width }));
  comprobar(v.grande && v.ancho > 400, "«Panel grande» agranda el panel", JSON.stringify(v));
  await sw("panel_grande");

  // --- avisar de una barrera ---
  await page.evaluate(() => { Winclus.caja.getElementById("wcl-barrera").value = ""; Winclus.avisarBarrera(""); });
  await page.waitForTimeout(100);
  v = await page.evaluate(() => Winclus.caja.querySelector(".wcl-aviso") && Winclus.caja.querySelector(".wcl-aviso").textContent);
  comprobar(/Escribe primero/.test(v || ""), "sin texto no se envía nada y se pide escribirlo", String(v));
  await page.evaluate(() => Winclus.avisarBarrera("El formulario no se envía con el teclado"));
  await page.waitForTimeout(200);
  v = await page.evaluate(() => window.__abiertos);
  comprobar(v.length === 1 && /^mailto:accesibilidad@ejemplo\.gov\.co\?subject=/.test(v[0]) && /formulario%20no%20se%20env/.test(v[0]) && /Winclus%200\./.test(v[0]) && /pagina-botones/.test(v[0]), "con un enlace de correo de accesibilidad en la página, se abre un correo con la barrera, la página y la versión", (v[0] || "").slice(0, 120));
  // con data-contacto a una URL: POST con JSON
  const recibido = [];
  await page.route("https://barreras.ejemplo/aviso", (route) => { recibido.push(JSON.parse(route.request().postData())); route.fulfill({ status: 200, body: "ok" }); });
  const page2 = await ctx.newPage();
  await page2.route("https://barreras.ejemplo/aviso", (route) => { recibido.push(JSON.parse(route.request().postData())); route.fulfill({ status: 200, body: "ok" }); });
  await page2.goto(PAGINA + "?contacto");
  await page2.waitForFunction(() => window.Winclus);
  await page2.evaluate(() => Winclus.avisarBarrera("No se puede leer el PDF"));
  await page2.waitForTimeout(400);
  comprobar(recibido.length === 1 && recibido[0].texto === "No se puede leer el PDF" && /pagina-botones/.test(recibido[0].url) && recibido[0].version && Array.isArray(recibido[0].ayudas), "con data-contacto a una URL, el aviso llega por POST con la página, el texto, el navegador y las ayudas activas", JSON.stringify(recibido[0] || {}).slice(0, 160));
  await page2.close();

  // --- un clic fuera del panel lo cierra ---
  await page.evaluate(() => Winclus.abrir());
  await page.mouse.click(300, 700);
  let abierto = await page.evaluate(() => Winclus.caja.querySelector(".wcl-panel").classList.contains("abierto"));
  comprobar(!abierto, "un clic fuera del panel lo cierra");
  await page.evaluate(() => Winclus.abrir());
  const r = await page.evaluate(() => { const b = Winclus.caja.querySelector(".wcl-panel h2").getBoundingClientRect(); return { x: b.left + 20, y: b.top + 10 }; });
  await page.mouse.click(r.x, r.y);
  abierto = await page.evaluate(() => Winclus.caja.querySelector(".wcl-panel").classList.contains("abierto"));
  comprobar(abierto, "un clic dentro del panel no lo cierra");
  await page.evaluate(() => { Winclus.mover(300, 700); Winclus.clic(); });
  await page.waitForTimeout(100);
  abierto = await page.evaluate(() => Winclus.caja.querySelector(".wcl-panel").classList.contains("abierto"));
  comprobar(!abierto, "también con el clic del puntero facial fuera del panel");
  await page.evaluate(() => { Winclus.ajustes.barrido = true; Winclus.ajustes.barrido_senal = "raton"; Winclus.abrir(); });
  await page.mouse.click(300, 700);
  abierto = await page.evaluate(() => Winclus.caja.querySelector(".wcl-panel").classList.contains("abierto"));
  comprobar(abierto, "con el barrido por clic del ratón, el clic es señal y no cierra el panel");
  await page.evaluate(() => { Winclus.ajustes.barrido = false; Winclus.ajustes.barrido_senal = "espacio"; Winclus.abrir(); });

  // --- axe sobre las piezas nuevas del panel ---
  const fs = require("fs");
  await page.addScriptTag({ content: fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8") });
  await page.evaluate(() => Winclus.estructura("zonas"));
  v = await page.evaluate(async () => { const r = await axe.run(Winclus.caja.querySelector(".wcl-elegir"), { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } }); return r.violations.map((x) => x.id); });
  comprobar(v.length === 0, "la lista de estructura pasa axe", v.join(","));
  await page.evaluate(() => { Winclus.caja.querySelector(".wcl-elegir .cerrar").click(); Winclus.caja.querySelector("#wcl-tab-mas").click(); });
  v = await page.evaluate(async () => { const r = await axe.run(Winclus.caja.querySelector(".wcl-panel"), { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } }); return r.violations.map((x) => x.id + ":" + x.nodes.length); });
  comprobar(v.length === 0, "la pestaña Más con las secciones nuevas pasa axe", v.join(","));

  comprobar(errores.length === 0, "sin errores de JavaScript", errores.join(" | "));
  await nav.close();
  console.log(fallos ? "\n" + fallos + " comprobación(es) fallida(s)" : "\nTodo bien");
  process.exit(fallos ? 1 : 0);
})();
