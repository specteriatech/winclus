// Winclus Monitor (22-sep-2026): vigilancia continua de un sitio. Primera ejecución sobre una página limpia; segunda con
// una página con barreras añadida a la lista y un sitemap local: detecta la página nueva, las barreras nuevas, la falta
// del widget y de la declaración, guarda historial, ultimo.json, panel.html, alerta.txt/json y los informes (con ACR),
// y avisa por webhook (servidor local que recibe el POST). Tercera ejecución sin cambios: sin avisos. Uso: node prueba_monitor.js
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  const recibidos = [];
  const hook = http.createServer((req, res) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { recibidos.push(JSON.parse(d)); res.writeHead(200); res.end("ok"); }); }).listen(8766, "127.0.0.1");
  await new Promise((r) => setTimeout(r, 600));
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "winclus-monitor-"));
  const sitemap = path.join(__dirname, "sitemap-prueba.xml");
  fs.writeFileSync(sitemap, '<?xml version="1.0"?><urlset><url><loc>http://127.0.0.1:8765/pruebas/pagina-formulario.html</loc></url><url><loc>http://127.0.0.1:8765/pruebas/foto.jpg</loc></url></urlset>');
  const cfg = (extra) => { const c = Object.assign({ entidad: "Entidad de Prueba", urls: ["http://127.0.0.1:8765/"], salida: "monitor", webhook: "http://127.0.0.1:8766/aviso" }, extra); fs.writeFileSync(path.join(carpeta, "monitor.json"), JSON.stringify(c)); return path.join(carpeta, "monitor.json"); };
  // El monitor corre aparte y en segundo plano: si se esperara con spawnSync, este proceso no podría contestar al webhook
  const correr = (ruta) => new Promise((resolve) => { const p = spawn(process.execPath, [path.join(__dirname, "monitor.js"), ruta]); let stdout = "", stderr = ""; p.stdout.on("data", (d) => (stdout += d)); p.stderr.on("data", (d) => (stderr += d)); p.on("close", (status) => resolve({ status, stdout, stderr })); });
  const leer = (n) => JSON.parse(fs.readFileSync(path.join(carpeta, "monitor", n), "utf8"));

  // 1. primera ejecución: solo la portada
  let r = await correr(cfg({}));
  comprobar(r.status === 0, "la primera ejecución termina bien", (r.stdout || "").trim().split("\n").slice(-2).join(" | ") + (r.stderr ? " ERR " + r.stderr.slice(0, 300) : ""));
  const u1 = leer("ultimo.json"), h1 = leer("historial.json"), a1 = leer("alerta.json");
  const portada = u1.paginas["http://127.0.0.1:8765/"];
  comprobar(portada && portada.ok && portada.total === 0 && portada.winclus && portada.declaracion, "la portada sale limpia, con widget y con enlace a la declaración", JSON.stringify(portada && { ok: portada.ok, total: portada.total, winclus: portada.winclus, declaracion: portada.declaracion }));
  comprobar(h1.length === 1 && a1.avisos.length === 0 && recibidos.length === 0, "primera vez: historial de una entrada, sin avisos y sin llamar al webhook", h1.length + " / " + a1.avisos.length + " / " + recibidos.length);
  const informes = fs.readdirSync(path.join(carpeta, "monitor")).filter((n) => /^informe-/.test(n));
  comprobar(informes.length === 1 && ["informe.html", "declaracion.html", "acr.html", "acr.md", "resultados.json"].every((n) => fs.existsSync(path.join(carpeta, "monitor", informes[0], n))), "guarda el informe completo de la ejecución con declaración y ACR", informes.join(","));
  const acr = fs.readFileSync(path.join(carpeta, "monitor", informes[0], "acr.html"), "utf8");
  comprobar(/VPAT/.test(acr) && /Tabla 1: criterios de nivel A/.test(acr) && /<strong>1\.1\.1<\/strong> Contenido no textual/.test(acr) && /<strong>2\.4\.7<\/strong> Foco visible/.test(acr) && /Pendiente de revisión manual/.test(acr) && /Cumple \(evaluación automática\)/.test(acr) && /EN 301 549 9\.1\.4\.3/.test(acr),
    "el ACR sigue la plantilla VPAT 2.5 con los 55 criterios A y AA, la cláusula de la EN 301 549 y sin marcar «Cumple» a secas");
  comprobar(!/>Cumple<\/td>/.test(acr), "ningún criterio sale como «Cumple» sin la coletilla de evaluación automática");

  // 2. segunda: se añade una página con barreras y un sitemap local
  r = await correr(cfg({ urls: ["http://127.0.0.1:8765/", "http://127.0.0.1:8765/pruebas/pagina-arreglos.html?sin"], sitemap: "http://127.0.0.1:8765/pruebas/sitemap-prueba.xml", maximo: 10 }));
  comprobar(r.status === 0, "la segunda ejecución termina bien", (r.stderr || "").slice(0, 300));
  const u2 = leer("ultimo.json"), h2 = leer("historial.json"), a2 = leer("alerta.json");
  const urls2 = Object.keys(u2.paginas);
  comprobar(urls2.length === 3 && urls2.includes("http://127.0.0.1:8765/pruebas/pagina-formulario.html") && !urls2.some((u) => /foto\.jpg/.test(u)), "las páginas del sitemap se suman a la lista y las imágenes se ignoran", urls2.join(", "));
  const mala = u2.paginas["http://127.0.0.1:8765/pruebas/pagina-arreglos.html?sin"];
  comprobar(mala && mala.total >= 10 && Object.keys(mala.problemas).some((k) => k === "image-alt") && Object.keys(mala.problemas).some((k) => k === "1519:skip-link"), "la página con barreras se resume por problema, con los de axe y los de la Res. 1519", mala && mala.total + ": " + Object.keys(mala.problemas).slice(0, 6).join(","));
  comprobar(a2.avisos.some((x) => /Página nueva en la vigilancia: .*pagina-arreglos/.test(x)) && a2.avisos.length >= 1 && h2.length === 2, "avisa de la página nueva con sus problemas y el historial crece", a2.avisos.join(" | ").slice(0, 200));
  comprobar(recibidos.length === 1 && /aviso\(s\)/.test(recibidos[0].asunto) && recibidos[0].avisos.length === a2.avisos.length && recibidos[0].entidad === "Entidad de Prueba", "el webhook recibe el aviso con asunto, lista y entidad", JSON.stringify(recibidos[0] || {}).slice(0, 200));
  const panel = fs.readFileSync(path.join(carpeta, "monitor", "panel.html"), "utf8");
  comprobar(/Monitor de accesibilidad · Entidad de Prueba/.test(panel) && /Avisos de esta ejecución/.test(panel) && /pagina-arreglos/.test(panel) && /<svg/.test(panel) && /acr\.html/.test(panel), "el panel muestra entidad, avisos, páginas, evolución y enlaces a los informes");
  comprobar(/<td class="mal">no<\/td>/.test(panel), "el panel marca en rojo la página sin widget o sin declaración");

  // 3. tercera: misma lista, nada cambia → sin avisos ni webhook
  r = await correr(cfg({ urls: ["http://127.0.0.1:8765/", "http://127.0.0.1:8765/pruebas/pagina-arreglos.html?sin"], sitemap: "http://127.0.0.1:8765/pruebas/sitemap-prueba.xml", maximo: 10 }));
  const a3 = leer("alerta.json"), h3 = leer("historial.json");
  comprobar(r.status === 0 && a3.avisos.length === 0 && a3.nuevos === 0 && recibidos.length === 1 && h3.length === 3, "sin cambios no hay avisos ni webhook, y el historial sigue creciendo", a3.avisos.join(" | ") + " / webhooks: " + recibidos.length);
  // 4. una página desaparece de la lista y otra deja de responder
  r = await correr(cfg({ urls: ["http://127.0.0.1:8765/", "http://127.0.0.1:8765/no-existe.html"] }));
  const a4 = leer("alerta.json");
  comprobar(a4.avisos.some((x) => /ya no está en la lista/.test(x)) && a4.avisos.some((x) => /no-existe.*no se pudo analizar|no se pudo analizar.*no-existe/.test(x)), "avisa de las páginas que salen de la lista y de las que no responden", a4.avisos.join(" | ").slice(0, 300));

  hook.close(); servidor.kill();
  try { fs.unlinkSync(sitemap); fs.rmSync(carpeta, { recursive: true, force: true }); } catch (e) {}
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
