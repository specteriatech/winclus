// Gestos de la cara y la página que se mueve sola (0.6.12). Viene puesto que abrir la boca baja la página: eso
// se llevaba la página a los 0,15 s, así que hablar, bostezar o respirar la movía. Ahora la rueda por gesto tarda
// 0,6 s en arrancar, empieza despacio, avisa la primera vez de por qué se mueve, y hay un interruptor «Usar los
// gestos de la cara» que apaga todos menos el gesto con el que se hace clic. Sin cámara: se llama al tic de los
// gestos con los valores de la cara puestos a mano. Uso: node prueba_gestos.js
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
  await page.evaluate(() => { window.__voz = []; speechSynthesis.speak = (u) => { window.__voz.push(u.text); setTimeout(() => { if (u.onend) u.onend({}); }, 10); }; });

  // Boca abierta durante «segundos», en cuadros de 33 ms, como haría la cámara
  const boca = (segundos, abierta = 0.8) => page.evaluate(([s, a]) => {
    window.scrollTo(0, 0);
    const d = Winclus.deteccion; d.cara = true; d.lm = null; d.bs = { jawOpen: a };
    let t = 1000;
    for (let i = 0; i < Math.round(s / 0.033); i++) { Winclus.tickGestos(t); t += 0.033; }
    d.bs = { jawOpen: 0 }; Winclus.tickGestos(t + 0.033);   // cerrar la boca
    d.cara = false;
    return Math.round(window.scrollY);
  }, [segundos, abierta]);

  let r = await boca(0.4);
  comprobar(r === 0, "abrir la boca menos de medio segundo (hablar, respirar) no mueve la página", r + " px");
  r = await boca(0.55);
  comprobar(r === 0, "medio segundo largo, tampoco", r + " px");
  const unSegundo = await boca(1.0);
  comprobar(unSegundo > 0 && unSegundo < 200, "un segundo con la boca abierta empieza a bajar, y despacio", unSegundo + " px");
  const tres = await boca(3.0);
  comprobar(tres > unSegundo * 3, "cuanto más se mantiene, más baja (va cogiendo velocidad)", tres + " px frente a " + unSegundo);
  r = await page.evaluate(() => window.__voz.join(" "));
  comprobar(/La página se mueve por el gesto de la cara/.test(r), "la primera vez explica por qué se mueve y cómo apagarlo", r.slice(0, 90));
  r = await page.evaluate(() => (Winclus.caja.querySelector(".wcl-aviso") || {}).textContent || "");
  comprobar(/gesto puesto en «Bajar»|Se cambia en Clics/.test(r), "y lo pone también en la etiqueta del puntero", r.slice(0, 90));

  // El interruptor apaga los gestos, pero no el clic
  await page.evaluate(() => { Winclus.ajustes.gestos_activos = false; });
  r = await boca(3.0);
  comprobar(r === 0, "con «Usar los gestos de la cara» apagado, la boca ya no mueve la página", r + " px");
  r = await page.evaluate(() => {
    window.__clics = 0; document.getElementById("boton-sitio").addEventListener("click", () => window.__clics++);
    const b = document.getElementById("boton-sitio").getBoundingClientRect();
    Winclus.ajustes.modo_clic = "boca"; Winclus.mover(b.left + b.width / 2, b.top + b.height / 2);
    const d = Winclus.deteccion; d.cara = true; d.lm = null; d.bs = { jawOpen: 0.8 };
    Winclus.tickGestos(2000); d.bs = { jawOpen: 0 }; Winclus.tickGestos(2000.05); d.cara = false;
    Winclus.ajustes.modo_clic = "parpadeo";
    return window.__clics;
  });
  comprobar(r === 1, "pero si haces clic con la boca, el clic sigue funcionando con los gestos apagados", String(r));
  await page.evaluate(() => { Winclus.ajustes.gestos_activos = true; });
  r = await page.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-clics").click(); const sw = Winclus.caja.getElementById("wcl-gestos_activos"); return { existe: !!sw, marcado: sw && sw.getAttribute("aria-checked") }; });
  comprobar(r.existe && r.marcado === "true", "el interruptor está en la pestaña Clics y viene encendido", JSON.stringify(r));

  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
