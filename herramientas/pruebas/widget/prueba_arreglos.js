// Arreglos al vuelo del sitio (22-sep-2026, 0.7.0): lo que le falta a una página para los lectores de pantalla, el
// teclado y el zoom, Winclus lo pone para TODAS las ayudas técnicas (no solo para su lector): lang, alt a partir de lo
// que ya dice la página (nunca inventado), nombres de botones y enlaces con solo un icono, enlaces «aquí» con su
// contexto, etiquetas de campos, «Saltar al contenido», zona principal, foco visible, zoom permitido, título de iframes,
// cabeceras de tablas y controles en medios que arrancan solos. Lo que no se puede arreglar sin riesgo se anota para
// quien mantiene el sitio. data-arreglos="no" lo apaga. Uso: node prueba_arreglos.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const path = require("path");
const fs = require("fs");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-arreglos.html").replace(/\\/g, "/");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  const page = await ctx.newPage();
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus && Winclus.arreglos().length > 0);
  await page.waitForTimeout(300);

  const v = await page.evaluate(() => {
    const q = (s) => document.querySelector(s), al = (s) => (q(s) ? q(s).getAttribute("aria-label") : null), alt = (s) => (q(s) ? q(s).getAttribute("alt") : null);
    const salto = document.body.firstElementChild;
    return {
      lang: document.documentElement.lang, viewport: q("meta[name=viewport]").getAttribute("content"),
      principal: q(".contenido").getAttribute("role"), salto: { es: salto.tagName + "." + salto.className, href: salto.getAttribute("href"), texto: salto.textContent, tabindex: q(".contenido").getAttribute("tabindex"), id: q(".contenido").id },
      foco: !!document.querySelector("style[data-winclus-arreglo=foco]"),
      logo: alt(".logo img"), fachada: alt("img[src='alcaldia-fachada.jpg']"), sinPista: q("img[src='img_0234.jpg']").hasAttribute("alt"), spacer: alt("img[src='spacer.gif']"), mapa: alt("img[src='mapa.png']"), plaza: alt("figure img"),
      aqui: al("a[href='/certificado']"), leerMas: al("a[href='/plan']"), pdf: al("a[href='/docs/informe.pdf']"), facebook: al("a[href*='facebook']"), lupa: al("a[href='/buscar']"),
      menu: al("#hamburguesa"), cerrar: al(".btn-close"), enviar: al("button[type=submit]"),
      correo: al("input[placeholder]"), nombre: al("#nombre"), depto: al("select"), buscar: al("input[type=search]"), mensaje: al("textarea"),
      iframe: q("iframe").getAttribute("title"), cabeceras: [...document.querySelectorAll("table tr:first-child td")].map((c) => c.getAttribute("role") + "/" + c.getAttribute("scope")).join(","), video: q("video").controls,
      n: Winclus.arreglos().length, pendientes: Winclus.pendientes().map((p) => p.tipo + ": " + p.que), informe: Winclus.informeArreglos()
    };
  });
  comprobar(v.lang === "es", "<html> sin lang recibe el idioma del sitio", v.lang);
  comprobar(!/user-scalable|maximum-scale/.test(v.viewport) && /width=device-width/.test(v.viewport), "el viewport deja ampliar con los dedos", v.viewport);
  comprobar(v.principal === "main", "la zona del contenido se marca como principal (role=main) cuando no hay <main>", v.principal);
  comprobar(v.salto.es === "A.winclus-salto" && v.salto.href === "#" + v.salto.id && v.salto.tabindex === "-1" && /Saltar al contenido/.test(v.salto.texto), "hay un enlace «Saltar al contenido» al principio que lleva a la zona principal", JSON.stringify(v.salto));
  comprobar(v.foco, "el foco vuelve a verse cuando el sitio lo quita con outline:none", String(v.foco));
  comprobar(v.logo === "Página de inicio", "el logo del enlace de inicio recibe alt por el destino del enlace", v.logo);
  comprobar(v.fachada === "alcaldia fachada", "una imagen sin alt recibe el nombre del archivo, marcado como provisional", v.fachada);
  comprobar(v.sinPista === false, "una imagen sin ninguna pista NO recibe un alt inventado: queda para una persona", String(v.sinPista));
  comprobar(v.spacer === "", "un espaciador de 1×1 se marca decorativo (alt vacío)", JSON.stringify(v.spacer));
  comprobar(v.mapa === "Mapa de la ciudad" && v.plaza === "La plaza mayor un domingo", "el title y el pie de foto pasan a alt", v.mapa + " | " + v.plaza);
  comprobar(v.aqui === "aquí: Para pedir el certificado de residencia entre", "el enlace «aquí» recibe el texto del párrafo que lo rodea", v.aqui);
  comprobar(/^Leer más: El plan de desarrollo/.test(v.leerMas || ""), "el enlace «Leer más» recibe el texto del párrafo", v.leerMas);
  comprobar(v.pdf === "Informe anual (PDF)", "un enlace a un PDF dice que abre un PDF", v.pdf);
  comprobar(v.facebook === "Facebook" && v.lupa === "Buscar", "los enlaces que solo llevan un icono reciben nombre por el destino o el icono", v.facebook + " | " + v.lupa);
  comprobar(v.menu === "Menú" && v.cerrar === "Cerrar" && v.enviar === null, "los botones con solo un icono reciben nombre; los que ya tienen texto no se tocan", v.menu + " | " + v.cerrar + " | " + v.enviar);
  comprobar(v.correo === "Tu correo" && v.nombre === "Nombre:" && v.depto === "departamento" && v.buscar === "Buscar" && v.mensaje === "Mensaje", "los campos sin etiqueta reciben nombre por placeholder, texto de al lado, tipo o name", [v.correo, v.nombre, v.depto, v.buscar, v.mensaje].join(" | "));
  comprobar(v.iframe === "Vídeo de YouTube", "el iframe sin título recibe uno por su origen", v.iframe);
  comprobar(v.cabeceras === "columnheader/col,columnheader/col,columnheader/col", "la primera fila de una tabla sin <th> se anuncia como cabecera", v.cabeceras);
  comprobar(v.video === true, "un vídeo que arranca solo sin controles recibe controles", String(v.video));
  const pend = v.pendientes.join(" || ");
  comprobar(/id repetido/.test(pend) && /salto\(s\) de nivel/.test(pend) && /tabindex mayor que 0/.test(pend) && /aria-hidden/.test(pend) && /sin ninguna pista/.test(pend), "lo que no se puede arreglar sin riesgo queda anotado para quien mantiene el sitio", pend.slice(0, 300));
  comprobar(v.n >= 18 && /pagina-arreglos\.html/.test(v.informe) && /no son cumplimiento/.test(v.informe) && /necesita a una persona/.test(v.informe), "la lista para quien mantiene el sitio lleva los arreglos, sus selectores y lo pendiente", v.n + " arreglos");

  // contenido que llega después (SPA, carrusel): también se arregla
  await page.evaluate(() => { document.getElementById("nuevo").innerHTML = '<figure><img src="tarde.jpg" width="50" height="50"><figcaption>Llegó tarde</figcaption></figure><a href="/mas">más</a>'; });
  await page.waitForTimeout(700);
  const tarde = await page.evaluate(() => ({ alt: document.querySelector("img[src='tarde.jpg']").getAttribute("alt"), enlace: document.querySelector("a[href='/mas']").getAttribute("aria-label") }));
  comprobar(tarde.alt === "Llegó tarde" && /^más: (Trámites|Llegó tarde)/.test(tarde.enlace || ""), "lo que aparece después de cargar también se arregla", JSON.stringify(tarde));

  // el panel lo cuenta y deja copiar la lista
  await page.evaluate(() => { localStorage.setItem("winclus.visto", "1"); Winclus.abrir(); Winclus.vistaCompleta(true); });
  await page.click("#wcl-tab-mas");
  const panel = await page.evaluate(() => { const s = [...Winclus.caja.querySelectorAll(".wcl-sec")].find((x) => /arregló en esta página/.test(x.textContent)); return { hay: !!s, texto: s ? s.querySelector(".wcl-estado").textContent : "", items: s ? s.querySelectorAll("li").length : 0, boton: !!(s && [...s.querySelectorAll("button")].some((b) => /Copiar la lista/.test(b.textContent))) }; });
  comprobar(panel.hay && /\d+ arreglo\(s\) hechos/.test(panel.texto) && panel.items >= 20 && panel.boton, "la pestaña Más dice cuántos arreglos hizo, los lista y deja copiarlos", JSON.stringify(panel).slice(0, 200));

  // axe: con los arreglos hay menos incumplimientos que sin ellos
  const axeCuenta = async (p) => { await p.addScriptTag({ content: AXE }); return p.evaluate(async () => { const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }); return r.violations.reduce((s, v) => s + v.nodes.length, 0); }); };
  const con = await axeCuenta(page);
  const page2 = await ctx.newPage();
  await page2.goto(PAGINA + "?sin");
  await page2.waitForFunction(() => window.Winclus);
  await page2.waitForTimeout(500);
  const sin = await page2.evaluate(() => ({ lang: document.documentElement.lang, n: Winclus.arreglos().length, alt: document.querySelector("img[src='mapa.png']").hasAttribute("alt") }));
  comprobar(sin.lang === "" && sin.n === 0 && !sin.alt, "con data-arreglos=\"no\" el sitio queda tal cual", JSON.stringify(sin));
  const sinN = await axeCuenta(page2);
  comprobar(con < sinN / 2, "axe encuentra menos de la mitad de incumplimientos con los arreglos puestos", "con arreglos: " + con + " · sin: " + sinN);

  comprobar(errores.length === 0, "sin errores de JavaScript", errores.join(" | "));
  await nav.close();
  console.log(fallos ? "\n" + fallos + " comprobación(es) fallida(s)" : "\nTodo bien");
  process.exit(fallos ? 1 : 0);
})();
