// Corre todas las pruebas del widget y genera web/evidencia.html y web/evidencia.json: fecha, commit, cada
// prueba con lo que demuestra, sus comprobaciones y los criterios WCAG / Res. 1519 que respalda. Es la página
// «Evidencia» de winclus.com: se regenera en cada push (GitHub Actions) y antes de cada despliegue.
// Uso: node evidencia.js   (sale 1 si alguna prueba falla)
const { spawnSync, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const RAIZ = path.resolve(__dirname, "../../..");
const PRUEBAS = [
  ["prueba_posicion.js", "Con cada ajuste guardado (modo oscuro, contraste, lupa, texto 200 %…) el botón y el panel siguen en pantalla y la cabecera fija del sitio no se mueve.", ["WCAG 1.4.10", "WCAG 1.4.4"]],
  ["prueba_teclado_fisico.js", "Tab llega a todas las teclas y frases; Intro y Espacio las pulsan; el lector básico no captura las teclas de los controles del sitio.", ["WCAG 2.1.1", "WCAG 2.1.2", "EN 301 549 11.5"]],
  ["prueba_aria.js", "Pestañas con el patrón Tabs, −/+ con etiqueta y valor, avisos en región live, calibración modal.", ["WCAG 4.1.2", "WCAG 4.1.3", "WCAG 1.3.1"]],
  ["prueba_privacidad.js", "Consentimiento antes de la primera cámara, avisos de la voz, «Acerca de» honesto, «Restablecer todo» borra todo.", ["Ley 1581/2012 art. 5", "Ley 1480/2011"]],
  ["prueba_axe.js", "axe-core WCAG 2.1/2.2 AA sobre cada pestaña, el teclado, las frases y el modo fácil, más contraste calculado a mano.", ["WCAG 1.4.3", "WCAG 1.4.11", "Res. 1519 CC5"]],
  ["prueba_aislamiento.js", "Estilos agresivos del sitio no alteran el widget (shadow root) y funciona con CSP estricta con nonce.", ["EN 301 549 11.5", "Res. 1519 CC13"]],
  ["prueba_daltonismo.js", "Los filtros de daltonismo son SVG reales y cambian los píxeles de la página.", ["WCAG 1.4.1"]],
  ["prueba_landing.js", "winclus.com (portada, privacidad, accesibilidad, integrar, comparar) pasa axe a 1280 y 390 px y carga su propio widget.", ["Res. 1519 Anexo 1", "WCAG 2.1 AA"]],
  ["prueba_sistema.js", "Respeta prefers-reduced-motion y prefers-contrast, lee la página en su idioma, cursor grande.", ["EN 301 549 11.7", "WCAG 3.1.1", "WCAG 2.4.7"]],
  ["prueba_barrido.js", "Barrido con un solo pulsador: página, teclado por filas y teclas, Escape pausa, el gesto de la cara es la señal.", ["EN 301 549 11.5", "ISO 9241-171 §9"]],
  ["prueba_barrido2.js", "Barrido con dos pulsadores, por zonas, punto de barrido para tocar cualquier sitio, menú de acciones (clic largo, arrastrar, leer, escribir) y aceleración (familia 5).", ["EN 301 549 11.5", "WCAG 2.2.1", "WCAG 2.5.1", "ISO 9241-171 §9"]],
  ["prueba_auditiva.js", "Aviso visual de sonido, subtítulos mostrados y agrandados, subtítulos en vivo, Centro de Relevo y diccionario LSC.", ["WCAG 1.2.2", "WCAG 1.3.3", "WCAG 1.4.2", "Res. 1519 CC2"]],
  ["prueba_voz.js", "«Números» y «clic 12», dictado con confirmación.", ["EN 301 549 11.5", "WCAG 2.5.1"]],
  ["prueba_formularios.js", "«Campo N de M», errores en lenguaje claro con foco, pegar siempre permitido.", ["WCAG 3.3.1", "WCAG 3.3.3", "WCAG 3.3.7", "WCAG 3.3.8", "Res. 1519 CC25"]],
  ["prueba_perfil_enlace.js", "El perfil viaja en un enlace sin cuentas ni servidores y un enlace roto no rompe nada.", ["EN 301 549 11.7"]],
  ["prueba_pictogramas.js", "Tablero ARASAAC: frase con voz, predicción aprendida, frases guardadas, barrido dentro.", ["ISO 24751", "CAA"]],
  ["prueba_pictogramas2.js", "CAA (familia 4): vocabulario nuclear por colores, frases con el verbo conjugado y género, historial, búsqueda en ARASAAC, tableros propios con fotos compartibles por archivo y enlace, tablero con dos pulsadores y con el puntero facial.", ["ISO 24751", "CAA", "EN 301 549 11.5"]],
  ["prueba_lector.js", "Lector de pantalla completo dentro de la página (familia 2): zonas, tablas celda a celda con cabeceras, listas, casillas, encabezados por nivel, letra a letra y palabra a palabra, deletrear, lectura continua, buscar, modo formulario, roles y estados, regiones vivas, verbosidad y tono.", ["WCAG 1.3.1", "WCAG 4.1.2", "WCAG 4.1.3", "WCAG 2.4.1", "EN 301 549 11.5"]],
  ["prueba_familias36.js", "Guiños e inclinación de la cabeza como gestos asignables (familia 3); colores por tipo de palabra, resumen en tres frases y preguntas de comprobación en la lectura fácil (familia 6).", ["WCAG 3.1.5", "COGA", "EN 301 549 11.5"]],
  ["prueba_familia3_widget.js", "Calibración ocular de 9, 13 o 25 puntos con compensación de cabeza medida, puntero de otro rastreador con clics por cámara y enlace a NVDA (familia 3 en el widget).", ["EN 301 549 11.5", "ISO 9241-171 §9"]],
  ["prueba_gestos.js", "Los gestos de la cara no se disparan al hablar o bostezar: la rueda por gesto tarda en arrancar y empieza despacio, se explica la primera vez y se pueden apagar todos sin perder el clic.", ["EN 301 549 11.5", "WCAG 2.5.1", "WCAG 3.2.5"]],
  ["prueba_bordes.js", "Bajar y subir la página llevando el puntero de la cara o los ojos al borde de la pantalla, con aviso en pantalla y voz.", ["EN 301 549 11.5", "WCAG 2.5.1"]],
  ["prueba_elegir.js", "Elegir con los ojos sin tener que acertar: cuando hay varias cosas cerca del puntero se pregunta cuál (con su nombre y qué es), los desplegables enseñan todas sus opciones de una vez, se marca lo que se va a pulsar, el puntero llega a los bordes de la pantalla y, si el gesto de clic no sale, se ofrece otro.", ["WCAG 2.5.1", "WCAG 2.5.5", "WCAG 3.3.2", "EN 301 549 11.5", "ISO 9241-171 §9"]],
  ["prueba_seguir_camara.js", "La cámara sigue encendida al pasar de una página a otra: quien no tiene manos no pierde el control a cada enlace. Se reanuda solo con consentimiento, permiso del navegador ya concedido y la cámara encendida al salir; lo dice en pantalla y en voz; apagarla a mano, el interruptor o «Restablecer todo» lo impiden.", ["WCAG 2.1.1", "EN 301 549 11.5", "Ley 1581/2012 art. 5"]],
  ["prueba_facil.js", "«Explicar en fácil» por reglas y con IA, resaltado palabra a palabra, «¿Dónde estoy?».", ["WCAG 3.1.5", "WCAG 2.4.8", "COGA"]],
  ["prueba_auditar.js", "Winclus Audit: informe por criterio de la Res. 1519 (cada hallazgo con su número y nombre oficial) y borrador de declaración; detecta CAPTCHA con desafío o de imagen y sesiones que caducan sin aviso, y no confunde los invisibles ni los temporizadores inofensivos.", ["Res. 1519 Anexo 1", "Res. 1519 CC1", "Res. 1519 CC19", "Res. 1519 CC29", "WCAG 2.2.1"]],
  ["prueba_cc1519.js", "Verificación de winclus.com contra los 32 criterios de cumplimiento del Anexo 1 de la Resolución 1519 de 2020, uno por uno y con la numeración del anexo: alternativas, vídeos, ampliación, contraste, identificación coherente, estructura, tablas y listas, saltar bloques, marcado, múltiples vías, navegación coherente, orden, tabulación, foco, audio automático, tiempos, movimiento, refresco, títulos, campos, enlaces, idioma, codificación y teclado. Lo que ninguna máquina puede juzgar se marca como revisión humana en vez de darlo por bueno.", ["Res. 1519/2020 Anexo 1 (CC1 a CC32)", "WCAG 2.1 AA", "Ley 1712/2014 art. 8"]],
  ["prueba_documentos.mjs", "Capítulo 3.3 del Anexo 1 (documentos PDF): los PDF de winclus.com están etiquetados, con idioma, título, encabezados sin saltos, listas, texto alternativo en todas las figuras, texto real, índice y sin restricciones para lectores de pantalla.", ["Res. 1519 Anexo 1 cap. 3", "PDF/UA", "WCAG 1.1.1"]],
  ["prueba_sdk.js", "Web component, guía de integración, plugin de WordPress y módulo de Drupal.", ["Integración"]],
  ["prueba_idiomas.js", "Panel en inglés en páginas en inglés, data-ui, idiomas añadidos por el sitio.", ["WCAG 3.1.1", "WCAG 3.1.2"]],
  ["prueba_maximo.js", "Limitador de volumen, voz neuronal preferida, asistente «¿Qué quieres hacer?», transcribir un medio.", ["WCAG 1.4.2", "COGA"]],
  ["prueba_evidencia.js", "La demostración pública pasa axe; las cifras de uso se cuentan en local, el resumen no lleva datos personales y solo se envían al sitio si la persona lo activa.", ["Ley 1581/2012", "Evidencia de uso"]],
  ["prueba_navegadores.js", "En Chromium, Firefox y WebKit: sin síntesis ni reconocimiento de voz, localStorage bloqueado, sin portapapeles, página sin <main>, DOM reemplazado (SPA), script cargado dos veces, móvil.", ["Robustez"]],
  ["prueba_robustez.js", "Regresión de la revisión de código: consentimiento sin localStorage, CSS móvil, voz por trozos, glosario sin HTML anidado, barrido sin lista rancia, perfiles con tipos inválidos, contraseñas protegidas, un solo reconocedor de voz.", ["Robustez"]],
  ["prueba_rendimiento.js", "La inferencia de la cara va a la tasa de la cámara; modo ahorro a 15/s.", ["Rendimiento"]],
  ["prueba_familias.js", "Paridad con los overlays (familia 1): tipo de letra legible y para dislexia, espacio entre renglones, texto a la izquierda, zoom de toda la página, títulos y foco resaltados, silenciar la página y diccionario al tocar una palabra (glosario del sitio, ARASAAC con dibujo, Wikcionario); sílabas coloreadas en la lectura limpia (familia 6). Aplicados a la página, guardados y reversibles.", ["WCAG 1.4.8", "WCAG 1.4.12", "WCAG 1.4.4", "WCAG 2.4.7", "WCAG 1.4.2", "WCAG 3.1.3"]],
  ["prueba_aaa.js","Nivel AAA: reglas AAA de axe en el panel y en las 15 páginas, contraste 7:1, objetivos de 44×44, confirmación antes de borrar, colores propios y modo dislexia, glosario, migas de pan, lectura fácil y transcripciones.", ["WCAG 1.4.6", "WCAG 1.4.8", "WCAG 2.5.5", "WCAG 3.3.6", "WCAG 3.1.4", "WCAG 3.1.5", "WCAG 2.4.8", "WCAG 1.2.8"]],
  ["prueba_entender.js","El panel se entiende sin manual: Inicio con «¿Qué te cuesta?», «Lo que tienes activado» y «Apagar todo», ayuda en palabras corrientes bajo cada opción, ajustes finos plegados, sin jerga, todo traducido.", ["WCAG 3.1.5", "WCAG 3.3.2", "COGA", "ISO 24495-1"]],
  ["prueba_situaciones.js", "«¿Qué te cuesta?» se pone y se quita: diez opciones (también «No veo» y «Confundo los colores») que encienden lo que dicen, quedan marcadas con ✓ y al tocarlas otra vez dejan todo como estaba antes; el permiso de la cámara sale en Inicio; el panel se abre sencillo y «Ver más opciones» enseña las pestañas.", ["WCAG 3.3.2", "WCAG 4.1.2", "WCAG 2.1.1", "Res. 1519 CC25"]],
  ["prueba_amplificar.js", "Para la hipoacusia: subir el volumen por encima de lo normal (medido: 3 veces al 300 %, con limitador para que no se rompa) y «Voz más clara» (quita graves, realza la voz); los audios de otro sitio sin permiso no se tocan, porque sonarían en silencio.", ["WCAG 1.4.7", "EN 301 549 7.2", "Ley 1618/2013 art. 16"]],
  ["prueba_temblor.js", "Temblor con el ratón de siempre: el clic que cae al lado de un botón lo pulsa (o pregunta cuál), el segundo clic sin querer no cuenta; nunca toca un clic que ya cae en algo pulsable.", ["WCAG 2.5.8", "WCAG 2.5.2", "EN 301 549 11.5"]],
  ["prueba_ayuda_voz.js", "ELA avanzada: «Pedir ayuda» en toda la pantalla sin destellos, que para cualquier tecla o gesto; «Mis frases con mi voz»: la frase grabada suena con la voz de la persona en vez de la sintética, se guarda solo en el navegador y se borra.", ["WCAG 2.3.1", "CDPD art. 21", "Ley 1581/2012"]],
  ["prueba_atajo_imagenes.js", "Alt+Mayúsculas+W abre el panel desde cualquier sitio; las imágenes sin texto alternativo se dicen como tales, con la mejor pista de la página y sin inventar, o con la descripción del servicio del sitio (data-describir); la transcripción de los subtítulos en vivo se guarda en un archivo con la hora de cada frase.", ["WCAG 2.1.1", "WCAG 1.1.1", "Res. 1519 CC1", "WCAG 1.2.4"]],
  ["prueba_pdf.js", "Los PDF del mismo sitio se abren en la lectura limpia con su texto y su título (pdf.js desde winclus.com); los de otro sitio, como siempre; un PDF escaneado se dice que no tiene texto.", ["Res. 1519 Anexo 1 cap. 3", "WCAG 1.4.4", "Ley 1680/2013"]],
  ["prueba_mascarilla.js", "ELA con ventilación: con una mascarilla oronasal (simulada sobre una cara real) se detecta la cara, el puntero sigue a la cabeza y el parpadeo da la misma señal que sin ella.", ["EN 301 549 11.5", "WCAG 2.5.1"]],
  ["prueba_alcance.js", "ELA que avanza y cansancio: «Ajustar el puntero a lo que puedo mover» mide el movimiento de cabeza que queda y lo hace cruzar la pantalla; si ni al máximo alcanza, propone los ojos o un pulsador.", ["EN 301 549 11.5", "WCAG 2.5.1", "ISO 9241-171 §9"]],
  ["prueba_otro_idioma.js", "Cambiar el idioma desde la barra de accesibilidad (Res. MinTIC 2893 de 2020, Anexo 1, 4.3.2 b): «Otro idioma» se ve al abrir el panel y lleva a las versiones del sitio en otros idiomas (hreflang, selector con lang o data-idiomas); si no hay, explica cómo traducir con el navegador sin enviar la página a nadie.", ["Res. MinTIC 2893 de 2020, Anexo 1, 4.3.2 b", "WCAG 3.1.1", "WCAG 2.5.5"]],
];

function commit() { try { return execSync("git rev-parse --short HEAD", { cwd: RAIZ }).toString().trim(); } catch (e) { return "?"; } }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const resultados = [];
let fallan = 0;
for (const [archivo, que, criterios] of PRUEBAS) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, archivo)], { encoding: "utf8", timeout: 600000 });
  const lineas = (r.stdout || "").split(/\r?\n/).filter((l) => /^(OK|MAL) /.test(l));
  const ok = lineas.filter((l) => l.startsWith("OK")).length, mal = lineas.filter((l) => l.startsWith("MAL")).length;
  const bien = r.status === 0 && mal === 0;
  if (!bien) fallan++;
  resultados.push({ archivo, que, criterios, ok, mal, bien, segundos: Math.round((Date.now() - t0) / 1000), lineas: lineas.map((l) => l.replace(/\s+\(.*\)$/, "").slice(0, 160)) });
  console.log((bien ? "OK  " : "MAL ") + archivo + " (" + ok + " ok, " + mal + " mal)");
}

const fecha = new Date();
const json = { fecha: fecha.toISOString(), commit: commit(), version: (fs.readFileSync(path.join(RAIZ, "web/widget.js"), "utf8").match(/var VERSION = "([^"]+)"/) || [])[1], pruebas: resultados.length, comprobaciones: resultados.reduce((s, r) => s + r.ok + r.mal, 0), fallan, resultados };
fs.writeFileSync(path.join(RAIZ, "web/evidencia.json"), JSON.stringify(json, null, 2));
// Las cifras que citan las páginas (presentación, comparar, una página…) van en <span data-cifra="…"> y se ponen
// aquí, con el resultado real: antes se escribían a mano y cada página decía un número distinto (22, 35, 36…).
// Solo si todo ha pasado: una cifra publicada tiene que ser de una batería en verde.
if (!fallan) {
  const cifras = { pruebas: json.pruebas, comprobaciones: json.comprobaciones.toLocaleString("es-CO"), version: json.version };
  fs.readdirSync(path.join(RAIZ, "web")).filter((f) => f.endsWith(".html")).forEach((f) => {
    const p = path.join(RAIZ, "web", f), antes = fs.readFileSync(p, "utf8");
    const despues = antes.replace(/(<span data-cifra="(\w+)">)[^<]*(<\/span>)/g, (m, a, k, z) => (k in cifras ? a + cifras[k] + z : m));
    if (despues !== antes) fs.writeFileSync(p, despues);
  });
}

const fechaTxt = fecha.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }) + ", " + fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
const porCriterio = {};
resultados.forEach((r) => r.criterios.forEach((c) => { porCriterio[c] = porCriterio[c] || []; porCriterio[c].push(r); }));
let h = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evidencia · Winclus</title>
<meta name="description" content="Resultado de las pruebas automáticas públicas del widget Winclus: qué demuestra cada una, cuándo se corrió y con qué versión.">
<link rel="icon" href="img/icono.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="paginas.css">
<style>.ok{color:#0A5C54;font-weight:700}.mal{color:#A6402F;font-weight:700}details{margin:6px 0 14px}summary{cursor:pointer;font-weight:600}.lineas{font-size:.88rem;margin:6px 0 0 8px;padding-left:16px}.lineas li{margin:2px 0}.tag{display:inline-block;font-size:.78rem;background:#F3F6FA;border:1px solid #DCE3EC;border-radius:999px;padding:1px 8px;margin:2px 4px 2px 0}.kpi{display:flex;gap:14px;flex-wrap:wrap;margin:16px 0}.kpi div{background:#F3F6FA;border-radius:12px;padding:12px 18px;min-width:120px}.kpi b{display:block;font-size:1.7rem}pre{overflow-x:auto;background:#101F3D;color:#EEF1EA;padding:12px 14px;border-radius:10px;font-size:14px}main{overflow-wrap:anywhere}</style>
</head>
<body>
<a class="salto" href="#contenido">Ir al contenido</a>
<header><div class="barra"><a class="marca" href="/"><img src="img/logo.png" alt="" width="40" height="40">winclus<span>.com</span></a><a class="volver" href="/">Volver a la portada</a></div></header>
<main id="contenido"><nav class="migas" aria-label="Estás en"><a href="/">Portada</a><span aria-hidden="true">›</span><span aria-current="page">Evidencia</span></nav>
  <h1>Evidencia: lo que las pruebas demuestran</h1>
  <p class="meta">Generado automáticamente el ${esc(fechaTxt)} · widget ${esc(json.version)} · commit <code>${esc(json.commit)}</code>. Las pruebas corren automáticamente con cada cambio del código.</p>
  <div class="kpi"><div><b>${json.pruebas}</b>pruebas</div><div><b>${json.comprobaciones}</b>comprobaciones</div><div><b class="${fallan ? "mal" : "ok"}">${fallan ? fallan + " fallan" : "0 fallan"}</b>estado</div></div>
  <div class="${fallan ? "aviso" : "resumen"}"><p>${fallan ? "<strong>Hay pruebas que fallan.</strong> Esta versión no debería desplegarse hasta corregirlas; el detalle está abajo." : "<strong>Todas las pruebas pasan.</strong> Esto demuestra lo que el widget hace por sí mismo; no sustituye a las pruebas con personas usuarias ni a una auditoría de tercero, que están en curso."}</p></div>
  <h2>Por criterio</h2>
  <div class="tabla" tabindex="0" role="region" aria-label="Criterios y pruebas"><table><thead><tr><th>Criterio o norma</th><th>Lo respaldan</th></tr></thead><tbody>`;
Object.keys(porCriterio).sort().forEach((c) => { h += `<tr><td>${esc(c)}</td><td>${porCriterio[c].map((r) => `<span class="${r.bien ? "ok" : "mal"}">${r.bien ? "✓" : "✗"}</span> ${esc(r.archivo)}`).join("<br>")}</td></tr>`; });
h += `</tbody></table></div>
  <h2>Por prueba</h2>`;
resultados.forEach((r) => {
  h += `<details><summary><span class="${r.bien ? "ok" : "mal"}">${r.bien ? "✓" : "✗"}</span> ${esc(r.archivo)} · ${r.ok} comprobaciones${r.mal ? ", " + r.mal + " fallan" : ""} · ${r.segundos} s</summary><p>${esc(r.que)}</p><p>${r.criterios.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</p><ul class="lineas">${r.lineas.map((l) => `<li class="${l.startsWith("OK") ? "" : "mal"}">${esc(l.replace(/^(OK|MAL)\s+/, ""))}</li>`).join("")}</ul></details>`;
});
h += `</main>
<footer><div class="pie"><div>© 2026 Winclus</div><ul><li><a href="/">Portada</a></li><li><a href="accesibilidad">Accesibilidad</a></li><li><a href="privacidad">Privacidad y datos</a></li><li><a href="mapa-del-sitio">Mapa del sitio</a></li><li><a href="glosario">Glosario</a></li><li><a href="mailto:hola@winclus.com">hola@winclus.com</a></li></ul></div></footer>
<script src="widget.js" async></script>
</body>
</html>`;
fs.writeFileSync(path.join(RAIZ, "web/evidencia.html"), h);
console.log((fallan ? fallan + " prueba(s) MAL · " : "todo bien · ") + "web/evidencia.html y web/evidencia.json");
process.exit(fallan ? 1 : 0);
