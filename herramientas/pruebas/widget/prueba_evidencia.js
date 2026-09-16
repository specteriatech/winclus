// Página de demostración y métricas de uso: demo.html pasa axe y carga el widget; las cifras de uso se cuentan
// en local, el resumen se copia sin datos personales, y solo se envían al sitio si hay data-metricas y la
// persona lo activa (una vez por semana). Uso: node prueba_evidencia.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  const nav = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));

  // --- demo ---
  await page.goto("http://127.0.0.1:8765/demo.html");
  await page.waitForFunction(() => window.Winclus, null, { timeout: 15000 });
  await page.addScriptTag({ content: AXE });
  const v = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations.map((x) => x.id + "×" + x.nodes.length));
  comprobar(v.length === 0, "demo.html pasa axe", v.join(", "));
  const pasos = await page.evaluate(() => document.querySelectorAll(".paso").length);
  comprobar(pasos === 7, "la demo tiene los siete pasos", String(pasos));
  await page.fill("#correo", "sinarroba");
  await page.click("#enviar");
  await page.waitForTimeout(250);
  comprobar(/tiene que ser un correo/.test(await page.evaluate(() => Winclus.caja.querySelector(".wcl-sonido").textContent)), "en la demo el error del formulario se explica en lenguaje claro");

  // --- métricas de uso: se cuentan en local ---
  await page.evaluate(() => { Winclus.abrir(); Winclus.orden("números"); Winclus.orden("quita los números"); Winclus.teclado(); Winclus.teclado(); });
  await page.waitForTimeout(100);
  const uso = await page.evaluate(() => JSON.parse(localStorage.getItem("winclus.uso")));
  comprobar(uso && uso.n.errores === 1 && uso.n.teclado === 1 && uso.n.ordenes >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(uso.desde), "las cifras de uso se cuentan en local (errores explicados, teclado, órdenes)", JSON.stringify(uso));
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-mas button")).find((b) => /Copiar el resumen de uso/.test(b.textContent)).click(); });
  await page.waitForTimeout(200);
  const resumen = await page.evaluate(() => navigator.clipboard.readText());
  comprobar(/Uso de Winclus en este navegador desde el/.test(resumen) && /errores de formulario explicados/.test(resumen) && !/correo|sinarroba/.test(resumen), "el resumen copiado solo lleva cifras, sin datos personales", resumen.split("\n")[1]);
  const sinEnvio = await page.evaluate(() => !Winclus.caja.getElementById("wcl-metricas_compartir"));
  comprobar(sinEnvio, "sin data-metricas no existe siquiera el interruptor de compartir");
  await ctx.close();

  // --- con data-metricas: solo si la persona lo activa ---
  const demo = fs.readFileSync(path.join(__dirname, "../../../web/demo.html"), "utf8");
  fs.writeFileSync(path.join(__dirname, "pagina-metricas.html"), demo.replace('<script src="widget.js" async>', '<script src="/widget.js" data-metricas="https://entidad.ejemplo/metricas" async>').replace(/href="paginas\.css"/, 'href="/paginas.css"'));
  const ctx2 = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const page2 = await ctx2.newPage();
  let recibido = null;
  await page2.route("https://entidad.ejemplo/metricas", async (route) => { recibido = JSON.parse(route.request().postData()); await route.fulfill({ status: 200, body: "ok" }); });
  await page2.goto("http://127.0.0.1:8765/pruebas/pagina-metricas.html");
  await page2.waitForFunction(() => window.Winclus, null, { timeout: 15000 });
  await page2.evaluate(() => { Winclus.abrir(); Winclus.teclado(); Winclus.teclado(); });
  await page2.waitForTimeout(5500);
  comprobar(recibido === null, "sin activar el interruptor no se envía nada aunque pasen los 5 s iniciales");
  await page2.evaluate(() => Winclus.caja.getElementById("wcl-metricas_compartir").click());
  await page2.waitForTimeout(400);
  comprobar(recibido && recibido.sitio === "127.0.0.1" && recibido.cifras.teclado === 1 && !("nombre" in recibido) && Object.keys(recibido).join(",") === "sitio,version,desde,cifras", "al activarlo se envían solo sitio, versión, fecha de inicio y cifras", JSON.stringify(recibido));
  const enviado = await page2.evaluate(() => JSON.parse(localStorage.getItem("winclus.uso_enviado") || "0"));
  recibido = null;
  await page2.evaluate(() => { Winclus.caja.getElementById("wcl-metricas_compartir").click(); Winclus.caja.getElementById("wcl-metricas_compartir").click(); });
  await page2.waitForTimeout(300);
  comprobar(enviado > 0 && recibido === null, "no se vuelve a enviar hasta pasada una semana");
  try { fs.unlinkSync(path.join(__dirname, "pagina-metricas.html")); } catch (e) {}
  await ctx2.close();

  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  servidor.kill();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
