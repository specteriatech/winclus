// Winclus Audit: escáner de accesibilidad de un sitio (axe-core WCAG 2.1/2.2 AA + comprobaciones de la
// Resolución 1519 de 2020) que genera un informe legible y un borrador de declaración de accesibilidad.
// Uso: node auditar.js https://sitio.gov.co [otra-url …] [--salida carpeta] [--entidad "Nombre de la entidad"]
// Necesita: npm i (playwright, axe-core) y npx playwright install chromium.
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores
const path = require("path");
const fs = require("fs");

const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const args = process.argv.slice(2);
const urls = [], opts = { salida: path.join(process.cwd(), "informe-accesibilidad"), entidad: "" };
for (let i = 0; i < args.length; i++) { if (args[i] === "--salida") opts.salida = path.resolve(args[++i]); else if (args[i] === "--entidad") opts.entidad = args[++i]; else urls.push(args[i]); }
if (!urls.length) { console.log("Uso: node auditar.js https://sitio [más urls] [--salida carpeta] [--entidad \"Nombre\"]"); process.exit(1); }

const CRITERIOS_1519 = {   // criterios del Anexo 1 de la Res. 1519 que este escáner cubre, y con qué
  "CC1 Texto alternativo": ["image-alt", "input-image-alt", "area-alt", "object-alt", "svg-img-alt", "role-img-alt"],
  "CC2 Subtítulos en vídeos": ["video-caption"],
  "CC3 Contenido con estructura": ["heading-order", "empty-heading", "page-has-heading-one", "list", "listitem", "definition-list", "dlitem", "landmark-one-main", "region"],
  "CC4 Texto ampliable al 200 %": ["zoom-200"],
  "CC5 Contraste": ["color-contrast", "color-contrast-enhanced"],
  "CC6 Acceso por teclado": ["scrollable-region-focusable", "focus-order-semantics", "tabindex", "accesskeys"],
  "CC7 Sin trampas de teclado": ["no-keyboard-trap"],
  "CC8 Saltar bloques": ["bypass", "skip-link"],
  "CC9 Título de la página": ["document-title"],
  "CC10 Idioma de la página": ["html-has-lang", "html-lang-valid", "valid-lang", "html-xml-lang-mismatch"],
  "CC11 Propósito de los enlaces": ["link-name", "link-in-text-block"],
  "CC12 Etiquetas en formularios": ["label", "label-title-only", "form-field-multiple-labels", "select-name", "input-button-name", "autocomplete-valid"],
  "CC13 Nombre, función y valor": ["button-name", "aria-*", "aria-allowed-attr", "aria-required-attr", "aria-valid-attr", "aria-valid-attr-value", "aria-roles", "aria-hidden-focus", "nested-interactive", "frame-title"],
  "CC14 Sin destellos ni movimiento sin control": ["blink", "marquee", "meta-refresh"],
  "CC15 Declaración de accesibilidad": ["declaracion"]
};
function criterioDe(id) { for (const c in CRITERIOS_1519) if (CRITERIOS_1519[c].some((r) => r === id || (r.endsWith("*") && id.startsWith(r.slice(0, -1))))) return c; return "Otros criterios WCAG"; }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function auditarUrl(nav, url) {
  const res = { url, paginas: [], extra: [] };
  for (const [nombre, vista] of [["escritorio 1280 px", { width: 1280, height: 900 }], ["móvil 390 px", { width: 390, height: 844 }]]) {
    const ctx = await nav.newContext({ viewport: vista, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const r = { vista: nombre, ok: false, error: "", violaciones: [], revisados: 0, titulo: "", lang: "" };
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1500);
      await page.addScriptTag({ content: AXE });
      const a = await page.evaluate(async () => {
        const out = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
        return { titulo: document.title, lang: document.documentElement.lang, revisados: out.passes.reduce((s, p) => s + p.nodes.length, 0), violaciones: out.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, nodos: v.nodes.map((n) => ({ sel: n.target.join(" "), html: n.html.slice(0, 200), msg: (n.any.concat(n.all, n.none)[0] || {}).message || "" })) })) };
      });
      Object.assign(r, a, { ok: true });
      if (nombre.startsWith("escritorio")) {
        // Res. 1519: texto al 200 % sin scroll horizontal, enlace a la declaración, saltar al contenido, vídeos con pistas
        const extra = await page.evaluate(() => {
          const antes = document.documentElement.scrollWidth;
          document.documentElement.style.fontSize = "200%";
          const scrollX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
          document.documentElement.style.fontSize = "";
          const enlaces = Array.from(document.querySelectorAll("a")).map((e) => (e.textContent + " " + e.getAttribute("href")).toLowerCase());
          const declaracion = enlaces.some((t) => /accesibilidad|accessibility/.test(t));
          const salto = enlaces.some((t) => /(ir|saltar) al contenido|skip to (main )?content|#contenido|#main|#content/.test(t));
          const videos = Array.from(document.querySelectorAll("video")).map((v) => ({ pistas: v.querySelectorAll("track[kind=subtitles],track[kind=captions]").length }));
          const iframesVideo = document.querySelectorAll('iframe[src*="youtube"],iframe[src*="vimeo"]').length;
          return { scrollX, declaracion, salto, videos, iframesVideo, antes };
        });
        if (extra.scrollX) res.extra.push({ id: "zoom-200", criterio: "CC4 Texto ampliable al 200 %", impact: "serious", help: "Con el texto al 200 % aparece desplazamiento horizontal", detalle: "El contenido debería reorganizarse (WCAG 1.4.4 y 1.4.10)." });
        if (!extra.declaracion) res.extra.push({ id: "declaracion", criterio: "CC15 Declaración de accesibilidad", impact: "moderate", help: "No se encontró un enlace a la declaración de accesibilidad", detalle: "La Res. 1519 pide publicarla (nivel alcanzado, fecha, contacto). Winclus genera un borrador en este informe." });
        if (!extra.salto) res.extra.push({ id: "skip-link", criterio: "CC8 Saltar bloques", impact: "moderate", help: "No se encontró un enlace «Ir al contenido»", detalle: "Un enlace al principio de la página que lleve al contenido principal (WCAG 2.4.1)." });
        extra.videos.forEach((v, i) => { if (!v.pistas) res.extra.push({ id: "video-caption", criterio: "CC2 Subtítulos en vídeos", impact: "critical", help: "Vídeo " + (i + 1) + " sin pista de subtítulos", detalle: "Añadir <track kind=\"subtitles\"> o subtítulos abiertos (WCAG 1.2.2; Res. 1519: 100 % de los vídeos)." }); });
        if (extra.iframesVideo) res.extra.push({ id: "video-caption", criterio: "CC2 Subtítulos en vídeos", impact: "moderate", help: extra.iframesVideo + " vídeo(s) incrustado(s) de YouTube/Vimeo", detalle: "Comprobar a mano que tengan subtítulos revisados, no solo automáticos." });
      }
    } catch (e) { r.error = String(e.message || e).slice(0, 200); }
    res.paginas.push(r);
    await ctx.close();
  }
  return res;
}

function informeHtml(resultados) {
  const fecha = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  let total = 0, porCriterio = {};
  resultados.forEach((r) => { r.paginas.forEach((p) => p.violaciones.forEach((v) => { total += v.nodos.length; const c = criterioDe(v.id); porCriterio[c] = (porCriterio[c] || 0) + v.nodos.length; })); r.extra.forEach((x) => { total++; porCriterio[x.criterio] = (porCriterio[x.criterio] || 0) + 1; }); });
  const criterios = Object.keys(CRITERIOS_1519);
  let h = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe de accesibilidad</title>
<style>body{font:16px/1.55 "Segoe UI",system-ui,sans-serif;color:#101F3D;margin:0;padding:24px;max-width:1100px;margin-inline:auto}h1{font-size:1.9rem}h2{margin-top:2em;border-top:1px solid #DCE3EC;padding-top:.5em}table{border-collapse:collapse;width:100%;font-size:.93rem}th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid #DCE3EC}th{background:#F3F6FA}.ok{color:#0F7A70;font-weight:700}.mal{color:#A6402F;font-weight:700}.critical,.serious{color:#A6402F;font-weight:700}.moderate{color:#9A6A12;font-weight:700}.minor{color:#4A5670}code{background:#F3F6FA;padding:1px 5px;border-radius:4px;font-size:.85em;word-break:break-all}.resumen{background:#F3F6FA;border-left:4px solid #0F7A70;padding:12px 16px;border-radius:0 10px 10px 0}.nota{color:#4A5670;font-size:.9rem}</style></head><body>
<h1>Informe de accesibilidad web</h1><p class="nota">Generado por Winclus Audit el ${fecha} · axe-core (WCAG 2.1 y 2.2 nivel AA) y comprobaciones de la Resolución 1519 de 2020 de MinTIC · escritorio y móvil.</p>
<div class="resumen"><p><strong>${total === 0 ? "No se detectaron incumplimientos automáticos." : total + " incumplimiento(s) detectado(s) en " + resultados.length + " página(s)."}</strong> Este escáner detecta una parte de las barreras (entre el 30 y el 50 % según el W3C); una evaluación completa necesita revisión manual y pruebas con personas con discapacidad. No constituye certificación.</p></div>
<h2>Resumen por criterio de la Resolución 1519</h2><table><thead><tr><th>Criterio</th><th>Resultado</th></tr></thead><tbody>`;
  criterios.concat(Object.keys(porCriterio).filter((c) => !criterios.includes(c))).forEach((c) => { const n = porCriterio[c] || 0; h += `<tr><td>${esc(c)}</td><td class="${n ? "mal" : "ok"}">${n ? n + " problema(s)" : "sin problemas detectados"}</td></tr>`; });
  h += "</tbody></table>";
  resultados.forEach((r) => {
    h += `<h2>${esc(r.url)}</h2>`;
    r.paginas.forEach((p) => {
      h += `<h3>${esc(p.vista)}</h3>`;
      if (!p.ok) { h += `<p class="mal">No se pudo analizar: ${esc(p.error)}</p>`; return; }
      h += `<p class="nota">Título: «${esc(p.titulo)}» · lang="${esc(p.lang)}" · ${p.revisados} elementos revisados · ${p.violaciones.reduce((s, v) => s + v.nodos.length, 0)} elemento(s) con problemas.</p>`;
      if (!p.violaciones.length) { h += `<p class="ok">Sin incumplimientos automáticos.</p>`; return; }
      h += `<table><thead><tr><th>Criterio</th><th>Problema</th><th>Elementos</th><th>Cómo corregirlo</th></tr></thead><tbody>`;
      p.violaciones.forEach((v) => { h += `<tr><td>${esc(criterioDe(v.id))}</td><td><span class="${v.impact}">${esc(v.impact)}</span><br>${esc(v.help)}<br><a href="${esc(v.helpUrl)}">${esc(v.id)}</a></td><td>${v.nodos.slice(0, 5).map((n) => `<code>${esc(n.sel)}</code>`).join("<br>")}${v.nodos.length > 5 ? "<br>… y " + (v.nodos.length - 5) + " más" : ""}</td><td>${esc(v.nodos[0].msg)}</td></tr>`; });
      h += "</tbody></table>";
    });
    if (r.extra.length) { h += `<h3>Comprobaciones de la Resolución 1519</h3><table><thead><tr><th>Criterio</th><th>Problema</th><th>Qué hacer</th></tr></thead><tbody>`; r.extra.forEach((x) => { h += `<tr><td>${esc(x.criterio)}</td><td><span class="${x.impact}">${esc(x.impact)}</span><br>${esc(x.help)}</td><td>${esc(x.detalle)}</td></tr>`; }); h += "</tbody></table>"; }
  });
  h += `<h2>Lo que este escáner no puede comprobar (revisión manual obligatoria)</h2>
<p>El propio Anexo 1 de la Resolución 1519 (apartado 2.2.3.8) dice que los validadores automáticos «no pueden convertirse en el medio principal de revisión». Este informe cubre lo automatizable (entre el 30 y el 50 % de las barreras). Antes de declarar conformidad, una persona debe comprobar a mano, como mínimo:</p>
<table><thead><tr><th>Criterio del Anexo 1</th><th>Qué comprobar a mano</th></tr></thead><tbody>
<tr><td>CC1 · CC6 · CC29 (alternativas textuales, imágenes de texto)</td><td>Que cada texto alternativo describa de verdad la imagen y su función, no solo que exista.</td></tr>
<tr><td>CC2 · CC3 (vídeos y audios)</td><td>Que los subtítulos sean fieles y sincronizados en el 100 % de los vídeos nuevos (§1.5); guion o transcripción de lo que es solo audio o solo vídeo.</td></tr>
<tr><td>CC4 (ampliable)</td><td>Zoom del navegador al 200 % y texto al 200 %: nada se corta ni se solapa; a 320 px de ancho no hay desplazamiento horizontal.</td></tr>
<tr><td>CC8 · CC9 · CC11 · CC14 (estructura, tablas, listas, orden)</td><td>Que los encabezados reflejen la estructura real, que las tablas de datos tengan cabeceras y que el orden de lectura con lector de pantalla tenga sentido.</td></tr>
<tr><td>CC12 · CC13 · §1.6 (múltiples vías, navegación coherente, mapa del sitio)</td><td>Buscador, menú y mapa del sitio enlazado desde el pie; mapa XML para buscadores; menús iguales en todas las páginas.</td></tr>
<tr><td>CC15 · CC24 · CC25 · CC28 (advertencias, campos, instrucciones, errores)</td><td>Rellenar cada formulario con lector de pantalla: instrucciones antes del campo, errores que dicen qué corregir y dónde, sin depender del color.</td></tr>
<tr><td>CC16 · CC17 · CC32 (tabulación, foco, teclado)</td><td>Recorrer todo el sitio solo con teclado: orden lógico, foco siempre visible, ninguna trampa, menús y ventanas emergentes manejables.</td></tr>
<tr><td>CC18 · CC19 · CC20 · CC21 · CC22 (audio, tiempo, movimiento, refresco, cambios de contexto)</td><td>Nada arranca solo, todo lo que se mueve o parpadea se puede parar, los tiempos se pueden ampliar y nada cambia de página al recibir el foco.</td></tr>
<tr><td>CC23 · CC26 · CC27 (títulos, enlaces, idioma)</td><td>Títulos de página únicos y descriptivos, enlaces que se entienden fuera de contexto, cambios de idioma marcados.</td></tr>
<tr><td>CC30 · CC31 (objetos programados, componentes)</td><td>Carruseles, mapas, calendarios, visores de PDF y componentes a medida: usables con teclado y anunciados por el lector.</td></tr>
<tr><td>Capítulo 3 (documentos)</td><td>Cada PDF, Word, Excel y presentación descargable: etiquetado, idioma, encabezados, orden de lectura, texto alternativo, sin información solo por color.</td></tr>
<tr><td>Lenguaje claro (§1.4, principio comprensible)</td><td>Que los textos de trámites se entiendan sin jerga; una persona ajena a la entidad debe poder decir de qué va la página.</td></tr>
</tbody></table>
<h2>Cómo seguir</h2><ol><li>Corregir primero lo marcado como <span class="critical">critical</span> y <span class="serious">serious</span>: son las barreras que impiden usar la página.</li><li>Repetir el escáner tras cada corrección.</li><li>Completar con revisión manual (teclado, lector de pantalla, zoom 200 %, lectura fácil) y pruebas con personas con discapacidad.</li><li>Publicar la declaración de accesibilidad (borrador adjunto: <code>declaracion.html</code>) y mantenerla al día.</li></ol></body></html>`;
  return h;
}

function declaracionHtml(resultados, entidad) {
  const fecha = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  const total = resultados.reduce((s, r) => s + r.paginas.reduce((t, p) => t + p.violaciones.reduce((u, v) => u + v.nodos.length, 0), 0) + r.extra.length, 0);
  const estado = total === 0 ? "cumple, según evaluación automática, el nivel AA de las WCAG 2.1" : "cumple parcialmente el nivel AA de las WCAG 2.1: se han detectado " + total + " incumplimientos que están en proceso de corrección";
  const lista = new Set(); resultados.forEach((r) => { r.paginas.forEach((p) => p.violaciones.forEach((v) => lista.add(v.help))); r.extra.forEach((x) => lista.add(x.help)); });
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Declaración de accesibilidad</title>
<style>body{font:17px/1.6 "Segoe UI",system-ui,sans-serif;color:#101F3D;max-width:760px;margin:40px auto;padding:0 20px}h1{font-size:1.9rem}.aviso{background:#FFF6DB;border:1px solid #C99A1E;border-radius:10px;padding:10px 14px}</style></head><body>
<h1>Declaración de accesibilidad</h1>
<p class="aviso">Borrador generado por Winclus Audit el ${fecha}. Completa los corchetes, revisa las excepciones y publícalo en una página enlazada desde el pie de todas las páginas.</p>
<p><strong>${esc(entidad || "[Nombre de la entidad]")}</strong> se compromete a hacer accesible su sitio web ${esc(resultados[0].url)} de conformidad con la Ley 1618 de 2013, la Ley 1680 de 2013 y la Resolución 1519 de 2020 del Ministerio de Tecnologías de la Información y las Comunicaciones (Anexo 1, directrices de accesibilidad web).</p>
<h2>Situación de cumplimiento</h2><p>Este sitio web ${estado}.</p>
<h2>Contenido no accesible</h2>${lista.size ? "<p>Se han identificado las siguientes barreras, que se están corrigiendo:</p><ul>" + Array.from(lista).slice(0, 25).map((t) => `<li>${esc(t)}</li>`).join("") + "</ul>" : "<p>No se han identificado barreras en la evaluación automática. [Añadir las conocidas por revisión manual.]</p>"}
<h2>Preparación de esta declaración</h2><p>Esta declaración fue preparada el ${fecha}. El método empleado fue una evaluación automática con axe-core (WCAG 2.1 y 2.2 nivel AA) y comprobaciones específicas de la Resolución 1519 con Winclus Audit, [complementada con revisión manual el [fecha] por [quién]]. Última revisión: ${fecha}.</p>
<h2>Observaciones y datos de contacto</h2><p>Si encuentras una barrera de accesibilidad, escríbenos a <strong>[correo de contacto]</strong> o llama al <strong>[teléfono]</strong>. Nos comprometemos a responder en máximo [10] días hábiles. Si no quedas conforme, puedes acudir a [mecanismo de PQRSD de la entidad / Procuraduría].</p>
<h2>Tecnología de apoyo disponible</h2><p>[Si el sitio usa Winclus:] Este sitio incluye el widget Winclus, que permite usarlo con la cara, la voz, un solo pulsador, teclado en pantalla, pictogramas y ajustes de lectura y color. El widget no sustituye la accesibilidad del propio sitio.</p>
</body></html>`;
}

(async () => {
  fs.mkdirSync(opts.salida, { recursive: true });
  const nav = await chromium.launch();
  const resultados = [];
  for (const u of urls) { process.stdout.write("Analizando " + u + " … "); const r = await auditarUrl(nav, u); resultados.push(r); const n = r.paginas.reduce((s, p) => s + p.violaciones.reduce((t, v) => t + v.nodos.length, 0), 0) + r.extra.length; console.log(n + " problema(s)"); }
  await nav.close();
  fs.writeFileSync(path.join(opts.salida, "informe.html"), informeHtml(resultados));
  fs.writeFileSync(path.join(opts.salida, "declaracion.html"), declaracionHtml(resultados, opts.entidad));
  fs.writeFileSync(path.join(opts.salida, "resultados.json"), JSON.stringify(resultados, null, 2));
  console.log("Informe: " + path.join(opts.salida, "informe.html"));
  console.log("Borrador de declaración: " + path.join(opts.salida, "declaracion.html"));
})();
