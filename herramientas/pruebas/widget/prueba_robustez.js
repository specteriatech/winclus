// Regresión de los fallos encontrados en la revisión del 16-sep-2026: consentimiento sin localStorage, CSS móvil,
// voz larga por trozos, glosario sin HTML anidado, barrido sin lista rancia, perfil con tipos inválidos, contraseñas
// no expuestas, <li> leído, <select> vacío, pegado que no rompe editores, un solo reconocedor de voz, sin lookbehind.
// Uso: node prueba_robustez.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const path = require("path");
const fs = require("fs");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
const TRAMITE = "file:///" + path.resolve(__dirname, "pagina-tramite.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const src = fs.readFileSync(path.join(__dirname, "../../../web/widget.js"), "utf8");
  comprobar(!/\(\?<[=!]/.test(src), "sin lookbehind en ninguna regex (Safari e iOS < 16.4 no lo analizan)");

  const nav = await chromium.launch();
  const init = () => {
    window.__voz = []; window.__recs = [];
    document.addEventListener("DOMContentLoaded", () => { speechSynthesis.speak = (u) => { window.__voz.push(u.text); if (u.onend) setTimeout(() => u.onend(), 5); }; });
    window.SpeechRecognition = class { constructor() { this.paradas = 0; window.__recs.push(this); } start() {} stop() { this.paradas++; } };
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => { window.__camara = (window.__camara || 0) + 1; return Promise.reject(Object.assign(new Error("sin cámara"), { name: "NotFoundError" })); };
  };

  // --- consentimiento con localStorage bloqueado ---
  let ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  await ctx.addInitScript(init);
  await ctx.addInitScript(() => { const b = { get: () => { throw new Error("bloqueado"); } }; Object.defineProperty(window, "localStorage", b); });
  let page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => { if (!/Fetch API cannot load file:/.test(String(e))) errores.push(String(e).slice(0, 120)); });   // WebKit sobre file://: ruido del entorno, no del widget
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { Winclus.abrir(); Winclus.activarCamara(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll(".wcl-consent button")).find((b) => /Acepto/.test(b.textContent)).click(); });
  await page.waitForTimeout(1500);
  const cons = await page.evaluate(() => ({ aviso: !!Winclus.caja.querySelector(".wcl-consent"), estado: Winclus.caja.getElementById("wcl-estado").textContent }));
  comprobar(!cons.aviso && /detector|activar|cámara/i.test(cons.estado), "sin localStorage, «Acepto» no vuelve a pedir el consentimiento y sigue con la cámara", JSON.stringify(cons));
  await ctx.close();

  // --- móvil: el panel cabe y las reglas del @media ganan ---
  ctx = await nav.newContext({ viewport: { width: 375, height: 700 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  await ctx.addInitScript(init);
  page = await ctx.newPage();
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => Winclus.abrir());
  await page.waitForTimeout(200);
  const mov = await page.evaluate(() => { const r = Winclus.caja.querySelector(".wcl-panel").getBoundingClientRect(); const t = getComputedStyle(Winclus.caja.querySelector('[role="tab"]')); return { left: r.left, right: r.right, top: r.top, fs: t.fontSize, cerrar: Winclus.caja.querySelector(".wcl-cab button").getBoundingClientRect().top }; });
  comprobar(mov.left >= 0 && mov.right <= 375 && mov.top >= 0 && mov.fs === "11.5px" && mov.cerrar >= 0, "a 375 px el panel cabe en pantalla y aplica las reglas de móvil", JSON.stringify(mov));
  await ctx.close();

  // --- el resto, en escritorio ---
  ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  await ctx.addInitScript(init);
  await ctx.addInitScript(() => localStorage.setItem("winclus.ajustes", JSON.stringify({ voz_activa: true, teclado_sonido: false })));
  page = await ctx.newPage();
  page.on("pageerror", (e) => { if (!/Fetch API cannot load file:/.test(String(e))) errores.push(String(e).slice(0, 120)); });   // WebKit sobre file://: ruido del entorno, no del widget
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  // voz larga por trozos
  await page.evaluate(() => { window.__voz = []; Winclus.decir("Frase uno. ".repeat(60)); });
  await page.waitForTimeout(600);
  const trozos = await page.evaluate(() => window.__voz.length);
  comprobar(trozos >= 5 && trozos <= 80, "un texto largo se dice por trozos encadenados (no una sola frase de 15 s)", trozos + " trozos");
  // <li> se lee
  await page.evaluate(() => { const ul = document.createElement("ul"); ul.innerHTML = "<li id='li1'>Elemento de lista leído</li>"; document.querySelector("main").appendChild(ul); window.__voz = []; Winclus.ajustes.lectura = true; });
  await page.click("#li1");
  await page.waitForTimeout(100);
  comprobar((await page.evaluate(() => window.__voz.some((t) => /Elemento de lista/.test(t)))), "«leer lo que se pulsa» lee un <li>");
  await page.evaluate(() => { Winclus.ajustes.lectura = false; });
  // contraseñas
  await page.evaluate(() => { const c = document.createElement("input"); c.id = "clave"; c.type = "password"; document.querySelector("main").appendChild(c); c.focus(); Winclus.teclado(); });
  await page.waitForTimeout(150);
  for (const l of ["s", "e", "c", "r"]) await page.locator(".wcl-tec button").filter({ hasText: new RegExp("^" + l + "$") }).first().click();   // clics reales: el teclado ignora los sintéticos
  const clave = await page.evaluate(() => ({ valor: document.getElementById("clave").value, tira: Winclus.caja.querySelector(".wcl-tec .texto").textContent, palabras: localStorage.getItem("winclus.palabras") || "" }));
  comprobar(clave.valor === "secr" && !/secr/.test(clave.tira) && !/secr/.test(clave.palabras), "lo escrito en un campo de contraseña no se muestra, no se aprende ni se lee", JSON.stringify(clave));
  await page.evaluate(() => Winclus.teclado());
  // un solo reconocedor
  await page.evaluate(() => { Winclus.abrir(); Array.from(Winclus.caja.querySelectorAll("#wcl-panel-escribir button")).find((b) => b.textContent === "Dictar").click(); Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /Escuchar órdenes/.test(b.textContent)).click(); });
  await page.waitForTimeout(100);
  const recs = await page.evaluate(() => ({ n: window.__recs.length, primeroParado: window.__recs[0] && window.__recs[0].paradas > 0, dictando: /Parar el dictado/.test(Winclus.caja.getElementById("wcl-panel-escribir").textContent) }));
  comprobar(recs.n === 2 && recs.primeroParado && !recs.dictando, "arrancar las órdenes por voz para el dictado (nunca dos reconocedores vivos)", JSON.stringify(recs));
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /Dejar de escuchar/.test(b.textContent)).click(); });
  // <select> vacío
  await page.evaluate(() => { const s = document.createElement("select"); s.id = "vacio"; document.querySelector("main").appendChild(s); const r = s.getBoundingClientRect(); Winclus.mover(r.left + 5, r.top + 5); Winclus.clic(); });
  await page.waitForTimeout(100);
  comprobar(errores.length === 0, "un clic por gesto sobre un <select> vacío no lanza error", errores.join(" | "));
  // pegado: el manejador del sitio sigue ejecutándose en un editor
  await page.evaluate(() => { const d = document.createElement("div"); d.id = "editor"; d.contentEditable = "true"; d.textContent = "x"; document.querySelector("main").appendChild(d); window.__pasteSitio = 0; d.addEventListener("paste", () => { window.__pasteSitio++; }); d.focus(); const ev = new Event("paste", { bubbles: true, cancelable: true }); d.dispatchEvent(ev); });
  comprobar((await page.evaluate(() => window.__pasteSitio)) === 1, "el evento paste sigue llegando al manejador del sitio (editores, chats)");
  // perfil con tipos inválidos
  await page.evaluate(() => { Winclus.ajustes.barrido = false; });
  const roto = Buffer.from(JSON.stringify({ ajustes: { barrido: true, barrido_ms: "x", voz_velocidad: "x", velocidad: null, texto: "grande" } })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await page.evaluate((h) => { location.hash = h; }, "winclus=" + roto);   // el perfil llega estando ya en la página (hashchange)
  await page.waitForTimeout(1300);
  const tipos = await page.evaluate(() => ({ ms: Winclus.ajustes.barrido_ms, vel: Winclus.ajustes.voz_velocidad, velocidad: Winclus.ajustes.velocidad, texto: Winclus.ajustes.texto, barrido: Winclus.ajustes.barrido }));
  comprobar(tipos.ms === 1200 && tipos.vel === 0 && tipos.velocidad === 20 && tipos.texto === 100 && tipos.barrido === true, "un perfil con tipos inválidos, abierto estando ya en la página, se aplica sin dejar NaN ni cadenas", JSON.stringify(tipos));
  const marcas = await page.evaluate(async () => { let n = 0, ult = null; const t0 = Date.now(); while (Date.now() - t0 < 1500) { const m = document.querySelector(".wcl-barrido") || Winclus.caja.querySelector(".wcl-barrido"); if (m !== ult) { n++; ult = m; } await new Promise((r) => setTimeout(r, 30)); } return n; });
  comprobar(marcas <= 3, "el barrido va a un ritmo normal aunque el perfil trajera barrido_ms roto", marcas + " cambios en 1,5 s");
  await page.evaluate(() => { window.__voz = []; Winclus.decir("prueba de voz"); });
  comprobar((await page.evaluate(() => window.__voz.length)) >= 1, "la voz sigue funcionando con voz_velocidad inválida");
  // barrido: al cerrar el panel no sigue marcando sus controles ocultos
  await page.evaluate(() => { Winclus.ajustes.barrido_ms = 300; Winclus.abrir(); });
  await page.waitForTimeout(700);
  await page.evaluate(() => Winclus.cerrar());
  await page.waitForTimeout(700);
  const rancio = await page.evaluate(() => { const m = document.querySelector(".wcl-barrido") || Winclus.caja.querySelector(".wcl-barrido"); return m ? (m.closest(".wcl-panel") ? "panel" : "página") : "nada"; });
  comprobar(rancio !== "panel", "tras cerrar el panel el barrido no marca controles ocultos del panel", rancio);
  await page.evaluate(() => { Winclus.ajustes.barrido = false; });
  await ctx.close();

  // --- glosario sin HTML anidado ---
  ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  await ctx.addInitScript(init);
  page = await ctx.newPage();
  await page.goto(TRAMITE);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => Winclus.orden("lectura fácil"));
  await page.waitForTimeout(300);
  const glos = await page.evaluate(() => { const t = Winclus.caja.querySelector(".wcl-limpia-texto"); return { roto: /">|<abbr|title=/.test(t.innerText), anidado: !!t.querySelector("abbr abbr"), abbr: t.querySelectorAll("abbr").length }; });
  comprobar(!glos.roto && !glos.anidado && glos.abbr > 3, "«deberá» y «obligatorio» no generan HTML anidado ni texto roto", JSON.stringify(glos));
  await ctx.close();

  comprobar(errores.length === 0, "sin errores JS en toda la sesión", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
