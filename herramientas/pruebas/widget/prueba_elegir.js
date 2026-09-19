// Elegir con los ojos (0.6.13). El usuario dijo que con los ojos «falla al escoger»: los desplegables iban de
// opción en opción, el clic caía en el enlace de al lado, el puntero temblaba y el gesto a veces no salía. Esta
// prueba reproduce las tres primeras sin cámara: se lleva el puntero virtual donde caería la mirada (con su error
// de unos 75 px) y se comprueba que Winclus pregunta cuál en vez de adivinar, que el desplegable enseña todas sus
// opciones de una vez y que lo que se va a pulsar se ve marcado antes de pulsarlo.
// Uso: node prueba_elegir.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const path = require("path");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto("file:///" + path.join(__dirname, "pagina-elegir.html").replace(/\\/g, "/"));
  await page.waitForFunction(() => window.Winclus);
  // Se simula que la cámara está en marcha (no se enciende ninguna) y el modo ojos
  await page.evaluate(() => {
    Winclus.simularCamara(true);
    Winclus.ajustes.modo_puntero = "ojos"; Winclus.ajustes.ojos_modo = "directo";
    window.__voz = [];
    speechSynthesis.speak = (u) => { window.__voz.push(u.text); setTimeout(() => { if (u.onend) u.onend({}); }, 5); };
  });
  const centro = (sel, dx = 0, dy = 0) => page.evaluate(([s, x, y]) => {
    const b = document.querySelector(s).getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2 + x), y: Math.round(b.top + b.height / 2 + y) };
  }, [sel, dx, dy]);
  const mirarYPulsar = async (p) => page.evaluate(([x, y]) => { Winclus.mover(x, y); Winclus.clic(); }, [p.x, p.y]);
  const lista = () => page.evaluate(() => {
    const d = Winclus.caja.querySelector(".wcl-elegir");
    if (!d || d.style.display !== "block") return null;
    return { titulo: d.querySelector("h2").textContent, opciones: Array.from(d.querySelectorAll("button")).map((b) => b.textContent.trim()) };
  });
  const pulsarOpcion = (texto) => page.evaluate((t) => {
    const b = Array.from(Winclus.caja.querySelectorAll(".wcl-elegir button")).find((x) => x.textContent.trim().indexOf(t) === 0);
    if (!b) return false; b.click(); return true;
  }, texto);

  console.log("== 1. Dos enlaces pegados: preguntar en vez de adivinar");
  // La mirada cae entre «Aceptar» y «Cancelar»: hoy pulsaría uno al azar
  let p = await centro("#uno", 34, 0);
  await mirarYPulsar(p);
  let d = await lista();
  comprobar(d && /Cuál de estos/i.test(d.titulo), "con dos enlaces cerca, sale la lista «¿Cuál de estos?»", d ? d.titulo : "no salió");
  comprobar(d && d.opciones.some((o) => /Aceptar/.test(o)) && d.opciones.some((o) => /Cancelar/.test(o)) && /Cancelar/.test(d.opciones[0]),
    "la lista trae los enlaces por su nombre y el más cercano va primero", d ? d.opciones.join(" | ") : "");
  comprobar(d && d.opciones.some((o) => /enlace/.test(o)), "cada opción dice qué es (enlace, botón, campo…)", d ? d.opciones[0] : "");
  comprobar((await page.evaluate(() => window.__pulsado.length)) === 0, "mientras se elige no se ha pulsado nada todavía");
  await pulsarOpcion("Cancelar");
  comprobar((await page.evaluate(() => window.__pulsado)).join() === "dos", "al elegir «Cancelar» se pulsa ese enlace y no el otro",
    JSON.stringify(await page.evaluate(() => window.__pulsado)));
  comprobar(!(await lista()), "la lista se cierra al elegir");

  console.log("== 2. Un botón cerca pero no debajo: ir a él");
  await page.evaluate(() => { window.__pulsado = []; });
  p = await centro("#enviar", 0, 46);      // 46 px por debajo del botón: fuera de él
  await mirarYPulsar(p);
  comprobar(!(await lista()), "con una sola cosa cerca no se pregunta: se va a ella");
  comprobar((await page.evaluate(() => window.__pulsado)).join() === "enviar", "el clic acaba en el botón aunque el puntero cayera fuera",
    JSON.stringify(await page.evaluate(() => window.__pulsado)));

  console.log("== 3. Lejos de todo: no se inventa un objetivo");
  await page.evaluate(() => { window.__pulsado = []; });
  await mirarYPulsar({ x: 300, y: 650 });
  comprobar(!(await lista()) && (await page.evaluate(() => window.__pulsado.length)) === 0,
    "en un sitio sin nada pulsable no sale lista ni se pulsa nada por inercia");

  console.log("== 4. Desplegables: todas las opciones de una vez");
  await page.evaluate(() => { window.__cambios = []; });
  p = await centro("#ciudad");
  await mirarYPulsar(p);
  d = await lista();
  if (d && /Cuál de estos/i.test(d.titulo)) { await pulsarOpcion("Ciudad"); d = await lista(); }   // si hubiera algo más cerca, primero se elige el campo
  comprobar(d && /Ciudad/i.test(d.titulo), "al pulsar el desplegable sale su lista con la etiqueta del campo", d ? d.titulo : "no salió");
  comprobar(d && d.opciones.length >= 6 && d.opciones.some((o) => /Cartagena/.test(o)),
    "están TODAS las opciones, no solo la siguiente", d ? d.opciones.join(" | ") : "");
  await pulsarOpcion("Cartagena");
  const cambios = await page.evaluate(() => window.__cambios);
  comprobar(cambios.join() === "car", "elegir Cartagena deja ese valor y dispara «change» una sola vez", JSON.stringify(cambios));
  comprobar((await page.evaluate(() => document.getElementById("ciudad").selectedIndex)) === 5, "el desplegable queda en la opción elegida");
  const voz = await page.evaluate(() => window.__voz.join(" "));
  comprobar(/Cartagena/.test(voz), "y se dice en voz alta lo que se eligió", voz.slice(-60));

  console.log("== 4b. La etiqueta de un campo no se ofrece aparte del campo");
  await page.evaluate(() => { Winclus.mover(0, 0); });
  p = await centro("#ciudad", -30, 0);
  const cands = await page.evaluate(([x, y]) => { Winclus.mover(x, y); return Winclus.candidatosCerca(x, y, 80).map((c) => c.el.tagName); }, [p.x, p.y]);
  comprobar(cands.indexOf("LABEL") < 0 && cands.indexOf("SELECT") >= 0, "entre «Ciudad» (etiqueta) y su desplegable se ofrece solo el desplegable", JSON.stringify(cands));

  console.log("== 5. Se ve lo que se va a pulsar antes de pulsarlo");
  p = await centro("#tres");
  await page.evaluate(([x, y]) => Winclus.mover(x, y), [p.x, p.y]);
  await page.waitForTimeout(60);
  comprobar(await page.evaluate(() => !!document.querySelector("#tres.wcl-apuntado")), "lo que hay bajo el puntero se marca con un marco");
  await page.evaluate(([x, y]) => Winclus.mover(x, y), [300, 650]);
  await page.waitForTimeout(60);
  comprobar(await page.evaluate(() => !document.querySelector(".wcl-apuntado")), "al irse el puntero, la marca desaparece");

  console.log("== 6. Con el ajuste apagado, todo como antes");
  await page.evaluate(() => { window.__pulsado = []; Winclus.ajustes.elegir_cerca = false; });
  p = await centro("#uno", 34, 0);
  await mirarYPulsar(p);
  comprobar(!(await lista()), "con «Preguntar cuál» apagado no sale la lista");
  await page.evaluate(() => { Winclus.ajustes.elegir_cerca = true; });

  console.log("== 7. Con un pulsador (barrido) también se puede elegir");
  await page.evaluate(() => { window.__pulsado = []; Winclus.ajustes.barrido = true; });
  p = await centro("#uno", 34, 0);
  await page.evaluate(([x, y]) => { Winclus.mover(x, y); }, [p.x, p.y]);
  await page.evaluate(() => Winclus.caja.querySelector(".wcl-elegir") || null);
  // el barrido usa el gesto como señal, así que la lista se abre desde el código
  await page.evaluate(([x, y]) => { Winclus.mover(x, y); Winclus.simularCamara(true); }, [p.x, p.y]);
  await page.evaluate(() => {
    const c = Winclus.candidatosCerca(Winclus.puntero.x, Winclus.puntero.y, Winclus.ajustes.elegir_radio_px);
    window.__cand = c.length;
  });
  comprobar((await page.evaluate(() => window.__cand)) >= 2, "candidatosCerca encuentra los enlaces pegados");
  await page.evaluate(() => { Winclus.ajustes.barrido = false; });

  console.log("== 8. Escape cierra la lista");
  p = await centro("#uno", 34, 0);
  await mirarYPulsar(p);
  comprobar(!!(await lista()), "la lista está abierta");
  await page.keyboard.press("Escape");
  comprobar(!(await lista()), "Escape la cierra sin pulsar nada");

  console.log("== 9. Llegar a los bordes de la pantalla");
  const alc = await page.evaluate(() => {
    Winclus.ajustes.ojos_alcance = true;
    const centro = Winclus.estirarAlcance([640, 400]);
    const casiBorde = Winclus.estirarAlcance([window.innerWidth * 0.92, window.innerHeight * 0.92]);
    Winclus.ajustes.ojos_alcance = false;
    const sin = Winclus.estirarAlcance([window.innerWidth * 0.92, window.innerHeight * 0.92]);
    Winclus.ajustes.ojos_alcance = true;
    return { centro, casiBorde, sin, ancho: window.innerWidth, alto: window.innerHeight };
  });
  comprobar(Math.abs(alc.centro[0] - 640) < 1 && Math.abs(alc.centro[1] - 400) < 1, "mirar al centro sigue siendo el centro", JSON.stringify(alc.centro));
  comprobar(alc.casiBorde[0] > alc.ancho * 0.99 && alc.casiBorde[1] > alc.alto * 0.99,
    "lo que la calibración deja en el 92 % llega ahora al borde", JSON.stringify(alc.casiBorde));
  comprobar(alc.casiBorde[0] <= alc.ancho - 1 && alc.casiBorde[1] <= alc.alto - 1, "y no se sale de la pantalla");
  comprobar(Math.abs(alc.sin[0] - alc.ancho * 0.92) < 1, "con el ajuste apagado, el puntero se queda donde se quedaba", JSON.stringify(alc.sin));

  console.log("== 10. Si el gesto de clic no sale, se ofrece otro");
  await page.evaluate(() => { Winclus.cerrarElegir(); Winclus.ajustes.modo_clic = "parpadeo"; Winclus.ajustes.ayuda_clic = true; Winclus.simularCamara(true); });
  const ofrecer = async () => page.evaluate(() => {
    // 60 s de reloj moviendo el puntero sin pulsar nunca
    let t = 1000;
    for (let i = 0; i < 120; i++) { Winclus.mover(300 + (i % 2) * 120, 300 + (i % 3) * 90); Winclus.tickAyudaClic(t); t += 0.5; }
    const d = Winclus.caja.querySelector(".wcl-elegir");
    return d && d.style.display === "block" ? { titulo: d.querySelector("h2").textContent, ops: Array.from(d.querySelectorAll("button")).map((b) => b.textContent.trim()) } : null;
  });
  let of = await ofrecer();
  comprobar(of && /No consigues hacer clic/i.test(of.titulo), "tras un rato moviendo el puntero sin pulsar, Winclus lo pregunta", of ? of.titulo : "no salió");
  comprobar(of && of.ops.some((o) => /quedándome quieto/i.test(o)) && !of.ops.some((o) => /cerrando los ojos/i.test(o)),
    "ofrece las otras formas de pulsar, no la que ya está puesta", of ? of.ops.join(" | ") : "");
  await pulsarOpcion("Pulsar quedándome quieto");
  comprobar((await page.evaluate(() => Winclus.ajustes.modo_clic)) === "quieto", "al elegirla, el clic pasa a ser quedarse quieto");
  of = await ofrecer();
  comprobar(!of, "y no vuelve a preguntar en la misma sesión");

  comprobar(errores.length === 0, "sin errores JS en toda la prueba", errores.join(" | "));
  await nav.close();
  console.log(fallos ? "FALLOS: " + fallos : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
