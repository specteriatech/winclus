// Familia 3 en el widget (docs/hoja-ruta-familias.md), 0.6.9: calibración ocular a medida (rápida 9, normal 13 o
// completa 25 puntos; más tiempo por punto; punto grande), compensación de los movimientos de la cabeza (aprendida
// mirando al centro, guardada solo si mejora y con la mejora medida), «Otro aparato mueve el puntero» (el puntero
// del sistema manda y la cámara hace los clics) y el enlace a NVDA en el lector. Sin cámara: los modelos se ajustan
// con rasgos sintéticos y el puntero externo con movimientos reales del ratón. Uso: node prueba_familia3_widget.js
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

  // --- rejilla según el modo ---
  let r = await page.evaluate(() => ["rapida", "normal", "completa"].map((m) => { Winclus.ajustes.calib_modo = m; const p = Winclus.rejilla(); return p.length + ":" + new Set(p.map((q) => q.join(","))).size; }));
  comprobar(r.join(" ") === "9:9 13:13 25:25", "la calibración tiene 9, 13 o 25 puntos distintos según «Rápida», «Normal» o «Completa»", r.join(" "));
  r = await page.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-cara").click(); const ts = Array.from(Winclus.caja.querySelectorAll(".wcl-panel .wcl-opc[aria-label], .wcl-panel label, .wcl-panel .wcl-big")).map((x) => x.getAttribute("aria-label") || x.textContent.trim()); Winclus.ajustes.calib_modo = "completa"; Winclus.caja.querySelectorAll(".wcl-sw").length; return { opc: ts.includes("Cómo de larga es la calibración"), lento: ts.includes("Más tiempo en cada punto"), grande: ts.includes("Punto más grande"), cabeza: ts.includes("Paso final de compensación de cabeza"), externo: ts.includes("Otro aparato mueve el puntero") }; });
  comprobar(Object.values(r).every(Boolean), "el panel tiene las opciones de calibración y «Otro aparato mueve el puntero»", JSON.stringify(r));
  r = await page.evaluate(() => { Winclus.ajustes.calib_modo = "completa"; Winclus.abrir(); return Array.from(Winclus.caja.querySelectorAll(".wcl-panel .wcl-big")).map((b) => b.textContent).find((t) => /Calibrar los ojos/.test(t)); });
  comprobar(/unos 70 s/.test(r || ""), "el botón de calibrar dice cuánto tarda según el modo", r);

  // --- modelo sintético y compensación de cabeza ---
  r = await page.evaluate(() => {
    const W = window.innerWidth, H = window.innerHeight, rasgos = (gx, gy) => [gx, gy, 0.5, gx, gy, 0.5, 0, 0, gx * gx, gy * gy, gx * gy, 0.3, 0.3, gx ** 3, gy ** 3];
    Winclus.ajustes.calib_modo = "normal"; const puntos = Winclus.rejilla(), R = puntos.map((p) => rasgos(p[0] / W, p[1] / H));
    const modelo = Winclus.ajustarModelo(puntos, R);
    const err = puntos.map((p, i) => { const q = Winclus.predecir(modelo, R[i]); return Math.hypot(q[0] - p[0], q[1] - p[1]); });
    // Con la cabeza desplazada la mirada medida se corre: k por cada unidad de nariz. Mirando al centro, muestras con la cabeza en varios sitios
    const ref = [0.5, 0.5, 0.2], k = 0.4, muestras = [];
    for (let i = 0; i < 40; i++) { const dx = (i % 5 - 2) * 0.03, dy = (Math.floor(i / 5) % 4 - 1.5) * 0.02; muestras.push([rasgos(0.5 + k * dx + 0.001 * Math.sin(i), 0.5 + k * dy), [ref[0] + dx, ref[1] + dy, ref[2]]]); }
    const cab = Winclus.ajustarCabeza(modelo, muestras, ref);
    modelo.cabeza = cab;
    Winclus.deteccion.pose = [ref[0] + 0.03, ref[1] - 0.02, ref[2]];   // cabeza corrida: sin compensar, la mirada al centro se iría
    const sin = Winclus.predecir(modelo, rasgos(0.5 + k * 0.03, 0.5 - k * 0.02), false, true), con = Winclus.predecir(modelo, rasgos(0.5 + k * 0.03, 0.5 - k * 0.02));
    Winclus.deteccion.pose = null;
    return { errMax: Math.round(Math.max(...err)), cab, sin: [Math.round(sin[0] - W / 2), Math.round(sin[1] - H / 2)], con: [Math.round(con[0] - W / 2), Math.round(con[1] - H / 2)] };
  });
  comprobar(r.errMax < 5, "el modelo ocular se ajusta a los 13 puntos (error de ajuste menor de 5 px con rasgos limpios)", "máximo " + r.errMax + " px");
  comprobar(r.cab && r.cab.coef_x && r.cab.mejora_px > 10 && r.cab.despues_px < 5, "la compensación de cabeza se aprende mirando al centro y mide su mejora", JSON.stringify(r.cab));
  comprobar(Math.hypot(r.sin[0], r.sin[1]) > 10 && Math.hypot(r.con[0], r.con[1]) < 4, "con la cabeza desplazada, sin compensar el puntero se va y con ella vuelve al centro", "sin " + r.sin + " · con " + r.con);
  r = await page.evaluate(() => { const W = window.innerWidth, H = window.innerHeight, rasgos = (gx, gy) => [gx, gy, 0.5, gx, gy, 0.5, 0, 0, gx * gx, gy * gy, gx * gy, 0.3, 0.3, gx ** 3, gy ** 3]; const puntos = Winclus.rejilla(), modelo = Winclus.ajustarModelo(puntos, puntos.map((p) => rasgos(p[0] / W, p[1] / H))); const ruido = []; for (let i = 0; i < 40; i++) ruido.push([rasgos(0.5 + 0.02 * Math.sin(i * 7), 0.5 + 0.02 * Math.cos(i * 3)), [0.5 + 0.03 * Math.sin(i * 11), 0.5, 0.2]]); return Winclus.ajustarCabeza(modelo, ruido, [0.5, 0.5, 0.2]); });
  comprobar(r && !r.coef_x && r.mejora_px === 0, "si mover la cabeza no explica el error, la compensación no se guarda", JSON.stringify(r));

  // --- puntero externo: el ratón del sistema manda y la cámara solo hace clics ---
  await page.evaluate(() => { Winclus.cerrar(); Winclus.ajustes.puntero_externo = true; });
  const antes = await page.evaluate(() => ({ x: Winclus.puntero.x, y: Winclus.puntero.y }));
  await page.mouse.move(300, 200); await page.waitForTimeout(50);
  const sinCam = await page.evaluate(() => ({ x: Winclus.puntero.x, y: Winclus.puntero.y }));
  comprobar(sinCam.x === antes.x && sinCam.y === antes.y, "sin cámara activa, el ratón no toca el puntero virtual", JSON.stringify(sinCam));
  r = await page.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-cara").click(); Winclus.ajustes.puntero_externo = false; const sw = Winclus.caja.getElementById("wcl-puntero_externo"); sw.click(); const a = JSON.parse(localStorage.getItem("winclus.ajustes")).puntero_externo; sw.click(); return { guardado: a, ahora: Winclus.ajustes.puntero_externo }; });
  comprobar(r.guardado === true && r.ahora === false, "«Otro aparato mueve el puntero» se enciende, se guarda y se apaga desde el panel (con la cámara real hay que probarlo en vivo)", JSON.stringify(r));
  await page.evaluate(() => { Winclus.ajustes.puntero_externo = false; });

  // --- NVDA en el lector ---
  r = await page.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-oir").click(); return Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir .wcl-big, .wcl-panel .wcl-big")).map((b) => b.textContent).some((t) => /Descargar NVDA/.test(t)); });
  comprobar(process.env.NAVEGADOR === "webkit" ? !r : r, "en Windows, el lector ofrece descargar NVDA (WebKit se presenta como Mac: no lo ofrece)", String(r));

  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
