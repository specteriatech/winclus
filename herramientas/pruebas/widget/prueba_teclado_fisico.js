// Teclado físico y pulsador: las teclas del teclado en pantalla y las frases se alcanzan con Tab y se
// pulsan con Intro sin perder el sitio; y con el lector básico activo, Espacio e Intro siguen
// activando los botones, casillas y enlaces reales de la página. Uso: node prueba_teclado_fisico.js
const { chromium } = require("playwright");
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => localStorage.setItem("winclus.ajustes", JSON.stringify({ voz_activa: false, teclado_sonido: false })));
  const page = await ctx.newPage();
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { const c = document.createElement("input"); c.id = "campo"; c.type = "text"; document.querySelector("main").prepend(c); });

  // --- teclado en pantalla con Tab ---
  await page.focus("#campo");
  await page.evaluate(() => Winclus.teclado());
  await page.waitForTimeout(200);
  const nTab = await page.evaluate(() => Winclus.caja.querySelectorAll(".wcl-tec button[tabindex='-1']").length);
  comprobar(nTab === 0, "ninguna tecla con tabindex=-1", nTab + " con -1");
  // Tab desde el campo hasta la primera tecla (el teclado está al final del documento)
  let llegado = false, pasos = 0;
  while (pasos < 80 && !llegado) { await page.keyboard.press("Tab"); pasos++; llegado = await page.evaluate(() => !!(Winclus.caja.activeElement || document.activeElement).closest(".wcl-tec")); }
  comprobar(llegado, "con Tab se llega al teclado en pantalla", pasos + " pulsaciones");
  // hasta la tecla «q»
  let enQ = false; pasos = 0;
  while (pasos < 60 && !enQ) { enQ = await page.evaluate(() => (Winclus.caja.activeElement || document.activeElement).textContent === "q"); if (!enQ) { await page.keyboard.press("Tab"); pasos++; } }
  comprobar(enQ, "se llega a la tecla q");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  const valor1 = await page.$eval("#campo", (e) => e.value);
  const focoTrasQ = await page.evaluate(() => (Winclus.caja.activeElement || document.activeElement).textContent);
  comprobar(valor1 === "q", "Intro sobre q escribe en el campo", "campo=" + JSON.stringify(valor1));
  comprobar(focoTrasQ === "q", "el foco se queda en la tecla", "foco en " + JSON.stringify(focoTrasQ));
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  comprobar((await page.$eval("#campo", (e) => e.value)) === "qq", "Espacio también pulsa la tecla");
  // Mayús redibuja el teclado: el foco pasa a la tecla del mismo sitio
  const iMayus = await page.evaluate(() => { const b = Array.from(Winclus.caja.querySelectorAll(".wcl-tec button")).find((x) => x.textContent === "Mayús"); b.focus(); return Array.from(Winclus.caja.querySelectorAll(".wcl-tec button")).indexOf(b); });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const trasMayus = await page.evaluate(() => ({ foco: (Winclus.caja.activeElement || document.activeElement).textContent, enTec: !!(Winclus.caja.activeElement || document.activeElement).closest(".wcl-tec"), q: !!Array.from(Winclus.caja.querySelectorAll(".wcl-tec button")).find((x) => x.textContent === "Q") }));
  comprobar(trasMayus.enTec && trasMayus.foco === "Mayús" && trasMayus.q, "tras Mayús el teclado se redibuja y el foco sigue en Mayús", JSON.stringify(trasMayus));
  // Frases
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll(".wcl-tec button")).find((x) => x.textContent === "Frases").focus(); });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const frases = await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll(".wcl-tec button.frase")).map((b) => ({ t: b.textContent, tab: b.tabIndex })));
  comprobar(frases.length >= 1 && frases.every((f) => f.tab === 0), "las frases están en el teclado y son tabulables", frases.length + " frases");
  await page.evaluate(() => { window.__d = []; speechSynthesis.speak = (u) => { window.__d.push(u.text); }; Array.from(Winclus.caja.querySelectorAll(".wcl-tec button.frase"))[1].focus(); });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const frasesDichas = await page.evaluate(() => window.__d);
  comprobar(frasesDichas.includes(frases[1].t), "Intro sobre una frase la dice", JSON.stringify(frasesDichas));
  await page.evaluate(() => Winclus.teclado());

  // --- lector básico sobre controles reales ---
  await page.evaluate(() => { const s = Winclus.caja.getElementById("wcl-lector"); if (s.getAttribute("aria-checked") !== "true") s.click(); });
  await page.waitForTimeout(200);
  const lectorOn = await page.evaluate(() => Winclus.ajustes.lector === true);
  comprobar(lectorOn, "lector básico activado");
  await page.evaluate(() => { window.__clics = 0; document.getElementById("boton-sitio").addEventListener("click", () => window.__clics++); });
  await page.focus("#boton-sitio");
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const clics = await page.evaluate(() => window.__clics);
  comprobar(clics === 2, "Espacio e Intro activan un botón real de la página (una vez cada uno)", clics + " clics");
  await page.focus("#casilla");
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  comprobar(await page.$eval("#casilla", (e) => e.checked), "Espacio marca una casilla real");
  // Un select: las flechas son suyas
  await page.evaluate(() => { const s = document.createElement("select"); s.id = "lista"; ["uno", "dos", "tres"].forEach((t) => { const o = document.createElement("option"); o.textContent = t; s.appendChild(o); }); document.querySelector("main").prepend(s); });
  await page.focus("#lista");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  const idx = await page.$eval("#lista", (e) => e.selectedIndex);
  comprobar(idx === 1, "flecha abajo en un desplegable cambia la opción, no mueve el lector", "índice " + idx);
  // Sobre el cuerpo, las flechas sí mueven el lector
  await page.evaluate(() => (Winclus.caja.activeElement || document.activeElement).blur());
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  const marcado = await page.evaluate(() => !!document.querySelector(".wcl-lector"));   // clase sobre un elemento de la página, no del widget
  comprobar(marcado, "flecha abajo sin control enfocado mueve el lector");

  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
