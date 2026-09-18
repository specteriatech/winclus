// Familia 2 (docs/hoja-ruta-familias.md), widget 0.6.7: lector de pantalla completo dentro de la página: zonas (d),
// tablas (t y Ctrl+Alt+flechas con cabeceras), listas (a), casillas (c), encabezados por nivel (1-6), letra a letra
// (← →), palabra a palabra (Ctrl+← →), deletrear (s), leer todo desde aquí (r) con resaltado, buscar (Ctrl+F), modo
// formulario (Escape sale), roles y estados (expandido, obligatorio, no válido, no disponible, descripción), regiones
// vivas (aria-live y alertas), verbosidad (mucho, normal, poco) y tono de la voz. Uso: node prueba_lector.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  const page = await ctx.newPage();
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  // Página con zonas, tabla con cabeceras, lista, casillas con estados, imagen, desplegable y región viva
  await page.evaluate(() => {
    document.querySelector("main").insertAdjacentHTML("afterbegin", '<nav aria-label="Principal"><a href="#a" id="n1">Inicio</a> <a href="#b" id="n2">Trámites</a></nav>');
    document.querySelector("main").insertAdjacentHTML("beforeend",
      '<h2 id="h2a">Horarios</h2><table id="tabla"><caption>Horario de atención</caption><thead><tr><th>Día</th><th>Abre</th><th>Cierra</th></tr></thead><tbody><tr><th>Lunes</th><td>8:00</td><td>16:00</td></tr><tr><th>Martes</th><td>9:00</td><td id="c23">17:00</td></tr></tbody></table>'
      + '<h3 id="h3a">Requisitos</h3><ul id="lista"><li>Cédula</li><li>Recibo</li><li>Formulario</li></ul>'
      + '<p id="parrafo">Hola, Mundo. ¿Vale?</p>'
      + '<label>Acepto <input type="checkbox" id="acepto" required aria-describedby="ayuda-acepto"></label><span id="ayuda-acepto">Sin esto no se puede seguir</span>'
      + '<button type="button" id="desp" aria-expanded="false" aria-controls="det">Detalles</button><div id="det" hidden>Más</div>'
      + '<input type="text" id="correo" aria-label="Correo" aria-invalid="true"><button type="button" id="apagado" disabled>Enviar</button>'
      + '<img id="foto" alt="Sede de la entidad" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==">'
      + '<div id="viva" role="status" aria-live="polite"></div><div id="alerta" role="alert"></div>');
    document.body.insertAdjacentHTML("beforeend", '<footer><a href="#p" id="p1">Privacidad</a></footer>');
    document.getElementById("desp").addEventListener("click", function () { this.setAttribute("aria-expanded", this.getAttribute("aria-expanded") === "true" ? "false" : "true"); });
    window.__voz = []; window.__ut = []; speechSynthesis.speak = (u) => { window.__voz.push(u.text); window.__ut.push(u); setTimeout(() => { if (u.onend) u.onend({}); }, 30); };
    Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-oir").click(); Winclus.caja.getElementById("wcl-lector").click(); Winclus.cerrar();
    document.body.focus();
  });
  await page.waitForTimeout(150);
  const ultimo = () => page.evaluate(() => window.__voz.join("").replace(/\s+/g, " ").trim());   // la voz habla por trozos: se juntan
  const limpiar = () => page.evaluate(() => { window.__voz = []; });
  // La voz habla por trozos encadenados: se espera a que la frase deje de crecer, no un tiempo fijo
  const esperarVoz = async () => {
    let antes = "", iguales = 0;
    for (let i = 0; i < 40 && iguales < 2; i++) {
      await page.waitForTimeout(50);
      const ahora = await ultimo();
      iguales = ahora === antes ? iguales + 1 : 0;
      antes = ahora;
    }
    return antes;
  };
  const tecla = async (k) => { await limpiar(); await page.keyboard.press(k); return esperarVoz(); };
  const actual = () => page.evaluate(() => { const e = Winclus.lectorActual(); return e ? (e.id || e.tagName) : null; });

  let r = await page.evaluate(() => window.__voz.join(""));
  comprobar(/encabezados/.test(r) && /zonas/.test(r), "al activarse dice cuántos encabezados, enlaces y zonas hay", r);

  // --- zonas, tablas, listas, casillas, encabezados por nivel ---
  r = await tecla("d");
  comprobar(/^Zona 1 de 3, contenido principal, \d+ elementos\./.test(r) && /Enlace: Inicio/.test(r), "d va a la primera zona y dice su nombre y cuántos elementos tiene", r);
  r = await tecla("d"); const z2 = r; r = await tecla("d"); r = await tecla("Shift+d");
  comprobar(/Zona 2 de 3, menú Principal, 2 elementos/.test(z2) && /Zona 2 de 3/.test(r), "d avanza por las zonas (el menú dentro del contenido es su propia zona) y Mayús+d retrocede", z2 + " | " + r);
  r = await tecla("t");
  comprobar(/Tabla 1 de 1, Horario de atención, 3 filas por 3 columnas/.test(r) && /Cabecera, fila 1, columna 1: Día/.test(r), "t va a la tabla y dice su título, filas y columnas", r);
  r = await tecla("Control+Alt+ArrowDown"); const c1 = r; r = await tecla("Control+Alt+ArrowRight"); const c2 = r; r = await tecla("Control+Alt+ArrowDown");
  comprobar(/Cabecera, fila 2, columna 1, Día: Lunes/.test(c1) && /fila 2, columna 2, Abre, Lunes: 8:00/.test(c2) && /fila 3, columna 2, Abre, Martes: 9:00/.test(r), "Ctrl+Alt+flechas van por las celdas diciendo fila, columna y cabeceras", c1 + " | " + c2 + " | " + r);
  r = await tecla("Control+Alt+ArrowRight"); r = await tecla("Control+Alt+ArrowRight");
  comprobar(/Última columna/.test(r), "en el borde de la tabla lo dice", r);
  r = await tecla("a");
  comprobar(/Lista 1 de 1, 3 elementos\. Elemento 1 de 3: Cédula/.test(r), "a va a la lista y dice cuántos elementos tiene", r);
  r = await tecla("c");
  comprobar(/Casilla: sin marcar, Acepto, obligatorio\. Sin esto no se puede seguir/.test(r), "c va a la casilla y dice su estado, que es obligatoria y su descripción", r);
  r = await tecla("Enter"); await page.waitForTimeout(350); r = await esperarVoz();   // tras activar, el lector vuelve a decir el estado 300 ms después
  comprobar(/Casilla: marcada/.test(r), "Intro la marca y se lee el nuevo estado", r);
  r = await tecla("Shift+3"); const h3 = r; r = await tecla("Shift+2");
  comprobar(/Encabezado nivel 3: Requisitos/.test(h3) && /Encabezado nivel 2: Horarios/.test(r), "1 a 6 van al encabezado de ese nivel", h3 + " | " + r);

  // --- roles y estados ---
  r = await tecla("b");
  comprobar(/Botón: Detalles, contraído/.test(r), "un botón con aria-expanded se anuncia como contraído", r);
  r = await tecla("Enter"); await page.waitForTimeout(350); r = await esperarVoz();   // tras activar, el lector vuelve a decir el estado 300 ms después
  comprobar(/Botón: Detalles, expandido/.test(r), "y tras pulsarlo, expandido", r);
  r = await tecla("f");
  comprobar(/Campo de texto: Correo, vacío, no válido/.test(r), "un campo con aria-invalid se anuncia como no válido", r);
  r = await tecla("Escape");
  comprobar(/Modo lectura/.test(r) && (await page.evaluate(() => document.activeElement !== document.getElementById("correo"))), "en un campo, Escape sale del modo formulario", r);
  r = await tecla("b");
  comprobar(/Botón: Enviar, no disponible/.test(r), "un botón desactivado se anuncia como no disponible", r);

  // --- letra a letra, palabra a palabra, deletrear ---
  await page.evaluate(() => { Winclus.caja.getElementById; document.getElementById("parrafo").scrollIntoView(); });
  await page.keyboard.press("Home"); await page.waitForTimeout(50);
  for (let i = 0; i < 40 && (await actual()) !== "parrafo"; i++) await page.keyboard.press("ArrowDown");
  comprobar((await actual()) === "parrafo", "flecha abajo llega al párrafo");
  r = await tecla("ArrowRight"); const l1 = r; r = await tecla("ArrowRight"); r = await tecla("ArrowRight"); r = await tecla("ArrowRight");
  comprobar(l1 === "o" && r === "coma", "← → leen letra a letra y nombran los signos", l1 + " | " + r);
  r = await tecla("Control+ArrowRight"); const w1 = r; r = await tecla("Control+ArrowRight");
  comprobar(w1 === "Mundo." && r === "¿Vale?", "Ctrl+← → leen palabra a palabra", w1 + " | " + r);
  r = await tecla("s");
  comprobar(/^¿Vale\?,? ?abre interrogación, mayúscula v, a, l, e, cierra interrogación$/.test(r), "s deletrea la palabra actual", r);
  r = await tecla("Home");
  comprobar(/Encabezado nivel 1: Título de prueba/.test(r) || /Zona|Enlace/.test(r), "Inicio va al principio", r);

  // --- leer todo desde aquí con resaltado ---
  await page.evaluate(() => { const p = document.getElementById("h2a"); p.scrollIntoView(); });
  for (let i = 0; i < 40 && (await actual()) !== "h2a"; i++) await page.keyboard.press("ArrowDown");
  await limpiar(); await page.keyboard.press("r"); await page.waitForTimeout(400);
  r = await page.evaluate(() => ({ voz: window.__voz.slice(0, 4), actual: (Winclus.lectorActual() || {}).id || (Winclus.lectorActual() || {}).tagName, marcado: !!document.querySelector(".wcl-lector") }));
  comprobar(r.voz.length >= 3 && /Encabezado nivel 2: Horarios/.test(r.voz[0]) && r.actual !== "h2a" && r.marcado, "r lee todo desde aquí, bloque a bloque, y el resaltado sigue a la voz", JSON.stringify(r));
  await page.keyboard.press("Escape"); await page.waitForTimeout(100); const n1 = await page.evaluate(() => window.__voz.length); await page.waitForTimeout(300); const n2 = await page.evaluate(() => window.__voz.length);
  comprobar(n1 === n2, "Escape para la lectura continua", n1 + " = " + n2);

  // --- buscar ---
  await limpiar(); await page.keyboard.press("Control+f"); await page.waitForTimeout(80);
  r = await page.evaluate(() => ({ visible: Winclus.caja.querySelector(".wcl-busca").style.display === "flex", foco: Winclus.caja.activeElement && Winclus.caja.activeElement.id }));
  comprobar(r.visible && r.foco === "wcl-busca-q", "Ctrl+F abre el buscador del lector con el foco en la caja", JSON.stringify(r));
  await page.keyboard.type("recibo"); await limpiar(); await page.keyboard.press("Enter"); await page.waitForTimeout(80); r = await ultimo();
  comprobar(/Coincidencia 1 de 1\. Elemento 2 de 3: Recibo/.test(r) && (await actual()) === "LI", "Intro busca sin acentos ni mayúsculas y lleva al bloque", r);
  await page.keyboard.press("Escape"); await page.waitForTimeout(50);
  comprobar(await page.evaluate(() => Winclus.caja.querySelector(".wcl-busca").style.display === "none"), "Escape cierra el buscador");

  // --- regiones vivas ---
  await limpiar(); await page.evaluate(() => { document.getElementById("viva").textContent = "Guardado correctamente"; }); await page.waitForTimeout(400); const v1 = await ultimo();
  await limpiar(); await page.evaluate(() => { document.getElementById("alerta").textContent = "Sesión a punto de caducar"; }); await page.waitForTimeout(400); const v2 = await ultimo();
  comprobar(v1 === "Guardado correctamente" && v2 === "Aviso: Sesión a punto de caducar", "lo que cambia en aria-live y en las alertas se dice solo", v1 + " | " + v2);

  // --- verbosidad y tono ---
  r = await page.evaluate(() => { const e = document.getElementById("n1"); const out = {}; ["principiante", "normal", "experto"].forEach((v) => { Winclus.ajustes.lector_verbosidad = v; out[v] = Winclus.describir(e); }); Winclus.ajustes.lector_verbosidad = "normal"; return out; });
  comprobar(r.principiante === "Enlace: Inicio. Intro para abrirlo" && r.normal === "Enlace: Inicio" && r.experto === "Inicio, enlace", "tres niveles de verbosidad: mucho, normal y poco", JSON.stringify(r));
  await page.evaluate(() => { Winclus.ajustes.voz_tono = 4; window.__ut = []; Winclus.decir("prueba"); });
  r = await page.evaluate(() => window.__ut.map((u) => u.pitch));
  comprobar(r.length && Math.abs(r[0] - 1.4) < 0.01, "«Tono de la voz» cambia el tono (pitch) de lo que se dice", JSON.stringify(r));
  r = await page.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-oir").click(); return { verb: !!Winclus.caja.getElementById("wcl-l-lector_verbosidad") || !!Winclus.caja.querySelector("#wcl-panel-oir .wcl-opc"), tono: !!Winclus.caja.getElementById("wcl-l-voz_tono") }; });
  comprobar(r.verb && r.tono, "el panel tiene «Cuánto explica el lector» y «Tono de la voz»", JSON.stringify(r));

  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
