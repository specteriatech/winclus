// Bajar y subir por los bordes (0.6.10): con la cara o los ojos, el puntero pegado al borde de abajo baja la página y
// en el de arriba la sube, tras 0,35 s en la franja; se avisa en pantalla y con voz; con el interruptor apagado no
// pasa nada; al activar la cámara se explica cómo bajar. Sin cámara: se llama al tic directamente con el puntero
// virtual puesto donde toca. Uso: node prueba_bordes.js
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
  // La voz habla por trozos encadenados con onend: el simulador los encadena para oír la frase entera
  await page.evaluate(() => { window.__voz = []; speechSynthesis.speak = (u) => { window.__voz.push(u.text); setTimeout(() => { if (u.onend) u.onend({}); }, 10); }; window.scrollTo(0, 0); });
  const tics = (y, n) => page.evaluate(([yy, nn]) => { Winclus.mover(640, yy); let t = 100; for (let i = 0; i < nn; i++) { Winclus.tickBordes(t); t += 0.033; } return { scroll: Math.round(window.scrollY), banda: (Winclus.caja.querySelector(".wcl-borde") || {}).className, texto: (Winclus.caja.querySelector(".wcl-borde") || {}).textContent }; }, [y, n]);

  let r = await tics(790, 8);   // menos de 0,35 s en la franja: nada
  comprobar(r.scroll === 0 && !/abajo/.test(r.banda), "pasar por el borde menos de 0,35 s no mueve la página", JSON.stringify(r));
  r = await tics(790, 40);      // 1,3 s pegado al borde de abajo
  comprobar(r.scroll > 150 && /abajo/.test(r.banda) && /Bajando/.test(r.texto), "el puntero pegado al borde de abajo baja la página y sale la banda «Bajando»", JSON.stringify(r));
  await page.waitForTimeout(80);
  const voz = await page.evaluate(() => window.__voz.join(" ").replace(/\s+/g, " "));
  comprobar(/Bajando\. Aparta el puntero/.test(voz), "la primera vez lo dice con voz", voz.slice(0, 80));
  const bajado = r.scroll;
  r = await tics(750, 40);      // dentro de la franja pero menos pegado: baja más despacio
  comprobar(r.scroll > bajado && r.scroll - bajado < bajado, "menos pegado al borde baja más despacio", (r.scroll - bajado) + " frente a " + bajado);
  r = await tics(400, 5);       // fuera de la franja: para y la banda se quita
  const quieto = r.scroll; r = await tics(400, 20);
  comprobar(r.scroll === quieto && !/abajo|arriba/.test(r.banda), "al apartar el puntero del borde se para y la banda desaparece", JSON.stringify(r));
  r = await tics(10, 40);       // borde de arriba: sube
  comprobar(r.scroll < quieto && /arriba/.test(r.banda) && /Subiendo/.test(r.texto), "en el borde de arriba sube", JSON.stringify(r));
  await page.evaluate(() => { Winclus.ajustes.bordes_desplazan = false; });
  const antes = (await tics(400, 3)).scroll; r = await tics(790, 40);
  comprobar(r.scroll === antes && !/abajo/.test(r.banda), "con «Bajar y subir llevando el puntero al borde» apagado no pasa nada", JSON.stringify(r));
  await page.evaluate(() => { Winclus.ajustes.bordes_desplazan = true; });
  r = await page.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-cara").click(); const sw = Winclus.caja.getElementById("wcl-bordes_desplazan"); const estado = Winclus.caja.getElementById("wcl-estado").textContent; return { sw: !!sw, marcado: sw && sw.getAttribute("aria-checked"), estado: /borde de abajo/.test(estado) }; });
  comprobar(r.sw && r.marcado === "true" && r.estado, "el interruptor está en la pestaña Cara, encendido por defecto, y el texto de la cámara explica cómo bajar", JSON.stringify(r));

  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
