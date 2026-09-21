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

// Criterios de cumplimiento del Anexo 1 de la Res. 1519 de 2020, con SU numeración (CC1 a CC32),
// y las reglas automáticas que dan señal de cada uno. Lo que ninguna regla puede juzgar se lista
// aparte, en la revisión humana obligatoria del informe: la propia resolución (2.2.3.8) avisa de
// que los validadores automáticos no bastan.
const CRITERIOS_1519 = {
  "CC1 Alternativa texto para elementos no textuales": ["captcha", "image-alt", "input-image-alt", "area-alt", "object-alt", "svg-img-alt", "role-img-alt", "image-redundant-alt"],
  "CC2 Complemento para vídeos o elementos multimedia": ["video-caption", "audio-caption", "video-description"],
  "CC3 Guion para solo vídeo y solo audio": ["transcripcion"],
  "CC4 Textos e imágenes ampliables y en tamaños adecuados": ["zoom-200", "meta-viewport", "meta-viewport-large"],
  "CC5 Contraste de color suficiente en textos e imágenes": ["color-contrast", "color-contrast-enhanced", "link-in-text-block"],
  "CC6 Imágenes alternas al texto cuando sea posible": [],
  "CC7 Identificación coherente": ["identificacion-coherente"],
  "CC8 Todo documento y página organizado en secciones": ["heading-order", "empty-heading", "page-has-heading-one", "landmark-one-main", "region", "landmark-unique", "landmark-no-duplicate-banner", "landmark-no-duplicate-contentinfo"],
  "CC9 Contenedores como tablas y listas usados correctamente": ["list", "listitem", "definition-list", "dlitem", "table-duplicate-name", "table-fake-caption", "td-headers-attr", "th-has-data-cells", "scope-attr-valid", "empty-table-header", "lista-de-uno"],
  "CC10 Permitir saltar bloques que se repiten": ["bypass", "skip-link"],
  "CC11 Lenguaje de marcado bien utilizado": ["duplicate-id", "duplicate-id-active", "duplicate-id-aria", "marcado-sin-cerrar"],
  "CC12 Permitir encontrar las páginas por múltiples vías": ["multiples-vias"],
  "CC13 Navegación coherente": ["navegacion-coherente"],
  "CC14 Orden adecuado de los contenidos si es significativo": ["tabindex", "focus-order-semantics"],
  "CC15 Advertencias bien ubicadas": [],
  "CC16 Orden adecuado de los elementos al navegar con tabulación": ["tabindex"],
  "CC17 Foco visible al navegar con tabulación": ["foco-visible"],
  "CC18 No utilizar audio automático": ["no-autoplay-audio"],
  "CC19 Permitir control de eventos temporizados": ["tiempo-sesion", "meta-refresh-no-exceptions"],
  "CC20 Permitir control de contenidos con movimiento y parpadeo": ["blink", "marquee"],
  "CC21 No generar actualización automática de páginas": ["meta-refresh"],
  "CC22 No generar cambios automáticos al recibir el foco o entradas": ["cambio-al-foco"],
  "CC23 Utilice textos adecuados en títulos, páginas y secciones": ["document-title", "titulo-repetido", "frame-title", "frame-title-unique"],
  "CC24 Utilice nombres e indicaciones claras en campos de formulario": ["label", "label-title-only", "form-field-multiple-labels", "select-name", "input-button-name", "autocomplete-valid"],
  "CC25 Utilice instrucciones expresas y claras": [],
  "CC26 Enlaces adecuados": ["link-name", "enlace-vago"],
  "CC27 Idioma": ["html-has-lang", "html-lang-valid", "valid-lang", "html-xml-lang-mismatch"],
  "CC28 Manejo del error": [],
  "CC29 Imágenes de texto": ["captcha-imagen", "image-redundant-alt"],
  "CC30 Objetos programados": ["aria-*", "aria-allowed-attr", "aria-required-attr", "aria-valid-attr", "aria-valid-attr-value", "aria-roles", "aria-hidden-focus", "nested-interactive", "button-name", "scrollable-region-focusable"],
  "CC31 Desde una letra hasta un elemento complejo utilizable": ["charset-utf8"],
  "CC32 Manejable por teclado": ["no-keyboard-trap", "accesskeys", "focusable-content"],
  "Declaración de accesibilidad (Res. 1519, 2.2.1)": ["declaracion"]
};

function criterioDe(id) { for (const c in CRITERIOS_1519) if (CRITERIOS_1519[c].some((r) => r === id || (r.endsWith("*") && id.startsWith(r.slice(0, -1))))) return c; return "Otros criterios WCAG"; }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// CC19: los límites de tiempo de sesión no se ven en el HTML, se programan. Antes de que cargue la página se
// envuelven setTimeout y setInterval para anotar los de 30 s o más (sin cambiar lo que hacen); después se mira
// si su código cierra la sesión o cambia de página. Un temporizador así sin aviso previo deja fuera a quien
// lee, escribe o se mueve despacio: pierde el trámite a medias.
function vigilarTiempos() {
  const lista = (window.__wclTiempos = []);
  ["setTimeout", "setInterval"].forEach((nombre) => {
    const orig = window[nombre];
    window[nombre] = function (fn, ms) {
      try { if (+ms >= 30000) lista.push({ tipo: nombre, ms: +ms, codigo: String(fn).slice(0, 600) }); } catch (e) {}
      return orig.apply(this, arguments);
    };
  });
}

async function auditarUrl(nav, url) {
  const res = { url, paginas: [], extra: [] };
  for (const [nombre, vista] of [["escritorio 1280 px", { width: 1280, height: 900 }], ["móvil 390 px", { width: 390, height: 844 }]]) {
    const ctx = await nav.newContext({ viewport: vista, ignoreHTTPSErrors: true });
    await ctx.addInitScript(vigilarTiempos);
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
          const txt = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim();
          // CC9: una lista o una tabla para un solo elemento no es correcta (Anexo 1, 2.2.3.3)
          const listasDeUno = Array.from(document.querySelectorAll("ul,ol")).filter((l) => l.querySelectorAll(":scope > li").length === 1).length;
          const tablasDeUno = Array.from(document.querySelectorAll("table")).filter((t) => t.rows.length <= 1 || (t.rows[0] && t.rows[0].cells.length <= 1)).length;
          // CC26: enlaces que no dicen a dónde llevan
          const vagos = Array.from(document.querySelectorAll("a[href]"))
            .map(txt).filter((t) => /^(aqu[íi]|ver m[áa]s|m[áa]s|leer m[áa]s|clic aqu[íi]|pulse aqu[íi]|enlace|link)$/i.test(t)).length;
          // CC22: controles que navegan o cambian la página al recibir el foco o al escribir
          const alFoco = document.querySelectorAll("select[onchange],input[onchange],select[onfocus],a[onfocus]").length;
          // CC31: codificación declarada
          const charset = (document.characterSet || "").toLowerCase();
          // CC3: guion en texto de lo que es solo vídeo o solo audio
          const transcripciones = Array.from(document.querySelectorAll("summary,h2,h3,a")).filter((e) => /transcripci[óo]n|guion/i.test(txt(e))).length;
          // CC7 y CC13: para compararlos entre páginas hace falta el menú y los enlaces de cada una
          const menuPie = Array.from(document.querySelectorAll("footer a")).map(txt).join(" · ");
          const enlacesRuta = Array.from(document.querySelectorAll("a[href]")).map((a) => ({ texto: txt(a), ruta: (a.href || "").replace(/^https?:\/\/[^/]+/, "").replace(/#.*$/, "") }));
          // CC12: varias vías para llegar a las páginas
          const mapa = Array.from(document.querySelectorAll("a[href]")).some((a) => /mapa del sitio|sitemap/i.test(txt(a)));
          const buscador = !!document.querySelector("input[type=search],[role=search]");
          // CC1 y CC29: CAPTCHA. Los que plantean un desafío (marcar imágenes, copiar letras, escuchar un audio)
          // dejan fuera a personas ciegas, con discapacidad intelectual o con movilidad reducida; los invisibles
          // solo muestran desafío si sospechan. Se distinguen porque el riesgo no es el mismo.
          const fuentes = Array.from(document.querySelectorAll("script[src],iframe[src]")).map((e) => e.getAttribute("src") || "");
          const fuente = (re) => fuentes.some((s) => re.test(s));
          const desafio = [], invisible = [];
          const rc = document.querySelector(".g-recaptcha");
          // dibujado desde JavaScript (sin .g-recaptcha): el iframe de Google dice su tamaño en la dirección
          const ancla = fuentes.find((s) => /recaptcha\/(api2|enterprise)\/anchor/.test(s));
          if ((rc && rc.getAttribute("data-size") !== "invisible") || (ancla && !/[?&]size=invisible/.test(ancla))) desafio.push("reCAPTCHA («No soy un robot»)");
          else if (rc || fuente(/(google\.com|recaptcha\.net)\/recaptcha\/(api|enterprise)\.js/)) invisible.push("reCAPTCHA invisible");
          const hc = document.querySelector(".h-captcha");
          if (hc && hc.getAttribute("data-size") !== "invisible") desafio.push("hCaptcha");
          else if (hc || fuente(/hcaptcha\.com/)) invisible.push("hCaptcha invisible");
          if (document.querySelector(".cf-turnstile") || fuente(/challenges\.cloudflare\.com\/turnstile/)) invisible.push("Cloudflare Turnstile");
          const esCaptcha = (e) => /captcha/i.test([e.id, e.className && e.className.baseVal == null ? e.className : "", e.getAttribute("name"), e.getAttribute("src"), e.getAttribute("alt")].join(" "));
          const captchaImagen = Array.from(document.querySelectorAll("img,canvas")).filter((e) => esCaptcha(e) && !/recaptcha|hcaptcha/i.test(e.getAttribute("src") || "")).length
            + (/escrib[ae] (los caracteres|el (texto|c[óo]digo)) (de|que (ve|ves|aparece)) (en )?la imagen/i.test(document.body.innerText || "") ? 1 : 0);
          // CC19: límites de tiempo. Temporizadores largos que cierran la sesión o cambian de página, y avisos en el texto
          const tiempos = (window.__wclTiempos || []).filter((t) => t.ms >= 60000 &&
            /location\s*(\.\s*(href|assign|replace|reload)\b|=)|logout|log-out|signout|sign-out|cerrar.?sesi|expir|caduc/i.test(t.codigo))
            .map((t) => ({ tipo: t.tipo, minutos: Math.round(t.ms / 6000) / 10 }));
          const avisoTiempo = ((document.body.innerText || "").match(/(su|tu) sesi[óo]n (expirar[áa]|caducar[áa]|finalizar[áa]|terminar[áa]|se cerrar[áa])[^.\n]{0,40}|tiempo (restante|de sesi[óo]n)[^.\n]{0,30}|sesi[óo]n (expirada|caducada)|session (will )?(expire|time ?out)[^.\n]{0,30}|you will be logged out[^.\n]{0,30}/i) || [""])[0].trim();
          return { scrollX, declaracion, salto, videos, iframesVideo, antes,
                   listasDeUno, tablasDeUno, vagos, alFoco, charset, transcripciones, menuPie, enlacesRuta, mapa, buscador,
                   desafio, invisible, captchaImagen, tiempos, avisoTiempo };
        });
        if (extra.scrollX) res.extra.push({ id: "zoom-200", criterio: "CC4 Texto ampliable al 200 %", impact: "serious", help: "Con el texto al 200 % aparece desplazamiento horizontal", detalle: "El contenido debería reorganizarse (WCAG 1.4.4 y 1.4.10)." });
        if (extra.listasDeUno) res.extra.push({ id: "lista-de-uno", criterio: "CC9 Contenedores como tablas y listas usados correctamente", impact: "minor", help: extra.listasDeUno + " lista(s) con un solo elemento", detalle: "El Anexo 1 (2.2.3.3) dice que una lista o una tabla para un solo elemento no es correcta: usa un párrafo." });
        if (extra.tablasDeUno) res.extra.push({ id: "lista-de-uno", criterio: "CC9 Contenedores como tablas y listas usados correctamente", impact: "minor", help: extra.tablasDeUno + " tabla(s) de una sola fila o columna", detalle: "Las tablas son para relacionar datos, no para dar diseño (Anexo 1, 2.2.3.3)." });
        if (extra.vagos) res.extra.push({ id: "enlace-vago", criterio: "CC26 Enlaces adecuados", impact: "moderate", help: extra.vagos + " enlace(s) del tipo «aquí» o «ver más»", detalle: "Los enlaces deben entenderse solos, sin el texto que los rodea (Anexo 1, 2.2.3.6)." });
        if (extra.alFoco) res.extra.push({ id: "cambio-al-foco", criterio: "CC22 No generar cambios automáticos al recibir el foco o entradas", impact: "serious", help: extra.alFoco + " control(es) que actúan al recibir el foco o al escribir", detalle: "Un cambio de página o de contenido sin pedirlo desorienta a quien usa lector de pantalla (Anexo 1, 2.2.3.5)." });
        if (extra.charset && extra.charset !== "utf-8") res.extra.push({ id: "charset-utf8", criterio: "CC31 Desde una letra hasta un elemento complejo utilizable", impact: "moderate", help: "La página declara la codificación «" + extra.charset + "»", detalle: "El Anexo 1 pide UTF-8 para que las tildes y la ñ lleguen bien a las ayudas técnicas." });
        if (extra.videos.length && !extra.transcripciones) res.extra.push({ id: "transcripcion", criterio: "CC3 Guion para solo vídeo y solo audio", impact: "moderate", help: "Hay vídeo pero no se encontró transcripción ni guion en texto", detalle: "Junto al vídeo o en un enlace señalado, para quien no puede verlo ni oírlo (Anexo 1, 2.2.3.1)." });
        if (!extra.mapa && !extra.buscador) res.extra.push({ id: "multiples-vias", criterio: "CC12 Permitir encontrar las páginas por múltiples vías", impact: "moderate", help: "No se encontró buscador ni enlace al mapa del sitio", detalle: "Toda página debe poder alcanzarse por más de un camino (Anexo 1, 2.2.3.3)." });
        if (extra.desafio.length) res.extra.push({ id: "captcha", impact: "serious", help: "CAPTCHA con desafío: " + extra.desafio.join(", "),
          detalle: "Pedir que se marquen imágenes, se copien letras o se escuche un audio deja fuera a personas ciegas, sordociegas, con discapacidad intelectual, con dislexia o con movilidad reducida. WCAG 1.1.1 exige una alternativa en otra modalidad y WCAG 2.2 (3.3.8) no permite exigir una prueba cognitiva sin alternativa. Qué hacer: cambiarlo por una verificación sin desafío (reCAPTCHA v3, Turnstile no interactivo, un campo trampa oculto, límite de intentos) y ofrecer siempre otra vía para el trámite (teléfono, correo, ventanilla). Una tecnología de apoyo no debe saltárselo: la barrera tiene que quitarla el sitio." });
        if (extra.invisible.length && !extra.desafio.length) res.extra.push({ id: "captcha", impact: "minor", help: "Verificación antirrobots invisible: " + extra.invisible.join(", "),
          detalle: "No plantea desafío a la mayoría, pero si sospecha puede mostrar uno (sobre todo a quien navega con teclado, lector de pantalla o conexiones compartidas). Comprobar a mano que, si aparece, haya otra forma de terminar el trámite." });
        if (extra.captchaImagen) res.extra.push({ id: "captcha-imagen", impact: "critical", help: extra.captchaImagen + " CAPTCHA de imagen con letras para copiar",
          detalle: "Es texto dentro de una imagen que hay que transcribir: un lector de pantalla no puede leerlo y el Anexo 1 (CC29) pide no entregar texto en imágenes. Hay que quitarlo (ver el CAPTCHA en CC1 para las alternativas)." });
        if (extra.tiempos.length) res.extra.push({ id: "tiempo-sesion", impact: "serious", help: "Temporizador de " + extra.tiempos.map((t) => t.minutos + " min").join(", ") + " que cierra la sesión o cambia de página",
          detalle: "Quien lee, escribe o se mueve despacio pierde el trámite a medias. WCAG 2.2.1 y el Anexo 1 (CC19): avisar al menos 20 segundos antes, dejar ampliar el tiempo con una acción sencilla (al menos 10 veces) y no borrar lo que la persona ya escribió. Comprobar a mano que el aviso existe y se anuncia a los lectores de pantalla." });
        else if (extra.avisoTiempo) res.extra.push({ id: "tiempo-sesion", impact: "moderate", help: "La página habla de un límite de tiempo: «" + extra.avisoTiempo.slice(0, 80) + "»",
          detalle: "Comprobar a mano que se avisa antes de que se acabe, que se puede ampliar con una acción sencilla y que no se pierde lo escrito (WCAG 2.2.1, Anexo 1 CC19)." });
        res.menuPie = extra.menuPie; res.enlacesRuta = extra.enlacesRuta;
        if (!extra.declaracion) res.extra.push({ id: "declaracion", criterio: "CC15 Declaración de accesibilidad", impact: "moderate", help: "No se encontró un enlace a la declaración de accesibilidad", detalle: "La Res. 1519 pide publicarla (nivel alcanzado, fecha, contacto). Winclus genera un borrador en este informe." });
        if (!extra.salto) res.extra.push({ id: "skip-link", criterio: "CC8 Saltar bloques", impact: "moderate", help: "No se encontró un enlace «Ir al contenido»", detalle: "Un enlace al principio de la página que lleve al contenido principal (WCAG 2.4.1)." });
        extra.videos.forEach((v, i) => { if (!v.pistas) res.extra.push({ id: "video-caption", criterio: "CC2 Subtítulos en vídeos", impact: "critical", help: "Vídeo " + (i + 1) + " sin pista de subtítulos", detalle: "Añadir <track kind=\"subtitles\"> o subtítulos abiertos (WCAG 1.2.2; Res. 1519: 100 % de los vídeos)." }); });
        if (extra.iframesVideo) res.extra.push({ id: "video-caption", criterio: "CC2 Subtítulos en vídeos", impact: "moderate", help: extra.iframesVideo + " vídeo(s) incrustado(s) de YouTube/Vimeo", detalle: "Comprobar a mano que tengan subtítulos revisados, no solo automáticos." });
      }
    } catch (e) { r.error = String(e.message || e).slice(0, 200); }
    res.paginas.push(r);
    await ctx.close();
  }
  // El criterio sale siempre de la tabla del Anexo 1 por el id de la regla, nunca escrito a mano: así un
  // hallazgo no puede llevar un número o un nombre que no son los de la resolución.
  res.extra.forEach((x) => { x.criterio = criterioDe(x.id); });
  return res;
}

// CC7 y CC13 solo se ven comparando páginas entre sí: el mismo texto de enlace debe llevar siempre
// al mismo sitio, y el menú debe repetirse en el mismo orden en todas las páginas.
function coherenciaEntrePaginas(resultados) {
  const hallazgos = [];
  const conRutas = resultados.filter((r) => r.enlacesRuta && r.enlacesRuta.length);
  if (conRutas.length > 1) {
    const porTexto = {};
    conRutas.forEach((r) => r.enlacesRuta.forEach((a) => {
      const k = (a.texto || "").toLowerCase().trim();
      if (!k || !a.ruta || /^(ir al contenido|saltar)/.test(k)) return;
      (porTexto[k] = porTexto[k] || new Set()).add(a.ruta.replace(/\.html$/, "").replace(/\/$/, ""));
    }));
    const dobles = Object.entries(porTexto).filter(([, d]) => d.size > 1);
    dobles.slice(0, 10).forEach(([t, d]) => hallazgos.push({
      id: "identificacion-coherente", criterio: "CC7 Identificación coherente", impact: "moderate",
      help: "El enlace «" + t + "» lleva a " + d.size + " destinos distintos",
      detalle: "El Anexo 1 (2.2.3.2) pide que lo que se llama igual haga lo mismo; si llevan a sitios distintos, hay que distinguir sus textos."
    }));
    const menus = {};
    conRutas.forEach((r) => { if (r.menuPie != null) (menus[r.menuPie] = menus[r.menuPie] || []).push(r.url); });
    const raros = Object.entries(menus).filter(([, u]) => u.length === 1);
    if (Object.keys(menus).length > 1 && raros.length) hallazgos.push({
      id: "navegacion-coherente", criterio: "CC13 Navegación coherente", impact: "moderate",
      help: raros.length + " página(s) con el menú del pie distinto al de las demás",
      detalle: "Los enlaces que se repiten deben ir en el mismo orden en todas las páginas (Anexo 1, 2.2.3.3): " + raros.map(([, u]) => u[0]).join(", ")
    });
  }
  return hallazgos;
}

function informeHtml(resultados) {
  const fecha = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  // Lo que solo se ve comparando páginas se añade a la primera, para que salga en el informe
  const entrePaginas = coherenciaEntrePaginas(resultados);
  entrePaginas.forEach((x) => { x.criterio = criterioDe(x.id); });
  if (entrePaginas.length && resultados[0]) resultados[0].extra = resultados[0].extra.concat(entrePaginas);
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
<tr><td>CC1 · CC19 · CC29 (CAPTCHA y tiempo de sesión en trámites)</td><td>Hacer un trámite completo (inicio de sesión, PQRSD, pagos) con lector de pantalla y solo con teclado: ningún CAPTCHA con desafío sin otra vía, aviso antes de que caduque la sesión con opción de ampliarla y sin perder lo escrito. El escáner no ve lo que está detrás de un inicio de sesión.</td></tr>
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
