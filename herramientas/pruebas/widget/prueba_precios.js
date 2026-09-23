// Página de precios (web/precios.html). Uso: node prueba_precios.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const WEB = path.resolve(__dirname, "../../../web");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const html = fs.readFileSync(path.join(WEB, "precios.html"), "utf8");
  comprobar(/<span data-cifra="pruebas">/.test(html), "la cifra de pruebas la actualiza evidencia.js (data-cifra)");
  for (const [f, texto] of [["index.html", 'href="precios"'], ["mapa-del-sitio.html", 'href="precios"'], ["sitemap.xml", "winclus.com/precios<"], ["index.html", 'href="declaracion"'], ["mapa-del-sitio.html", 'href="declaracion"'], ["sitemap.xml", "winclus.com/declaracion<"]]) {
    comprobar(fs.readFileSync(path.join(WEB, f), "utf8").includes(texto), f + " enlaza " + texto);
  }
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1280, height: 900 } });
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto("http://127.0.0.1:8765/precios.html");
  const r = await page.evaluate(() => {
    const planes = [...document.querySelectorAll(".plan")].map((p) => ({ nombre: p.querySelector("h2").textContent.trim(), precio: p.querySelector(".precio").textContent.trim().replace(/\s+/g, " "), n: p.querySelectorAll("li").length, boton: p.querySelector("a.btn").textContent.trim(), href: p.querySelector("a.btn").getAttribute("href") }));
    const filas = [...document.querySelectorAll("#comparar ~ .tabla tbody tr, .tabla tbody tr")].map((tr) => tr.children[0].textContent.trim());
    return { planes, filas, texto: document.body.innerText, detalles: document.querySelectorAll("details summary").length, h1: document.querySelector("h1").textContent.trim() };
  });
  comprobar(r.planes.length === 4 && r.planes.map((p) => p.nombre).join("|") === "Gratis|Entidad|Entidad Plus|A medida", "cuatro planes: Gratis, Entidad, Entidad Plus y A medida", r.planes.map((p) => p.nombre).join("|"));
  comprobar(/\$0/.test(r.planes[0].precio) && /sin límite de visitas/.test(r.planes[0].precio) && r.planes[0].n >= 5 && /lector de pantalla propio/.test(r.texto) && /contraste inteligente/.test(r.texto), "el plan gratis: $0, sin límite de visitas, con el panel completo (lector y contraste inteligente)", r.planes[0].precio);
  comprobar(/\$2\.400\.000/.test(r.planes[1].precio) && /\$5\.900\.000/.test(r.planes[2].precio) && /Cotización/.test(r.planes[3].precio), "Entidad $2.400.000, Entidad Plus $5.900.000, A medida con cotización", r.planes.map((p) => p.precio).join(" · "));
  comprobar(r.planes.every((p) => p.n >= 5 && p.boton && p.href), "cada plan lista al menos cinco cosas y tiene botón con destino");
  comprobar(r.filas.length >= 12 && r.filas.includes("Precio por tráfico") && r.filas.includes("Asistencia jurídica") && /23 de septiembre de 2026/.test(r.texto), "tabla frente a UserWay con al menos 12 condiciones y la fecha en que se leyó su página", r.filas.length + " filas");
  comprobar(/No hay cobro por visitas/.test(r.texto) && /Sin cobro por visitas en ningún plan/.test(r.texto), "dice que no hay cobro por visitas");
  comprobar(/sin IVA/.test(r.texto) && /SECOP/.test(r.texto), "precios sin IVA y contratación por SECOP");
  comprobar(r.detalles >= 5 && /derecho colombiano/.test(r.texto), "preguntas plegables y asistencia jurídica en derecho colombiano", r.detalles + " preguntas");
  comprobar(/Auditoría manual/.test(r.texto) && /Formación/.test(r.texto) && /Pruebas con personas/.test(r.texto), "servicios sueltos: auditoría manual, formación y pruebas con personas");
  // teclado: los details se abren con Intro
  await page.focus("details summary");
  await page.keyboard.press("Enter");
  const abierto = await page.evaluate(() => document.querySelector("details").open);
  comprobar(abierto, "una pregunta se abre con Intro desde el teclado");
  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  servidor.kill();
  console.log(fallos ? "\n" + fallos + " fallo(s)" : "\nTodo bien");
  process.exit(fallos ? 1 : 0);
})();
