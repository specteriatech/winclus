// Últimos huecos del catálogo: limitador de volumen, voces neuronales del navegador, asistente guiado
// «¿Qué quieres hacer?» (texto, Intro, orden por voz) y transcripción de un medio por micrófono.
// Uso: node prueba_maximo.js
const { chromium } = require("playwright");
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-medios.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    localStorage.setItem("winclus.ajustes", JSON.stringify({ voz_activa: false, volumen_max: 40 }));
    // voces simuladas: una normal y una «Natural» de es-CO
    const voces = [{ name: "Microsoft Sabina Desktop", lang: "es-MX" }, { name: "Microsoft Gonzalo Online (Natural) - Spanish (Colombia)", lang: "es-CO" }, { name: "Google español", lang: "es-ES" }];
    speechSynthesis.getVoices = () => voces;
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };   // acepta voces simuladas
    window.__u = []; speechSynthesis.speak = (u) => window.__u.push({ voz: u.voice && u.voice.name, texto: u.text });
    window.__recs = []; window.SpeechRecognition = class { constructor() { window.__recs.push(this); } start() {} stop() {} };
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { const c = document.createElement("a"); c.href = "#contacto"; c.textContent = "Contáctenos"; document.body.appendChild(c); });

  // --- limitador de volumen ---
  const vol = await page.evaluate(async () => { const a = document.getElementById("audio"); a.volume = 1; a.play().catch(() => {}); await new Promise((r) => setTimeout(r, 100)); const v1 = a.volume; a.volume = 0.9; await new Promise((r) => setTimeout(r, 50)); return { alPlay: v1, alSubir: a.volume }; });
  comprobar(Math.abs(vol.alPlay - 0.4) < 0.01 && Math.abs(vol.alSubir - 0.4) < 0.01, "ningún medio pasa del volumen máximo (40 %), ni al reproducir ni al subirlo", JSON.stringify(vol));
  await page.evaluate(() => { Winclus.abrir(); Winclus.ajustes.volumen_max = 100; });

  // --- voz neuronal preferida ---
  await page.evaluate(() => { Winclus.ajustes.voz_activa = true; Winclus.decir("hola"); });
  const voz = await page.evaluate(() => window.__u[window.__u.length - 1]);
  comprobar(/Natural/.test(voz.voz || ""), "sin voz elegida, usa la neuronal de es-CO", JSON.stringify(voz));
  const nombreVoz = await page.evaluate(() => Winclus.caja.getElementById("wcl-voz-nombre").textContent);
  comprobar(/Gonzalo/.test(nombreVoz), "el panel muestra la voz neuronal como actual", nombreVoz);

  // --- asistente guiado ---
  const pregunta = async (t) => { await page.evaluate((x) => { const i = Winclus.caja.getElementById("wcl-que"); i.value = x; i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); }, t); await page.waitForTimeout(80); return page.evaluate(() => Winclus.caja.getElementById("wcl-estado").textContent); };
  comprobar(!!(await page.evaluate(() => Winclus.caja.querySelector(".wcl-facil #wcl-que, .wcl-facil .wcl-guia-caja"))) && !!(await page.evaluate(() => Winclus.caja.querySelector("#wcl-panel-ver .wcl-guia-caja"))), "la caja «¿Qué quieres hacer?» está en el modo fácil y en la pestaña Ver");
  let r = await pregunta("no veo bien");
  const ver = await page.evaluate(() => ({ texto: Winclus.ajustes.texto, contraste: Winclus.ajustes.contraste }));
  comprobar(/Texto más grande/.test(r) && ver.texto >= 150 && ver.contraste, "«no veo bien» agranda el texto y sube el contraste", r);
  r = await pregunta("no oigo");
  comprobar(/Avisos en pantalla/.test(r) && (await page.evaluate(() => Winclus.ajustes.alertas_sonido && Winclus.ajustes.subtitulos)), "«no oigo» activa avisos y subtítulos");
  r = await pregunta("solo puedo pulsar un botón");
  comprobar(/Barrido activado/.test(r) && (await page.evaluate(() => Winclus.ajustes.barrido)), "«solo puedo pulsar un botón» activa el barrido");
  await page.evaluate(() => { Winclus.ajustes.barrido = false; });
  r = await pregunta("no puedo hablar");
  comprobar(/Tablero de dibujos/.test(r) && (await page.evaluate(() => getComputedStyle(Winclus.caja.querySelector(".wcl-pictos")).display !== "none")), "«no puedo hablar» abre los pictogramas");
  await page.evaluate(() => Winclus.caja.querySelector(".wcl-pictos .acciones button:last-child").click());
  r = await pregunta("quiero contactarlos");
  comprobar(/página de contacto/.test(r), "«quiero contactarlos» pulsa el enlace de contacto de la página", r);
  r = await pregunta("hacer una pirueta");
  comprobar(/No sé hacer eso todavía/.test(r), "lo que no sabe, lo dice y da ejemplos");
  await page.evaluate(() => Winclus.orden("me marea el movimiento"));
  await page.waitForTimeout(80);
  comprobar((await page.evaluate(() => Winclus.ajustes.calma)), "una orden por voz que no es orden va al asistente («me marea el movimiento» → calma)");

  // --- transcribir un medio ---
  await page.click("#wcl-tab-oir");
  await page.evaluate(() => { const v = document.getElementById("video"); v.muted = true; Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /Transcribir el vídeo/.test(b.textContent)).click(); });
  await page.waitForTimeout(150);
  const tr = await page.evaluate(() => ({ barra: getComputedStyle(Winclus.caja.querySelector(".wcl-subvivo")).display !== "none", recs: window.__recs.length, muted: document.getElementById("video").muted }));
  comprobar(tr.barra && tr.recs >= 1 && tr.muted === false, "«Transcribir» abre los subtítulos en vivo, arranca el reconocedor y quita el silencio al medio", JSON.stringify(tr));

  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
