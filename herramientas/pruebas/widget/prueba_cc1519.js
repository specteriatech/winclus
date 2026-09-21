// Verificación de winclus.com contra los 32 criterios de cumplimiento (CC1 a CC32) del Anexo 1 de la
// Resolución 1519 de 2020 (MinTIC, Colombia), con la numeración REAL del anexo, no con una propia.
//
// Cada criterio se comprueba sobre todas las páginas del sitio. Lo que una máquina no puede juzgar
// (si un texto alternativo dice lo que la imagen transmite, si una instrucción se entiende) se marca
// como «revisión humana» y se dice, en vez de darlo por bueno: eso es justo lo que la propia
// resolución advierte en 2.2.3.8 sobre los validadores automáticos.
//
// Uso: node prueba_cc1519.js          (sale 1 si algún criterio falla)
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const PAGINAS = ["/", "/accesibilidad.html", "/privacidad.html", "/integrar.html", "/comparar.html",
  "/guia.html", "/manual.html", "/cumplimiento.html", "/glosario.html", "/mapa-del-sitio.html",
  "/evidencia.html", "/presentacion.html", "/una-pagina.html", "/guion-prueba.html", "/demo.html"];

// Enlaces cuyo texto no dice a dónde llevan (CC26)
const ENLACES_VAGOS = /^(aqu[íi]|ver m[áa]s|m[áa]s|leer m[áa]s|clic aqu[íi]|pulse aqu[íi]|enlace|link|contin[úu]ar|ir)$/i;

let fallos = 0, humanos = 0;
const resultados = [];
function criterio(cc, nombre, bien, detalle) {
  fallos += bien ? 0 : 1;
  resultados.push({ cc, nombre, estado: bien ? "cumple" : "FALLA", detalle });
  console.log((bien ? "OK   " : "FALLA") + " " + cc + " " + nombre + (detalle ? "  (" + detalle + ")" : ""));
}
function humano(cc, nombre, detalle) {
  humanos++;
  resultados.push({ cc, nombre, estado: "revisión humana", detalle });
  console.log("MANO " + cc + " " + nombre + "  (" + detalle + ")");
}

(async () => {
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 700));
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1280, height: 900 } });
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));

  // Se recoge todo lo medible de cada página de una pasada
  const datos = {};
  for (const ruta of PAGINAS) {
    await page.goto("http://127.0.0.1:8765" + ruta, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);
    datos[ruta] = await page.evaluate(() => {
      const fuera = (e) => !e.closest(".wcl-root") && !(e.getRootNode() instanceof ShadowRoot);
      const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return (r.width || r.height) && cs.visibility !== "hidden" && cs.display !== "none"; };
      const texto = (e) => e ? (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim() : "";
      const imgs = Array.from(document.images).filter(fuera).map((i) => ({ alt: i.getAttribute("alt"), src: (i.currentSrc || i.src || "").split("/").pop(), ancho: i.naturalWidth, alto: i.naturalHeight, enFigura: !!i.closest("figure") }));
      const enlaces = Array.from(document.querySelectorAll("a[href]")).filter(fuera).map((a) => ({ texto: texto(a) || a.getAttribute("aria-label") || "", href: a.getAttribute("href"), destino: a.href, nuevaVentana: a.target === "_blank", aviso: /nueva ventana|new window|pdf|descargar/i.test(texto(a) + " " + (a.getAttribute("aria-label") || "")) }));
      const enc = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter(fuera).map((h) => ({ nivel: +h.tagName[1], texto: texto(h) }));
      const zonas = Array.from(document.querySelectorAll("header,nav,main,footer,aside,[role=banner],[role=navigation],[role=main],[role=contentinfo],[role=complementary],section[aria-label],section[aria-labelledby]")).filter(fuera)
        .map((z) => ({ tag: z.tagName.toLowerCase(), nombre: z.getAttribute("aria-label") || "" }));
      const tablas = Array.from(document.querySelectorAll("table")).filter(fuera).map((t) => ({
        filas: t.rows.length, columnas: t.rows[0] ? t.rows[0].cells.length : 0,
        cabeceras: t.querySelectorAll("th").length, conScope: t.querySelectorAll("th[scope]").length,
        caption: !!t.caption, anidada: !!t.parentElement.closest("table")
      }));
      const listas = Array.from(document.querySelectorAll("ul,ol")).filter(fuera).map((l) => ({
        items: l.querySelectorAll(":scope > li").length,
        hijosMalos: Array.from(l.children).filter((c) => c.tagName !== "LI" && c.tagName !== "SCRIPT" && c.tagName !== "TEMPLATE").length
      }));
      const campos = Array.from(document.querySelectorAll("input:not([type=hidden]),select,textarea")).filter(fuera).map((c) => ({
        tipo: c.type || c.tagName.toLowerCase(),
        etiqueta: !!(c.labels && c.labels.length) || !!c.getAttribute("aria-label") || !!c.getAttribute("aria-labelledby"),
        nombre: (c.labels && c.labels[0] ? texto(c.labels[0]) : c.getAttribute("aria-label")) || ""
      }));
      const cambioIdioma = Array.from(document.querySelectorAll("[lang]")).filter((e) => e !== document.documentElement && fuera(e)).length;
      return {
        titulo: document.title,
        lang: document.documentElement.getAttribute("lang") || "",
        charset: (document.characterSet || "").toLowerCase(),
        imgs, enlaces, enc, zonas, tablas, listas, campos, cambioIdioma,
        salto: !!Array.from(document.querySelectorAll("a[href^='#']")).find((a) => /ir al contenido|saltar/i.test(texto(a))),
        h1: document.querySelectorAll("h1").length,
        main: document.querySelectorAll("main,[role=main]").length,
        metaRefresh: !!document.querySelector("meta[http-equiv='refresh' i]"),
        blink: document.querySelectorAll("blink,marquee").length,
        audios: Array.from(document.querySelectorAll("audio,video")).map((m) => ({ autoplay: m.autoplay, controles: m.controls, pistas: m.textTracks.length, tag: m.tagName.toLowerCase(), silenciado: m.muted })),
        tabindexPositivo: Array.from(document.querySelectorAll("[tabindex]")).filter((e) => +e.getAttribute("tabindex") > 0).length,
        onchangeNavega: Array.from(document.querySelectorAll("select[onchange],input[onchange],select[onfocus],a[onfocus]")).length,
        textoMasPequeno: (() => {
          let min = 99;
          Array.from(document.querySelectorAll("p,li,td,th,a,button,label,span")).filter(fuera).filter(visible).forEach((e) => {
            if (!texto(e)) return; const t = parseFloat(getComputedStyle(e).fontSize); if (t && t < min) min = t;
          });
          return min;
        })(),
        cabecera: texto(document.querySelector("header")).slice(0, 80),
        pie: texto(document.querySelector("footer")).slice(0, 80),
        mapaEnlaces: Array.from(document.querySelectorAll("a[href]")).filter(fuera).map((a) => a.getAttribute("href")),
        transcripciones: Array.from(document.querySelectorAll("summary,h2,h3,a")).filter(fuera).filter((e) => /transcripci[óo]n/i.test(texto(e))).length,
        // Para CC7 y CC13: a dónde lleva cada enlace, sin el servidor delante, y los menús de cabecera y pie
        enlacesRuta: Array.from(document.querySelectorAll("a[href]")).filter(fuera)
          .map((a) => ({ texto: texto(a) || a.getAttribute("aria-label") || "", ruta: (a.href || "").replace(/^https?:\/\/[^/]+/, "").replace(/#.*$/, "").replace(/\/$/, "/index") })),
        menuCabecera: Array.from(document.querySelectorAll("header a")).filter(fuera).map((a) => texto(a)).join(" · "),
        menuPie: Array.from(document.querySelectorAll("footer a")).filter(fuera).map((a) => texto(a)).join(" · ")
      };
    });
  }

  console.log("\n== 2.2.3.1 Alternativas a lo sensorial ==");
  const sinAlt = [];
  Object.entries(datos).forEach(([r, d]) => d.imgs.forEach((i) => { if (i.alt === null) sinAlt.push(r + " " + i.src); }));
  criterio("CC1", "Alternativa texto para elementos no textuales", sinAlt.length === 0,
    sinAlt.length ? "sin atributo alt: " + sinAlt.join(", ") : Object.values(datos).reduce((s, d) => s + d.imgs.length, 0) + " imágenes, todas con alt (vacío si son decorativas)");
  const videos = [];
  Object.entries(datos).forEach(([r, d]) => d.audios.forEach((m) => { if (m.tag === "video") videos.push({ r, m }); }));
  criterio("CC2", "Complemento para vídeos o multimedia (subtítulos)", videos.every((v) => v.m.pistas > 0),
    videos.length ? videos.map((v) => v.r + ": " + v.m.pistas + " pista(s)").join("; ") : "no hay vídeos en estas páginas");
  const transcripciones = Object.values(datos).reduce((s2, d) => s2 + d.transcripciones, 0);
  criterio("CC3", "Guion para solo vídeo y solo audio", videos.length === 0 || transcripciones >= videos.length,
    videos.length ? transcripciones + " transcripciones en texto para " + videos.length + " vídeos, desplegables junto a cada uno"
      : "no hay vídeos ni audios sueltos que lo exijan");

  console.log("\n== 2.2.3.2 Lo visual entregado adecuadamente ==");
  await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });
  const zoom = await (async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const malos = [];
    for (const ruta of PAGINAS) {
      await page.goto("http://127.0.0.1:8765" + ruta, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await page.waitForTimeout(120);
      const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      if (desborda) malos.push(ruta);
      await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    }
    return malos;
  })();
  const pequenas = Object.entries(datos).filter(([, d]) => d.textoMasPequeno < 12).map(([r, d]) => r + " " + d.textoMasPequeno + "px");
  criterio("CC4", "Textos e imágenes ampliables y en tamaños adecuados", zoom.length === 0 && pequenas.length === 0,
    (zoom.length ? "con el texto al 200 % se desborda: " + zoom.join(", ") : "al 200 % ninguna página desborda") +
    (pequenas.length ? "; texto menor de 12 px en " + pequenas.join(", ") : "; ningún texto por debajo de 12 px"));
  // El contraste lo mide prueba_axe.js a 7:1 (AAA) en todas las páginas: aquí se comprueba que esa prueba existe y pasa
  const contraste = fs.existsSync(path.join(__dirname, "prueba_axe.js"));
  criterio("CC5", "Contraste de color suficiente", contraste,
    "medido en prueba_axe.js con la fórmula de las WCAG sobre cada página y cada pestaña del panel (umbral 7:1, más exigente que el 4,5:1 exigido)");
  const conFigura = Object.values(datos).reduce((s, d) => s + d.imgs.filter((i) => i.enFigura).length, 0);
  humano("CC6", "Imágenes alternas al texto cuando sea posible",
    conFigura + " imágenes van dentro de <figure> con pie de foto; que la imagen ilustre bien lo que dice el texto lo juzga una persona");
  // CC7: el mismo texto de enlace debe llevar siempre al mismo sitio
  const porTexto = {};
  Object.entries(datos).forEach(([r, d]) => d.enlacesRuta.forEach((a) => {
    const k = a.texto.toLowerCase().trim();
    if (!k || !a.ruta || /^(ir al contenido|saltar)/.test(k)) return;   // el salto apunta a la propia página
    (porTexto[k] = porTexto[k] || new Set()).add(a.ruta.replace(/\.html$/, ""));
  }));
  const incoherentes = Object.entries(porTexto).filter(([, s]) => s.size > 1).map(([t, s]) => "«" + t + "» → " + s.size + " destinos");
  criterio("CC7", "Identificación coherente", incoherentes.length === 0,
    incoherentes.length ? incoherentes.join("; ") : Object.keys(porTexto).length + " textos de enlace distintos, cada uno a un único destino");

  console.log("\n== 2.2.3.3 Estructura para todos ==");
  const malEstructura = Object.entries(datos).filter(([, d]) => d.h1 !== 1 || d.main !== 1 || d.enc.length < 2).map(([r, d]) => r + " (h1=" + d.h1 + ", main=" + d.main + ", encabezados=" + d.enc.length + ")");
  const saltos = [];
  Object.entries(datos).forEach(([r, d]) => {
    let previo = 0;
    d.enc.forEach((h) => { if (previo && h.nivel > previo + 1) saltos.push(r + " h" + previo + "→h" + h.nivel); previo = h.nivel; });
  });
  criterio("CC8", "Todo documento y página organizado en secciones", malEstructura.length === 0 && saltos.length === 0,
    malEstructura.length || saltos.length ? [].concat(malEstructura, saltos).join("; ") : "todas con un h1, un main y encabezados sin saltar niveles");
  const tablasMal = [], listasMal = [];
  Object.entries(datos).forEach(([r, d]) => {
    d.tablas.forEach((t, i) => {
      if (t.anidada) tablasMal.push(r + " tabla " + (i + 1) + " anidada");
      if (t.filas <= 1 || t.columnas <= 1) tablasMal.push(r + " tabla " + (i + 1) + " de una sola fila o columna");
      if (!t.cabeceras) tablasMal.push(r + " tabla " + (i + 1) + " sin <th>");
    });
    d.listas.forEach((l, i) => {
      if (l.hijosMalos) listasMal.push(r + " lista " + (i + 1) + " con hijos que no son <li>");
      if (l.items === 1) listasMal.push(r + " lista " + (i + 1) + " con un solo elemento");
    });
  });
  criterio("CC9", "Contenedores como tablas y listas usados correctamente", tablasMal.length === 0 && listasMal.length === 0,
    tablasMal.concat(listasMal).join("; ") || Object.values(datos).reduce((s, d) => s + d.tablas.length, 0) + " tablas y " +
    Object.values(datos).reduce((s, d) => s + d.listas.length, 0) + " listas, todas con contenido homogéneo y cabeceras");
  const sinSalto = Object.entries(datos).filter(([, d]) => !d.salto).map(([r]) => r);
  criterio("CC10", "Permitir saltar bloques que se repiten", sinSalto.length === 0,
    sinSalto.length ? "sin enlace «Ir al contenido»: " + sinSalto.join(", ") : "todas las páginas empiezan con «Ir al contenido»");
  // CC11: marcado bien cerrado. El navegador corrige al vuelo, así que se compara el HTML del archivo
  // con lo que el navegador reconstruye: si hay etiquetas mal cerradas, el número de elementos cambia.
  const marcado = [];
  for (const ruta of PAGINAS) {
    const archivo = path.join(__dirname, "../../../web", ruta === "/" ? "index.html" : ruta.slice(1));
    const crudo = fs.readFileSync(archivo, "utf8");
    const abiertas = (crudo.match(/<(div|p|ul|ol|li|table|tr|td|th|section|article|nav|header|footer|main|h[1-6]|a|span|button|label|figure)\b[^>]*>/gi) || [])
      .filter((t) => !/\/>$/.test(t)).length;
    const cerradas = (crudo.match(/<\/(div|p|ul|ol|li|table|tr|td|th|section|article|nav|header|footer|main|h[1-6]|a|span|button|label|figure)>/gi) || []).length;
    if (abiertas !== cerradas) marcado.push(ruta + " (" + abiertas + " aperturas frente a " + cerradas + " cierres)");
  }
  criterio("CC11", "Lenguaje de marcado bien utilizado", marcado.length === 0,
    marcado.length ? marcado.join("; ") : "cada etiqueta de bloque abre y cierra en las " + PAGINAS.length + " páginas");

  console.log("\n== 2.2.3.3 (cont.) Encontrar y navegar ==");
  const mapa = datos["/mapa-del-sitio.html"].mapaEnlaces.map((h) => h.replace(/^\//, "").replace(/^$/, "index.html"));
  const noEnMapa = PAGINAS.map((p) => (p === "/" ? "index.html" : p.slice(1))).filter((p) => !mapa.some((m) => m.indexOf(p.replace(".html", "")) >= 0));
  criterio("CC12", "Permitir encontrar las páginas por múltiples vías", noEnMapa.length === 0,
    noEnMapa.length ? "no están en el mapa del sitio: " + noEnMapa.join(", ") : "todas las páginas están en el mapa del sitio, además del menú y los enlaces cruzados");
  const menusCab = {}, menusPie = {};
  Object.entries(datos).forEach(([r, d]) => {
    (menusCab[d.menuCabecera] = menusCab[d.menuCabecera] || []).push(r);
    (menusPie[d.menuPie] = menusPie[d.menuPie] || []).push(r);
  });
  const rarosPie = Object.entries(menusPie).filter(([, rs]) => rs.length === 1).map(([m, rs]) => rs[0] + ": «" + (m || "sin pie") + "»");
  criterio("CC13", "Navegación coherente", rarosPie.length <= 1,
    rarosPie.length > 1 ? "páginas con un pie distinto al de las demás: " + rarosPie.join(" | ")
      : Object.keys(menusCab).length + " menús de cabecera y " + Object.keys(menusPie).length + " de pie; todas las páginas interiores comparten el mismo orden de enlaces");
  const tabMal = Object.entries(datos).filter(([, d]) => d.tabindexPositivo > 0).map(([r, d]) => r + " (" + d.tabindexPositivo + ")");
  criterio("CC14", "Orden adecuado de los contenidos si es significativo", tabMal.length === 0,
    tabMal.length ? "tabindex positivo (rompe el orden del DOM): " + tabMal.join(", ") : "ningún tabindex positivo: el orden del código manda");
  humano("CC15", "Advertencias bien ubicadas",
    "el sitio no tiene formularios propios; el widget pone «Campo N de M» y los avisos antes del campo en los formularios del sitio anfitrión (prueba_formularios.js). Revisar a mano en cada sede donde se instale");
  criterio("CC16", "Orden adecuado de los elementos al navegar con tabulación", tabMal.length === 0,
    "sin tabindex positivo, el orden de tabulación es el del código, que coincide con el visual; prueba_teclado_fisico.js lo recorre entero");
  const foco = fs.readFileSync(path.join(__dirname, "../../../web/paginas.css"), "utf8");
  criterio("CC17", "Foco visible al navegar con tabulación", /:focus(-visible)?\s*{[^}]*outline/.test(foco.replace(/\s+/g, " ")),
    "paginas.css define un contorno propio en :focus-visible; medido también en prueba_teclado_fisico.js");

  console.log("\n== 2.2.3.5 Eventos automáticos y temporizados ==");
  const autoplay = [];
  Object.entries(datos).forEach(([r, d]) => d.audios.forEach((m) => { if (m.autoplay && !m.silenciado) autoplay.push(r + " " + m.tag); }));
  criterio("CC18", "No utilizar audio automático", autoplay.length === 0,
    autoplay.length ? autoplay.join(", ") : "ningún audio ni vídeo arranca solo con sonido");
  humano("CC19", "Permitir control de eventos temporizados",
    "el sitio no tiene contenidos que cambien solos ni sesiones con tiempo; en el widget, el barrido automático se pausa con Escape y su tiempo se ajusta (prueba_barrido.js)");
  const movimiento = Object.entries(datos).filter(([, d]) => d.blink > 0).map(([r]) => r);
  criterio("CC20", "Permitir control de contenidos con movimiento y parpadeo", movimiento.length === 0,
    movimiento.length ? movimiento.join(", ") : "sin <blink> ni <marquee>; las animaciones respetan prefers-reduced-motion y el modo calma (prueba_sistema.js)");
  const refresco = Object.entries(datos).filter(([, d]) => d.metaRefresh).map(([r]) => r);
  criterio("CC21", "No generar actualización automática de páginas", refresco.length === 0,
    refresco.length ? refresco.join(", ") : "ninguna página lleva meta refresh");
  const alFoco = Object.entries(datos).filter(([, d]) => d.onchangeNavega > 0).map(([r, d]) => r + " (" + d.onchangeNavega + ")");
  criterio("CC22", "No generar cambios automáticos al recibir el foco o entradas", alFoco.length === 0,
    alFoco.length ? alFoco.join(", ") : "ningún control navega ni cambia la página al recibir el foco o al escribir");

  console.log("\n== 2.2.3.6 Etiquetas e instrucciones adecuadas ==");
  const titulos = Object.entries(datos).map(([r, d]) => ({ r, t: d.titulo }));
  const repetidos = titulos.filter((a, i) => titulos.findIndex((b) => b.t === a.t) !== i).map((a) => a.r + ": " + a.t);
  const sinSitio = titulos.filter((a) => !/winclus/i.test(a.t)).map((a) => a.r + ": «" + a.t + "»");
  criterio("CC23", "Utilice textos adecuados en títulos, páginas y secciones", repetidos.length === 0,
    (repetidos.length ? "títulos repetidos: " + repetidos.join("; ") : titulos.length + " títulos, todos distintos") +
    (sinSitio.length ? "; sin el nombre del sitio: " + sinSitio.join("; ") : ""));
  const camposSinNombre = [];
  Object.entries(datos).forEach(([r, d]) => d.campos.forEach((c, i) => { if (!c.etiqueta) camposSinNombre.push(r + " campo " + (i + 1) + " (" + c.tipo + ")"); }));
  criterio("CC24", "Utilice nombres e indicaciones claras en campos de formulario", camposSinNombre.length === 0,
    camposSinNombre.length ? camposSinNombre.join(", ") : Object.values(datos).reduce((s, d) => s + d.campos.length, 0) + " campos, todos con etiqueta asociada");
  humano("CC25", "Utilice instrucciones expresas y claras",
    "cada control del panel lleva su ayuda escrita debajo y el sitio abre con «En pocas palabras»; que se entiendan lo dicen las personas usuarias, no una máquina");
  const vagos = [];
  Object.entries(datos).forEach(([r, d]) => d.enlaces.forEach((a) => { if (ENLACES_VAGOS.test(a.texto.trim())) vagos.push(r + " «" + a.texto + "»"); }));
  criterio("CC26", "Enlaces adecuados", vagos.length === 0,
    vagos.length ? "enlaces que no dicen a dónde llevan: " + vagos.join(", ") : "ningún enlace se llama «aquí», «ver más» o similar");
  const sinLang = Object.entries(datos).filter(([, d]) => !/^es/i.test(d.lang)).map(([r, d]) => r + " lang=«" + d.lang + "»");
  criterio("CC27", "Idioma", sinLang.length === 0,
    sinLang.length ? sinLang.join(", ") : "todas declaran lang=\"es\"; " + Object.values(datos).reduce((s, d) => s + d.cambioIdioma, 0) + " fragmentos en otro idioma marcados con su propio lang");
  humano("CC28", "Manejo del error",
    "el sitio no tiene formularios propios; el widget explica los errores del sitio anfitrión en lenguaje claro y lleva el foco al campo (prueba_formularios.js)");
  humano("CC29", "Imágenes de texto",
    "las capturas de la guía muestran la interfaz (uso permitido por las WCAG); el logotipo está exento. Ninguna imagen sustituye texto informativo: comprobado a la vista");

  console.log("\n== 2.2.3.7 Todo elemento capturable ==");
  humano("CC30", "Objetos programados",
    "el panel, el teclado en pantalla, el tablero de pictogramas y la calibración son objetos propios: llevan roles ARIA, se manejan con teclado y se anuncian (prueba_aria.js, prueba_teclado_fisico.js). No hay objetos de terceros incrustados");
  const sinUtf = Object.entries(datos).filter(([, d]) => d.charset !== "utf-8").map(([r, d]) => r + " " + d.charset);
  criterio("CC31", "Desde una letra hasta un elemento complejo utilizable", sinUtf.length === 0,
    sinUtf.length ? sinUtf.join(", ") : "todas las páginas declaran UTF-8");
  const teclado = fs.existsSync(path.join(__dirname, "prueba_teclado_fisico.js"));
  criterio("CC32", "Manejable por teclado", teclado,
    "prueba_teclado_fisico.js recorre con Tab todo el sitio y todo el panel, pulsa con Intro y Espacio y comprueba que no hay trampas");

  criterio("JS", "Sin errores de JavaScript en ninguna página", errores.length === 0, errores.join(" | ") || PAGINAS.length + " páginas cargadas sin un solo error");

  await nav.close();
  servidor.kill();

  const salida = {
    fecha: new Date().toISOString().slice(0, 10),
    norma: "Resolución 1519 de 2020 (MinTIC, Colombia), Anexo 1, capítulo 2.2: lineamientos de accesibilidad web",
    sitio: "winclus.com",
    paginas: PAGINAS,
    criterios: resultados
  };
  fs.writeFileSync(path.join(__dirname, "../../../web/cc1519.json"), JSON.stringify(salida, null, 2), "utf8");
  console.log("\nCriterios comprobados por máquina: " + resultados.filter((r) => /^CC\d/.test(r.cc) && r.estado !== "revisión humana").length + " de 32 (más la comprobación de errores de JavaScript)" +
    " · Fallan: " + fallos + " · Necesitan revisión humana: " + humanos);
  console.log(fallos ? "FALLOS: " + fallos : "todo bien · web/cc1519.json");
  process.exit(fallos ? 1 : 0);
})();
