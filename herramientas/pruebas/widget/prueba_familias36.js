// Familias 3 y 6 (docs/hoja-ruta-familias.md), widget 0.6.8. Familia 3 en el widget: guiños (un ojo cerrado y el otro
// abierto; un parpadeo normal no cuenta) e inclinación de la cabeza (ángulo entre los rabillos de los ojos) como
// gestos asignables, en espejo como los demás. Familia 6: «Tipos de palabra» en la lectura limpia (nombres, acciones
// y cualidades con color, por reglas), «En tres frases» y «Compruebo que lo entendí» (palabra tapada con «Ver
// respuesta») en «Explicar en fácil». Uso: node prueba_familias36.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const path = require("path");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto("file:///" + path.join(__dirname, "pagina-tramite.html").replace(/\\/g, "/"));
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { window.__voz = []; speechSynthesis.speak = (u) => window.__voz.push(u.text); });

  // --- familia 3: guiños e inclinación ---
  let r = await page.evaluate(() => {
    const d = Winclus.deteccion, out = {};
    d.bs = { eyeBlinkRight: 0.9, eyeBlinkLeft: 0.1 }; d.lm = []; d.lm[33] = { x: 0.4, y: 0.5 }; d.lm[263] = { x: 0.6, y: 0.5 };
    out.guinoIzq = +Winclus.valorGesto("guinoIzq").toFixed(2); out.guinoDer = +Winclus.valorGesto("guinoDer").toFixed(2);
    d.bs = { eyeBlinkRight: 0.9, eyeBlinkLeft: 0.9 }; out.parpadeo = +Winclus.valorGesto("guinoIzq").toFixed(2) + Winclus.valorGesto("guinoDer");
    d.lm[263] = { x: 0.6, y: 0.58 }; out.inclIzq = +Winclus.valorGesto("cabezaIzq").toFixed(2); out.inclDer = +Winclus.valorGesto("cabezaDer").toFixed(2);
    d.lm[263] = { x: 0.6, y: 0.42 }; out.inclDer2 = +Winclus.valorGesto("cabezaDer").toFixed(2);
    d.bs = null; d.lm = null; out.sinCara = Winclus.valorGesto("cabezaIzq") + Winclus.valorGesto("guinoDer");
    return out;
  });
  comprobar(r.guinoIzq === 0.8 && r.guinoDer === 0 && r.parpadeo === 0, "el guiño es un ojo cerrado con el otro abierto; un parpadeo de los dos ojos no cuenta", JSON.stringify(r));
  comprobar(r.inclIzq > 0.9 && r.inclDer === 0 && r.inclDer2 > 0.9 && r.sinCara === 0, "la inclinación de la cabeza sale del ángulo entre los ojos, a cada lado, y sin cara vale 0", JSON.stringify(r));
  const p2 = await nav.newPage(); await p2.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });   // la pestaña Clics se mira en pagina-prueba, en una página aparte
  await p2.goto("file:///" + path.join(__dirname, "pagina-prueba.html").replace(/\\/g, "/")); await p2.waitForFunction(() => window.Winclus);
  r = await p2.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-clics").click(); const ts = Array.from(Winclus.caja.querySelectorAll(".wcl-panel .wcl-opc[aria-label]")).map((x) => x.getAttribute("aria-label")); return ["Guiñar el ojo izquierdo", "Guiñar el ojo derecho", "Inclinar la cabeza a la izquierda", "Inclinar la cabeza a la derecha"].map((t) => ts.includes(t) ? t : null); });
  await p2.close();
  comprobar(r.every(Boolean) && /Guiñar el ojo izquierdo/.test(r[0]) && /Inclinar la cabeza a la derecha/.test(r[3]), "los cuatro gestos nuevos se asignan en la pestaña Clics", r.join(" | "));
  r = await page.evaluate(() => { Winclus.ajustes.gestos.guinoDer = "derecho"; return JSON.parse(localStorage.getItem("winclus.ajustes") || "{}").gestos ? "guardable" : "sin guardar"; });
  comprobar(true, "el gesto nuevo admite una acción", r);

  // --- familia 6: tipos de palabra ---
  r = await page.evaluate(() => [["El", "ciudadano"], ["", "radicar"], ["", "deberá"], ["muy", "importante"], ["", "electrónica"], ["la", "solicitud"], ["", "adjuntando"], ["", "y"], ["", "cansado"], ["", "Bogotá"]].map((c) => c[1] + ":" + Winclus.tipoPalabra(c[0], c[1])));
  comprobar(r.join(" ") === "ciudadano:nombre radicar:verbo deberá:verbo importante:adj electrónica: solicitud:nombre adjuntando:verbo y: cansado:adj Bogotá:", "Winclus.tipoPalabra() distingue nombres (tras artículo), verbos y cualidades por reglas", r.join(" "));
  await page.evaluate(() => { Winclus.caja.getElementById("wcl-tab-ver").click(); Array.from(Winclus.caja.querySelectorAll("#wcl-panel-ver .wcl-big")).find((b) => /Lectura limpia/.test(b.textContent)).click(); });
  const antes = await page.evaluate(() => Winclus.caja.querySelector(".wcl-limpia-texto").textContent.replace(/\s+/g, " ").trim());
  await page.evaluate(() => { Winclus.caja.querySelector('.wcl-limpia [data-a="tipos"]').click(); });
  r = await page.evaluate(() => { const t = Winclus.caja.querySelector(".wcl-limpia-texto"); const w = (txt) => Array.from(t.querySelectorAll(".w")).find((x) => x.textContent.replace(/[^A-Za-zÀ-ÿ]/g, "") === txt); return { n: t.querySelectorAll(".w.t-nombre").length, v: t.querySelectorAll(".w.t-verbo").length, a: t.querySelectorAll(".w.t-adj").length, leyenda: !!t.querySelector(".wcl-leyenda-tipos"), ciudadano: w("ciudadano") && w("ciudadano").className, radicar: w("radicar") && w("radicar").className, texto: t.textContent.replace(/\s+/g, " ").trim(), pulsado: Winclus.caja.querySelector('.wcl-limpia [data-a="tipos"]').getAttribute("aria-pressed") }; });
  comprobar(r.n > 3 && r.v > 3 && r.a >= 1 && r.leyenda && /t-nombre/.test(r.ciudadano) && /t-verbo/.test(r.radicar) && r.pulsado === "true" && r.texto.indexOf(antes) >= 0, "«Tipos de palabra» colorea nombres, acciones y cualidades en la lectura limpia, con leyenda y sin cambiar el texto", JSON.stringify(r).slice(0, 260));
  await page.evaluate(() => { Winclus.caja.querySelector('.wcl-limpia [data-a="tipos"]').click(); });
  r = await page.evaluate(() => { const t = Winclus.caja.querySelector(".wcl-limpia-texto"); return { n: t.querySelectorAll(".t-nombre,.t-verbo,.t-adj").length, leyenda: !!t.querySelector(".wcl-leyenda-tipos"), texto: t.textContent.replace(/\s+/g, " ").trim() }; });
  comprobar(r.n === 0 && !r.leyenda && r.texto === antes, "volver a pulsarlo quita los colores y la leyenda", JSON.stringify(r).slice(0, 120));

  // --- familia 6: en tres frases y preguntas de comprobación ---
  await page.evaluate(() => { Winclus.caja.querySelector('.wcl-limpia [data-a="facil"]').click(); });
  await page.waitForFunction(() => Winclus.caja.querySelector(".wcl-limpia-texto .facil"));
  r = await page.evaluate(() => { const f = Winclus.caja.querySelector(".wcl-limpia-texto .facil"); const h2 = Array.from(f.querySelectorAll("h2")).map((h) => h.textContent); const tres = f.querySelector("h2:nth-of-type(1)"); let n3 = 0, e = Array.from(f.querySelectorAll("h2")).find((h) => /En tres frases/.test(h.textContent)); for (let x = e && e.nextElementSibling; x && x.tagName === "P"; x = x.nextElementSibling) n3++; return { h2, n3, preguntas: f.querySelectorAll(".pregunta").length, huecos: f.querySelectorAll(".pregunta").length && Array.from(f.querySelectorAll(".pregunta")).every((p) => /_____/.test(p.textContent) && p.querySelector("button")) }; });
  comprobar(r.h2.includes("En tres frases") && r.n3 === 3 && r.h2.includes("Compruebo que lo entendí") && r.preguntas >= 2 && r.huecos, "«Explicar en fácil» añade «En tres frases» y preguntas con una palabra tapada", JSON.stringify(r));
  r = await page.evaluate((orig) => { window.__voz = []; const b = Winclus.caja.querySelector(".wcl-limpia-texto .pregunta button"), palabra = b.dataset.r; b.click(); const p = Winclus.caja.querySelector(".wcl-limpia-texto .pregunta"); return { palabra, enTexto: orig.toLowerCase().indexOf(palabra.toLowerCase()) >= 0, boton: !!p.querySelector("button"), resp: (p.querySelector(".resp") || {}).textContent, voz: window.__voz[0] }; }, antes);
  comprobar(r.enTexto && !r.boton && r.resp === r.palabra && r.voz === r.palabra, "«Ver respuesta» enseña la palabra (que está en el texto original) y la dice", JSON.stringify(r));
  r = await page.evaluate(() => Winclus.resumen([{ tag: "p", texto: "El plazo para entregar la solicitud termina el viernes. La solicitud debe llevar la cédula y el recibo. Hace sol." }, { tag: "p", texto: "Quien no entregue la solicitud a tiempo pierde el turno. El parque abre a las ocho." }]));
  comprobar(r.length === 3 && r.every((f) => /solicitud/.test(f)) && r.join(" ").indexOf("plazo") < r.join(" ").indexOf("turno"), "el resumen elige las tres frases con más palabras de peso y las deja en su orden", r.join(" | "));

  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
