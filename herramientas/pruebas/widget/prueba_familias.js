// Hoja de ruta por familias (docs/hoja-ruta-familias.md). Bloque 1, paridad con los overlays (0.6.3): tipo de letra
// («Legible» Verdana, «Para dislexia» OpenDyslexic servida desde winclus.com/fuentes), espacio entre renglones,
// texto alineado a la izquierda y zoom de toda la página. Bloque 1b (0.6.4): resaltar títulos y foco, silenciar la
// página, diccionario al toque (glosario del sitio, ARASAAC con dibujo, Wikcionario; también con el puntero facial y
// dentro de la lectura limpia) y sílabas coloreadas en la lectura limpia (familia 6). Todo se aplica a la página
// anfitriona, no al widget, se guarda, aparece en «Lo que tienes activado» y se apaga con «Apagar todo lo activado».
// ARASAAC y Wikcionario se simulan con page.route. Uso: node prueba_familias.js
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

  // ===== 0.6.4: familia 1 completa (títulos, foco, silencio, diccionario) y familia 6 (sílabas, diccionario con dibujo) =====
  // Respuestas simuladas de ARASAAC y Wikcionario: la prueba no depende de la red
  await page.route(/api\.arasaac\.org\/api\/pictograms\/es\/search\//, (ruta) => {
    const palabra = decodeURIComponent(ruta.request().url().split("/search/")[1]);
    const lista = palabra === "casa" ? [{ _id: 1, keywords: [{ keyword: "casaca" }] }, { _id: 6964, keywords: [{ keyword: "casa", meaning: "Edificio para vivir." }] }] : palabra === "grande" ? [{ _id: 2, keywords: [{ keyword: "grandeza" }] }] : [];
    ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(lista) });
  });
  await page.route(/es\.wiktionary\.org\/w\/api\.php/, (ruta) => {
    ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ query: { pages: { "1": { extract: "== Español ==\n=== Adjetivo ===\n1 Que tiene un tamaño mayor de lo normal.\n2 Otra acepción." } } } }) });
  });
  await page.evaluate(() => { const p = document.createElement("p"); p.id = "dicc"; p.textContent = "Una casa grande, un murciélago y un enlace."; document.querySelector("main").insertBefore(p, document.getElementById("relleno")); window.WinclusGlosario = { "Texto": "Lo que está escrito en la página." }; });

  // --- resaltar títulos y foco ---
  await page.evaluate(() => { Winclus.caja.getElementById("wcl-tab-ver").click(); Winclus.caja.getElementById("wcl-titulos").click(); Winclus.caja.getElementById("wcl-foco").click(); });
  r = await page.evaluate(() => { const h = getComputedStyle(document.querySelector("h1")); document.getElementById("boton-sitio").focus(); const b = getComputedStyle(document.getElementById("boton-sitio")); return { clases: ["wcl-titulos", "wcl-foco"].filter((c) => document.documentElement.classList.contains(c)), borde: h.borderLeftWidth, fondo: h.backgroundColor, foco: b.outlineWidth, panel: getComputedStyle(Winclus.caja.querySelector(".wcl-panel h2")).borderLeftWidth }; });
  comprobar(r.clases.length === 2 && r.borde === "12px" && r.fondo === "rgb(255, 243, 196)" && parseFloat(r.foco) >= 4.5 && r.panel === "0px", "«Resaltar títulos» pone fondo y borde a los h1–h4 de la página y «Resaltar dónde estás» un marco de 5 px al foco (medido bajo el zoom); el panel no cambia", JSON.stringify(r));

  // --- silenciar la página ---
  await page.evaluate(() => { const m = document.querySelector("main"); ["v1", "v2"].forEach((id) => { const v = document.createElement("video"); v.id = id; m.appendChild(v); }); document.getElementById("v2").muted = true; Winclus.caja.getElementById("wcl-tab-oir").click(); Winclus.caja.getElementById("wcl-silencio").click(); });
  await page.evaluate(() => { const v = document.createElement("video"); v.id = "v3"; document.querySelector("main").appendChild(v); v.dispatchEvent(new Event("play", { bubbles: true })); document.getElementById("v1").muted = false; });
  await page.waitForTimeout(80);   // «volumechange» llega en otra tarea
  r = await page.evaluate(() => ({ v1: document.getElementById("v1").muted, v2: document.getElementById("v2").muted, v3: document.getElementById("v3").muted }));
  comprobar(r.v1 && r.v2 && r.v3, "«Silenciar la página» silencia lo que hay, lo que arranca después y lo que alguien vuelve a activar", JSON.stringify(r));
  await page.evaluate(() => { Winclus.caja.getElementById("wcl-silencio").click(); });
  r = await page.evaluate(() => ({ v1: document.getElementById("v1").muted, v2: document.getElementById("v2").muted, v3: document.getElementById("v3").muted }));
  comprobar(!r.v1 && r.v2 && !r.v3, "al apagarlo vuelve el sonido solo a lo que silenció Winclus (lo que el sitio tenía en silencio se queda así)", JSON.stringify(r));

  // --- diccionario al toque ---
  const centroDe = (sel, palabra, enWidget) => page.evaluate(([s, w, enW]) => {
    const base = enW ? Winclus.caja : document, e = base.querySelector(s), tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n;
    const span = Array.from(e.querySelectorAll(".w")).find((x) => x.textContent.replace(/[^A-Za-zÀ-ÿ]/g, "") === w);   // con sílabas, la palabra está repartida en <span>
    if (span) { const b = span.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }
    while ((n = tw.nextNode())) { const i = n.nodeValue.indexOf(w); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length); const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; } }
    return null;
  }, [sel, palabra, !!enWidget]);
  const dicc = () => page.evaluate(() => { const d = Winclus.caja.querySelector(".wcl-defin"); return d ? { titulo: d.querySelector("b").textContent, def: (d.querySelector("p") || {}).textContent || "", fuente: (d.querySelector("small") || {}).textContent || "", img: (d.querySelector("img") || {}).src || "" } : null; });
  const esperarDef = async () => { await page.waitForFunction(() => { const d = Winclus.caja.querySelector(".wcl-defin"); return d && d.querySelector("small,.botones"); }, null, { timeout: 8000 }).catch(() => {}); return dicc(); };
  await page.evaluate(() => { Winclus.caja.getElementById("wcl-tab-ver").click(); Winclus.caja.getElementById("wcl-diccionario").click(); Winclus.cerrar(); });
  let c = await centroDe("main p", "Texto"); await page.mouse.click(c.x, c.y); r = await esperarDef();
  comprobar(r && r.titulo === "texto" && /Lo que está escrito/.test(r.def) && /glosario de este sitio/.test(r.fuente), "tocar una palabra abre su definición; primero manda el glosario del sitio (window.WinclusGlosario)", JSON.stringify(r));
  await page.keyboard.press("Escape");
  c = await centroDe("#dicc", "casa"); await page.mouse.click(c.x, c.y); r = await esperarDef();
  comprobar(r && r.titulo === "casa" && /Edificio para vivir/.test(r.def) && /ARASAAC/.test(r.fuente) && /6964_300\.png/.test(r.img), "si el sitio no la tiene, ARASAAC da el significado y el dibujo (solo con coincidencia exacta de la palabra)", JSON.stringify(r));
  await page.keyboard.press("Escape");
  c = await centroDe("#dicc", "grande"); await page.mouse.click(c.x, c.y); r = await esperarDef();
  comprobar(r && r.titulo === "grande" && /tamaño mayor de lo normal/.test(r.def) && /Wikcionario/.test(r.fuente) && !r.img, "sin dibujo exacto en ARASAAC, la definición viene de Wikcionario (primera acepción)", JSON.stringify(r));
  r = await page.evaluate(() => { const d = Winclus.caja.querySelector(".wcl-defin"), b = d.getBoundingClientRect(); return { dentro: b.left >= 0 && b.right <= window.innerWidth && b.top >= 0 && b.bottom <= window.innerHeight, rol: d.getAttribute("role"), botones: Array.from(d.querySelectorAll("button")).map((x) => x.getBoundingClientRect().height >= 44) }; });
  comprobar(r.dentro && r.rol === "dialog" && r.botones.length === 2 && r.botones.every(Boolean), "la ventanita queda dentro de la pantalla, es un diálogo y sus botones miden 44 px", JSON.stringify(r));
  await page.keyboard.press("Escape");
  r = await page.evaluate(() => !!Winclus.caja.querySelector(".wcl-defin"));
  comprobar(!r, "Escape cierra la definición", String(r));
  await page.click("#boton-sitio"); await page.waitForTimeout(150);
  r = await page.evaluate(() => !!Winclus.caja.querySelector(".wcl-defin"));
  comprobar(!r, "tocar un botón o un enlace no abre el diccionario: siguen funcionando como siempre", String(r));
  r = await page.evaluate(() => Winclus.definir("radicar"));
  comprobar(r && /Entregar un documento/.test(r.definicion) && r.fuente === "Winclus", "Winclus.definir() usa también el glosario de trámites del widget («radicar»)", JSON.stringify(r));
  c = await centroDe("#dicc", "casa"); await page.evaluate(([x, y]) => { Winclus.mover(x, y); Winclus.clic(); }, [c.x, c.y]); r = await esperarDef();
  comprobar(r && r.titulo === "casa", "el clic del puntero facial también abre el diccionario", JSON.stringify(r));
  await page.keyboard.press("Escape");

  // --- sílabas (en la lectura limpia) y diccionario dentro de ella ---
  r = await page.evaluate(() => { const casos = { murciélago: "mur-cié-la-go", transporte: "trans-por-te", instrucción: "ins-truc-ción", aeropuerto: "a-e-ro-puer-to", país: "pa-ís", guerra: "gue-rra", ahora: "a-ho-ra", construir: "cons-truir", abstracto: "abs-trac-to", ciudad: "ciu-dad", leer: "le-er", también: "tam-bién", extraordinario: "ex-tra-or-di-na-rio", atleta: "at-le-ta", llave: "lla-ve", estrella: "es-tre-lla", pingüino: "pin-güi-no", veía: "ve-í-a", hoy: "hoy", Murciélago: "Mur-cié-la-go" }; return Object.keys(casos).filter((k) => Winclus.silabear(k).join("-") !== casos[k]).map((k) => k + "→" + Winclus.silabear(k).join("-")); });
  comprobar(r.length === 0, "Winclus.silabear() separa 20 palabras según las reglas del español (diptongos, hiatos, grupos inseparables, dígrafos)", r.join(" "));
  await page.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-ver").click(); Array.from(Winclus.caja.querySelectorAll("#wcl-panel-ver .wcl-big")).find((b) => /Lectura limpia/.test(b.textContent)).click(); });
  const antes = await page.evaluate(() => Winclus.caja.querySelector(".wcl-limpia-texto").textContent.replace(/\s+/g, " ").trim());
  await page.evaluate(() => { Winclus.caja.querySelector('.wcl-limpia [data-a="silabas"]').click(); });
  r = await page.evaluate(() => { const t = Winclus.caja.querySelector(".wcl-limpia-texto"); const w = Array.from(t.querySelectorAll(".w")).find((x) => /murciélago/.test(x.textContent)); return { texto: t.textContent.replace(/\s+/g, " ").trim(), sil: w ? Array.from(w.querySelectorAll(".sil")).map((s) => s.textContent + ":" + s.className.replace("sil ", "")) : [], pulsado: Winclus.caja.querySelector('.wcl-limpia [data-a="silabas"]').getAttribute("aria-pressed"), color1: getComputedStyle(t.querySelector(".sil.s1")).color, color2: getComputedStyle(t.querySelector(".sil.s2")).color }; });
  comprobar(r.texto === antes && r.sil.join(" ") === "mur:s1 cié:s2 la:s1 go:s2" && r.pulsado === "true" && r.color1 !== r.color2, "«Sílabas» en la lectura limpia colorea cada sílaba alternando dos colores sin cambiar el texto", JSON.stringify(r).slice(0, 300));
  c = await centroDe(".wcl-limpia-texto", "casa", true); await page.mouse.click(c.x, c.y); r = await esperarDef();
  comprobar(r && r.titulo === "casa" && /Edificio para vivir/.test(r.def), "el diccionario también funciona dentro de la lectura limpia, con las sílabas puestas", JSON.stringify(r));
  await page.evaluate(() => { Winclus.caja.querySelector('.wcl-limpia [data-a="silabas"]').click(); });
  r = await page.evaluate(() => { const t = Winclus.caja.querySelector(".wcl-limpia-texto"); return { sil: t.querySelectorAll(".sil").length, texto: t.textContent.replace(/\s+/g, " ").trim() }; });
  comprobar(r.sil === 0 && r.texto === antes, "volver a pulsar «Sílabas» las quita", JSON.stringify(r).slice(0, 120));
  r = await page.evaluate(() => { Winclus.caja.querySelector('.wcl-limpia [data-a="cerrar"]').click(); return { limpia: !!Winclus.caja.querySelector(".wcl-limpia"), defin: !!Winclus.caja.querySelector(".wcl-defin") }; });
  comprobar(!r.limpia && !r.defin, "al cerrar la lectura limpia se cierra también la definición que estaba abierta", JSON.stringify(r));
  await page.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-oir").click(); Winclus.caja.getElementById("wcl-silencio").click(); });

  // --- lo activado y apagar todo ---
  r = await page.evaluate(() => { Winclus.caja.getElementById("wcl-tab-inicio").click(); return Array.from(Winclus.caja.querySelectorAll("#wcl-panel-inicio .wcl-activo li")).map((l) => l.textContent); });
  comprobar(["Texto a la izquierda", "Espacio entre renglones", "Zoom de la página", "Títulos resaltados", "Foco resaltado", "Página en silencio", "Diccionario al tocar"].every((t) => r.includes(t)), "«Lo que tienes activado» lista los siete ajustes nuevos", r.join(" | "));
  r = await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-inicio .wcl-big")).find((b) => /Apagar todo/.test(b.textContent)).click(); const h = document.documentElement; return { clases: ["wcl-letra-legible", "wcl-letra-dislexia", "wcl-alinear", "wcl-interlineado", "wcl-titulos", "wcl-foco", "wcl-dicc"].filter((c) => h.classList.contains(c)), zoom: document.body.style.zoom, v1: document.getElementById("v1").muted, a: Winclus.ajustes }; });
  comprobar(r.clases.length === 0 && r.zoom === "" && !r.v1 && r.a.letra === "no" && !r.a.alinear && r.a.interlineado === 100 && r.a.zoom_pagina === 100 && !r.a.titulos && !r.a.foco && !r.a.silencio && !r.a.diccionario, "«Apagar todo lo activado» los quita", JSON.stringify(r.clases) + " " + r.zoom + " v1:" + r.v1);

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
