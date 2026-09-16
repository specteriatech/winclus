// Voz completa: «números» pone etiquetas numeradas sobre enlaces, botones y campos; «clic 2» pulsa el 2;
// «escribe en 3» enfoca un campo; el dictado con confirmación muestra lo dicho y solo lo escribe tras «sí».
// Reconocedor de voz simulado: window.__reconocer(texto) entrega un resultado final. Uso: node prueba_voz.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    localStorage.setItem("winclus.ajustes", JSON.stringify({ voz_activa: false, dictado_confirmar: true, teclado_sonido: false }));
    window.__recs = [];
    window.SpeechRecognition = class { constructor() { window.__recs.push(this); } start() {} stop() {} };
    window.__reconocer = (t) => { const r = window.__recs[window.__recs.length - 1]; r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] }); };
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(PAGINA);
  await page.evaluate(() => { const c = document.createElement("input"); c.id = "campo"; c.type = "text"; document.querySelector("main").insertBefore(c, document.getElementById("relleno")); window.__clics = 0; document.getElementById("boton-sitio").addEventListener("click", () => window.__clics++); });
  await page.waitForFunction(() => window.Winclus);

  // --- números ---
  await page.evaluate(() => Winclus.orden("números"));
  await page.waitForTimeout(100);
  const nums = await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll(".wcl-num")).map((n) => n.textContent));
  comprobar(nums.length >= 4 && nums[0] === "1" && nums.join(",").indexOf("1,2,3,4") === 0, "«números» pone etiquetas 1, 2, 3… sobre lo que se puede pulsar", nums.join(","));
  const orden = await page.evaluate(() => Array.from(document.querySelectorAll("a,button,input")).filter((e) => !e.closest(".wcl-root")).map((e) => e.id || e.tagName.toLowerCase()));
  await page.evaluate(() => Winclus.orden("clic 2"));
  await page.waitForTimeout(100);
  const clics = await page.evaluate(() => window.__clics);
  comprobar(clics === 1 && orden[1] === "boton-sitio", "«clic 2» pulsa el botón que lleva el 2", "orden: " + orden.join(",") + "; clics=" + clics);
  comprobar((await page.evaluate(() => !Winclus.caja.querySelector(".wcl-nums"))), "tras pulsar, los números se quitan");
  await page.evaluate(() => Winclus.orden("números"));
  await page.evaluate(() => Winclus.orden("escribe en cinco"));
  await page.waitForTimeout(100);
  comprobar((await page.evaluate(() => document.activeElement.id)) === "campo", "«escribe en cinco» (número en palabras) enfoca el campo 5", await page.evaluate(() => document.activeElement.id || document.activeElement.tagName));
  await page.evaluate(() => Winclus.orden("números"));
  await page.evaluate(() => Winclus.orden("quita los números"));
  comprobar((await page.evaluate(() => !Winclus.caja.querySelector(".wcl-nums"))), "«quita los números» los quita");

  // --- dictado con confirmación ---
  await page.focus("#campo");
  await page.evaluate(() => Winclus.abrir());
  await page.click("#wcl-tab-escribir");
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-escribir button")).find((b) => b.textContent === "Dictar").click(); });
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__reconocer("hola mundo"));
  await page.waitForTimeout(100);
  let conf = await page.evaluate(() => { const c = Winclus.caja.querySelector(".wcl-dictconf"); return { visible: c && getComputedStyle(c).display !== "none", texto: c ? c.textContent : "", campo: document.getElementById("campo").value }; });
  comprobar(conf.visible && /hola mundo/.test(conf.texto) && conf.campo === "", "lo dictado se muestra para confirmar y aún no se escribe", JSON.stringify(conf));
  await page.evaluate(() => window.__reconocer("adiós mundo"));
  await page.waitForTimeout(50);
  conf = await page.evaluate(() => ({ texto: Winclus.caja.querySelector(".wcl-dictconf").textContent, campo: document.getElementById("campo").value }));
  comprobar(/adiós mundo/.test(conf.texto) && conf.campo === "", "otra frase sustituye a la pendiente", JSON.stringify(conf));
  await page.evaluate(() => window.__reconocer("sí"));
  await page.waitForTimeout(100);
  conf = await page.evaluate(() => ({ visible: getComputedStyle(Winclus.caja.querySelector(".wcl-dictconf")).display !== "none", campo: document.getElementById("campo").value }));
  comprobar(!conf.visible && conf.campo === "adiós mundo", "«sí» escribe la frase pendiente en el campo", JSON.stringify(conf));
  await page.evaluate(() => window.__reconocer("esto no"));
  await page.evaluate(() => window.__reconocer("no"));
  await page.waitForTimeout(100);
  conf = await page.evaluate(() => ({ visible: getComputedStyle(Winclus.caja.querySelector(".wcl-dictconf")).display !== "none", campo: document.getElementById("campo").value }));
  comprobar(!conf.visible && conf.campo === "adiós mundo", "«no» descarta la frase pendiente", JSON.stringify(conf));
  await page.evaluate(() => window.__reconocer("con botón"));
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll(".wcl-dictconf button")).find((b) => /Escribir/.test(b.textContent)).click(); });
  await page.waitForTimeout(100);
  comprobar((await page.evaluate(() => document.getElementById("campo").value)) === "adiós mundo con botón", "el botón «Escribir» también confirma", await page.evaluate(() => JSON.stringify({ campo: document.getElementById("campo").value, conf: Winclus.caja.querySelector(".wcl-dictconf").textContent, visible: getComputedStyle(Winclus.caja.querySelector(".wcl-dictconf")).display })));
  await page.evaluate(() => { Winclus.ajustes.dictado_confirmar = false; window.__reconocer("directo"); });
  await page.waitForTimeout(100);
  comprobar((await page.evaluate(() => document.getElementById("campo").value)) === "adiós mundo con botón directo", "sin confirmación se escribe directamente", await page.evaluate(() => document.getElementById("campo").value));
  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));

  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
