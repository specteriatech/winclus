// Winclus Audit: analiza dos páginas locales (la portada de winclus.com y una página con fallos a propósito) y
// comprueba que el informe y el borrador de declaración se generan con lo esperado. Uso: node prueba_auditar.js
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const mala = path.join(__dirname, "pagina-mala.html");
  fs.writeFileSync(mala, '<!doctype html><html><head><title></title></head><body><img src="x.png"><p style="color:#bbb;background:#fff">Texto flojo</p><input type="text"><a href="#">aquí</a><video src="v.mp4"></video></body></html>');
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  const salida = fs.mkdtempSync(path.join(os.tmpdir(), "winclus-audit-"));
  const r = spawnSync(process.execPath, [path.join(__dirname, "auditar.js"), "http://127.0.0.1:8765/", "http://127.0.0.1:8765/pruebas/pagina-mala.html", "--salida", salida, "--entidad", "Alcaldía de Prueba"], { encoding: "utf8", timeout: 240000 });
  servidor.kill();
  try { fs.unlinkSync(mala); } catch (e) {}
  comprobar(r.status === 0, "el escáner termina bien", (r.stdout || "").trim().split("\n").slice(-3).join(" | ") + (r.stderr ? " ERR " + r.stderr.slice(0, 200) : ""));
  const informe = fs.existsSync(path.join(salida, "informe.html")) ? fs.readFileSync(path.join(salida, "informe.html"), "utf8") : "";
  const decl = fs.existsSync(path.join(salida, "declaracion.html")) ? fs.readFileSync(path.join(salida, "declaracion.html"), "utf8") : "";
  const json = fs.existsSync(path.join(salida, "resultados.json")) ? JSON.parse(fs.readFileSync(path.join(salida, "resultados.json"), "utf8")) : [];
  comprobar(informe.length > 2000 && decl.length > 1000 && json.length === 2, "genera informe.html, declaracion.html y resultados.json");
  const portada = json[0], malaR = json[1];
  comprobar(portada && portada.paginas.every((p) => p.ok && p.violaciones.length === 0), "la portada de winclus.com sale limpia", portada ? portada.paginas.map((p) => p.vista + ":" + p.violaciones.length).join(", ") : "");
  const ids = malaR ? malaR.paginas[0].violaciones.map((v) => v.id) : [];
  comprobar(ids.includes("image-alt") && ids.includes("document-title") && ids.includes("html-has-lang") && ids.includes("label") && ids.includes("color-contrast"), "la página mala cae en alt, título, idioma, etiqueta y contraste", ids.join(", "));
  const extras = malaR ? malaR.extra.map((x) => x.id) : [];
  comprobar(extras.includes("video-caption") && extras.includes("declaracion") && extras.includes("skip-link"), "las comprobaciones de la Res. 1519 detectan vídeo sin subtítulos, sin declaración y sin «ir al contenido»", extras.join(", "));
  comprobar(/CC1 Alternativa texto para elementos no textuales/.test(informe) && /CC5 Contraste de color suficiente/.test(informe) && /Cómo seguir/.test(informe) && /No constituye certificación/.test(informe),
    "el informe agrupa por criterio de la Res. 1519 y avisa de sus límites");
  // Los números tienen que ser los del Anexo 1, no unos propios: si se desplazan, el informe miente
  comprobar(/CC3 Guion para solo vídeo y solo audio/.test(informe) && /CC10 Permitir saltar bloques/.test(informe) &&
    /CC26 Enlaces adecuados/.test(informe) && /CC32 Manejable por teclado/.test(informe) && !/CC3 Contenido con estructura/.test(informe),
    "cada CC lleva el nombre que tiene en el Anexo 1 de la Resolución 1519");
  comprobar(/Alcaldía de Prueba/.test(decl) && /Resolución 1519 de 2020/.test(decl) && /cumple parcialmente/.test(decl) && /\[correo de contacto\]/.test(decl), "el borrador de declaración lleva la entidad, la norma, el estado y los huecos por rellenar");
  fs.rmSync(salida, { recursive: true, force: true });
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
