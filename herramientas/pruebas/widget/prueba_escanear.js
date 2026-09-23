// Escáner en línea: web/api/escanear.js en local (con el Chromium de Playwright) y web/escanear.html con la API simulada.
// Uso: node prueba_escanear.js
const playwright = require("playwright");
const chromium = playwright[process.env.NAVEGADOR || "chromium"];
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  process.env.CHROME_PATH = process.env.CHROME_PATH || playwright.chromium.executablePath();
  const api = require(path.resolve(__dirname, "../../../web/api/escanear.js"));
  comprobar(api.urlValida("https://winclus.com/x") === "https://winclus.com/x" && api.urlValida("winclus.com") === null && api.urlValida("http://localhost/") === null && api.urlValida("http://10.1.2.3/") === null && api.urlValida("http://192.168.1.1/") === null && api.urlValida("ftp://a.com") === null && api.urlValida("http://127.0.0.1/") === null, "urlValida: solo http(s) públicas, nada privado ni local");

  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  // 1. la función sobre una página con barreras (por la función directa: urlValida no deja escanear 127.0.0.1)
  const r = await api.escanear("http://127.0.0.1:8765/pruebas/pagina-arreglos.html");
  comprobar(r.ok && r.total >= 15 && r.sev.critical >= 5 && r.puntaje >= 0 && r.puntaje <= 100, "escanea pagina-arreglos.html: muchas barreras, puntaje entre 0 y 100", r.total + " problemas, puntaje " + r.puntaje + ", " + r.ms + " ms");
  comprobar(r.problemas.every((p) => p.criterio && p.impact && p.help && p.n >= 1) && r.problemas.some((p) => /^CC\d+/.test(p.criterio)), "cada problema lleva criterio del Anexo 1, gravedad, texto y cuántos", r.problemas.slice(0, 2).map((p) => p.id + "→" + p.criterio).join(" | "));
  comprobar(r.extra.some((x) => x.id === "declaracion") && r.extra.some((x) => x.id === "skip-link") && !r.winclus && !r.declaracion && !r.salto, "comprobaciones de la 1519: sin declaración, sin «Ir al contenido», sin Winclus", r.extra.map((x) => x.id).join(","));
  const r2 = await api.escanear("http://127.0.0.1:8765/index.html");
  comprobar(r2.ok && r2.winclus && r2.declaracion && r2.salto && r2.puntaje >= 80, "la portada de winclus.com: con Winclus, declaración y salto, puntaje alto", r2.total + " problemas, puntaje " + r2.puntaje);
  const r3 = await api.escanear("http://127.0.0.1:8765/no-existe.html").catch((e) => ({ ok: false, error: e.message }));
  comprobar(!r3.ok && /HTTP 404/.test(r3.error || ""), "una página caída se informa como error, no como página sin barreras", r3.error);

  // 2. la página escanear.html con la API simulada
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1280, height: 900 } });
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  let pedido = null;
  await page.route("**/api/escanear", async (route) => { pedido = JSON.parse(route.request().postData()); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(r) }); });
  await page.goto("http://127.0.0.1:8765/escanear.html");
  await page.fill("#url", "ejemplo.gov.co");
  await page.click("#btn");
  await page.waitForSelector("#res.visible", { timeout: 10000 });
  const v = await page.evaluate(() => ({ puntaje: document.getElementById("puntaje").textContent, filas: document.querySelectorAll("#tabla tbody tr").length, checks: [...document.querySelectorAll("#checks li")].map((l) => l.className + ":" + l.textContent), kpis: document.getElementById("kpis").textContent, titulo: document.getElementById("titulo").textContent }));
  comprobar(pedido && pedido.url === "https://ejemplo.gov.co", "sin https:// la página lo añade antes de pedir", JSON.stringify(pedido));
  comprobar(v.puntaje === String(r.puntaje) && v.filas === r.problemas.length + r.extra.length && v.checks.length === 4 && v.checks.filter((c) => c.startsWith("no")).length >= 3 && /problemas/.test(v.kpis), "pinta puntaje, barreras, comprobaciones y cifras", v.puntaje + " · " + v.filas + " filas");
  const orden = await page.evaluate(() => [...document.querySelectorAll("#tabla tbody td.imp")].map((t) => t.textContent));
  const ORD = { "Crítica": 0, "Seria": 1, "Moderada": 2, "Leve": 3 };
  comprobar(orden.every((x, i) => i === 0 || ORD[orden[i - 1]] <= ORD[x]), "las barreras salen de más a menos graves", orden.slice(0, 4).join(","));
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.click("#descargar")]);
  const html = fs.readFileSync(await descarga.path(), "utf8");
  comprobar(/^escaneo-.*\.html$/.test(descarga.suggestedFilename()) && /<html lang="es">/.test(html) && /Resolución 1519/.test(html) && html.includes(r.problemas[0].help.replace(/&/g, "&amp;").replace(/</g, "&lt;")), "descarga el informe en HTML con las barreras", descarga.suggestedFilename());
  // error de la API
  await page.unroute("**/api/escanear");
  await page.route("**/api/escanear", (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Escribe una dirección completa" }) }));
  await page.fill("#url", "https://x.gov.co"); await page.click("#btn");
  await page.waitForFunction(() => /dirección completa/.test(document.getElementById("estado").textContent), null, { timeout: 5000 });
  comprobar(errores.length === 0, "el error de la API se muestra y no hay errores JS", errores.join(" | "));
  await nav.close();
  servidor.kill();
  console.log(fallos ? "\n" + fallos + " fallo(s)" : "\nTodo bien");
  process.exit(fallos ? 1 : 0);
})();
