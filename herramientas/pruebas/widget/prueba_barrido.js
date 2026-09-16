// Barrido con un solo pulsador: recorre el botón del widget y los controles de la página, la señal (Espacio,
// o el gesto de clic con la cara) activa lo marcado, un campo abre el teclado en pantalla, el teclado se barre
// por filas y luego por teclas, y Escape pausa y reanuda. Uso: node prueba_barrido.js
const { chromium } = require("playwright");
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }
const marcado = (page) => page.evaluate(() => { const e = document.querySelector(".wcl-barrido") || Winclus.caja.querySelector(".wcl-barrido"); const f = Winclus.caja.querySelector(".wcl-barrido-fila"); return { el: e ? (e.id || e.className || e.tagName) + ":" + (e.textContent || "").trim().slice(0, 12) : null, fila: f ? Array.from(f.querySelectorAll("button")).map((b) => b.textContent).slice(0, 3).join("") : null }; });

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => localStorage.setItem("winclus.ajustes", JSON.stringify({ barrido: true, barrido_ms: 300, barrido_voz: true, teclado_sonido: false, voz_activa: true })));
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__voz = []; document.addEventListener("DOMContentLoaded", () => { speechSynthesis.speak = (u) => window.__voz.push(u.text); }); });
  await page.goto(PAGINA);
  await page.evaluate(() => { const c = document.createElement("input"); c.id = "campo"; c.type = "text"; document.querySelector("main").appendChild(c); window.__clics = 0; document.getElementById("boton-sitio").addEventListener("click", () => window.__clics++); });
  await page.waitForFunction(() => window.Winclus);

  // recorre: botón del widget, enlace, botón, casilla, campo…
  const vistos = [];
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(310); vistos.push((await marcado(page)).el); }
  comprobar(vistos.some((v) => /wcl-btn/.test(v || "")) && vistos.some((v) => /enlace/.test(v || "")) && vistos.some((v) => /boton-sitio/.test(v || "")), "el barrido recorre el botón del widget, el enlace y el botón de la página", vistos.join(" | "));
  const voces = await page.evaluate(() => window.__voz);
  comprobar(voces.some((t) => /Winclus/.test(t)) && voces.some((t) => /enlace/i.test(t)), "va diciendo en voz alta lo marcado", voces.slice(0, 4).join(" | "));

  // Espacio sobre el botón de la página lo activa
  await page.waitForFunction(() => document.getElementById("boton-sitio").classList.contains("wcl-barrido"), null, { timeout: 5000 });
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  comprobar((await page.evaluate(() => window.__clics)) === 1, "la señal (Espacio) activa el botón marcado");

  // sobre el campo abre el teclado, y el teclado se barre por filas y luego por teclas
  await page.waitForFunction(() => document.getElementById("campo").classList.contains("wcl-barrido"), null, { timeout: 6000 });
  await page.keyboard.press("Space");
  await page.waitForTimeout(400);
  const tec = await page.evaluate(() => ({ visible: Winclus.caja.querySelector(".wcl-tec").classList.contains("visible"), campo: document.activeElement && document.activeElement.id }));
  comprobar(tec.visible, "la señal sobre un campo abre el teclado en pantalla", JSON.stringify(tec));
  await page.waitForTimeout(350);
  const f1 = await marcado(page);
  comprobar(!!f1.fila, "con el teclado abierto se marcan filas", JSON.stringify(f1));
  await page.waitForFunction(() => { const f = Winclus.caja.querySelector(".wcl-barrido-fila"); return f && /^q/.test(f.textContent); }, null, { timeout: 4000 });
  await page.keyboard.press("Space");   // entra en la fila q-w-e…
  await page.waitForTimeout(100);
  const t1 = await marcado(page);
  comprobar(/:q$/.test(t1.el || "") && t1.fila && /^qwe/.test(t1.fila), "la señal sobre la fila pasa a barrer sus teclas desde la primera", JSON.stringify(t1));
  await page.waitForTimeout(320);
  const t2 = await marcado(page);
  comprobar(/:w$/.test(t2.el || ""), "y avanza tecla a tecla", JSON.stringify(t2));
  await page.keyboard.press("Space");   // pulsa la w
  await page.waitForTimeout(150);
  const escrito = await page.$eval("#campo", (e) => e.value);
  const tras = await marcado(page);
  comprobar(escrito === "w", "la señal sobre una tecla la escribe en el campo", JSON.stringify(escrito));
  comprobar(!tras.el && !!tras.fila, "tras escribir vuelve al barrido por filas", JSON.stringify(tras));

  // Escape pausa y reanuda
  await page.keyboard.press("Escape");
  const p1 = await marcado(page);
  await page.waitForTimeout(700);
  const p2 = await marcado(page);
  comprobar(JSON.stringify(p1) === JSON.stringify(p2), "Escape pausa el barrido", JSON.stringify(p1) + " = " + JSON.stringify(p2));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  const p3 = await marcado(page);
  comprobar(JSON.stringify(p3) !== JSON.stringify(p2), "otro Escape lo reanuda");

  // el gesto de clic con la cara también es la señal
  const antes = await page.evaluate(() => ({ nivel: !!Winclus.caja.querySelector(".wcl-barrido"), fila: !!Winclus.caja.querySelector(".wcl-barrido-fila") }));
  await page.evaluate(() => Winclus.clic());
  await page.waitForTimeout(100);
  const despues = await page.evaluate(() => ({ el: !!Winclus.caja.querySelector(".wcl-barrido"), fila: !!Winclus.caja.querySelector(".wcl-barrido-fila") }));
  comprobar(antes.fila && despues.el, "Winclus.clic() (gesto de la cara) hace de señal: entra en la fila marcada", JSON.stringify(antes) + " -> " + JSON.stringify(despues));

  // apagar el barrido limpia todo
  await page.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-barrido").click(); });
  await page.waitForTimeout(400);
  const limpio = await page.evaluate(() => !document.querySelector(".wcl-barrido") && !Winclus.caja.querySelector(".wcl-barrido") && !Winclus.caja.querySelector(".wcl-barrido-fila") && Winclus.ajustes.barrido === false);
  comprobar(limpio, "apagar el barrido quita las marcas");

  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
