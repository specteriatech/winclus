// Winclus Monitor alojado: la vigilancia de los sitios que tienen cuenta en winclus.com/panel. Corre a diario en GitHub
// Actions (.github/workflows/monitor-alojado.yml) con la clave de servicio de Supabase: lee los sitios y sus páginas,
// pasa Winclus Audit (auditar.js) por cada una en dos vistas, guarda capturas en el bucket «capturas», compara con la
// ejecución anterior y guarda ejecución, resultados y avisos; si el sitio tiene webhook, le avisa.
// Uso: SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node monitor_alojado.js [--sitio <id>] [--max 50]
const { createClient } = require("@supabase/supabase-js");
const audit = require("./auditar.js");
const { resumir, comparar } = require("./monitor.js");

const URL_SB = process.env.SUPABASE_URL, CLAVE = process.env.SUPABASE_SERVICE_KEY;
if (!URL_SB || !CLAVE) { console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY"); process.exit(1); }
const sb = createClient(URL_SB, CLAVE, { auth: { persistSession: false } });
const args = process.argv.slice(2);
const soloSitio = args.includes("--sitio") ? args[args.indexOf("--sitio") + 1] : "";
const MAX = args.includes("--max") ? +args[args.indexOf("--max") + 1] || 50 : 50;

async function capturas(nav, url, sitioId, fecha, i) {
  const rutas = {};
  for (const [nombre, vista] of [["escritorio", { width: 1280, height: 900 }], ["movil", { width: 390, height: 844 }]]) {
    const ctx = await nav.newContext({ viewport: vista, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1200);
      const jpg = await page.screenshot({ type: "jpeg", quality: 55, fullPage: false });
      const ruta = sitioId + "/" + fecha + "/" + i + "-" + nombre + ".jpg";
      const { error } = await sb.storage.from("capturas").upload(ruta, jpg, { contentType: "image/jpeg", upsert: true });
      if (!error) rutas[nombre] = ruta; else console.log("  captura no guardada: " + error.message);
    } catch (e) { console.log("  captura " + nombre + " falló: " + e.message); }
    await ctx.close();
  }
  return rutas;
}
async function ultimaEjecucion(sitioId) {
  const { data: ej } = await sb.from("monitor_ejecuciones").select("id, fecha").eq("sitio_id", sitioId).order("fecha", { ascending: false }).limit(1).maybeSingle();
  if (!ej) return null;
  const { data: rs } = await sb.from("monitor_resultados").select("url, ok, total, problemas, winclus, declaracion").eq("ejecucion_id", ej.id);
  const paginas = {};
  (rs || []).forEach((r) => { const problemas = {}; (r.problemas || []).forEach((p) => { problemas[p.id] = p; }); paginas[r.url] = { ok: r.ok, total: r.total, problemas, winclus: r.winclus, declaracion: r.declaracion }; });
  return { fecha: ej.fecha, paginas };
}
async function avisarWebhook(url, sitio, dif, total) {
  if (!url) return;
  try {
    const asunto = "Winclus Monitor · " + (sitio.nombre || sitio.dominio) + ": " + dif.avisos.length + " aviso(s)";
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: asunto + "\n" + dif.avisos.join("\n"), asunto, avisos: dif.avisos, total, nuevos: dif.nuevos.length, resueltos: dif.resueltos.length, sitio: sitio.dominio }) });
    console.log("  webhook: HTTP " + r.status);
  } catch (e) { console.log("  webhook falló: " + e.message); }
}
async function vigilarSitio(nav, sitio) {
  const urls = (sitio.monitor_paginas || []).map((p) => p.url).slice(0, MAX);
  if (!urls.length) return;
  console.log("Sitio " + (sitio.nombre || sitio.dominio) + ": " + urls.length + " página(s)");
  const fecha = new Date().toISOString().slice(0, 10);
  const antes = await ultimaEjecucion(sitio.id);
  const ahora = { fecha, paginas: {} }, filas = [];
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    let r; try { r = await audit.auditarUrl(nav, u); } catch (e) { r = { url: u, paginas: [{ vista: "escritorio", ok: false, error: String(e.message || e).slice(0, 200), violaciones: [] }], extra: [] }; }
    const s = resumir(r);
    ahora.paginas[u] = s;
    const caps = s.ok ? await capturas(nav, u, sitio.id, fecha, i + 1) : {};
    filas.push({ url: u, ok: s.ok, error: s.error || null, total: s.total, problemas: Object.values(s.problemas || {}), titulo: s.titulo || null, winclus: !!s.winclus, declaracion: !!s.declaracion, captura_escritorio: caps.escritorio || null, captura_movil: caps.movil || null });
    console.log("  " + (s.ok ? s.total + " problema(s)" : "no responde: " + s.error) + " · " + u);
  }
  const dif = comparar(ahora, antes);
  const total = filas.reduce((s, f) => s + (f.total || 0), 0);
  const sev = filas.reduce((acc, f) => { (f.problemas || []).forEach((p) => { acc[p.impact] = (acc[p.impact] || 0) + (p.n || 1); }); return acc; }, { critical: 0, serious: 0, moderate: 0, minor: 0 });
  const { data: ej, error } = await sb.from("monitor_ejecuciones").insert({ sitio_id: sitio.id, paginas: filas.length, paginas_ok: filas.filter((f) => f.ok).length, total, sev, avisos: dif.avisos, nuevos: dif.nuevos.length, resueltos: dif.resueltos.length }).select("id").single();
  if (error) { console.log("  no se pudo guardar la ejecución: " + error.message); return; }
  const { error: e2 } = await sb.from("monitor_resultados").insert(filas.map((f) => Object.assign({ ejecucion_id: ej.id }, f)));
  if (e2) console.log("  no se pudieron guardar los resultados: " + e2.message);
  console.log("  guardado: " + total + " problema(s), " + dif.nuevos.length + " nuevo(s), " + dif.resueltos.length + " resuelto(s), " + dif.avisos.length + " aviso(s)");
  if (dif.avisos.length) await avisarWebhook(sitio.config && sitio.config.webhook, sitio, dif, total);
}
(async () => {
  let q = sb.from("sitios").select("id, dominio, nombre, config, monitor_paginas(url)");
  if (soloSitio) q = q.eq("id", soloSitio);
  const { data: sitios, error } = await q;
  if (error) { console.error("No se pudieron leer los sitios: " + error.message); process.exit(1); }
  const conPaginas = (sitios || []).filter((s) => (s.monitor_paginas || []).length);
  console.log(conPaginas.length + " sitio(s) con páginas vigiladas");
  if (!conPaginas.length) process.exit(0);
  const nav = await audit.chromium.launch();
  for (const s of conPaginas) { try { await vigilarSitio(nav, s); } catch (e) { console.log("  falló el sitio " + s.dominio + ": " + e.message); } }
  await nav.close();
  process.exit(0);
})();
