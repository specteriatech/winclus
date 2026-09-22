// Construye lo que se sirve del widget a partir del código legible (web/winclus-widget.js):
//   web/winclus-widget.min.js   minificado con esbuild (es lo que carga widget.js, el cargador)
//   web/widget-X.Y.Z.js         copia fija de la versión, solo con --fija (nunca se vuelve a tocar una publicada)
// Comprueba que la versión del cargador (web/widget.js) y la del código completo coinciden.
// Uso: node construir.js [--fija]      Se ejecuta solo al principio de «npm test».
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const esbuild = require("esbuild");

const WEB = path.resolve(__dirname, "../../../web");
const fuente = fs.readFileSync(path.join(WEB, "winclus-widget.js"), "utf8");
const cargador = fs.readFileSync(path.join(WEB, "widget.js"), "utf8");
const version = (fuente.match(/var VERSION = "([^"]+)"/) || [])[1];
const versionCargador = (cargador.match(/var VERSION = "([^"]+)"/) || [])[1];
if (!version || version !== versionCargador) { console.error("La versión del cargador (web/widget.js: " + versionCargador + ") no coincide con la del widget (web/winclus-widget.js: " + version + ")"); process.exit(1); }
if (/\(\?<[=!]/.test(fuente)) { console.error("Hay un lookbehind en una expresión regular: Safari e iOS < 16.4 no lo analizan"); process.exit(1); }

const salida = esbuild.transformSync(fuente, { minify: true, target: "es2015", charset: "utf8", legalComments: "inline", logLevel: "silent" });
const min = "/*! Winclus widget " + version + " · https://winclus.com · Apache 2.0 · código legible: https://winclus.com/winclus-widget.js */\n" + salida.code;
fs.writeFileSync(path.join(WEB, "winclus-widget.min.js"), min);
const kb = (s) => Math.round(Buffer.byteLength(s, "utf8") / 1024);
console.log("winclus-widget.min.js: " + kb(min) + " KB (legible: " + kb(fuente) + " KB) · cargador widget.js: " + (Buffer.byteLength(cargador, "utf8") / 1024).toFixed(1) + " KB · versión " + version);

if (process.argv.includes("--fija")) {
  const fija = path.join(WEB, "widget-" + version + ".js");
  if (fs.existsSync(fija)) { console.log("Ya existe " + path.basename(fija) + ": una versión publicada no se toca. Sube la versión para generar otra."); }
  else {
    // La copia fija es autónoma (no pasa por el cargador) para que el hash de integridad cubra todo el código
    fs.writeFileSync(fija, min);
    const hash = crypto.createHash("sha384").update(fs.readFileSync(fija)).digest("base64");
    console.log("Copia fija: " + path.basename(fija) + "\nintegrity=\"sha384-" + hash + "\"\nHay que ponerlo en web/integrar.html, web/manual.html, integraciones/wordpress y integraciones/drupal.");
  }
}
