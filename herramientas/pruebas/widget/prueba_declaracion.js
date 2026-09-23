// Generador de declaración de accesibilidad (web/declaracion.html). Uso: node prueba_declaracion.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const { spawn } = require("child_process");
const path = require("path");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto("http://127.0.0.1:8765/declaracion.html");
  await page.waitForFunction(() => window.WinclusDeclaracion);
  const doc = () => page.evaluate(() => document.getElementById("doc").innerText);
  let t = await doc();
  comprobar(errores.length === 0 && /Declaración de accesibilidad de \[Nombre de la entidad\]/.test(t), "vacío: la vista previa ya muestra la estructura con los huecos marcados");

  // sin datos mínimos no descarga
  await page.click("#descargar");
  let estado = await page.textContent("#estado");
  comprobar(/Falta el nombre de la entidad, la dirección del sitio, el correo de contacto/.test(estado), "sin datos no descarga y dice qué falta", estado);

  await page.fill("#entidad", "Alcaldía de Villa Ejemplo");
  await page.fill("#sitio", "https://www.villaejemplo.gov.co");
  await page.fill("#correo", "accesibilidad@villaejemplo.gov.co");
  await page.fill("#telefono", "(601) 555 0000");
  await page.fill("#excepciones", "Los PDF anteriores a 2024 no están etiquetados.\nLos vídeos no tienen lengua de señas; se añadirá en 2027.");
  await page.fill("#fecha_eval", "2026-09-20");
  await page.check("#ev_manual");
  t = await doc();
  comprobar(/Alcaldía de Villa Ejemplo/.test(t) && /Ley Estatutaria 1618 de 2013/.test(t) && /Resolución 1519 de 2020/.test(t) && /Resolución 2893 de 2020/.test(t) && /NTC 5854/.test(t) && /Ley 1581 de 2012/.test(t), "entidad pública: cita la Ley 1618, la Res. 1519, la 2893, la NTC 5854 y la Ley 1581");
  comprobar(/parcialmente conforme/.test(t) && /PDF anteriores a 2024/.test(t) && /lengua de señas/.test(t), "estado parcial con las dos excepciones listadas");
  comprobar(/Winclus Audit/.test(t) && /teclado y un lector de pantalla/.test(t) && /20 de septiembre de 2026/.test(t), "cómo se comprobó: automática y manual, con la fecha en letras");
  comprobar(/accesibilidad@villaejemplo\.gov\.co/.test(t) && /Centro de Relevo/.test(t) && /15 días hábiles/.test(t) && /derecho de petición/.test(t), "canal de avisos con correo, teléfono por Centro de Relevo, plazo y derecho de petición");
  comprobar(/Alt \+ Mayús \+ W/.test(t) && /pictogramas/.test(t), "explica las ayudas de Winclus");

  // privada: sin 1519, con WCAG y NTC
  await page.selectOption("#tipo", "privada");
  t = await doc();
  comprobar(!/Resolución 1519/.test(t) && /WCAG\) 2\.1, nivel AA/.test(t) && /NTC 5854/.test(t) && !/Procuraduría/.test(t), "empresa privada: WCAG y NTC 5854, sin la Res. 1519 ni la Procuraduría");
  await page.selectOption("#tipo", "publica");
  await page.selectOption("#nivel", "total");
  t = await doc();
  comprobar(/totalmente conforme/.test(t), "estado «totalmente conforme»");
  await page.uncheck("#winclus");
  t = await doc();
  comprobar(!/Alt \+ Mayús \+ W/.test(t), "sin Winclus no se explica el panel");
  await page.check("#winclus");

  // descarga: HTML válido
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.click("#descargar")]);
  const ruta = await descarga.path();
  const html = require("fs").readFileSync(ruta, "utf8");
  comprobar(descarga.suggestedFilename() === "declaracion.html" && /^<!DOCTYPE html>\n<html lang="es">/.test(html) && /<title>Declaración de accesibilidad · Alcaldía de Villa Ejemplo<\/title>/.test(html) && /<main>/.test(html) && /<h1>Declaración de accesibilidad de Alcaldía de Villa Ejemplo<\/h1>/.test(html), "descarga declaracion.html con lang=es, título, main y h1");
  const ok = await page.evaluate((h) => { const d = new DOMParser().parseFromString(h, "text/html"); return !d.querySelector("parsererror") && d.querySelectorAll("h2").length >= 6; }, html);
  comprobar(ok, "el archivo se analiza sin errores y tiene al menos seis secciones");

  // vuelve tras recargar
  await page.reload();
  await page.waitForFunction(() => window.WinclusDeclaracion);
  const v = await page.inputValue("#entidad");
  comprobar(v === "Alcaldía de Villa Ejemplo", "lo escrito vuelve al recargar (localStorage)", v);
  await page.click("#limpiar");
  comprobar((await page.inputValue("#entidad")) === "", "«Empezar de nuevo» vacía el formulario");

  // axe sobre la página con el formulario lleno
  const AXE = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  await page.addScriptTag({ content: AXE });
  const axe = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }); return r.violations.map((v) => v.id + "×" + v.nodes.length); });
  comprobar(axe.length === 0, "axe sin incumplimientos en el generador", axe.join(", "));
  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));

  await nav.close();
  servidor.kill();
  console.log(fallos ? "\n" + fallos + " fallo(s)" : "\nTodo bien");
  process.exit(fallos ? 1 : 0);
})();
