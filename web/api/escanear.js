// POST /api/escanear { url } → el escáner en línea de winclus.com/escanear: abre la página en un Chromium del servidor,
// pasa axe-core (WCAG 2.1/2.2 A y AA) y las comprobaciones de la Resolución 1519 que se pueden hacer a máquina, y devuelve
// los problemas con su criterio del Anexo 1. Es la misma base que Winclus Audit (herramientas/pruebas/widget/auditar.js):
// una primera mirada en medio minuto; el informe completo, con las dos vistas y el ACR, lo hace el monitor de la cuenta.
const fs = require("fs");
const crypto = require("crypto");
const { supabase, cors, json, cuerpoJson } = require("./_comun.js");
const { criterioDe } = require("./_criterios.js");

const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const LIMITE_HORA = 12;   // escaneos por dirección y hora

function urlValida(u) {
  let x; try { x = new URL(String(u || "").trim()); } catch (e) { return null; }
  if (!/^https?:$/.test(x.protocol)) return null;
  const h = x.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || /^\[?(::1|fc|fd|fe80)/.test(h)) return null;
  if (!h.includes(".")) return null;
  return x.href;
}
async function navegador() {
  const puppeteer = require("puppeteer-core");
  if (process.env.CHROME_PATH) return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const chromium = require("@sparticuz/chromium");
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true, defaultViewport: { width: 1280, height: 900 } });
}
// Lo que se mira dentro de la página (la misma lógica que auditar.js, resumida): declaración, «Ir al contenido», vídeos,
// enlaces vagos, listas de uno, cambios al foco, codificación, varias vías, CAPTCHA, texto al 200 % y el widget.
function extrasEnPagina() {
  const txt = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim();
  const enlaces = Array.from(document.querySelectorAll("a")).map((e) => (e.textContent + " " + e.getAttribute("href")).toLowerCase());
  const antes = document.documentElement.scrollWidth;
  document.documentElement.style.fontSize = "200%";
  const scrollX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
  document.documentElement.style.fontSize = "";
  const fuentes = Array.from(document.querySelectorAll("script[src],iframe[src]")).map((e) => e.getAttribute("src") || "");
  const fuente = (re) => fuentes.some((s) => re.test(s));
  const desafio = [], invisible = [];
  const rc = document.querySelector(".g-recaptcha"), ancla = fuentes.find((s) => /recaptcha\/(api2|enterprise)\/anchor/.test(s));
  if ((rc && rc.getAttribute("data-size") !== "invisible") || (ancla && !/[?&]size=invisible/.test(ancla))) desafio.push("reCAPTCHA («No soy un robot»)");
  else if (rc || fuente(/(google\.com|recaptcha\.net)\/recaptcha\/(api|enterprise)\.js/)) invisible.push("reCAPTCHA invisible");
  const hc = document.querySelector(".h-captcha");
  if (hc && hc.getAttribute("data-size") !== "invisible") desafio.push("hCaptcha"); else if (hc || fuente(/hcaptcha\.com/)) invisible.push("hCaptcha invisible");
  if (document.querySelector(".cf-turnstile") || fuente(/challenges\.cloudflare\.com\/turnstile/)) invisible.push("Cloudflare Turnstile");
  return {
    titulo: document.title, lang: document.documentElement.lang || "", charset: (document.characterSet || "").toLowerCase(), antes, scrollX,
    winclus: !!(window.Winclus || document.querySelector('script[src*="winclus"]')),
    declaracion: enlaces.some((t) => /accesibilidad|accessibility/.test(t)),
    salto: enlaces.some((t) => /(ir|saltar) al contenido|skip to (main )?content|#contenido|#main|#content/.test(t)),
    videosSinPistas: Array.from(document.querySelectorAll("video")).filter((v) => !v.querySelectorAll("track[kind=subtitles],track[kind=captions]").length).length,
    iframesVideo: document.querySelectorAll('iframe[src*="youtube"],iframe[src*="vimeo"]').length,
    transcripciones: Array.from(document.querySelectorAll("summary,h2,h3,a")).filter((e) => /transcripci[óo]n|guion/i.test(txt(e))).length,
    listasDeUno: Array.from(document.querySelectorAll("ul,ol")).filter((l) => l.querySelectorAll(":scope > li").length === 1).length,
    tablasDeUno: Array.from(document.querySelectorAll("table")).filter((t) => t.rows.length <= 1 || (t.rows[0] && t.rows[0].cells.length <= 1)).length,
    vagos: Array.from(document.querySelectorAll("a[href]")).map(txt).filter((t) => /^(aqu[íi]|ver m[áa]s|m[áa]s|leer m[áa]s|clic aqu[íi]|pulse aqu[íi]|enlace|link)$/i.test(t)).length,
    alFoco: document.querySelectorAll("select[onchange],input[onchange],select[onfocus],a[onfocus]").length,
    mapa: Array.from(document.querySelectorAll("a[href]")).some((a) => /mapa del sitio|sitemap/i.test(txt(a))),
    buscador: !!document.querySelector("input[type=search],[role=search]"),
    desafio, invisible,
    captchaImagen: Array.from(document.querySelectorAll("img,canvas")).filter((e) => /captcha/i.test([e.id, typeof e.className === "string" ? e.className : "", e.getAttribute("name"), e.getAttribute("src"), e.getAttribute("alt")].join(" ")) && !/recaptcha|hcaptcha/i.test(e.getAttribute("src") || "")).length,
  };
}
function extrasAHallazgos(x) {
  const h = [];
  const p = (id, impact, help, detalle) => h.push({ id, impact, help, detalle, criterio: criterioDe(id), n: 1 });
  if (x.scrollX) p("zoom-200", "serious", "Con el texto al 200 % aparece desplazamiento horizontal", "El contenido debe reorganizarse al ampliar la letra (WCAG 1.4.4 y 1.4.10; Anexo 1 CC4).");
  if (!x.declaracion) p("declaracion", "moderate", "No se encontró un enlace a la declaración de accesibilidad", "La Res. 1519 pide una sección de accesibilidad enlazada desde todas las páginas. Winclus tiene un generador gratis en winclus.com/declaracion.");
  if (!x.salto) p("skip-link", "moderate", "No se encontró un enlace «Ir al contenido»", "Un enlace al principio de la página que lleve al contenido principal (WCAG 2.4.1; Anexo 1 CC10).");
  if (x.videosSinPistas) p("video-caption", "critical", x.videosSinPistas + " vídeo(s) sin pista de subtítulos", "Añadir <track kind=\"captions\"> con subtítulos en español (WCAG 1.2.2; Anexo 1 CC2).");
  if (x.iframesVideo) p("video-caption", "moderate", x.iframesVideo + " vídeo(s) incrustado(s) de YouTube o Vimeo", "Comprobar a mano que tienen subtítulos revisados, no solo automáticos (Anexo 1 CC2).");
  if ((x.videosSinPistas || x.iframesVideo) && !x.transcripciones) p("transcripcion", "moderate", "Hay vídeo pero no se encontró transcripción ni guion", "Publicar el guion en texto junto al vídeo (Anexo 1 CC3).");
  if (x.listasDeUno) p("lista-de-uno", "minor", x.listasDeUno + " lista(s) con un solo elemento", "Una lista de un elemento no es una lista (Anexo 1 CC9).");
  if (x.tablasDeUno) p("lista-de-uno", "minor", x.tablasDeUno + " tabla(s) de una sola fila o columna", "Una tabla que no cruza datos debería ser texto o lista (Anexo 1 CC9).");
  if (x.vagos) p("enlace-vago", "moderate", x.vagos + " enlace(s) del tipo «aquí» o «ver más»", "Los enlaces deben entenderse solos: «Ver el calendario de pagos», no «aquí» (WCAG 2.4.4; Anexo 1 CC26).");
  if (x.alFoco) p("cambio-al-foco", "serious", x.alFoco + " control(es) que actúan al recibir el foco o al cambiar", "Un desplegable no debe navegar al elegir: hace falta un botón «Ir» (WCAG 3.2.1 y 3.2.2; Anexo 1 CC22).");
  if (x.charset && x.charset !== "utf-8") p("charset-utf8", "moderate", "La página declara la codificación «" + x.charset + "»", "Usar UTF-8 para que tildes y eñes lleguen bien a las ayudas técnicas (Anexo 1 CC31).");
  if (!x.mapa && !x.buscador) p("multiples-vias", "moderate", "No se encontró buscador ni enlace al mapa del sitio", "Hace falta más de una vía para llegar a cada página (WCAG 2.4.5; Anexo 1 CC12).");
  if (x.desafio.length) p("captcha", "serious", "CAPTCHA con desafío: " + x.desafio.join(", "), "Marcar imágenes, copiar letras o escuchar un audio deja fuera a personas ciegas, con discapacidad intelectual o con movilidad reducida. Hace falta una alternativa (WCAG 1.1.1; Anexo 1 CC1 y CC29).");
  else if (x.invisible.length) p("captcha", "minor", "Verificación antirrobots invisible: " + x.invisible.join(", "), "Si sospecha, muestra un desafío. Comprobar a mano que hay otra forma de terminar el trámite.");
  if (x.captchaImagen) p("captcha-imagen", "critical", x.captchaImagen + " CAPTCHA de imagen con letras para copiar", "Texto dentro de una imagen que hay que transcribir: un lector de pantalla no puede leerlo (Anexo 1 CC29).");
  return h;
}
async function escanear(url) {
  const t0 = Date.now();
  const nav = await navegador();
  try {
    const page = await nav.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 WinclusAudit/1.0 (+https://winclus.com/escanear)");
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (resp && resp.status() >= 400) throw new Error("La página respondió HTTP " + resp.status());
    await new Promise((r) => setTimeout(r, 1200));
    await page.addScriptTag({ content: AXE });
    const a = await page.evaluate(async () => {
      const out = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
      return { revisados: out.passes.reduce((s, p) => s + p.nodes.length, 0), violaciones: out.violations.map((v) => ({ id: v.id, impact: v.impact || "minor", help: v.help, descripcion: v.description, n: v.nodes.length, ejemplo: v.nodes[0] ? { selector: (v.nodes[0].target || []).join(" "), html: String(v.nodes[0].html || "").slice(0, 160) } : null })) };
    });
    const x = await page.evaluate(extrasEnPagina);
    const problemas = a.violaciones.map((v) => Object.assign(v, { criterio: criterioDe(v.id) }));
    const extra = extrasAHallazgos(x);
    const sev = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    problemas.forEach((v) => { sev[v.impact] = (sev[v.impact] || 0) + v.n; });
    extra.forEach((v) => { sev[v.impact] = (sev[v.impact] || 0) + 1; });
    const total = problemas.reduce((s, v) => s + v.n, 0) + extra.length;
    // Puntaje orientativo de 0 a 100: pesa más lo crítico; no es una certificación
    const puntaje = Math.max(0, Math.round(100 - sev.critical * 8 - sev.serious * 4 - sev.moderate * 1.5 - sev.minor * 0.5));
    return { url, ok: true, titulo: x.titulo, lang: x.lang, revisados: a.revisados, total, sev, puntaje, problemas, extra, winclus: x.winclus, declaracion: x.declaracion, salto: x.salto, ms: Date.now() - t0 };
  } finally { try { await nav.close(); } catch (e) {} }
}

module.exports = async (req, res) => {
  cors(res, "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") return json(res, 405, { error: "Solo POST" });
  const cuerpo = await cuerpoJson(req);
  const url = urlValida(cuerpo && cuerpo.url);
  if (!url) return json(res, 400, { error: "Escribe una dirección completa, con https://, de un sitio público." });
  const sb = supabase();
  const ip = String(req.headers["x-forwarded-for"] || req.socket && req.socket.remoteAddress || "").split(",")[0].trim();
  const ipHash = crypto.createHash("sha256").update((process.env.SAL_IP || "winclus") + ip).digest("hex").slice(0, 32);
  if (sb) {
    const desde = new Date(Date.now() - 3600000).toISOString();
    const { count } = await sb.from("escaneos").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("fecha", desde);
    if ((count || 0) >= LIMITE_HORA) return json(res, 429, { error: "Ya se hicieron " + LIMITE_HORA + " escaneos desde esta conexión en la última hora. Para vigilar un sitio a diario, crea una cuenta en winclus.com/panel." });
  }
  let r;
  try { r = await escanear(url); }
  catch (e) { return json(res, 200, { url, ok: false, error: "No se pudo analizar la página: " + String(e.message || e).slice(0, 160) }); }
  if (sb) { try { await sb.from("escaneos").insert({ url, total: r.total, sev: r.sev, resultado: r, ip_hash: ipHash }); } catch (e) {} }
  return json(res, 200, r);
};
module.exports.escanear = escanear;
module.exports.urlValida = urlValida;
