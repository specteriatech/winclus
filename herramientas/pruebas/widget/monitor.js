// Winclus Monitor: vigila la accesibilidad de un sitio de forma continua. Cada vez que se ejecuta (a diario con el
// Programador de tareas de Windows, cron o GitHub Actions) pasa Winclus Audit por las páginas del sitio (las de la
// lista y las del sitemap), compara con la ejecución anterior, guarda el historial, actualiza un panel (panel.html)
// y avisa por correo o por webhook (Slack, Teams, n8n, Make…) si aparecen barreras nuevas, una página deja de
// responder, el widget desaparece o se pierde el enlace a la declaración de accesibilidad.
// Uso: node monitor.js monitor.json          (copia monitor.ejemplo.json y rellénalo)
//      node monitor.js https://sitio.gov.co --sitemap --entidad "Alcaldía de …"
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const audit = require("./auditar.js");

function leerConfig() {
  const args = process.argv.slice(2);
  let cfg = { entidad: "", urls: [], sitemap: "", maximo: 30, salida: path.join(process.cwd(), "monitor"), webhook: "", correo: null, guardarInformes: true };
  if (args[0] && /\.json$/i.test(args[0])) { Object.assign(cfg, JSON.parse(fs.readFileSync(args[0], "utf8"))); cfg.salida = path.resolve(path.dirname(args[0]), cfg.salida || "monitor"); args.shift(); }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sitemap") cfg.sitemap = /^https?:/.test(args[i + 1] || "") ? args[++i] : "auto";
    else if (args[i] === "--entidad") cfg.entidad = args[++i];
    else if (args[i] === "--salida") cfg.salida = path.resolve(args[++i]);
    else if (args[i] === "--maximo") cfg.maximo = +args[++i] || 30;
    else if (args[i] === "--webhook") cfg.webhook = args[++i];
    else if (/^https?:/.test(args[i])) cfg.urls.push(args[i]);
  }
  if (!cfg.urls.length && !cfg.sitemap) { console.log("Uso: node monitor.js monitor.json  |  node monitor.js https://sitio [--sitemap [url]] [--entidad \"Nombre\"] [--salida carpeta] [--webhook url]"); process.exit(1); }
  return cfg;
}
function pedir(url, opciones, cuerpo) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.request(url, Object.assign({ method: cuerpo ? "POST" : "GET", timeout: 20000 }, opciones || {}), (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve({ estado: res.statusCode, cuerpo: d })); });
    req.on("error", reject); req.on("timeout", () => { req.destroy(new Error("tiempo agotado")); });
    if (cuerpo) req.write(cuerpo);
    req.end();
  });
}
// Páginas del sitemap (y de los sitemaps índice), hasta el máximo, con las de la lista siempre delante
async function urlsDelSitemap(cfg) {
  const base = cfg.urls[0] ? new URL(cfg.urls[0]).origin : "";
  const sm = cfg.sitemap === "auto" || cfg.sitemap === true ? base + "/sitemap.xml" : cfg.sitemap;
  const vistas = new Set(cfg.urls), lista = cfg.urls.slice();
  async function leer(u, prof) {
    if (prof > 2 || lista.length >= cfg.maximo) return;
    let r; try { r = await pedir(u); } catch (e) { console.log("No se pudo leer el sitemap " + u + ": " + e.message); return; }
    if (r.estado !== 200) { console.log("Sitemap " + u + ": HTTP " + r.estado); return; }
    const locs = [...r.cuerpo.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].trim());
    if (/<sitemapindex/i.test(r.cuerpo)) { for (const l of locs) await leer(l, prof + 1); return; }
    for (const l of locs) { if (lista.length >= cfg.maximo) break; if (!vistas.has(l) && !/\.(pdf|jpg|png|xml|zip)$/i.test(l)) { vistas.add(l); lista.push(l); } }
  }
  await leer(sm, 0);
  return lista;
}
function resumir(r) {
  const problemas = {}, sev = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  r.paginas.forEach((p) => p.violaciones.forEach((v) => { const k = v.id; problemas[k] = problemas[k] || { id: k, help: v.help, criterio: audit.criterioDe(k), impact: v.impact, n: 0 }; problemas[k].n += v.nodos.length; sev[v.impact] = (sev[v.impact] || 0) + v.nodos.length; }));
  r.extra.forEach((x) => { const k = "1519:" + x.id; problemas[k] = problemas[k] || { id: k, help: x.help, criterio: x.criterio, impact: x.impact, n: 0 }; problemas[k].n += 1; sev[x.impact] = (sev[x.impact] || 0) + 1; });
  const esc = r.paginas.find((p) => p.vista.startsWith("escritorio")) || r.paginas[0];
  return { url: r.url, ok: r.paginas.some((p) => p.ok), error: r.paginas.map((p) => p.error).filter(Boolean)[0] || "", total: audit.contar(r), sev, titulo: esc ? esc.titulo : "", winclus: !!(esc && esc.winclus), declaracion: !r.extra.some((x) => x.id === "declaracion"), problemas };
}
function comparar(ahora, antes) {
  const avisos = [], nuevos = [], resueltos = [];
  Object.keys(ahora.paginas).forEach((u) => {
    const a = ahora.paginas[u], b = antes && antes.paginas[u];
    if (!a.ok) { avisos.push("La página " + u + " no se pudo analizar: " + (a.error || "sin respuesta")); return; }
    if (!b) { if (a.total) avisos.push("Página nueva en la vigilancia: " + u + " con " + a.total + " problema(s)"); return; }
    if (!b.ok) return;
    Object.keys(a.problemas).forEach((k) => { if (!b.problemas[k]) nuevos.push({ url: u, p: a.problemas[k] }); else if (a.problemas[k].n > b.problemas[k].n) nuevos.push({ url: u, p: a.problemas[k], mas: a.problemas[k].n - b.problemas[k].n }); });
    Object.keys(b.problemas).forEach((k) => { if (!a.problemas[k]) resueltos.push({ url: u, p: b.problemas[k] }); });
    if (b.winclus && !a.winclus) avisos.push("El widget Winclus ya no está en " + u);
    if (b.declaracion && !a.declaracion) avisos.push("Se perdió el enlace a la declaración de accesibilidad en " + u);
  });
  if (antes) Object.keys(antes.paginas).forEach((u) => { if (!ahora.paginas[u]) avisos.push("La página " + u + " ya no está en la lista vigilada"); });
  nuevos.forEach((n) => avisos.push((n.mas ? n.mas + " elemento(s) más con " : "Barrera nueva en ") + n.url + ": " + n.p.help + " (" + n.p.criterio + ", " + n.p.impact + ")"));
  return { avisos, nuevos, resueltos };
}
function sparkline(historial) {
  const puntos = historial.slice(-60).map((h) => h.total), max = Math.max(1, ...puntos), w = 240, h = 48;
  if (puntos.length < 2) return "";
  const xs = puntos.map((_, i) => (i / (puntos.length - 1)) * (w - 4) + 2), ys = puntos.map((p) => h - 4 - (p / max) * (h - 8));
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolución del total de problemas: de ${puntos[0]} a ${puntos[puntos.length - 1]}"><polyline fill="none" stroke="#0F7A70" stroke-width="2" points="${xs.map((x, i) => x.toFixed(1) + "," + ys[i].toFixed(1)).join(" ")}"/></svg>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function panelHtml(cfg, ahora, antes, historial, dif, carpetaInforme) {
  const urls = Object.keys(ahora.paginas), total = urls.reduce((s, u) => s + (ahora.paginas[u].total || 0), 0), totalAntes = antes ? Object.keys(antes.paginas).reduce((s, u) => s + (antes.paginas[u].total || 0), 0) : null;
  const delta = totalAntes == null ? "" : total > totalAntes ? `<span class="mal">▲ ${total - totalAntes} más que la vez anterior</span>` : total < totalAntes ? `<span class="ok">▼ ${totalAntes - total} menos que la vez anterior</span>` : `<span class="nota">igual que la vez anterior</span>`;
  const fila = (u) => { const p = ahora.paginas[u], b = antes && antes.paginas[u], d = b && b.ok && p.ok ? p.total - b.total : null;
    return `<tr><td><a href="${esc(u)}">${esc(p.titulo || u)}</a><br><span class="nota">${esc(u)}</span></td><td class="${!p.ok ? "mal" : p.total ? "mal" : "ok"}">${!p.ok ? "no responde" : p.total}</td><td>${d == null ? "" : d > 0 ? '<span class="mal">+' + d + "</span>" : d < 0 ? '<span class="ok">' + d + "</span>" : "="}</td><td>${p.sev.critical || 0} / ${p.sev.serious || 0}</td><td class="${p.winclus ? "ok" : "mal"}">${p.winclus ? "sí" : "no"}</td><td class="${p.declaracion ? "ok" : "mal"}">${p.declaracion ? "sí" : "no"}</td></tr>`; };
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Monitor de accesibilidad · ${esc(cfg.entidad || urls[0] || "")}</title>
<style>body{font:16px/1.55 "Segoe UI",system-ui,sans-serif;color:#101F3D;margin:0;padding:24px;max-width:1100px;margin-inline:auto}h1{font-size:1.7rem}h2{margin-top:1.6em}table{border-collapse:collapse;width:100%;font-size:.93rem}th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid #DCE3EC}th{background:#F3F6FA}.ok{color:#0F7A70;font-weight:700}.mal{color:#A6402F;font-weight:700}.nota{color:#4A5670;font-size:.86rem}.kpi{display:flex;gap:14px;flex-wrap:wrap;margin:16px 0}.kpi div{background:#F3F6FA;border-radius:12px;padding:12px 18px;min-width:140px}.kpi b{display:block;font-size:1.7rem}.aviso{background:#FFF6DB;border:1px solid #C99A1E;border-radius:10px;padding:10px 14px}ul{padding-left:20px}</style></head><body>
<h1>Monitor de accesibilidad${cfg.entidad ? " · " + esc(cfg.entidad) : ""}</h1>
<p class="nota">Winclus Monitor · última ejecución: ${esc(ahora.fecha)} · ${urls.length} página(s) vigilada(s) · axe-core (WCAG 2.1 y 2.2 AA) y Resolución 1519 de 2020 · ${historial.length} ejecución(es) guardada(s).</p>
<div class="kpi"><div><b class="${total ? "mal" : "ok"}">${total}</b>problemas ahora</div><div><b>${urls.filter((u) => ahora.paginas[u].ok).length}/${urls.length}</b>páginas analizadas</div><div><b>${dif.nuevos.length}</b>barreras nuevas</div><div><b>${dif.resueltos.length}</b>resueltas</div><div>${sparkline(historial)}<br><span class="nota">evolución</span></div></div>
<p>${delta}</p>
${dif.avisos.length ? '<div class="aviso"><strong>Avisos de esta ejecución</strong><ul>' + dif.avisos.map((a) => "<li>" + esc(a) + "</li>").join("") + "</ul></div>" : '<p class="ok">Sin barreras nuevas ni páginas caídas desde la ejecución anterior.</p>'}
<h2>Por página</h2><table><thead><tr><th>Página</th><th>Problemas</th><th>Cambio</th><th>Críticos / serios</th><th>Widget Winclus</th><th>Enlace a la declaración</th></tr></thead><tbody>${urls.map(fila).join("")}</tbody></table>
${dif.resueltos.length ? "<h2>Resueltas desde la vez anterior</h2><ul>" + dif.resueltos.map((r) => "<li>" + esc(r.url) + ": " + esc(r.p.help) + "</li>").join("") + "</ul>" : ""}
<h2>Informes completos</h2><p>${carpetaInforme ? `De esta ejecución: <a href="${esc(carpetaInforme)}/informe.html">informe por criterio</a> · <a href="${esc(carpetaInforme)}/acr.html">ACR (VPAT)</a> · <a href="${esc(carpetaInforme)}/declaracion.html">borrador de declaración</a>.` : ""} Historial en <code>historial.json</code>; último estado en <code>ultimo.json</code>.</p>
<p class="nota">Un escáner detecta entre el 30 y el 50 % de las barreras. El monitor sirve para que nada empeore sin que nadie se entere; no sustituye la revisión manual ni las pruebas con personas con discapacidad.</p>
</body></html>`;
}
async function avisar(cfg, texto, asunto, dif) {
  const enviados = [];
  if (cfg.webhook) {
    try { const r = await pedir(cfg.webhook, { headers: { "Content-Type": "application/json" } }, JSON.stringify({ text: asunto + "\n" + texto, asunto, texto, avisos: dif.avisos, nuevos: dif.nuevos.length, resueltos: dif.resueltos.length, entidad: cfg.entidad })); enviados.push("webhook (HTTP " + r.estado + ")"); }
    catch (e) { console.log("No se pudo avisar por webhook: " + e.message); }
  }
  if (cfg.correo && cfg.correo.para && cfg.correo.para.length) {
    let nodemailer = null; try { nodemailer = require("nodemailer"); } catch (e) {}
    if (!nodemailer) console.log("Para avisar por correo hace falta nodemailer: npm i nodemailer");
    else {
      try {
        const smtp = cfg.correo.smtp || {};
        const t = nodemailer.createTransport({ host: smtp.host, port: smtp.puerto || smtp.port || 587, secure: !!smtp.seguro, auth: smtp.usuario ? { user: smtp.usuario, pass: smtp.clave || process.env.WINCLUS_SMTP_CLAVE || "" } : undefined });
        await t.sendMail({ from: cfg.correo.de || smtp.usuario, to: cfg.correo.para.join(", "), subject: asunto, text: texto });
        enviados.push("correo a " + cfg.correo.para.join(", "));
      } catch (e) { console.log("No se pudo enviar el correo: " + e.message); }
    }
  }
  return enviados;
}
async function ejecutar(cfg) {
  fs.mkdirSync(cfg.salida, { recursive: true });
  const urls = cfg.sitemap ? await urlsDelSitemap(cfg) : cfg.urls.slice();
  const nav = await audit.chromium.launch();
  const resultados = [];
  for (const u of urls) { process.stdout.write("Analizando " + u + " … "); try { const r = await audit.auditarUrl(nav, u); resultados.push(r); console.log(audit.contar(r) + " problema(s)"); } catch (e) { console.log("error: " + e.message); resultados.push({ url: u, paginas: [{ vista: "escritorio", ok: false, error: String(e.message), violaciones: [] }], extra: [] }); } }
  await nav.close();
  const fecha = new Date(), sello = fecha.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const ahora = { fecha: fecha.toISOString(), paginas: {} };
  resultados.forEach((r) => { ahora.paginas[r.url] = resumir(r); });
  const rutaUltimo = path.join(cfg.salida, "ultimo.json"), rutaHist = path.join(cfg.salida, "historial.json");
  const antes = fs.existsSync(rutaUltimo) ? JSON.parse(fs.readFileSync(rutaUltimo, "utf8")) : null;
  const historial = fs.existsSync(rutaHist) ? JSON.parse(fs.readFileSync(rutaHist, "utf8")) : [];
  const dif = comparar(ahora, antes);
  const total = Object.keys(ahora.paginas).reduce((s, u) => s + (ahora.paginas[u].total || 0), 0);
  historial.push({ fecha: ahora.fecha, total, paginas: Object.keys(ahora.paginas).length, porPagina: Object.fromEntries(Object.keys(ahora.paginas).map((u) => [u, ahora.paginas[u].ok ? ahora.paginas[u].total : null])) });
  while (historial.length > 400) historial.shift();
  let carpetaInforme = "";
  if (cfg.guardarInformes !== false) { carpetaInforme = "informe-" + sello; audit.escribirInformes(resultados.filter((r) => r.paginas.some((p) => p.ok)), path.join(cfg.salida, carpetaInforme), cfg.entidad, { producto: cfg.producto }); }
  fs.writeFileSync(rutaUltimo, JSON.stringify(ahora, null, 2));
  fs.writeFileSync(rutaHist, JSON.stringify(historial, null, 2));
  fs.writeFileSync(path.join(cfg.salida, "panel.html"), panelHtml(cfg, ahora, antes, historial, dif, carpetaInforme));
  const asunto = (dif.avisos.length ? "[Accesibilidad] " + dif.avisos.length + " aviso(s) en " : "[Accesibilidad] Sin cambios en ") + (cfg.entidad || urls[0]);
  const texto = [asunto, "Winclus Monitor · " + fecha.toLocaleString("es-CO") + " · " + urls.length + " página(s) · " + total + " problema(s) en total" + (antes ? " (antes: " + Object.keys(antes.paginas).reduce((s, u) => s + (antes.paginas[u].total || 0), 0) + ")" : ""), ""].concat(dif.avisos.length ? dif.avisos.map((a) => "• " + a) : ["Sin barreras nuevas ni páginas caídas."]).concat(dif.resueltos.length ? ["", "Resueltas: " + dif.resueltos.length] : []).concat(["", "Panel: " + path.join(cfg.salida, "panel.html")]).join("\n");
  fs.writeFileSync(path.join(cfg.salida, "alerta.txt"), texto);
  fs.writeFileSync(path.join(cfg.salida, "alerta.json"), JSON.stringify({ asunto, avisos: dif.avisos, nuevos: dif.nuevos.length, resueltos: dif.resueltos.length, total, fecha: ahora.fecha }, null, 2));
  let enviados = [];
  if (dif.avisos.length || cfg.avisarSiempre) enviados = await avisar(cfg, texto, asunto, dif);
  console.log("\n" + texto + (enviados.length ? "\nAvisado por " + enviados.join(" y ") : ""));
  return { ahora, dif, total, enviados };
}
module.exports = { ejecutar, comparar, resumir, urlsDelSitemap, panelHtml };
if (require.main === module) ejecutar(leerConfig()).then((r) => process.exit(0), (e) => { console.error(e); process.exit(1); });
