// Servidor estático con tipos MIME correctos: sirve web/ en / y el scratchpad en /pruebas/
const http = require("http"), fs = require("fs"), path = require("path");
const WEB = path.resolve(__dirname, "../../../web"), PRUEBAS = __dirname;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".wasm": "application/wasm",
  ".task": "application/octet-stream", ".txt": "text/plain; charset=utf-8", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".css": "text/css" };
http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split("?")[0]);
  let f = u.startsWith("/pruebas/") ? path.join(PRUEBAS, u.slice(9)) : path.join(WEB, u === "/" ? "index.html" : u);
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end("no: " + f); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Access-Control-Allow-Origin": "*" });
    res.end(data);
  });
}).listen(8765, "127.0.0.1", () => console.log("listo en http://127.0.0.1:8765"));
