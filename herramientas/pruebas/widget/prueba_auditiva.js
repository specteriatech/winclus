// Para personas sordas: aviso visual cuando suena un medio (en el documento o creado por código), subtítulos
// de los vídeos mostrados y agrandados (se elige la pista del idioma de la página), subtítulos en vivo por
// micrófono (reconocedor simulado) y botones al Centro de Relevo y al diccionario de LSC. Uso: node prueba_auditiva.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-medios.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    localStorage.setItem("winclus.ajustes", JSON.stringify({ alertas_sonido: true, subtitulos: true, voz_activa: false }));
    // reconocedor de voz simulado: al arrancar entrega un resultado parcial y luego uno final
    window.SpeechRecognition = class { start() { const self = this; setTimeout(() => { self.onresult && self.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "buenos días" }], { isFinal: false })] }); }, 50); setTimeout(() => { self.onresult && self.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "buenos días, siga por favor" }], { isFinal: true })] }); }, 120); } stop() { this.onend && this.onend(); } };
  });
  const page = await ctx.newPage();
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);

  // --- aviso visual de sonido ---
  await page.evaluate(() => { const a = document.getElementById("audio"); a.volume = 1; a.play().catch(() => {}); });
  await page.waitForTimeout(200);
  let son = await page.evaluate(() => { const s = Winclus.caja.querySelector(".wcl-sonido"); return { visible: getComputedStyle(s).display !== "none", texto: s.textContent, live: s.getAttribute("aria-live") }; });
  comprobar(son.visible && /Campana de aviso/.test(son.texto) && son.live === "assertive", "un audio de la página muestra el aviso con su nombre", JSON.stringify(son));
  await page.evaluate(() => { const a = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA="); a.play().catch(() => {}); });
  await page.waitForTimeout(150);
  son = await page.evaluate(() => Winclus.caja.querySelector(".wcl-sonido").textContent);
  comprobar(/un audio/.test(son), "un audio creado por código (new Audio) también avisa", son);
  await page.evaluate(() => { Winclus.ajustes.alertas_sonido = false; Winclus.caja.querySelector(".wcl-sonido").style.display = "none"; const a = document.getElementById("audio"); a.pause(); a.currentTime = 0; a.play().catch(() => {}); });
  await page.waitForTimeout(150);
  comprobar((await page.evaluate(() => getComputedStyle(Winclus.caja.querySelector(".wcl-sonido")).display)) === "none", "con el aviso apagado no aparece nada");

  // --- subtítulos de los vídeos ---
  const pistas = await page.evaluate(() => { const v = document.getElementById("video"); return Array.from(v.textTracks).map((t) => t.language + ":" + t.mode); });
  comprobar(pistas.includes("es:showing") && pistas.includes("en:disabled"), "se muestra la pista de subtítulos del idioma de la página y se apaga la otra", pistas.join(", "));
  const cue = await page.evaluate(() => Array.from(document.styleSheets).some((h) => { try { return Array.from(h.cssRules).some((r) => /wcl-subs video::cue/.test(r.selectorText || "")); } catch (e) { return false; } }) && document.documentElement.classList.contains("wcl-subs"));
  comprobar(cue, "hay regla ::cue en el documento (subtítulos grandes con fondo) y la clase está puesta");

  // --- subtítulos en vivo ---
  await page.evaluate(() => Winclus.abrir());
  await page.click("#wcl-tab-oir");
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /Subtítulos en vivo/.test(b.textContent)).click(); });
  await page.waitForTimeout(300);
  const sub = await page.evaluate(() => { const s = Winclus.caja.querySelector(".wcl-subvivo"); return { visible: getComputedStyle(s).display !== "none", texto: s.textContent, fs: getComputedStyle(s).fontSize }; });
  comprobar(sub.visible && /siga por favor/.test(sub.texto) && parseFloat(sub.fs) >= 24, "la barra de subtítulos en vivo muestra lo reconocido en letra grande", JSON.stringify(sub));
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /Parar los subtítulos/.test(b.textContent)).click(); });
  await page.waitForTimeout(100);
  comprobar((await page.evaluate(() => getComputedStyle(Winclus.caja.querySelector(".wcl-subvivo")).display)) === "none", "al parar, la barra desaparece");
  const avisoVoz = await page.evaluate(() => /Google o Microsoft/.test(Winclus.caja.getElementById("wcl-panel-oir").textContent));
  comprobar(avisoVoz, "la sección avisa de que la voz va a Google o Microsoft");

  // --- Centro de Relevo y diccionario LSC ---
  const botones = await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).map((b) => b.textContent));
  comprobar(botones.some((t) => /Centro de Relevo/.test(t)) && botones.some((t) => /Diccionario de Lengua de Señas/.test(t)), "hay botones al Centro de Relevo y al diccionario de LSC");
  const [popup] = await Promise.all([ctx.waitForEvent("page"), page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /Diccionario de Lengua/.test(b.textContent)).click(); })]);
  comprobar(/insor\.gov\.co/.test(popup.url()), "el diccionario abre educativo.insor.gov.co en otra pestaña", popup.url());
  await popup.close();

  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
