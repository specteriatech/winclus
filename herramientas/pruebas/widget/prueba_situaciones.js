// «¿Qué te cuesta?» se pone y se quita (21-sep-2026, 0.6.16). Cada una de las 10 opciones enciende lo que dice,
// queda marcada (aria-pressed y ✓) y, al tocarla otra vez, deja esos ajustes exactamente como estaban antes (no
// como vienen de fábrica). El permiso de la cámara sale en Inicio, donde está la persona (antes salía en la pestaña
// Cara, escondida, y parecía que «No puedo usar el ratón» no hacía nada). El panel se abre en la vista sencilla,
// sin pestañas; «Ver más opciones» las enseña y «Volver a como estaba» lo quita todo. Uso: node prueba_situaciones.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const path = require("path");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto("file:///" + path.join(__dirname, "pagina-prueba.html").replace(/\\/g, "/"));
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { localStorage.setItem("winclus.visto", "1"); Winclus.abrir(); });

  // --- la vista sencilla ---
  let v = await page.evaluate(() => {
    const c = Winclus.caja, vis = (e) => !!(e && e.offsetParent);
    return { tabs: vis(c.querySelector(".wcl-tabs")), opciones: [...c.querySelectorAll(".wcl-situ button")].map((b) => b.dataset.situ),
      verMas: vis(c.getElementById("wcl-ver-mas")), comoEstaba: vis(c.getElementById("wcl-como-estaba")), pie: getComputedStyle(c.querySelector(".wcl-pie")).position };
  });
  comprobar(!v.tabs && v.verMas && v.comoEstaba && v.pie === "sticky", "el panel se abre en la vista sencilla: sin pestañas, con «Ver más opciones» y «Volver a como estaba» fijos abajo", JSON.stringify(v));
  comprobar(v.opciones.join(",") === "veo,noveo,colores,oir,raton,pulsador,hablar,leer,escribir,marea", "hay 10 opciones, con «No veo» y «Confundo los colores» nuevas", v.opciones.join(","));

  const toca = (id) => page.evaluate((i) => { Winclus.caja.querySelector('[data-situ="' + i + '"]').click(); }, id);
  const estado = (id) => page.evaluate((i) => {
    const a = Winclus.ajustes, b = Winclus.caja.querySelector('[data-situ="' + i + '"]');
    return { pulsado: b.getAttribute("aria-pressed"), marca: getComputedStyle(b, "::after").content, respuesta: Winclus.caja.getElementById("wcl-respuesta").textContent,
      texto: a.texto, contraste: a.contraste, lector: a.lector, dalton: a.dalton, enlaces: a.enlaces, alertas: a.alertas_sonido, subtitulos: a.subtitulos,
      barrido: a.barrido, calma: a.calma, animaciones: a.animaciones, pictos: !!document.querySelector(".wcl-pictos") || !!Winclus.caja.querySelector(".wcl-pictos[style*=flex]"),
      tablero: !!(Winclus.caja.querySelector(".wcl-pictos") && Winclus.caja.querySelector(".wcl-pictos").style.display !== "none"),
      limpia: !!Winclus.caja.querySelector(".wcl-limpia"), teclado: !!Winclus.caja.querySelector(".wcl-tec.visible"), html: document.documentElement.className };
  }, id);

  // --- las que cambian ajustes: se ponen, y al quitarlas vuelve lo de ANTES (no lo de fábrica) ---
  await page.evaluate(() => { Winclus.ajustes.texto = 200; });   // la persona ya tenía la letra al 200 %
  await toca("veo"); let e = await estado("veo");
  comprobar(e.pulsado === "true" && /✓/.test(e.marca) && e.texto === 200 && e.contraste === true && /Texto más grande/.test(e.respuesta), "«Veo poco» pone contraste (respeta la letra al 200 % que ya tenía), queda marcada con ✓ y lo dice en el pie", JSON.stringify(e));
  await toca("veo"); e = await estado("veo");
  comprobar(e.pulsado === "false" && e.texto === 200 && e.contraste === false && /Quitado: Veo poco/.test(e.respuesta), "al tocarla otra vez se quita y deja la letra en 200 %, como estaba antes", JSON.stringify({ texto: e.texto, contraste: e.contraste, r: e.respuesta }));
  await page.evaluate(() => { Winclus.ajustes.texto = 100; });

  const casos = [
    ["noveo", (x) => x.lector === true, (x) => x.lector === false, "«No veo» enciende el lector de la página"],
    ["colores", (x) => x.dalton === "deutan" && x.enlaces === true, (x) => x.dalton === "no" && x.enlaces === false, "«Confundo los colores» corrige los colores y subraya los enlaces"],
    ["oir", (x) => x.alertas && x.subtitulos, (x) => !x.alertas && !x.subtitulos, "«No oigo bien» pone avisos en pantalla y subtítulos grandes"],
    ["pulsador", (x) => x.barrido === true, (x) => x.barrido === false, "«Solo puedo pulsar un botón» enciende el barrido"],
    ["marea", (x) => x.calma && x.animaciones, (x) => !x.calma && !x.animaciones, "«La pantalla me marea» pone el modo calma"],
    ["hablar", (x) => x.tablero, (x) => !x.tablero, "«No puedo hablar» abre el tablero de dibujos"],
    ["leer", (x) => x.limpia, (x) => !x.limpia, "«Me cuesta leer o entender» abre la página en fácil"],
    ["escribir", (x) => x.teclado, (x) => !x.teclado, "«Me cuesta escribir» abre el teclado en pantalla"]
  ];
  for (const [id, puesto, quitado, nombre] of casos) {
    await toca(id); await page.waitForTimeout(150); const a = await estado(id);
    await toca(id); await page.waitForTimeout(150); const b = await estado(id);
    comprobar(a.pulsado === "true" && puesto(a) && a.respuesta.length > 10 && b.pulsado === "false" && quitado(b), nombre + ", y al tocarla otra vez se quita", id + ": " + a.pulsado + "→" + b.pulsado);
  }

  // --- el botón «Quitar» del pie deshace lo último ---
  await toca("oir");
  const q1 = await page.evaluate(() => getComputedStyle(Winclus.caja.querySelector(".wcl-quitar")).display);
  await page.evaluate(() => Winclus.caja.querySelector(".wcl-quitar").click());
  e = await estado("oir");
  comprobar(q1 !== "none" && e.pulsado === "false" && !e.alertas, "«Quitar», en el pie, deshace la última opción", q1 + " / " + e.pulsado);

  // --- se suman, se recuerdan al volver y «Volver a como estaba» lo quita todo ---
  await toca("veo"); await toca("marea");
  await page.reload(); await page.waitForFunction(() => window.Winclus); await page.evaluate(() => Winclus.abrir());
  let m = await page.evaluate(() => [...Winclus.caja.querySelectorAll(".wcl-situ button[aria-pressed=true]")].map((b) => b.dataset.situ).join(","));
  comprobar(m === "veo,marea", "se pueden sumar varias y al volver a la página siguen marcadas", m);
  await page.evaluate(() => Winclus.caja.getElementById("wcl-como-estaba").click());
  m = await page.evaluate(() => ({ marcadas: Winclus.caja.querySelectorAll(".wcl-situ button[aria-pressed=true]").length, texto: Winclus.ajustes.texto, calma: Winclus.ajustes.calma, r: Winclus.caja.getElementById("wcl-respuesta").textContent }));
  comprobar(m.marcadas === 0 && m.texto === 100 && !m.calma && /como al principio/.test(m.r), "«Volver a como estaba» quita todas y lo dice", JSON.stringify(m));

  // --- si la persona quita a mano lo que puso una opción, la opción deja de marcarse ---
  await toca("marea");
  await page.evaluate(() => { Winclus.ajustes.calma = false; Winclus.ajustes.animaciones = false; Winclus.cerrar(); Winclus.abrir(); });
  await page.waitForTimeout(1700);
  e = await estado("marea");
  comprobar(e.pulsado === "false", "si se apaga a mano lo que puso una opción, deja de estar marcada", e.pulsado);

  // --- «No puedo usar el ratón»: el permiso sale en Inicio, a la vista, con el foco en «Acepto» ---
  await page.evaluate(() => localStorage.removeItem("winclus.consentimiento_camara"));
  await toca("raton"); await page.waitForTimeout(200);
  let c = await page.evaluate(() => { const k = Winclus.caja.querySelector(".wcl-consent"); return { visible: !!(k && k.offsetParent), enInicio: !!(k && k.closest("#wcl-panel-inicio")), foco: (Winclus.caja.activeElement || {}).textContent, r: Winclus.caja.getElementById("wcl-respuesta").textContent }; });
  comprobar(c.visible && c.enInicio && /Acepto/.test(c.foco) && /permiso/.test(c.r), "«No puedo usar el ratón» enseña el permiso de la cámara en Inicio, con el foco en «Acepto»", JSON.stringify(c));
  await page.evaluate(() => [...Winclus.caja.querySelectorAll(".wcl-consent button")].find((b) => /Ahora no/.test(b.textContent)).click());
  c = await page.evaluate(() => ({ queda: !!Winclus.caja.querySelector(".wcl-consent"), pulsado: Winclus.caja.querySelector('[data-situ="raton"]').getAttribute("aria-pressed"), foco: (Winclus.caja.activeElement || {}).dataset && Winclus.caja.activeElement.dataset.situ }));
  comprobar(!c.queda && c.pulsado === "false" && c.foco === "raton", "«Ahora no» cierra el permiso, no marca la opción y devuelve el foco a ella", JSON.stringify(c));

  // --- «Ver más opciones» enseña las pestañas; «Volver a lo sencillo» las esconde ---
  await page.evaluate(() => Winclus.caja.getElementById("wcl-ver-mas").click());
  v = await page.evaluate(() => ({ tabs: !!Winclus.caja.querySelector(".wcl-tabs").offsetParent, activa: Winclus.caja.querySelector("[role=tab][aria-selected=true]").id, boton: Winclus.caja.getElementById("wcl-ver-mas").textContent, exp: Winclus.caja.getElementById("wcl-ver-mas").getAttribute("aria-expanded") }));
  comprobar(v.tabs && v.activa === "wcl-tab-ver" && /Volver a lo sencillo/.test(v.boton) && v.exp === "true", "«Ver más opciones» enseña las pestañas y lleva a Ver", JSON.stringify(v));
  await page.evaluate(() => Winclus.caja.getElementById("wcl-ver-mas").click());
  v = await page.evaluate(() => ({ tabs: !!Winclus.caja.querySelector(".wcl-tabs").offsetParent, activa: Winclus.caja.querySelector("[role=tab][aria-selected=true]").id }));
  comprobar(!v.tabs && v.activa === "wcl-tab-inicio", "«Volver a lo sencillo» esconde las pestañas y vuelve a «¿Qué te cuesta?»", JSON.stringify(v));

  // --- con palabras: la caja «Dímelo» usa las mismas opciones (y marca el ✓) ---
  await page.evaluate(() => { const i = Winclus.caja.getElementById("wcl-que"); i.value = "soy ciego"; i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
  e = await estado("noveo");
  comprobar(e.pulsado === "true" && e.lector === true, "escribir «soy ciego» en la caja enciende «No veo» y lo marca", e.pulsado);
  await toca("noveo");
  await page.evaluate(() => { const i = Winclus.caja.getElementById("wcl-que"); i.value = "no veo bien"; i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
  e = await estado("veo");
  comprobar(e.pulsado === "true" && (await estado("noveo")).pulsado === "false", "«no veo bien» es «Veo poco», no «No veo»");

  // --- con teclado: las opciones son botones de verdad (Tab e Intro) ---
  await page.evaluate(() => Winclus.caja.getElementById("wcl-como-estaba").click());
  await page.evaluate(() => Winclus.caja.querySelector('[data-situ="oir"]').focus());
  await page.keyboard.press("Enter"); await page.waitForTimeout(100);
  e = await estado("oir");
  comprobar(e.pulsado === "true" && e.alertas, "con el teclado: Intro sobre una opción la pone", e.pulsado);

  comprobar(errores.length === 0, "sin errores de JavaScript", errores.slice(0, 2).join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
