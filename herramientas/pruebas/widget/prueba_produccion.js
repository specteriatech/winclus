// Recorrido de punta a punta contra el sitio en producción (o el que se pase por parámetro): comprueba que el
// widget carga y que las funciones de los nueve grupos de discapacidad del catálogo responden de verdad en
// esa página. Uso: node prueba_produccion.js [https://winclus.com/]
const path = require("path");
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores

const URL = process.argv[2] || "https://winclus.com/";
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }
function grupo(n) { console.log("\n== " + n); }

(async () => {
  const nav = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, permissions: (process.env.NAVEGADOR && process.env.NAVEGADOR !== "chromium") ? [] : ["clipboard-read", "clipboard-write"] });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  await ctx.addInitScript(() => {
    localStorage.setItem("winclus.ajustes", JSON.stringify({ voz_activa: true }));
    window.__voz = []; document.addEventListener("DOMContentLoaded", () => { speechSynthesis.speak = (u) => { window.__voz.push(u.text); if (u.onend) setTimeout(() => u.onend(), 5); }; });   // onend: la voz va por trozos encadenados
    window.__recs = []; window.SpeechRecognition = class { constructor() { window.__recs.push(this); } start() {} stop() {} };
    window.__reconocer = (t) => { const r = window.__recs[window.__recs.length - 1]; r && r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] }); };
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Winclus, null, { timeout: 30000 });
  const info = await page.evaluate(() => ({ version: Winclus.version, src: (document.querySelector("script[src*='widget']") || {}).src, sombra: !!Winclus.caja.host }));
  grupo("Instalación en " + URL);
  comprobar(info.sombra && !!info.version, "el widget está instalado y cargado en un shadow root", "versión " + info.version + " desde " + info.src);
  await page.evaluate(() => Winclus.abrir());
  const cs = (s) => page.evaluate((x) => getComputedStyle(document.documentElement)[x], s);
  const sw = (id) => page.evaluate((i) => { Winclus.caja.getElementById(i).click(); return Winclus.caja.getElementById(i).getAttribute("aria-checked"); }, "wcl-" + id);

  grupo("1. Visual");
  await page.evaluate(() => { for (let i = 0; i < 10; i++) Winclus.caja.querySelector("#wcl-panel-ver .wcl-mm button:last-child").click(); });
  comprobar((await page.evaluate(() => document.documentElement.style.fontSize)) === "200%" && (await page.evaluate(() => getComputedStyle(document.body).fontSize)) !== "17px", "texto al 200 % (la portada usa unidades relativas)", await page.evaluate(() => getComputedStyle(document.body).fontSize));
  await page.evaluate(() => { for (let i = 0; i < 10; i++) Winclus.caja.querySelector("#wcl-panel-ver .wcl-mm button:first-child").click(); });
  comprobar((await sw("contraste")) === "true" && /contrast/.test(await cs("filter")), "alto contraste"); await sw("contraste");
  comprobar((await sw("oscuro")) === "true" && /invert/.test(await cs("filter")) && (await page.evaluate(() => Winclus.caja.querySelector(".wcl-btn").getBoundingClientRect().left > 0)), "modo oscuro con el botón dentro de pantalla"); await sw("oscuro");
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll(".wcl-opc button")).find((b) => /el rojo/.test(b.textContent)).click(); });
  comprobar(/wcl-f-protan/.test(await cs("filter")), "corrección de daltonismo aplicada");
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll(".wcl-opc button")).find((b) => /Ninguna/.test(b.textContent)).click(); });
  comprobar((await sw("cursor_grande")) === "true" && /url\(/.test(await page.evaluate(() => getComputedStyle(document.body).cursor)), "cursor grande"); await sw("cursor_grande");
  comprobar((await sw("lupa_pantalla")) === "true" && /scale/.test(await page.evaluate(() => document.body.style.transform)), "lupa de pantalla"); await sw("lupa_pantalla");
  comprobar((await sw("guia")) === "true", "guía de lectura"); await sw("guia");
  await page.evaluate(() => { Winclus.caja.querySelector("#wcl-panel-ver").querySelectorAll("button").forEach(() => {}); Array.from(Winclus.caja.querySelectorAll("#wcl-panel-ver button")).find((b) => /Lectura limpia/.test(b.textContent)) && 0; });
  await page.evaluate(() => Winclus.orden("lectura fácil"));
  await page.waitForTimeout(400);
  const limpia = await page.evaluate(() => { const l = Winclus.caja.querySelector(".wcl-limpia"); return l ? l.innerText.length : 0; });
  comprobar(limpia > 500, "lectura limpia con el texto de la portada", limpia + " caracteres");
  await page.keyboard.press("Escape");
  await page.evaluate(() => { Winclus.abrir(); Winclus.leer(); });
  await page.waitForTimeout(600);
  comprobar((await page.evaluate(() => window.__voz.join(" ").length > 200 && window.__voz.every((t) => t.length <= 260))), "leer la página en voz alta (por trozos cortos, no en un solo bloque)");

  grupo("2. Auditiva");
  comprobar((await sw("alertas_sonido")) === "true", "avisos visuales de sonido activados");
  await page.evaluate(() => { const a = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA="); a.title = "Prueba"; a.play().catch(() => {}); });
  await page.waitForTimeout(150);
  comprobar(/Está sonando/.test(await page.evaluate(() => Winclus.caja.querySelector(".wcl-sonido").textContent)), "un sonido muestra el aviso"); await sw("alertas_sonido");
  comprobar((await sw("subtitulos")) === "true" && (await page.evaluate(() => document.documentElement.classList.contains("wcl-subs"))), "subtítulos grandes"); await sw("subtitulos");
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /Subtítulos en vivo/.test(b.textContent)).click(); window.__reconocer("prueba de subtítulos en vivo"); });
  await page.waitForTimeout(150);
  comprobar(/prueba de subtítulos/.test(await page.evaluate(() => Winclus.caja.querySelector(".wcl-subvivo").textContent)), "subtítulos en vivo");
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /Parar los subtítulos/.test(b.textContent)).click(); });
  comprobar((await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).some((b) => /Centro de Relevo/.test(b.textContent)))), "botón al Centro de Relevo");

  grupo("3. Física y motriz");
  await page.evaluate(() => { Winclus.ajustes.barrido_ms = 250; Winclus.caja.getElementById("wcl-barrido").click(); Winclus.cerrar(); });
  await page.waitForTimeout(900);
  comprobar((await page.evaluate(() => !!(document.querySelector(".wcl-barrido") || Winclus.caja.querySelector(".wcl-barrido")))), "barrido marcando elementos de la portada");
  await page.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-barrido").click(); });
  await page.evaluate(() => Winclus.teclado());
  await page.waitForTimeout(200);
  comprobar((await page.evaluate(() => Winclus.caja.querySelector(".wcl-tec").classList.contains("visible") && Winclus.caja.querySelectorAll(".wcl-tec button").length > 40)), "teclado en pantalla");
  await page.evaluate(() => Winclus.teclado());
  const cam = await page.evaluate(() => Winclus.caja.getElementById("wcl-panel-cara").textContent);
  comprobar(/Activar cámara/.test(cam) && /nada sale de tu equipo/.test(cam), "puntero con la cara disponible con aviso de privacidad");
  await page.evaluate(() => { Winclus.mover(400, 400); Winclus.clic(); });
  await page.waitForTimeout(150);
  comprobar(/Clic|Leyendo|no hay/i.test(await page.evaluate(() => Winclus.caja.querySelector(".wcl-vivo").textContent)), "clic virtual por gesto responde");

  grupo("4. Habla y comunicación");
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /pictogramas/i.test(b.textContent)).click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const t = (n) => Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .rejilla .picto")).find((x) => x.getAttribute("aria-label") === n); t("ayuda").click(); Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .acciones button")).find((b) => b.textContent === "Decir").click(); });
  comprobar((await page.evaluate(() => window.__voz.slice(-2).includes("ayuda"))), "pictogramas con voz");
  await page.evaluate(() => Winclus.caja.querySelector(".wcl-pictos .acciones button:last-child").click());
  await page.evaluate(() => Winclus.decir("Necesito ayuda"));
  comprobar((await page.evaluate(() => window.__voz[window.__voz.length - 1] === "Necesito ayuda")), "frases con voz");
  comprobar((await page.evaluate(() => !!Winclus.caja.getElementById("wcl-dictado_confirmar"))), "dictado con confirmación disponible");

  grupo("5. Cognitiva y aprendizaje");
  comprobar((await sw("dislexia")) === "true" && (await page.evaluate(() => document.documentElement.classList.contains("wcl-dislexia"))), "letras y palabras separadas"); await sw("dislexia");
  comprobar((await sw("mascara")) === "true", "máscara de enfoque"); await sw("mascara");
  await page.evaluate(() => Winclus.orden("explícame esta página"));
  await page.waitForTimeout(500);
  comprobar(/De qué va esta página/.test(await page.evaluate(() => (Winclus.caja.querySelector(".wcl-limpia-texto") || {}).innerText || "")), "«explícame esta página» en lenguaje claro");
  await page.keyboard.press("Escape");
  await page.evaluate(() => { Winclus.abrir(); const i = Winclus.caja.getElementById("wcl-que"); i.value = "no veo bien"; i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
  comprobar((await page.evaluate(() => Winclus.ajustes.texto >= 150)), "asistente «¿qué quieres hacer?» actúa");
  await page.evaluate(() => { Winclus.ajustes.texto = 100; Winclus.ajustes.contraste = false; });
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /Dónde estoy/.test(b.textContent)).click(); });
  comprobar(/Estás en:/.test(await page.evaluate(() => Winclus.caja.getElementById("wcl-estado").textContent)), "«¿Dónde estoy?»");
  comprobar((await sw("facil")) === "true" && (await page.evaluate(() => Winclus.caja.querySelector(".wcl-panel").classList.contains("facil"))), "modo fácil"); await page.evaluate(() => { Winclus.ajustes.facil = false; });

  grupo("6. Neurológica y sensorial");
  comprobar((await sw("calma")) === "true" && /saturate\(0\.7\)/.test(await cs("filter")), "modo calma"); await sw("calma");
  comprobar((await sw("animaciones")) === "true" && (await page.evaluate(() => document.documentElement.classList.contains("wcl-anim"))), "pausar animaciones"); await sw("animaciones");
  comprobar((await page.evaluate(() => !!Winclus.caja.querySelector('[id^="wcl-v-volumen_max"]'))), "limitador de volumen disponible");

  grupo("7. Psicosocial · 8. Envejecimiento · 9. Situacional");
  comprobar((await page.evaluate(() => !!Winclus.caja.getElementById("wcl-formularios") && Winclus.ajustes.formularios)), "ayuda en formularios activa por defecto (errores en lenguaje claro)");
  comprobar((await page.evaluate(() => !!Winclus.caja.querySelector(".wcl-facil .wcl-guia-caja"))), "asistente con tus palabras en el modo fácil (mayores)");
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-mas button")).find((b) => /Copiar enlace/.test(b.textContent)).click(); });
  await page.waitForTimeout(300);
  comprobar(/#winclus=/.test(await page.evaluate(() => navigator.clipboard.readText())), "perfil por enlace para llevarlo a otro equipo");
  comprobar((await page.evaluate(() => Winclus.caja.host.getAttribute("lang") === "es")), "panel en el idioma de la página");

  comprobar(errores.length === 0, "sin errores JS en toda la sesión", errores.join(" | "));
  await nav.close();
  console.log("\n" + (fallos ? fallos + " comprobación(es) MAL" : "todo bien") + " en " + URL);
  process.exit(fallos ? 1 : 0);
})();
