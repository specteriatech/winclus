// Tablero de pictogramas ARASAAC: se abre desde Oír, tiene categorías, al tocar un pictograma se dice y se
// añade a la frase, «Decir» dice la frase entera, predice el siguiente símbolo (por defecto y aprendido del uso),
// guarda frases (que pasan a la tecla «Frases») y el barrido lo recorre. Uso: node prueba_pictogramas.js
const { chromium } = require("playwright");
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { window.__voz = []; speechSynthesis.speak = (u) => window.__voz.push(u.text); });

  await page.evaluate(() => { Winclus.abrir(); Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /pictogramas/i.test(b.textContent)).click(); });
  await page.waitForTimeout(200);
  const t = await page.evaluate(() => { const p = Winclus.caja.querySelector(".wcl-pictos"); return { visible: getComputedStyle(p).display !== "none", cats: Array.from(p.querySelectorAll(".cats button")).map((b) => b.textContent), pictos: p.querySelectorAll(".rejilla .picto").length, imgs: Array.from(p.querySelectorAll(".rejilla .picto img")).slice(0, 2).map((i) => i.src), pie: p.querySelector(".pie").textContent }; });
  comprobar(t.visible && t.cats.length >= 8 && t.pictos >= 10, "el tablero se abre con categorías y pictogramas", t.cats.join(", ") + " · " + t.pictos + " pictos");
  comprobar(t.imgs.every((s) => /static\.arasaac\.org\/pictograms\/\d+\/\d+_300\.png$/.test(s)) && /ARASAAC/.test(t.pie) && /CC BY-NC-SA/.test(t.pie), "las imágenes vienen de ARASAAC y se atribuye la licencia", t.imgs[0]);

  const toca = (nombre) => page.evaluate((n) => { const b = Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .rejilla .picto")).find((x) => x.getAttribute("aria-label") === n); if (!b) return false; b.click(); return true; }, nombre);
  const cat = (nombre) => page.evaluate((n) => { Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .cats button")).find((b) => b.textContent === n).click(); }, nombre);
  await cat("Personas"); await toca("yo");
  await cat("Acciones"); await toca("quiero");
  await page.waitForTimeout(50);
  const sig = await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .sig .picto")).map((b) => b.getAttribute("aria-label")));
  comprobar(sig.includes("agua") && sig.includes("comer"), "tras «quiero» sugiere agua, comer…", sig.join(", "));
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .sig .picto")).find((b) => b.getAttribute("aria-label") === "agua").click(); });
  const frase = await page.evaluate(() => ({ texto: Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .frase .elegido b")).map((b) => b.textContent).join(" "), voz: window.__voz.slice(-3) }));
  comprobar(frase.texto === "yo quiero agua" && frase.voz.join("|") === "yo|quiero|agua", "cada pictograma se dice al tocarlo y forma la frase", JSON.stringify(frase));
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .acciones button")).find((b) => b.textContent === "Decir").click(); });
  comprobar((await page.evaluate(() => window.__voz[window.__voz.length - 1])) === "yo quiero agua", "«Decir» dice la frase entera");

  // aprendizaje: tras usar «quiero → agua», la sugerencia aprendida va primero
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .acciones button")).find((b) => b.textContent === "Borrar todo").click(); });
  await cat("Acciones"); await toca("quiero");
  const sig2 = await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .sig .picto")).map((b) => b.getAttribute("aria-label")));
  comprobar(sig2[0] === "agua", "la predicción aprende del uso: «agua» pasa a ser la primera", sig2.join(", "));

  // guardar frase
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .sig .picto")).find((b) => b.getAttribute("aria-label") === "agua").click(); Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .acciones button")).find((b) => b.textContent === "Guardar frase").click(); });
  await page.waitForTimeout(50);
  const guardada = await page.evaluate(() => ({ cats: Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .cats button")).map((b) => b.textContent), frases: JSON.parse(localStorage.getItem("winclus.frases") || "[]"), pictos: JSON.parse(localStorage.getItem("winclus.pictos_frases") || "[]") }));
  comprobar(guardada.cats.includes("Mis frases") && guardada.frases.includes("quiero agua") && guardada.pictos[0] && guardada.pictos[0].texto === "quiero agua", "«Guardar frase» la pone en «Mis frases» y en las frases del teclado", JSON.stringify(guardada.frases.slice(-1)));

  // barrido dentro del tablero
  await page.evaluate(() => { Winclus.ajustes.barrido_ms = 200; Winclus.caja.getElementById("wcl-barrido").click(); });
  await page.waitForTimeout(700);
  const enTablero = await page.evaluate(() => { const m = Winclus.caja.querySelector(".wcl-barrido"); return m ? !!m.closest(".wcl-pictos") : false; });
  comprobar(enTablero, "con el tablero abierto, el barrido recorre sus botones");

  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
