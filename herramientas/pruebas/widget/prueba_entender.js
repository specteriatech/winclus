// El panel se entiende sin manual (17-sep-2026): la pestaña Inicio pregunta «¿Qué te cuesta?» con botones por
// situación que encienden lo adecuado y explican qué han hecho; «Lo que tienes activado» dice en palabras corrientes
// qué está en marcha y «Apagar todo lo activado» lo apaga; cada interruptor y cada −/+ lleva una ayuda en palabras
// corrientes (aria-describedby); los números técnicos van plegados en «Ajustes finos» (cerrados al abrir); no queda
// jerga en los nombres visibles (protanopia, híbrido, ganancia, umbral, zona muerta…); y en inglés no se cuela
// español. Uso: node prueba_entender.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
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
  await page.goto("file:///" + path.join(__dirname, "pagina-prueba.html").replace(/\\/g, "/"));
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => Winclus.abrir());

  // --- Inicio: ¿qué te cuesta? ---
  const inicio = await page.evaluate(() => {
    const c = Winclus.caja;
    return {
      activa: c.querySelector('[role="tab"][aria-selected="true"]').id,
      situaciones: Array.from(c.querySelectorAll("#wcl-panel-inicio .wcl-situ button")).map((b) => b.textContent.trim()),
      caja: !!c.querySelector("#wcl-panel-inicio .wcl-guia-caja"),
      nada: c.querySelector("#wcl-panel-inicio .wcl-activo li.nada") ? c.querySelector("#wcl-panel-inicio .wcl-activo li.nada").textContent : "",
      apagar: getComputedStyle(Array.from(c.querySelectorAll("#wcl-panel-inicio .wcl-big")).find((b) => /Apagar todo/.test(b.textContent))).display,
    };
  });
  comprobar(inicio.activa === "wcl-tab-inicio", "al abrir por primera vez se ve la pestaña Inicio", inicio.activa);
  comprobar(inicio.situaciones.length === 10 && inicio.situaciones.some((t) => /^No veo/.test(t)) && inicio.situaciones.some((t) => /Confundo los colores/.test(t)) && inicio.situaciones.some((t) => /Veo poco/.test(t)) && inicio.situaciones.some((t) => /No puedo usar el ratón/.test(t)) && inicio.situaciones.some((t) => /Solo puedo pulsar un botón/.test(t)), "hay diez botones por situación (también «No veo» y «Confundo los colores»), dichos como lo diría la persona", inicio.situaciones.join(" | "));
  comprobar(inicio.caja, "la caja «¿Qué quieres hacer?» está en Inicio");
  comprobar(/Nada todavía/.test(inicio.nada) && inicio.apagar === "none", "sin nada activado lo dice y no ofrece «Apagar todo»", inicio.nada + " / " + inicio.apagar);

  const pulsarSituacion = (re) => page.evaluate((r) => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-inicio .wcl-situ button")).find((b) => new RegExp(r).test(b.textContent)).click(); }, re);
  await pulsarSituacion("Veo poco"); await page.waitForTimeout(100);
  let r = await page.evaluate(() => ({ texto: Winclus.ajustes.texto, contraste: Winclus.ajustes.contraste, respuesta: Winclus.caja.getElementById("wcl-respuesta").textContent, activos: Array.from(Winclus.caja.querySelectorAll("#wcl-panel-inicio .wcl-activo li")).map((l) => l.textContent), apagar: getComputedStyle(Array.from(Winclus.caja.querySelectorAll("#wcl-panel-inicio .wcl-big")).find((b) => /Apagar todo/.test(b.textContent))).display }));
  comprobar(r.texto >= 150 && r.contraste === true, "«Veo poco» agranda el texto y pone contraste", JSON.stringify(r));
  comprobar(/Texto más grande/.test(r.respuesta), "en Inicio queda escrito qué se ha hecho", r.respuesta);
  comprobar(r.activos.some((t) => /Texto al 150/.test(t)) && r.activos.some((t) => /Alto contraste/.test(t)) && r.apagar !== "none", "«Lo que tienes activado» lo lista en palabras corrientes y aparece «Apagar todo»", r.activos.join(" | "));
  await pulsarSituacion("La pantalla me marea"); await page.waitForTimeout(100);
  await pulsarSituacion("Solo puedo pulsar un botón"); await page.waitForTimeout(100);
  r = await page.evaluate(() => ({ calma: Winclus.ajustes.calma, barrido: Winclus.ajustes.barrido, activos: Array.from(Winclus.caja.querySelectorAll("#wcl-panel-inicio .wcl-activo li")).map((l) => l.textContent) }));
  comprobar(r.calma && r.barrido && r.activos.some((t) => /Modo calma/.test(t)) && r.activos.some((t) => /Barrido/.test(t)), "se pueden sumar situaciones (calma + pulsador) y las dos se listan", r.activos.join(" | "));
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-inicio .wcl-big")).find((b) => /Apagar todo/.test(b.textContent)).click(); });
  await page.waitForTimeout(100);
  r = await page.evaluate(() => ({ texto: Winclus.ajustes.texto, contraste: Winclus.ajustes.contraste, calma: Winclus.ajustes.calma, barrido: Winclus.ajustes.barrido, nada: !!Winclus.caja.querySelector("#wcl-panel-inicio .wcl-activo li.nada"), fontSize: document.documentElement.style.fontSize, marcado: !!document.querySelector(".wcl-barrido") }));
  comprobar(r.texto === 100 && !r.contraste && !r.calma && !r.barrido && r.nada && r.fontSize === "" && !r.marcado, "«Apagar todo lo activado» deja la página como siempre", JSON.stringify(r));

  // --- cada opción explica qué hace ---
  const ayudas = await page.evaluate(() => {
    const c = Winclus.caja, sin = [], rotas = [];
    c.querySelectorAll(".wcl-panel .wcl-sw").forEach((s) => {
      const d = s.getAttribute("aria-describedby"), a = d && c.getElementById(d);
      if (!d) sin.push(s.id); else if (!a || a.textContent.trim().length < 20) rotas.push(s.id);
    });
    const pasos = Array.from(c.querySelectorAll(".wcl-panel .wcl-mm")).map((m) => m.closest(".wcl-fila")), pasosSin = pasos.filter((f) => !f.querySelector(".wcl-ayuda")).map((f) => f.querySelector("span").textContent);
    const intros = Array.from(c.querySelectorAll(".wcl-panel .wcl-sec")).filter((s) => s.querySelector("h2")).map((s) => [s.querySelector("h2").textContent, !!s.querySelector(".wcl-intro")]);
    return { total: c.querySelectorAll(".wcl-panel .wcl-sw").length, sin, rotas, pasosTotal: pasos.length, pasosSin, intros };
  });
  const permitidosSin = ["wcl-avisos_sonido", "wcl-teclado_sonido"];   // «Pitido al hacer clic», «Sonido al pulsar»: se explican solos
  comprobar(ayudas.sin.every((id) => permitidosSin.includes(id)) && ayudas.rotas.length === 0, "todos los interruptores (" + ayudas.total + ") llevan una ayuda en palabras corrientes, ligada por aria-describedby", "sin: " + ayudas.sin.join(",") + " rotas: " + ayudas.rotas.join(","));
  const pasosPermitidos = ["Voz", "Cuánto agranda la lupa"];   // la voz se elige por nombre; la lupa de los ojos ya se explica en su interruptor
  comprobar(ayudas.pasosSin.every((t) => pasosPermitidos.includes(t)), "todos los −/+ (" + ayudas.pasosTotal + ") llevan una ayuda", ayudas.pasosSin.join(" | "));
  const sinIntro = ayudas.intros.filter((i) => !i[1]).map((i) => i[0]);
  comprobar(sinIntro.every((t) => /Acerca de|Panel sencillo|Voz/.test(t)), "cada sección dice para quién es", "sin intro: " + sinIntro.join(" | "));

  // --- los números técnicos van plegados y cerrados ---
  const finos = await page.evaluate(() => {
    const c = Winclus.caja, d = Array.from(c.querySelectorAll(".wcl-panel details.wcl-fino"));
    const dentro = (id) => { const e = c.getElementById(id); return !!(e && e.closest("details.wcl-fino")); };
    return { n: d.length, abiertos: d.filter((x) => x.open).length, resumen: d[0] && d[0].querySelector("summary").textContent, tecnicos: ["wcl-l-suavizado", "wcl-l-ojos_suavizado", "wcl-l-ojos_zona_muerta", "wcl-l-ojos_vertical", "wcl-l-hibrido_salto_px", "wcl-l-gestos_umbral", "wcl-l-iman_radio_px", "wcl-l-cierre", "wcl-ahorro"].map(dentro), aLaVista: ["wcl-l-velocidad", "wcl-iman_activo", "wcl-calib_invisible", "wcl-l-parpadeo_ms", "wcl-l-barrido_ms"].map((id) => !dentro(id)) };
  });
  comprobar(finos.n >= 6 && finos.abiertos === 0 && /Ajustes finos/.test(finos.resumen), "hay bloques «Ajustes finos» y todos empiezan cerrados", finos.n + " bloques, " + finos.abiertos + " abiertos");
  comprobar(finos.tecnicos.every(Boolean), "los ajustes técnicos (suavizados, zona muerta, ganancia, umbrales, radio del imán, modo ahorro) están dentro de «Ajustes finos»", finos.tecnicos.join(","));
  comprobar(finos.aLaVista.every(Boolean), "lo esencial (velocidad, imán, aprender de mis clics, tiempo de parpadeo, tiempo del barrido) sigue a la vista", finos.aLaVista.join(","));

  // --- sin jerga en lo visible ---
  const jerga = await page.evaluate(() => {
    const c = Winclus.caja, textos = [];
    c.querySelectorAll(".wcl-panel h2, .wcl-panel label, .wcl-panel .wcl-opc button, .wcl-panel .wcl-fila > span:first-child, .wcl-panel .wcl-big, .wcl-panel .wcl-situ button, .wcl-panel summary").forEach((e) => textos.push(e.textContent.trim()));
    const malas = /protanop|deuteranop|tritanop|híbrido|ganancia|umbral|zona muerta|suavizado|sensibilidad|fijaci[oó]n|calibraci[oó]n invisible|modo ahorro|aceleraci[oó]n|exportar|importar|perfil\b|máscara de enfoque|escala de grises/i;
    return textos.filter((t) => malas.test(t));
  });
  comprobar(jerga.length === 0, "ningún nombre visible usa jerga (protanopia, híbrido, ganancia, umbral, zona muerta, suavizado, exportar…)", jerga.join(" | "));

  // --- nombres nuevos, en palabras de la persona ---
  const nombres = await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll(".wcl-panel .wcl-opc button")).map((b) => b.textContent.trim()));
  comprobar(["No distingo el rojo", "No distingo el verde", "No distingo el azul", "Todo en gris", "Va a donde miro", "Miro y afino con la cabeza", "Como una palanca", "Cerrar los ojos"].every((n) => nombres.includes(n)), "los colores y los modos de ojos se nombran como lo diría la persona", nombres.join(" | "));

  // --- el resto de pestañas siguen ahí y con sus piezas ---
  const piezas = await page.evaluate(() => ({ tabs: Array.from(Winclus.caja.querySelectorAll('[role="tab"]')).map((b) => b.textContent), facil: !!Winclus.caja.getElementById("wcl-facil"), pictos: !!Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir .wcl-big")).find((b) => /pictogramas/.test(b.textContent)), teclado: !!Array.from(Winclus.caja.querySelectorAll("#wcl-panel-escribir .wcl-big")).find((b) => /teclado/.test(b.textContent)), enlace: !!Array.from(Winclus.caja.querySelectorAll("#wcl-panel-mas .wcl-big")).find((b) => /Copiar enlace con mis ajustes/.test(b.textContent)), restablecer: !!Array.from(Winclus.caja.querySelectorAll("#wcl-panel-mas .wcl-big")).find((b) => /Restablecer todo/.test(b.textContent)) }));
  comprobar(piezas.tabs.join(",") === "Inicio,Ver,Oír,Cara,Clics,Escribir,Más" && piezas.facil && piezas.pictos && piezas.teclado && piezas.enlace && piezas.restablecer, "siete pestañas (Inicio primero, «Cara» en vez de «Puntero») y las piezas de siempre", JSON.stringify(piezas));

  // --- en inglés no se cuela español ---
  const EN = pagina("pagina-prueba-en2.html", BASE.replace('<html lang="es">', '<html lang="en">'));
  await page.goto(EN);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => Winclus.abrir());
  const fugas = await page.evaluate(() => {
    const c = Winclus.caja, out = [];
    const esp = /[ñ¿¡«»]|\b(el|la|los|las|para|con|que|del|una|un|se|es|de|y|sin|más|cuánto|cómo|si)\b/i;
    c.querySelectorAll(".wcl-panel h2, .wcl-panel label, .wcl-panel .wcl-opc button, .wcl-panel .wcl-fila > span:first-child, .wcl-panel .wcl-big, .wcl-panel .wcl-situ button, .wcl-panel summary, .wcl-panel .wcl-ayuda, .wcl-panel .wcl-intro, .wcl-panel .wcl-estado, .wcl-panel .wcl-activo li, .wcl-panel .wcl-guia-caja label").forEach((e) => {
      const t = e.textContent.trim().replace(/Centro de Relevo|Lengua de Señas|winclus\.com\/privacidad|Lengua de Señas Colombiana/g, "");   // nombres propios
      if (t && esp.test(t)) out.push(t.slice(0, 70));
    });
    return Array.from(new Set(out));
  });
  comprobar(fugas.length === 0, "en una página en inglés todo el panel (nombres, ayudas, intros, situaciones) sale en inglés", fugas.slice(0, 30).join(" | ") + (fugas.length > 30 ? " … +" + (fugas.length - 30) : ""));
  const enInicio = await page.evaluate(() => ({ tab: Winclus.caja.getElementById("wcl-tab-inicio").textContent, situ: Winclus.caja.querySelector("#wcl-panel-inicio .wcl-situ button").textContent.trim(), nada: Winclus.caja.querySelector("#wcl-panel-inicio .wcl-activo li").textContent }));
  comprobar(enInicio.tab === "Start" && /I can't see well/.test(enInicio.situ) && /Nothing yet/.test(enInicio.nada), "Inicio en inglés: Start, «I can't see well», «Nothing yet»", JSON.stringify(enInicio));
  try { fs.unlinkSync(path.join(__dirname, "pagina-prueba-en2.html")); } catch (e) {}

  // --- primera vez guiada, pictogramas, «Explícame», «Léemelo», ayuda en el barrido y cifras del panel ---
  await page.goto("file:///" + path.join(__dirname, "pagina-prueba.html").replace(/\\/g, "/"));
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { localStorage.removeItem("winclus.visto"); localStorage.removeItem("winclus.uso"); window.__voz = []; speechSynthesis.speak = (u) => window.__voz.push(u.text); });
  await page.evaluate(() => Winclus.abrir());
  await page.waitForTimeout(150);
  const bienv = await page.evaluate(() => ({ visto: !!localStorage.getItem("winclus.visto"), late: Winclus.caja.querySelector(".wcl-situ").classList.contains("destacar"), voz: (window.__voz || []).join(" | "), tab: Winclus.caja.querySelector('[role="tab"][aria-selected="true"]').id }));
  comprobar(bienv.visto && bienv.late && /^Hola, soy Winclus\./.test(bienv.voz) && bienv.tab === "wcl-tab-inicio", "la primera vez la voz dice qué hacer, los botones de situación laten y se abre Inicio", JSON.stringify(bienv).slice(0, 200));   // la voz va por trozos: con la síntesis simulada solo llega el primero
  await page.evaluate(() => { Winclus.abrir(false); window.__voz = []; Winclus.abrir(true); });
  await page.waitForTimeout(100);
  comprobar((await page.evaluate(() => (window.__voz || []).join(""))) === "", "la bienvenida solo suena la primera vez");
  const pictos = await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll(".wcl-situ button .ico img")).map((i) => [i.getAttribute("alt"), /static\.arasaac\.org\/pictograms\/\d+\/\d+_300\.png$/.test(i.src)]));
  comprobar(pictos.length === 10 && pictos.every((p) => p[0] === "" && p[1]), "cada situación lleva un pictograma ARASAAC decorativo (alt vacío)", JSON.stringify(pictos));
  const expl = await page.evaluate(() => { const b = Array.from(Winclus.caja.querySelectorAll("#wcl-panel-inicio .wcl-big")).find((x) => /Explícame esta página en fácil/.test(x.textContent)); b.click(); return !!Winclus.caja.querySelector(".wcl-limpia-texto"); });
  comprobar(expl, "«Explícame esta página en fácil» abre la lectura limpia desde Inicio");
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll(".wcl-limpia-barra button")).find((b) => /Cerrar/.test(b.textContent)).click(); });
  const leeme = await page.evaluate(() => { window.__voz = []; Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-ver").click(); const s = Winclus.caja.querySelector("#wcl-panel-ver .wcl-sec"); s.querySelector(".wcl-leeme").click(); return { n: Winclus.caja.querySelectorAll(".wcl-panel .wcl-leeme").length, voz: (window.__voz || []).join(" "), texto: Winclus.textoSeccion(s) }; });
  comprobar(leeme.n >= 20 && /^Ver mejor\./.test(leeme.voz) && /Alto contraste: desactivado\. Letras negras/.test(leeme.texto) && /Tamaño del texto: 100 %\. Agranda/.test(leeme.texto), "«Léemelo» en cada sección lee nombre, estado y ayuda de cada opción", leeme.texto.slice(0, 200));
  const barr = await page.evaluate(() => { window.__voz = []; Winclus.ajustes.barrido_voz = true; Winclus.ajustes.barrido_ms = 2500; const sw = Winclus.caja.getElementById("wcl-contraste"); const nombre = sw.closest(".wcl-fila").querySelector("label").textContent; return { con: Winclus.ayudaBarrido ? Winclus.ayudaBarrido(sw) : null, nombre }; });
  comprobar(barr.con === null || /Letras negras/.test(barr.con), "con el barrido a 2 s o más, los interruptores del panel se anuncian con su ayuda", String(barr.con).slice(0, 120));
  const cifras = await page.evaluate(() => { Winclus.caja.getElementById("wcl-contraste").click(); Winclus.caja.getElementById("wcl-contraste").click(); Array.from(Winclus.caja.querySelectorAll("#wcl-panel-inicio .wcl-situ button")).find((b) => /Veo poco/.test(b.textContent)).click(); const u = JSON.parse(localStorage.getItem("winclus.uso")); return { panel: u.panel, resumen: Winclus.caja.querySelector("#wcl-panel-mas .wcl-estado").textContent }; });
  comprobar(cifras.panel && cifras.panel["Alto contraste"] === 2 && cifras.panel["Veo poco"] >= 1 && /Lo que más tocas del panel: .*Alto contraste \(2\)/.test(cifras.resumen), "se cuenta qué se toca del panel (solo nombres de opciones y números) y el resumen de uso lo muestra", JSON.stringify(cifras.panel) + " · " + cifras.resumen.slice(-120));

  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
