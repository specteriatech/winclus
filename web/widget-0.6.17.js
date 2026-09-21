/*!
 * Winclus · widget de accesibilidad para páginas web · https://winclus.com
 * Licencia Apache 2.0
 *
 * Cómo añadirlo a una página (una sola línea, antes de </body>):
 *   <script src="https://winclus.com/widget.js" async></script>
 *
 * Opciones (atributos del <script>):
 *   data-posicion="izquierda"   botón a la izquierda (por defecto, derecha)
 *   data-color="#101F3D"        color del botón
 *   data-camara="no"            ocultar el control con la cámara (solo panel de accesibilidad)
 *   data-glosario="/glosario.json"  JSON {palabra: definición} para el diccionario al toque (o window.WinclusGlosario)
 *
 * Hace dentro de la página lo mismo que la aplicación Winclus para Windows:
 * puntero con la cabeza o con los ojos (directo, híbrido o palanca, con
 * calibración en la página y calibración invisible que aprende de cada
 * clic), clic por parpadeo, boca, cejas o permanencia, menú de clics con los
 * ojos cerrados 1,2 s, arrastrar, rueda, lupa, imán a los botones, teclado
 * en pantalla con sugerencias, frases con voz, dictado, órdenes por voz,
 * avisos y perfiles exportables. Todo se procesa en el navegador.
 */
(function () {
  "use strict";
  if (window.Winclus) return;

  var script = document.currentScript;
  var opciones = {
    posicion: (script && script.dataset.posicion) || "derecha",
    color: (script && script.dataset.color) || "#101F3D",
    camara: !(script && script.dataset.camara === "no"),
    relevo: !(script && script.dataset.relevo === "no"),   // botón al Centro de Relevo de MinTIC (intérprete de LSC por videollamada)
    explicar: (script && script.dataset.explicar) || "",    // URL opcional de un servicio de lectura fácil con IA (POST {texto, idioma} → {texto})
    metricas: (script && script.dataset.metricas) || "",    // URL opcional a la que el sitio recibe cifras de uso anónimas (solo si la persona lo activa)
    glosario: (script && script.dataset.glosario) || ""     // URL opcional de un JSON {palabra: definición} para el diccionario al toque (o window.WinclusGlosario)
  };
  // Cifras de uso: cuántas veces se hizo clic con la cara, se dijo una frase, se explicó un error… Solo números,
  // en este navegador. Sirven a la persona para ver lo que consigue y a una entidad para reportar tareas
  // completadas (ITA) si la persona decide compartirlas. Nunca se envían solas.
  var uso = null;
  function contar(clave) {
    try {
      if (!uso) { uso = JSON.parse(localStorage.getItem("winclus.uso") || "null") || { desde: new Date().toISOString().slice(0, 10), n: {} }; }
      uso.n = uso.n || {}; uso.n[clave] = (uso.n[clave] || 0) + 1; localStorage.setItem("winclus.uso", JSON.stringify(uso));
    } catch (e) {}
  }
  var NOMBRES_USO = { clics_cara: "clics hechos con la cara", barrido: "acciones con el barrido", frases: "frases dichas con voz", pictos: "frases dichas con pictogramas", teclado: "veces que se abrió el teclado", dictado: "dictados escritos", errores: "errores de formulario explicados", facil: "páginas explicadas en fácil", limpia: "lecturas limpias", diccionario: "palabras buscadas en el diccionario", silabas: "textos separados en sílabas", camara: "sesiones con la cámara", ordenes: "órdenes por voz ejecutadas", asistente: "peticiones al asistente" };
  function resumenUso() {
    try { uso = uso || JSON.parse(localStorage.getItem("winclus.uso") || "null"); } catch (e) {}
    if (!uso || !uso.n || !Object.keys(uso.n).length) return T("Todavía no hay cifras de uso en este navegador.");
    return T("Uso de Winclus en este navegador desde el ") + uso.desde + T(" (sitio: ") + location.hostname + "):\n" + Object.keys(uso.n).map(function (k) { return "· " + uso.n[k] + " " + T(NOMBRES_USO[k] || k); }).join("\n") + (masUsadoPanel() ? "\n" + masUsadoPanel() : "");
  }
  var URL_RELEVO = "https://www.centroderelevo.gov.co/", URL_DICCIONARIO_LSC = "https://educativo.insor.gov.co/diccionario/";
  var ORIGEN = (script && script.src) ? script.src.replace(/\/[^\/]*$/, "") : "https://winclus.com";
  // El detector de caras (MediaPipe Tasks Vision, Apache 2.0) y el modelo se sirven
  // desde el mismo sitio que este archivo; jsDelivr y Google quedan de respaldo.
  var FUENTES_MP = [
    { base: ORIGEN + "/mediapipe", modelo: ORIGEN + "/mediapipe/face_landmarker.task" },
    { base: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35", modelo: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" }
  ];
  var VERSION = "0.6.17";
  var CAM_W = 640, CAM_H = 480;
  var raiz = document.documentElement;
  var LADO = opciones.posicion === "izquierda" ? "left" : "right";

  // ------------------------------------------------------------ ajustes --
  // Mismas claves y valores por defecto que cursor.json de la aplicación.
  var POR_DEFECTO = {
    texto: 100, contraste: false, oscuro: false, enlaces: false, guia: false, animaciones: false, lectura: false,
    voz_activa: true, voz_nombre: "", voz_velocidad: 0, voz_tono: 0, voz_eco: false, lector_verbosidad: "normal",
    modo_puntero: "cabeza", ojos_modo: "directo",
    velocidad: 20, suavizado: 8, aceleracion: false,
    ojos_velocidad: 50, ojos_zona_muerta: 4, ojos_vertical: 150, ojos_suavizado: 6,
    ojos_fijacion_px: 60, ojos_persistencia_ms: 150,
    hibrido_cabeza: 40, hibrido_salto_px: 150, hibrido_pausa_ms: 250,
    lupa_activa: true, lupa_zoom: 3, lupa_tiempo_max_s: 8,
    iman_activo: true, iman_radio_px: 90, iman_cabeza: false,
    elegir_cerca: true, elegir_radio_px: 80, apuntado_marcar: true, ojos_alcance: true, ojos_quieto: false, ayuda_clic: true,
    menu_ojos: true, menu_largo_ms: 1200,   // elegir con los ojos: lista de candidatos y marca de lo apuntado
    calib_invisible: true, calib_modo: "normal", calib_lento: false, calib_punto_grande: false, calib_cabeza: true, puntero_externo: false, bordes_desplazan: true,
    modo_clic: "parpadeo", parpadeo_ms: 200, parpadeo_umbral: 0.62,
    quieto_ms: 1100, quieto_radio_px: 40, quieto_anillo: true, hold_ms: 250,
    gestos: { jawOpen: "rueda_abajo", browInnerUp: "rueda_arriba", mouthRight: "derecho", mouthLeft: "nada",
              mouthPucker: "nada", mouthSmile: "nada", mouthRollLower: "nada", guinoIzq: "nada", guinoDer: "nada", cabezaIzq: "nada", cabezaDer: "nada" },
    gestos_umbral: 50, gestos_activos: true,
    avisos_visuales: true, avisos_sonido: false,
    teclado_altura: 32, teclado_posicion: "abajo", teclado_prediccion: true, teclado_sonido: true,
    camara_ver: true, camara_seguir: true, dwell: false, ahorro: false, cursor_grande: false,
    barrido: false, barrido_ms: 1200, barrido_senal: "espacio", barrido_voz: true, barrido_modo: "auto", barrido_senal2: "intro", caa_gramatica: true, caa_genero: "n", barrido_grupos: false, barrido_punto: false, barrido_menu: false, barrido_acelerar: false,
    subtitulos: false, alertas_sonido: false, dictado_confirmar: false, formularios: true, volumen_max: 100, amplificar: 100, voz_clara: false, raton_temblor: false, raton_doble_ms: 600, raton_radio_px: 40, metricas_compartir: false,
    dalton: "no", calma: false, colores: "no", color_texto: "#000000", color_fondo: "#FFFFFF", letra: "no", alinear: false, interlineado: 100, zoom_pagina: 100, titulos: false, foco: false, silencio: false, diccionario: false, dislexia: false, sinimg: false, mascara: false, lector: false, facil: false,
    lupa_pantalla: false, lupa_pantalla_zoom: 2,
    situaciones: [], situ_antes: {}   // lo elegido en «¿Qué te cuesta?» y cómo estaba cada ajuste antes, para quitarlo tal cual
  };
  var CLAVE = "winclus.ajustes";
  var ajustes = JSON.parse(JSON.stringify(POR_DEFECTO));
  // Nunca se sustituye el objeto «ajustes» (ni «ajustes.gestos»): los controles del panel guardan su referencia
  // Solo entra lo que tenga el mismo tipo que el valor por defecto y, si es número, sea finito: un perfil (archivo,
  // enlace o localStorage tocado) con "20 rápido" o null no puede dejar un NaN guardado que mate el puntero o la voz
  function fusionarAjustes(g) {
    for (var k in g) if (Object.prototype.hasOwnProperty.call(ajustes, k)) {
      var v = g[k], d = ajustes[k];
      if (k === "gestos") { if (v && typeof v === "object") for (var s in v) if (s in ajustes.gestos && typeof v[s] === "string") ajustes.gestos[s] = v[s]; }
      else if (typeof v === typeof d && (typeof v !== "number" || isFinite(v))) ajustes[k] = v;
    }
  }
  function cargarAjustes() {
    var g = null;
    try { g = JSON.parse(localStorage.getItem(CLAVE)); } catch (e) {}
    if (g) {
      fusionarAjustes(g);
      if (g.dwell && g.modo_clic == null) ajustes.modo_clic = "quieto";   // ajuste de la versión 0.1
    }
    preferenciasDelSistema(g || {});
  }
  // Lo que la persona ya pidió al sistema operativo se respeta sin que tenga que repetirlo aquí (EN 301 549 11.7),
  // pero solo mientras no haya tocado ese ajuste en el widget: lo guardado manda.
  function preferenciasDelSistema(g) {
    var mm = function (q) { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } };
    if (mm("(prefers-reduced-motion: reduce)")) { if (!("animaciones" in g)) ajustes.animaciones = true; if (!("calma" in g)) ajustes.calma = true; }
    if (mm("(prefers-contrast: more)") && !("contraste" in g)) ajustes.contraste = true;
  }
  cargarAjustes();
  // Idioma de la página (para leerla con la voz que toca) y del reconocimiento de voz (español de Colombia por defecto)
  var IDIOMA_PAGINA = (document.documentElement.lang || "es").toLowerCase();
  var IDIOMA_VOZ = (script && script.dataset.idioma) || "es-CO";
  // ---------------------------------------------------------- idiomas del panel --
  // Los textos del widget están escritos en español y se traducen al vuelo con un diccionario por idioma
  // (clave: la cadena en español). Inglés va incluido; un sitio puede añadir otros con window.WinclusIdiomas
  // antes de cargar el widget. Lo que no esté traducido sale en español. data-ui manda; si no, el lang de la página.
  var DICC = {
    en: {
      "Ver": "See", "Oír": "Hear", "Puntero": "Pointer", "Clics": "Clicks", "Escribir": "Type", "Más": "More", "Cerrar": "Close", "Pausar": "Pause",
      "Abrir accesibilidad Winclus": "Open Winclus accessibility", "Pausar el puntero": "Pause the pointer", "Accesibilidad Winclus": "Winclus accessibility", "Lectura limpia": "Clean reading",
      "Ver mejor": "See better", "Tamaño del texto": "Text size", "Alto contraste": "High contrast", "Modo oscuro": "Dark mode", "Resaltar enlaces": "Highlight links", "Guía de lectura": "Reading guide", "Cursor del ratón grande": "Large mouse cursor",
      "Colores y calma": "Colors and calm", "Ninguna": "None",
      "Modo calma: sin destellos, animaciones ni vídeos que arranquen solos": "Calm mode: no flashes, animations or self-starting videos",
      "Leer con menos esfuerzo": "Read with less effort", "Lectura limpia: solo el texto, grande": "Clean reading: just the text, large", "Letras y palabras más separadas": "Wider letter and word spacing", "Atenuar imágenes y vídeos": "Dim images and videos",
      "Lector de pantalla": "Screen reader", "Lector de pantalla activado": "Screen reader on", "Modo fácil": "Easy mode",
      "Escuchar": "Listen", "Leer en voz alta lo que se pulsa": "Read aloud what you click", "Leer la página": "Read the page", "¿Dónde estoy?": "Where am I?", "Callar": "Stop talking",
      "Voz": "Voice", "Voz activada (Decir y frases)": "Voice on (Say and phrases)", "Velocidad de la voz": "Voice speed", "Leer cada palabra al escribirla": "Read each word as you type", "Probar la voz": "Test the voice", "Voz anterior": "Previous voice", "Voz siguiente": "Next voice",
      "Frases para decir": "Phrases to say", "Tablero de pictogramas": "Pictogram board", "Guardar frases": "Save phrases", "Volver a las de ejemplo": "Back to the examples",
      "Escuchar órdenes": "Listen for commands", "Dejar de escuchar": "Stop listening",
      "Sonidos y subtítulos": "Sounds and captions", "Avisar en pantalla cuando algo suena": "Show an alert when something makes a sound", "Subtítulos en vivo (micrófono)": "Live captions (microphone)", "Parar los subtítulos en vivo": "Stop live captions", "Subtítulos en vivo": "Live captions", "Centro de Relevo (intérprete de LSC)": "Centro de Relevo (sign language interpreter)", "Diccionario de Lengua de Señas (INSOR)": "Sign language dictionary (INSOR)",
      "Usar con la cara": "Use with your face", "Activar cámara": "Turn on camera", "Apagar cámara": "Turn off camera", "Ver la cámara": "Show the camera",
      "Mueve el puntero con la cabeza o con los ojos y haz clic con un gesto. Para bajar la página, lleva el puntero al borde de abajo; para subir, al de arriba. La cámara se procesa aquí mismo: nada sale de tu equipo.": "Move the pointer with your head or eyes and click with a gesture. The camera is processed right here: nothing leaves your device.",
      "El control con la cámara está desactivado en esta página.": "Camera control is disabled on this page.", "Permiso para usar la cámara": "Permission to use the camera", "Acepto y activo la cámara": "I agree, turn on the camera", "Ahora no": "Not now",
      "Cómo se mueve el puntero": "How the pointer moves", "Con la cabeza": "With my head", "Con los ojos": "With my eyes", "Directo": "Direct", "Palanca": "Joystick",
      "Calibrar los ojos (unos 40 s)": "Calibrate eyes (about 40 s)", "Recentrar (mirar al centro 2 s)": "Recenter (look at the center 2 s)", "Olvidar la calibración": "Forget calibration", "Centrar (mira al centro)": "Center (look at the center)", "Velocidad": "Speed",
      "Velocidad con la cabeza": "Head speed",
      "Imán a los botones": "Snap to buttons", "Imán activado": "Snap on", "También con la cabeza": "Also with the head",
      "Aprender de mis clics": "Learn from my clicks", "Ajustar ahora": "Adjust now", "Olvidar los clics": "Forget clicks",
      "Cómo se hace clic": "How to click", "Parpadeo": "Blink", "Abrir la boca": "Open mouth", "Subir las cejas": "Raise eyebrows", "Quedarse quieto": "Hold still", "Mostrar el anillo que se llena": "Show the filling ring",
      "Otras acciones con gestos": "Other gesture actions", "Mantener el gesto para arrastrar": "Hold the gesture to drag", "Nada": "Nothing", "Clic": "Click", "Clic derecho": "Right click", "Doble clic": "Double click", "Bajar": "Scroll down", "Subir": "Scroll up", "Menú de clics": "Click menu", "Pausar / seguir": "Pause / resume", "Teclado": "Keyboard", "Recentrar": "Recenter", "Leer en voz alta": "Read aloud",
      "Avisos": "Alerts", "Etiqueta junto al puntero": "Label next to the pointer", "Pitido al hacer clic": "Beep on click",
      "Barrido con un solo pulsador": "Single-switch scanning", "Barrido activado": "Scanning on", "Señal": "Signal", "Espacio": "Space", "Intro": "Enter", "Cualquier tecla": "Any key", "Clic del ratón": "Mouse click", "Tiempo en cada elemento": "Time on each item", "Decir en voz alta lo marcado": "Say the highlighted item aloud",
      "Teclado en pantalla": "On-screen keyboard", "Mostrar / ocultar el teclado": "Show / hide the keyboard", "Altura": "Height", "Abajo": "Bottom", "Arriba": "Top", "Sugerir palabras": "Suggest words", "Sonido al pulsar": "Key sound", "Olvidar las palabras aprendidas": "Forget learned words", "Teclado en pantalla Winclus": "Winclus on-screen keyboard",
      "Ayuda en formularios": "Form help", "Al entrar en un campo te dice cuál es y cuántos quedan («Campo 3 de 8: Correo, obligatorio»); si el sitio marca un error, lo explica en lenguaje claro; y deja pegar aunque el sitio lo bloquee.": "When you enter a field it tells you which one it is and how many are left (“Field 3 of 8: Email, required”); if the site flags an error, it explains it in plain language; and it lets you paste even if the site blocks it.",
      "Dictado": "Dictation", "Dictar": "Dictate", "Parar el dictado": "Stop dictation", "Confirmar lo dictado": "Confirm dictation", "Escribir (o di «sí»)": "Type it (or say “yes”)", "Descartar (o di «no»)": "Discard (or say “no”)",
      "Perfil": "Profile", "Copiar enlace con mis ajustes": "Copy a link with my settings", "Restablecer todo": "Reset everything", "Acerca de": "About",
      "Borra de este navegador todo lo que Winclus guarda: ajustes, calibración de los ojos, clics aprendidos, frases, palabras y el permiso de la cámara.": "Deletes everything Winclus stores in this browser: settings, eye calibration, learned clicks, phrases, words and the camera permission.",
      "🔊 Leer la página": "🔊 Read the page", "🔇 Callar": "🔇 Stop talking", "A+ Texto más grande": "A+ Larger text", "◐ Alto contraste": "◐ High contrast", "📖 Lectura limpia": "📖 Clean reading", "🔍 Lupa de pantalla": "🔍 Magnifier", "📷 Usar con la cara": "📷 Use with my face", "Ver todas las opciones": "See all options",
      "Toca los dibujos para formar tu frase": "Tap the pictures to build your sentence", "Siguiente:": "Next:", "Decir": "Say", "Borrar último": "Delete last", "Borrar todo": "Delete all", "Guardar frase": "Save sentence", "Básico": "Basics", "Necesito": "I need", "Siento": "I feel", "Personas": "People", "Acciones": "Actions", "Lugares": "Places", "Comida": "Food", "Tiempo y cosas": "Time and things", "Mis frases": "My sentences",
      "Calibración de los ojos": "Eye calibration", "Cancelar (o tecla Esc)": "Cancel (or Esc key)", "Explicar en fácil": "Explain simply", "Ver el original": "See the original", "Leer en voz alta": "Read aloud", "Texto más pequeño": "Smaller text", "Texto más grande": "Larger text",
      "Sí": "Yes", "No": "No", "Gracias": "Thank you", "Necesito ayuda": "I need help", "Tengo sed": "I am thirsty", "Tengo hambre": "I am hungry", "Tengo dolor": "I am in pain", "Quiero ir al baño": "I need the bathroom", "Tengo frío": "I am cold", "Tengo calor": "I am hot", "Estoy cansado": "I am tired", "Quiero descansar": "I want to rest", "Llama a mi familia": "Call my family", "Espera un momento": "Wait a moment", "No entiendo": "I don't understand", "Hasta luego": "See you later",
      "¿Qué quieres hacer? Dímelo con tus palabras": "What do you want to do? Tell me in your own words", "Por ejemplo: no veo bien, quiero escribir, contacto…": "For example: I can't see well, I want to type, contact…", "Ir": "Go", "Hacerlo": "Do it", "Decirlo con la voz": "Say it out loud",
      "Lo que consigo con Winclus": "What I get done with Winclus", "Copiar el resumen de uso": "Copy the usage summary", "Compartir mis cifras de uso con este sitio": "Share my usage figures with this site", "Volumen máximo de vídeos y audios": "Maximum volume for videos and audio", "Transcribir el vídeo o audio de la página (micrófono)": "Transcribe the page's video or audio (microphone)",
      "Escrito": "Typed", "Descartado": "Discarded", "Barrido activado": "Scanning on", "Barrido en pausa": "Scanning paused", "Barrido en marcha": "Scanning running", "Enlace copiado": "Link copied", "Perfil importado": "Profile imported", "Todo restablecido": "Everything reset", "Frases guardadas": "Phrases saved", "Frase guardada": "Sentence saved", "Cámara apagada.": "Camera off.",
      "Seguir con la cámara al cambiar de página": "Keep the camera on when changing pages",
      "Si dejas la cámara encendida y abres otra página de este sitio, se vuelve a encender sola: nadie tiene que pulsar nada. Solo si ya diste permiso a la cámara. Si la apagas con «Apagar cámara», no vuelve a encenderse sola.": "If you leave the camera on and open another page of this site, it turns on again by itself: nobody has to press anything. Only if you already allowed the camera. If you turn it off with 'Turn off camera', it will not turn on by itself.",
      "Cámara encendida otra vez, como la dejaste.": "Camera on again, as you left it.",
      "Toca lo que te pase y Winclus enciende lo que ayuda. Puedes tocar varios. Tócalo otra vez para quitarlo.": "Tap what happens to you and Winclus turns on what helps. You can tap several. Tap it again to remove it.",
      "No veo": "I can't see", "Una voz te lee la página": "A voice reads the page to you",
      "Confundo los colores": "I mix up colours", "Colores que se distinguen": "Colours you can tell apart",
      "Texto más grande y más contraste. Si necesitas más, di «lupa».": "Bigger text and more contrast. If you need more, say 'magnifier'.",
      "Lector encendido: la flecha abajo lee lo siguiente y la flecha arriba lo anterior. F1 te explica todas las teclas.": "Reader on: the down arrow reads the next thing and the up arrow the previous one. F1 explains all the keys.",
      "Colores corregidos para el rojo y el verde, y enlaces subrayados. En «Ver más opciones», pestaña Ver, puedes elegir otra corrección.": "Colours corrected for red and green, and links underlined. In 'More options', See tab, you can choose another correction.",
      "Avisos en pantalla cuando algo suene y subtítulos grandes en los vídeos. Para lo que se habla cerca, pulsa «Subtítulos en vivo». Si oyes algo pero poco, en «Ver más opciones», pestaña Oír, puedes subir el volumen por encima de lo normal.": "On-screen alerts when something makes a sound, and big subtitles in videos. For what is said near you, press 'Live captions'. If you hear a little, in 'More options', Hear tab, you can turn the volume up beyond normal.",
      "En esta página la cámara no está disponible. Prueba «Solo puedo pulsar un botón» o «Me cuesta escribir».": "The camera is not available on this page. Try 'I can only press one button' or 'Typing is hard'.",
      "Primero, el permiso: lee el aviso que sale aquí mismo y pulsa «Acepto y activo la cámara».": "First, the permission: read the notice right here and press 'I agree, turn on the camera'.",
      "Vamos a usar la cámara: mueve la cabeza y el puntero te sigue; cierra los ojos un momento para hacer clic.": "Let's use the camera: move your head and the pointer follows you; close your eyes for a moment to click.",
      "Winclus va marcando cada cosa con un marco azul: cuando esté en lo que quieres, pulsa tu botón.": "Winclus marks each thing in turn with a blue frame: when it is on what you want, press your button.",
      "Tablero de dibujos: toca los que quieras y pulsa Decir.": "Picture board: tap the ones you want and press Say.",
      "Tablero de dibujos cerrado.": "Picture board closed.",
      "Te muestro la página en fácil y te la leo en voz alta. Pulsa «Callar» para parar.": "Here is the page in easy words, read aloud. Press 'Stop talking' to stop.",
      "Lectura cerrada.": "Reading closed.",
      "Teclado en pantalla abierto. Pulsa un campo y escribe.": "On-screen keyboard open. Tap a field and type.",
      "Teclado cerrado.": "Keyboard closed.",
      "Modo calma: sin destellos, animaciones ni vídeos que arranquen solos.": "Calm mode: no flashing, no animations and no videos that start by themselves.",
      "Subir el volumen por encima de lo normal": "Turn the volume up beyond normal",
      "Para quien oye poco: los vídeos y audios de esta página suenan más fuerte que su volumen normal, sin que se rompa el sonido. Los vídeos de otros sitios (como YouTube) no se pueden tocar.": "For people who hear little: the videos and audio on this page play louder than their normal volume, without the sound breaking up. Videos from other sites (such as YouTube) cannot be changed.",
      "Voz más clara": "Clearer voice",
      "Si la mano tiembla con el ratón": "If your hand shakes on the mouse",
      "Para quien usa su propio ratón pero con temblor: Parkinson, temblor esencial, esclerosis múltiple.": "For people who use their own mouse but have a tremor: Parkinson's, essential tremor, multiple sclerosis.",
      "Ayudarme a pulsar con el ratón": "Help me click with the mouse",
      "Si el clic cae al lado de un botón o un enlace, Winclus pulsa el que tenías cerca (o te pregunta cuál, si hay varios). Y si el dedo pulsa dos veces sin querer, el segundo clic no cuenta.": "If the click lands next to a button or a link, Winclus presses the one you were close to (or asks which one, if there are several). And if your finger clicks twice by mistake, the second click does not count.",
      "Si ignora clics que sí querías o no llega a lo que tienes cerca.": "If it ignores clicks you did want or does not reach what is near you.",
      "Tiempo para no contar un segundo clic": "Time in which a second click does not count",
      "Si pulsas otra vez en el mismo sitio antes de este tiempo, no cuenta. Más largo: ignora más clics sin querer.": "If you click the same spot again within this time, it does not count. Longer: ignores more accidental clicks.",
      "Hasta qué distancia busca lo que tienes cerca": "How far it looks for what is near you",
      "Más grande: te ayuda aunque el clic caiga más lejos del botón.": "Bigger: it helps you even if the click lands further from the button.",
      "Ayuda con el temblor del ratón": "Help with mouse tremor",
      "Segundo clic sin querer: no cuenta": "Accidental second click: ignored",
      "Pulsado:": "Pressed:",
      "Mis frases con mi voz": "My phrases in my voice",
      "Para quien va a perder el habla (ELA, por ejemplo): grábalas ahora y Winclus las dirá con tu voz.": "For people who are going to lose their speech (ALS, for example): record them now and Winclus will say them in your voice.",
      "Frase que vas a grabar": "Phrase you are going to record", "Por ejemplo: Tengo sed": "For example: I'm thirsty",
      "● Grabar esta frase": "● Record this phrase", "■ Parar y guardar": "■ Stop and save",
      "Escribe la frase, pulsa «Grabar» y dila con tu voz; pulsa otra vez para guardarla. Cuando pulses esa frase en el teclado, en el tablero o con «Decir», sonará tu voz. Se guardan solo en este navegador: no salen de tu equipo.": "Type the phrase, press 'Record' and say it in your voice; press again to save it. When you press that phrase on the keyboard, on the board or with 'Say', your voice will play. They are kept only in this browser: they never leave your device.",
      "Todavía no has grabado ninguna frase.": "You haven't recorded any phrase yet.",
      "Oír": "Hear", "Borrar": "Delete", "Guardada:": "Saved:",
      "Frase guardada con tu voz": "Phrase saved in your voice", "Grabando… di la frase": "Recording… say the phrase",
      "Escribe primero la frase": "Type the phrase first", "Este navegador no deja grabar": "This browser does not allow recording",
      "No hay permiso para el micrófono": "No permission for the microphone",
      "Necesito ayuda": "I need help", "Toca la pantalla o pulsa una tecla para pararlo": "Touch the screen or press a key to stop it",
      "🔔 Pedir ayuda a quien esté cerca": "🔔 Call someone nearby for help", "Pedir ayuda": "Call for help", "Aviso parado": "Alert stopped",
      "Pidiendo ayuda con sonido y en toda la pantalla. Cualquier tecla, clic o gesto lo para.": "Calling for help with sound and on the whole screen. Any key, click or gesture stops it.",
      "Te ayudo con el ratón: si el clic cae al lado de un botón, pulso el que tenías cerca, y un segundo clic sin querer no cuenta.": "I will help you with the mouse: if the click lands next to a button, I press the one you were close to, and an accidental second click does not count.",
      "Quita los graves que tapan y realza las frecuencias de la voz: lo que se dice en los vídeos se entiende mejor.": "Removes the bass that masks speech and boosts voice frequencies: what is said in videos is easier to understand.",
      "Volumen subido al": "Volume raised to",
      "Este vídeo viene de otro sitio: no se puede subir su volumen": "This video comes from another site: its volume cannot be raised",
      "Quitado:": "Removed:", "Todo está como antes.": "Everything is as it was.", "Quitar": "Remove",
      "↺ Volver a como estaba": "↺ Put everything back", "⚙ Ver más opciones": "⚙ More options", "← Volver a lo sencillo": "← Back to simple",
      "Todo está como al principio.": "Everything is back to how it started.",
      "Todas las opciones, por pestañas: Ver, Oír, Cara, Clics, Escribir y Más.": "All the options, in tabs: See, Hear, Face, Clicks, Type and More.",
      "La cámara se ha vuelto a encender sola porque la dejaste encendida. Para apagarla, pulsa «Apagar cámara» en el panel; para pararla un momento, usa Pausar.": "The camera turned on again by itself because you left it on. To turn it off, press 'Turn off camera' in the panel; to stop it for a moment, use Pause.", "Escribir aquí": "Type here", "Leyendo": "Reading", "Ahí no hay tecla": "No key there", "En pausa": "Paused", "Activado": "On", "Centrado": "Centered", "Sin números": "No numbers",
      "Menú de clics": "Click menu", "Este es el menú de clics. Sale cuando tienes los ojos cerrados más de ": "This is the click menu. It appears when your eyes stay closed for more than ",
      " segundos. Mira una opción y ciérralos otra vez, o mira «Cerrar» para salir.": " seconds. Look at an option and close them again, or look at “Close” to leave.",
      "¿Se te abre este menú sin querer?": "Does this menu open by accident?", "Sí: no abrirlo con los ojos": "Yes: don't open it with my eyes", "Podrás seguir usándolo desde el panel": "You can still use it from the panel",
      "Sí: pedir más tiempo con los ojos cerrados": "Yes: ask for more time with my eyes closed", "Dos segundos y medio en vez de poco más de uno": "Two and a half seconds instead of just over one",
      "No: lo estoy usando bien": "No: I am using it on purpose", "Menú apagado": "Menu off", "Más tiempo para el menú": "More time for the menu",
      "Hecho: el menú ya no se abre con los ojos.": "Done: the menu no longer opens with your eyes.", "Hecho: ahora hay que tener los ojos cerrados dos segundos y medio.": "Done: now your eyes must stay closed for two and a half seconds.",
      "Abrir el menú de clics cerrando los ojos": "Open the click menu by closing my eyes",
      "Con los ojos cerrados un rato sale una rueda con clic derecho, doble clic, arrastrar, rueda, teclado, leer, recentrar y pausar. Si se te abre sin querer porque cierras mucho los ojos al pulsar, apágalo: el menú sigue estando en «Más».": "Closing your eyes for a while brings up a wheel with right click, double click, drag, scroll, keyboard, read, recenter and pause. If it opens by accident because you close your eyes a lot when clicking, turn it off: the menu is still in “More”.",
      "Cuánto hay que cerrar los ojos": "How long to keep my eyes closed",
      "Si al hacer clic cierras los ojos mucho rato, sube este tiempo. Winclus además lo sube solo si ve que tus clics duran casi lo mismo, para que el menú no te salga al pulsar.": "If you close your eyes for a long time when clicking, raise this. Winclus also raises it by itself if it sees your clicks last almost as long, so the menu does not pop up when you click.",
      "Si el menú se abre sin querer o cuesta abrirlo.": "If the menu opens by accident or is hard to open.",
      // --- 0.6.13: elegir con los ojos (lista de candidatos, desplegables, ayuda del clic) ---
      "¿Cuál de estos?": "Which one?", "opciones": "options", "(vacío)": "(empty)", "Elige una opción": "Choose an option",
      "enlace": "link", "botón": "button", "desplegable": "dropdown", "campo de texto": "text box", "casilla": "checkbox", "opción": "radio button", "campo": "field",
      "¿No consigues hacer clic?": "Can't manage to click?", "Pulsar quedándome quieto": "Click by staying still", "Pulsar abriendo la boca": "Click by opening my mouth", "Pulsar subiendo las cejas": "Click by raising my eyebrows", "Pulsar cerrando los ojos": "Click by closing my eyes", "Seguir igual": "Leave it as it is",
      "Llevas un rato moviendo el puntero sin pulsar nada. ¿Quieres pulsar de otra forma?": "You have been moving the pointer for a while without clicking anything. Do you want to click another way?",
      "Elegir sin acertar": "Choosing without aiming", "Con los ojos o la cara es difícil dar en un enlace pequeño: no hace falta.": "With your eyes or face it is hard to hit a small link: you don't have to.",
      "Preguntarme cuál, si hay varias cosas cerca": "Ask me which one when several things are close",
      "En vez de adivinar, Winclus enseña lo que hay alrededor del puntero (enlaces, botones, campos) en botones grandes y eliges de la lista. Los desplegables también se abren así, con todas sus opciones.": "Instead of guessing, Winclus shows what is around the pointer (links, buttons, fields) as large buttons and you pick from the list. Dropdowns open the same way, with all their options.",
      "Marcar lo que voy a pulsar": "Highlight what I am about to click",
      "Rodea con un marco azul lo que se pulsaría si hicieras el gesto ahora, para verlo antes de gastarlo.": "Draws a blue frame around what would be clicked if you made the gesture now, so you can see it before spending it.",
      "Ofrecerme otra forma de pulsar si no me sale": "Offer me another way to click if it doesn't work",
      "Si llevas un rato moviendo el puntero sin conseguir pulsar nada, Winclus te lo dice y te ofrece pulsar quedándote quieto, abriendo la boca o subiendo las cejas.": "If you have been moving the pointer for a while without managing to click, Winclus tells you and offers clicking by staying still, opening your mouth or raising your eyebrows.",
      "El puntero tiembla: dejarlo más quieto": "The pointer shakes: keep it steadier",
      "Suaviza más la mirada y ensancha la zona en la que el puntero no se mueve. Va un pelín más lento, pero se queda donde lo dejas.": "Smooths the gaze more and widens the area where the pointer does not move. A touch slower, but it stays where you leave it.",
      "Llegar a los bordes de la pantalla": "Reach the edges of the screen",
      "La calibración mide con un margen, así que mirando a una esquina el puntero se queda corto. Con esto se estira lo justo para alcanzarlas.": "Calibration measures with a margin, so looking at a corner leaves the pointer short. This stretches it just enough to reach them.",
      // --- 0.6.0: panel fácil de entender (Inicio, ayudas bajo cada opción, ajustes finos) ---
      "Inicio": "Start", "Cara": "Face", "Ajustes finos": "Fine settings", "Solo si algo no va bien. Los valores de fábrica funcionan para casi todo el mundo.": "Only if something is not right. The factory values work for almost everyone.",
      "¿Qué te cuesta?": "What is hard for you?", "Toca lo que te pase y Winclus enciende lo que ayuda. Puedes tocar varios.": "Tap what happens to you and Winclus turns on what helps. You can tap several.",
      "Veo poco": "I can't see well", "Letra grande y más contraste": "Large text and more contrast", "No oigo bien": "I can't hear well", "Avisos en pantalla y subtítulos": "On-screen alerts and captions",
      "No puedo usar el ratón": "I can't use the mouse", "Mover el puntero con la cara": "Move the pointer with your face", "Solo puedo pulsar un botón": "I can only press one button", "Winclus va marcando y tú pulsas": "Winclus highlights, you press",
      "No puedo hablar": "I can't speak", "Dibujos y frases con voz": "Pictures and spoken phrases", "Me cuesta leer o entender": "Reading or understanding is hard", "La página en fácil y en voz alta": "The page made simple and read aloud",
      "Me cuesta escribir": "Typing is hard", "Teclado en pantalla y dictado": "On-screen keyboard and dictation", "La pantalla me marea": "The screen makes me dizzy", "Sin destellos ni movimiento": "No flashes or motion",
      "Lo que tienes activado": "What you have on", "Para saber qué está haciendo Winclus ahora mismo.": "So you know what Winclus is doing right now.", "Nada todavía: la página se ve como siempre.": "Nothing yet: the page looks as usual.", "Apagar todo lo activado": "Turn everything off",
      "Texto al": "Text at", "Enlaces resaltados": "Links highlighted", "Cursor grande": "Large cursor", "Sin movimiento": "No motion", "Colores corregidos": "Colors corrected", "Modo calma": "Calm mode", "Lupa de pantalla": "Screen magnifier", "Ver solo una franja": "See only a strip", "Letras separadas": "Wider letter spacing", "Imágenes atenuadas": "Images dimmed",
      "Leer lo que se pulsa": "Read what is clicked", "Avisos cuando algo suena": "Alerts when something sounds", "Subtítulos grandes": "Large captions", "Escuchando órdenes": "Listening for commands", "Puntero con los ojos": "Pointer with the eyes", "Puntero con la cabeza": "Pointer with the head", "Barrido con un pulsador": "Single-switch scanning", "Dictado": "Dictation",
      "Todo apagado": "Everything off", "Todo apagado. La página vuelve a verse como siempre. Tus ajustes de cámara y tus frases se conservan.": "Everything off. The page looks as usual again. Your camera settings and phrases are kept.",
      "Panel sencillo": "Simple panel", "Deja solo unos pocos botones grandes: leer, callar, texto más grande, contraste, lectura limpia, lupa y cámara. Para quien se pierde con tantas opciones.": "Leaves just a few big buttons: read, stop talking, larger text, contrast, clean reading, magnifier and camera. For anyone lost among so many options.",
      "Para quien ve poco, se cansa con la pantalla o pierde el renglón.": "For anyone who sees poorly, gets tired by the screen or loses their line.", "Agranda o achica toda la letra de la página.": "Makes all the text on the page larger or smaller.",
      "Letras negras sobre fondo claro y colores más marcados, para distinguir mejor.": "Black text on a light background and stronger colors, to tell things apart.", "Fondo oscuro y letras claras: menos luz en los ojos.": "Dark background and light text: less light in your eyes.",
      "Los enlaces se ven subrayados y con fondo, para encontrarlos a la primera.": "Links are underlined and highlighted, so you find them at once.", "Una línea de color sigue al puntero para no perder el renglón que lees.": "A colored line follows the pointer so you don't lose the line you are reading.",
      "Una flecha más grande, para no perder el ratón de vista.": "A bigger arrow, so you never lose sight of the mouse.", "Quitar el movimiento": "Remove motion", "Para las animaciones y los carruseles que se mueven solos.": "Stops animations and carousels that move on their own.",
      "Para dislexia, cansancio o cuando la página tiene demasiadas cosas.": "For dyslexia, tiredness or when the page has too much going on.", "Quita menús, anuncios y adornos y deja solo el texto, grande. Desde ahí puedes oírlo o pedir que te lo explique en fácil.": "Removes menus, ads and decoration and leaves just the text, large. From there you can hear it or ask for a simple explanation.",
      "Agranda la zona de la página que está alrededor del puntero, como una lupa de verdad.": "Enlarges the part of the page around the pointer, like a real magnifying glass.", "Cuánto agranda la lupa": "How much the magnifier enlarges", "×2 es el doble de grande; ×4, cuatro veces.": "×2 is twice as big; ×4, four times.",
      "Oscurece toda la página menos una franja a la altura del puntero, para concentrarte en un renglón.": "Darkens the whole page except a strip at the pointer, so you focus on one line.", "Más aire entre letras, palabras y renglones: se leen con menos esfuerzo.": "More space between letters, words and lines: easier to read.",
      "Las imágenes se ven muy suaves, para que no distraigan del texto.": "Images become very faint, so they don't distract from the text.", "Para quien confunde colores o se marea con destellos y movimiento.": "For anyone who confuses colors or gets dizzy with flashes and motion.",
      "Si confundes colores": "If you confuse colors", "No distingo el rojo": "I can't tell red", "No distingo el verde": "I can't tell green", "No distingo el azul": "I can't tell blue", "Todo en gris": "All in gray",
      "Cambia los colores de la página para que se distingan. Prueba uno y quédate con el que mejor veas.": "Changes the page's colors so they can be told apart. Try one and keep the one you see best.",
      "Sin destellos, sin animaciones y sin vídeos que arranquen solos. Colores más suaves. Para epilepsia fotosensible, migrañas o sensibilidad.": "No flashes, no animations and no self-starting videos. Softer colors. For photosensitive epilepsy, migraines or sensitivity.",
      "Para quien prefiere oír la página o ve poco.": "For anyone who prefers to hear the page or sees poorly.", "Al pulsar un texto, un botón o un enlace, Winclus lo lee con voz.": "When you click a text, a button or a link, Winclus reads it aloud.",
      "Dice el nombre de la página, en qué parte estás y qué apartados tiene.": "Says the page's name, where you are and what sections it has.", "Para personas ciegas o con muy poca visión que no tienen instalado un lector.": "For blind or very low-vision people who don't have a screen reader installed.",
      "Lee la página con voz y se maneja con el teclado: ↓ ↑ leen, h encabezados, l enlaces, b botones, f campos, Intro activa, F1 ayuda. Si ya usas NVDA, JAWS o VoiceOver, déjalo apagado: se pisarían.": "Reads the page aloud and works from the keyboard: ↓ ↑ read, h headings, l links, b buttons, f fields, Enter activates, F1 help. If you already use NVDA, JAWS or VoiceOver, leave it off: they would clash.",
      "La voz con la que Winclus habla y dice tus frases.": "The voice Winclus speaks and says your phrases with.", "Apágala si no quieres que Winclus hable en ningún momento.": "Turn it off if you never want Winclus to speak.",
      "Menos de 0 habla más despacio; más de 0, más deprisa.": "Below 0 speaks slower; above 0, faster.", "Al escribir con el teclado en pantalla, dice cada palabra que terminas.": "When typing with the on-screen keyboard, says each word you finish.",
      "Hablar por mí": "Speak for me", "Para quien no puede hablar o no lee ni escribe bien.": "For anyone who can't speak or doesn't read or write well.",
      "Un tablero de dibujos (pictogramas ARASAAC): tocas los dibujos, se forma la frase y Winclus la dice con voz.": "A board of pictures (ARASAAC pictograms): tap the pictures, the sentence forms and Winclus says it aloud.",
      "Tus frases de siempre, una por línea (hasta 16). Aparecen en la tecla «Frases» del teclado y en el tablero, para decirlas de un toque.": "Your usual phrases, one per line (up to 16). They appear under the “Phrases” key and on the board, to say them with one tap.",
      "Mandar con la voz": "Command by voice", "Para manejar la página hablando, sin manos.": "To drive the page by speaking, hands-free.", "Para quien no oye o oye poco.": "For deaf or hard-of-hearing people.",
      "Si la página hace un sonido (un aviso, una alarma), sale un cartel para que lo veas.": "If the page makes a sound (an alert, an alarm), a sign appears so you see it.", "Subtítulos grandes en los vídeos": "Large captions on videos",
      "Si el vídeo trae subtítulos, se muestran grandes y con fondo para leerlos bien.": "If the video has captions, they are shown large and with a background so they read well.", "Ningún vídeo ni audio de la página sonará más alto que esto.": "No video or audio on the page will play louder than this.",
      "Escribe en pantalla lo que se habla cerca (una videollamada, una consulta) usando el micrófono. ": "Writes on screen what is said nearby (a video call, an appointment) using the microphone. ",
      "Para quien no puede usar el ratón con las manos.": "For anyone who can't use the mouse with their hands.", "Muestra aquí lo que ve la cámara, para comprobar que tu cara sale entera y con luz.": "Shows here what the camera sees, to check your whole face is in view and lit.",
      "Si el equipo se calienta o quieres saber qué detecta la cámara.": "If the device gets hot or you want to see what the camera detects.", "Gastar menos batería": "Use less battery", "Analiza menos imágenes por segundo: el puntero va un poco menos fino, pero el equipo se calienta menos.": "Analyzes fewer frames per second: the pointer is a bit less smooth, but the device stays cooler.",
      "Con la cabeza funciona desde el primer momento. Con los ojos hay que calibrar una vez.": "With the head it works right away. With the eyes you calibrate once.",
      "Con la cabeza: giras un poco la cabeza y el puntero va hacia allí. Con los ojos: el puntero va a donde miras.": "With the head: turn your head a little and the pointer goes that way. With the eyes: the pointer goes where you look.",
      "Cuánto recorre el puntero con cada giro de cabeza. Si se te va lejos, bájala; si no llega, súbela.": "How far the pointer travels with each head turn. If it overshoots, lower it; if it doesn't reach, raise it.",
      "Si el puntero tiembla o no responde como quieres.": "If the pointer shakes or doesn't respond as you want.", "Quietud del puntero": "Pointer steadiness", "Más alto: menos temblor, pero responde un poco más tarde.": "Higher: less shaking, but it responds a bit later.",
      "Más rápido si te mueves rápido": "Faster when you move fast", "Un giro lento mueve poco el puntero (para afinar) y uno rápido lo mueve mucho (para cruzar la pantalla).": "A slow turn moves the pointer a little (to fine-tune) and a fast one moves it a lot (to cross the screen).",
      "Cómo responden los ojos": "How the eyes respond", "Va a donde miro": "Goes where I look", "Miro y afino con la cabeza": "Look, then fine-tune with the head", "Como una palanca": "Like a joystick",
      "«Va a donde miro» es lo más directo. «Miro y afino con la cabeza» salta con la mirada y termina con un giro pequeño de cabeza: más preciso. «Como una palanca»: mirar hacia un lado empuja el puntero hacia allí y mirar al centro lo para; no necesita calibrar.": "“Goes where I look” is the most direct. “Look, then fine-tune with the head” jumps with the gaze and finishes with a small head turn: more precise. “Like a joystick”: looking to one side pushes the pointer that way and looking at the center stops it; no calibration needed.",
      "Miras unos puntos que van saliendo, sin mover la cabeza. Así Winclus aprende a dónde miras. Se hace una vez por navegador.": "You look at some dots that appear, without moving your head. That is how Winclus learns where you look. Done once per browser.",
      "Si el puntero se ha ido de sitio: mira al centro de la pantalla dos segundos y vuelve a su sitio.": "If the pointer has drifted: look at the center of the screen for two seconds and it comes back.",
      "Lupa para afinar el clic": "Magnifier to aim the click", "Con los ojos es difícil acertar en un botón pequeño: el primer gesto agranda la zona y el segundo pulsa donde miras.": "With the eyes it's hard to hit a small button: the first gesture enlarges the area and the second clicks where you look.",
      "Cuánto manda la cabeza": "How much the head controls", "Más alto: la cabeza afina más, pero el puntero se mueve más al girarla.": "Higher: the head fine-tunes more, but the pointer moves more when you turn it.",
      "Mira al centro de la pantalla: desde ahí, mirar a un lado empuja el puntero hacia ese lado.": "Look at the center of the screen: from there, looking to one side pushes the pointer that way.", "Cuánto se mueve el puntero mientras miras hacia un lado.": "How much the pointer moves while you look to one side.",
      "Si el puntero con los ojos tiembla, salta o no llega a los bordes.": "If the eye pointer shakes, jumps or doesn't reach the edges.", "Zona en la que no se mueve": "Zone where it doesn't move",
      "Mientras la mirada se queda dentro de esta zona, el puntero no se mueve. Más grande: más quieto, menos preciso.": "While your gaze stays inside this zone, the pointer doesn't move. Bigger: steadier, less precise.",
      "Distancia mínima para saltar": "Minimum distance to jump", "Si miras a un sitio más cerca que esto, el puntero no salta: lo llevas con la cabeza.": "If you look somewhere closer than this, the pointer doesn't jump: you take it there with your head.",
      "Centro que no empuja": "Center that doesn't push", "Zona alrededor del centro en la que mirar no mueve el puntero. Más grande: más fácil pararlo.": "Area around the center where looking doesn't move the pointer. Bigger: easier to stop it.",
      "Fuerza hacia arriba y abajo": "Strength up and down", "Los ojos se mueven menos en vertical que en horizontal: esto lo compensa.": "Eyes move less vertically than horizontally: this makes up for it.",
      "Para el temblor o los movimientos involuntarios.": "For tremor or involuntary movements.", "Si el puntero se queda cerca de un botón o un enlace, se pega a él solo: no hace falta acertar.": "If the pointer stays near a button or a link, it snaps to it on its own: no need to aim exactly.",
      "Si el imán se pega a lo que no quieres o no llega.": "If the snap grabs what you don't want or doesn't reach.", "Desde qué distancia se pega": "From how far it snaps", "Más grande: se pega desde más lejos.": "Bigger: snaps from farther away.",
      "El imán viene pensado para los ojos; actívalo si con la cabeza también te ayuda.": "The snap is meant for the eyes; turn it on if it also helps you with the head.",
      "Para no tener que calibrar: Winclus aprende solo.": "So you don't have to calibrate: Winclus learns by itself.", "Cada vez que haces clic con la cabeza, Winclus mira a dónde mirabas. Con unos 30 clics ya sabe usar tus ojos sin calibrar.": "Every time you click with your head, Winclus notes where you were looking. After about 30 clicks it can use your eyes without calibrating.",
      "Si quieres forzar el ajuste o empezar de cero.": "If you want to force the adjustment or start over.",
      "El gesto con el que pulsas cuando usas la cámara.": "The gesture you click with when using the camera.", "Cerrar los ojos": "Close the eyes",
      "Cerrar los ojos un momento (más que un parpadeo normal), abrir la boca, subir las cejas o dejar el puntero quieto un instante sobre lo que quieres.": "Close your eyes for a moment (longer than a normal blink), open your mouth, raise your eyebrows or hold the pointer still for an instant on what you want.",
      "Cuánto tiempo cerrar los ojos": "How long to close the eyes", "Los parpadeos normales duran menos y no cuentan. Si hace clic solo, súbelo; si no te sale, bájalo.": "Normal blinks are shorter and don't count. If it clicks by itself, raise it; if you can't make it click, lower it.",
      "Si el clic no sale o sale sin querer.": "If the click doesn't happen or happens by accident.", "Cuánto hay que cerrarlos": "How far to close them",
      "Si el clic no sale, bájalo; si se dispara solo, súbelo. Abajo ves cuánto duró tu último cierre y si contó como clic.": "If the click doesn't happen, lower it; if it fires by itself, raise it. Below you see how long your last closure lasted and whether it counted as a click.",
      "Cuánto tiempo quieto": "How long to hold still", "El puntero tiene que estar quieto este tiempo para que cuente como clic.": "The pointer must stay still this long to count as a click.",
      "Un círculo alrededor del puntero se va llenando: cuando se completa, hace clic.": "A circle around the pointer fills up: when complete, it clicks.", "Si el temblor te impide quedarte quieto.": "If tremor keeps you from holding still.",
      "Cuánto puede temblar": "How much it may shake", "Mientras el puntero no salga de esta zona, cuenta como quieto.": "As long as the pointer stays inside this zone, it counts as still.",
      "Con los ojos cerrados 1,2 s se abre el menú de clics: clic derecho, doble clic, arrastrar, rueda, teclado, leer, recentrar o pausar.": "Closing your eyes for 1.2 s opens the click menu: right click, double click, drag, scroll, keyboard, read, recenter or pause.",
      "Cada gesto de la cara puede hacer una cosa: bajar, subir, clic derecho…": "Each face gesture can do one thing: scroll down, scroll up, right click…", "Si un gesto se dispara solo o no lo reconoce.": "If a gesture fires by itself or isn't recognized.",
      "Cuánto hay que marcar el gesto": "How strongly to make the gesture", "Más alto: hay que hacer el gesto más exagerado (menos disparos sin querer).": "Higher: the gesture must be more exaggerated (fewer accidental triggers).",
      "Si mantienes el gesto de clic este tiempo, en vez de clic empieza a arrastrar.": "If you hold the click gesture this long, it starts dragging instead of clicking.", "Para saber que el clic se ha hecho.": "So you know the click happened.",
      "Un cartelito junto al puntero dice «Clic», «Arrastrando», «En pausa»…": "A small label next to the pointer says “Click”, “Dragging”, “Paused”…",
      "Para quien solo puede accionar una cosa: un pulsador, una tecla o un gesto.": "For anyone who can only operate one thing: a switch, a key or a gesture.",
      "Winclus va marcando uno a uno los botones, enlaces y campos de la página (y las teclas del teclado en pantalla). Cuando el marco está en lo que quieres, das la señal. El clic con la cara también vale. Escape lo pausa y lo reanuda.": "Winclus highlights the page's buttons, links and fields one by one (and the keys of the on-screen keyboard). When the frame is on what you want, give the signal. The face click also works. Escape pauses and resumes it.",
      "Con qué das la señal. Un pulsador normalmente hace de tecla Espacio o de clic.": "What you give the signal with. A switch usually acts as the Space key or a click.",
      "Cuánto se queda el marco en cada cosa antes de pasar a la siguiente. Si no te da tiempo, súbelo.": "How long the frame stays on each item before moving on. If you don't have enough time, raise it.", "Dice el nombre de cada cosa que va marcando, por si no la ves bien.": "Says the name of each item it highlights, in case you can't see it well.",
      "Para escribir sin el teclado de verdad: con el puntero, con la cara o con un pulsador.": "To type without a real keyboard: with the pointer, the face or a switch.",
      "Pulsa en un campo de la página y escribe con el puntero. Tiene sugerencias de palabras y las teclas «Decir», «Frases» y «Dictar».": "Click a field on the page and type with the pointer. It has word suggestions and the “Say”, “Phrases” and “Dictate” keys.",
      "Dónde sale": "Where it appears", "Qué parte de la pantalla ocupa el teclado. Más alto: teclas más grandes.": "How much of the screen the keyboard takes. Higher: bigger keys.",
      "Mientras escribes propone palabras completas para tocarlas de una vez. Aprende las que usas.": "While you type it suggests whole words to tap at once. It learns the ones you use.", "Para escribir hablando.": "To type by speaking.",
      "Pulsa en un campo, habla y se escribe lo que dices (Chrome o Edge). ": "Click a field, speak and what you say is typed (Chrome or Edge). ", "Confirmar antes de escribir lo dictado": "Confirm before typing what was dictated",
      "Te enseña lo que ha entendido y esperas a decir «sí» o «no» antes de que se escriba.": "Shows you what it understood and waits for you to say “yes” or “no” before typing it.", "Para no perderse rellenando un trámite.": "So you don't get lost filling in a form.",
      "Cuántas cosas has hecho con ayuda de Winclus. Solo cifras, sin datos personales.": "How many things you've done with Winclus's help. Only figures, no personal data.",
      "Este sitio puede recibir estas cifras y qué opciones del panel se tocan (solo números, sin nada personal) para saber cuántas personas consiguen hacer sus gestiones con Winclus y qué opciones no se entienden. Se envían una vez por semana, solo si lo activas.": "This site can receive these figures and which panel options get used (only numbers, nothing personal) to know how many people manage to complete their tasks with Winclus and which options are not understood. They are sent once a week, only if you turn it on.",
      "Mis ajustes en otro sitio": "My settings elsewhere", "Para no volver a configurarlo todo en otro navegador, otro equipo u otra página.": "So you don't set everything up again in another browser, device or page.",
      "Lo más fácil: el enlace lleva dentro tus ajustes. Ábrelo en otro equipo o guárdalo en favoritos y todo queda igual.": "The easiest way: the link carries your settings. Open it on another device or bookmark it and everything stays the same.",
      "Guardar mis ajustes en un archivo": "Save my settings to a file", "Cargar mis ajustes desde un archivo": "Load my settings from a file", "El archivo (.winclus) guarda ajustes, calibración de los ojos, frases, palabras aprendidas y tus tableros de dibujos.": "The file (.winclus) keeps settings, eye calibration, phrases, learned words and your picture boards.",
      "Empezar de cero": "Start over",
      "Aviso: mientras escuchas, el navegador envía tu voz a los servidores de Google o Microsoft para reconocerla; nada más sale de tu equipo. Más en winclus.com/privacidad.": "Notice: while listening, the browser sends your voice to Google's or Microsoft's servers to recognize it; nothing else leaves your device. More at winclus.com/privacidad.",
      "Di «baja», «sube», «clic» y el nombre de un enlace, «escribe» y el texto, «lee», «teclado», «menú», «pausa», «sigue», «ayuda»… ": "Say “down”, “up”, “click” and a link's name, “type” and the text, “read”, “keyboard”, “menu”, “pause”, “resume”, “help”… ",
      "Si te comunicas en Lengua de Señas Colombiana: el Centro de Relevo de MinTIC te pone un intérprete por videollamada, gratis.": "If you communicate in Colombian Sign Language: MinTIC's Centro de Relevo provides an interpreter by video call, free of charge.",
      "Menos": "Less", "Más": "More", "Leer esta sección en voz alta": "Read this section aloud", "🔊 Léemelo": "🔊 Read it to me", "Léemelo": "Read it to me", ": activado.": ": on.", ": desactivado.": ": off.", "Opciones: ": "Options: ", "Elegido: ": "Chosen: ", "Botón: ": "Button: ",
      "Explícame esta página en fácil": "Explain this page simply", "Quita lo que sobra y cuenta la página con palabras corrientes y frases cortas: de qué va, lo más importante y los pasos.": "Removes what is not needed and tells the page in plain words and short sentences: what it is about, the key points and the steps.", "🔊 Léeme esta página": "🔊 Read this page to me",
      "Hola, soy Winclus. Toca lo que te cuesta: veo poco, no oigo bien, no puedo usar el ratón, solo puedo pulsar un botón, no puedo hablar, me cuesta leer, me cuesta escribir o la pantalla me marea. O escríbelo con tus palabras. Cada opción del panel lleva una frase que explica qué hace.": "Hi, I'm Winclus. Tap what is hard for you: I can't see well, I can't hear well, I can't use the mouse, I can only press one button, I can't speak, reading is hard, typing is hard or the screen makes me dizzy. Or write it in your own words. Every option in the panel has a sentence explaining what it does.",
      "Toca lo que te cuesta": "Tap what is hard for you", "Confirmar": "Confirm", "¿Seguro? No se puede deshacer.": "Are you sure? This cannot be undone.", "¿Seguro?": "Are you sure?", "Sí, borrar": "Yes, delete", "No, dejarlo como está": "No, leave it as it is",
      "Tipo de letra": "Font", "La del sitio": "The site's own", "Legible": "Legible", "Para dislexia": "For dyslexia", "«Legible» es una letra clara y ancha (Verdana). «Para dislexia» es OpenDyslexic: la base de cada letra pesa más para que no bailen ni se den la vuelta.": "“Legible” is a clear, wide font (Verdana). “For dyslexia” is OpenDyslexic: the bottom of each letter is heavier so letters don't swim or flip.",
      "Espacio entre renglones": "Line spacing", "100 % es el del sitio. 150 % es lo que recomiendan las normas para leer con menos esfuerzo.": "100 % is the site's own. 150 % is what the guidelines recommend for easier reading.", "Texto alineado a la izquierda": "Left-aligned text", "Quita el texto justificado: los huecos entre palabras dejan de ser desiguales y la vista no se pierde.": "Removes justified text: the gaps between words stop being uneven and your eyes don't get lost.",
      "▼ Bajar": "▼ Down", "▲ Subir": "▲ Up", "Usar los gestos de la cara": "Use face gestures", "Si la página se mueve o pasan cosas sin querer al hablar, bostezar o respirar, apaga esto: los gestos dejan de hacer nada. El gesto con el que haces clic sigue funcionando.": "If the page moves or things happen by accident when you talk, yawn or breathe, turn this off: the gestures stop doing anything. The gesture you click with keeps working.",
      "Gestos de la cara apagados": "Face gestures off", "La página se mueve porque tienes el gesto puesto en «": "The page is moving because your gesture is set to “", "». Se cambia en Clics.": "”. You can change it in Clicks.", "La página se mueve por el gesto de la cara. Si no lo quieres, apaga «Usar los gestos de la cara» en la pestaña Clics.": "The page is moving because of the face gesture. If you don't want that, turn off “Use face gestures” in the Clicks tab.",
"Bajar y subir llevando el puntero al borde": "Scroll by moving the pointer to the edge", "Lleva el puntero a la parte de abajo de la pantalla, donde pone «Bajar», y la página baja sola; arriba, donde pone «Subir», sube. Apártalo y para. También bajas abriendo la boca y subes con las cejas, o diciendo «baja» y «sube».": "Move the pointer to the bottom of the screen, where it says “Down”, and the page scrolls down by itself; to the top, where it says “Up”, it scrolls up. Move it away and it stops. You can also scroll down by opening your mouth and up with your eyebrows, or by saying “down” and “up”.",
      "Bajando: aparta el puntero del borde para parar": "Scrolling down: move the pointer away from the edge to stop", "Subiendo: aparta el puntero del borde para parar": "Scrolling up: move the pointer away from the edge to stop", "Bajando. Aparta el puntero del borde para parar.": "Scrolling down. Move the pointer away from the edge to stop.", "Subiendo. Aparta el puntero del borde para parar.": "Scrolling up. Move the pointer away from the edge to stop.",
      "Otro aparato mueve el puntero": "Another device moves the pointer", "Si ya tienes un rastreador de mirada (Tobii, Windows Eye Control) o cualquier aparato que mueva el puntero, márcalo: Winclus no lo toca y pone encima el clic por parpadeo, los gestos, el menú, el teclado y la voz.": "If you already have an eye tracker (Tobii, Windows Eye Control) or any device that moves the pointer, turn this on: Winclus leaves the pointer alone and adds the blink click, gestures, menu, keyboard and voice on top.",
      "Puntero de otro aparato, clics con la cara": "Pointer from another device, clicks with the face", "Calibrar los ojos (unos 30 s)": "Calibrate the eyes (about 30 s)", "Calibrar los ojos (unos 40 s)": "Calibrate the eyes (about 40 s)", "Calibrar los ojos (unos 70 s)": "Calibrate the eyes (about 70 s)",
      "Cómo de larga es la calibración": "How long the calibration is", "Rápida": "Quick", "Completa": "Full", "Rápida: 9 puntos, 30 segundos. Normal: 13 puntos, 40 segundos. Completa: 25 puntos, 70 segundos y más precisión.": "Quick: 9 points, 30 seconds. Normal: 13 points, 40 seconds. Full: 25 points, 70 seconds and more precision.",
      "Más tiempo en cada punto": "More time on each point", "Si no te da tiempo a llegar con la vista a cada punto.": "If you don't have time to reach each point with your eyes.", "Punto más grande": "Bigger point", "Para quien ve peor el punto naranja.": "For anyone who sees the orange point poorly.",
      "Paso final de compensación de cabeza": "Final head-compensation step", "Al terminar, miras el centro moviendo un poco la cabeza: Winclus aprende a corregir el puntero cuando la cabeza no está exactamente como al calibrar. Se guarda solo si mejora, y dice cuánto.": "At the end you look at the center while moving your head a little: Winclus learns to correct the pointer when your head is not exactly as it was when calibrating. It is kept only if it helps, and says by how much.",
      "Descargar NVDA (lector gratuito para Windows)": "Download NVDA (free screen reader for Windows)", "NVDA lee todo el sistema, no solo esta página: es gratis y de código abierto. Si lo instalas, deja apagado el lector de Winclus.": "NVDA reads the whole system, not just this page: it is free and open source. If you install it, leave the Winclus reader off.",
      "Guiñar el ojo izquierdo": "Wink the left eye", "Guiñar el ojo derecho": "Wink the right eye", "Inclinar la cabeza a la izquierda": "Tilt the head to the left", "Inclinar la cabeza a la derecha": "Tilt the head to the right",
      "Tipos de palabra": "Word types", "Nombres": "Nouns", "Cualidades": "Qualities", "Por reglas, aproximado": "By rules, approximate", "Nombres en azul, acciones en verde, cualidades en naranja": "Nouns in blue, actions in green, qualities in orange", "Colores quitados": "Colors removed",
      "En tres frases": "In three sentences", "Compruebo que lo entendí": "I check that I understood", "¿Qué palabra falta?": "Which word is missing?", "Ver respuesta": "Show answer",
      "Cuánto explica el lector": "How much the reader explains", "Mucho": "A lot", "Normal": "Normal", "Poco": "A little", "«Mucho»: dice qué es cada cosa, su nombre y qué tecla pulsar. «Normal»: qué es y su nombre. «Poco»: el nombre y una palabra, para quien ya se lo sabe.": "“A lot”: says what each thing is, its name and which key to press. “Normal”: what it is and its name. “A little”: the name and one word, for those who already know.",
      "Tono de la voz": "Voice pitch", "Menos de 0 suena más grave; más de 0, más agudo.": "Below 0 sounds deeper; above 0, higher.",
      "Lee la página con voz y se maneja con el teclado: ↓ ↑ leen, ← → letra a letra, h encabezados, l enlaces, b botones, f campos, d zonas, t tablas (Ctrl+Alt+flechas por las celdas), a listas, r lee todo, Ctrl+F busca, Intro activa, F1 ayuda. Dice los estados (marcado, obligatorio, no válido) y los avisos que cambian solos. Si ya usas NVDA, JAWS o VoiceOver, déjalo apagado: se pisarían.": "Reads the page aloud and is driven from the keyboard: ↓ ↑ read, ← → letter by letter, h headings, l links, b buttons, f fields, d zones, t tables (Ctrl+Alt+arrows through the cells), a lists, r reads everything, Ctrl+F searches, Enter activates, F1 help. It says states (checked, required, invalid) and the alerts that change on their own. If you already use NVDA, JAWS or VoiceOver, leave it off: they would clash.",
      "Buscar en la página": "Find in page", "Siguiente": "Next", "Anterior": "Previous",
      "Temas": "Topics", "Palabras": "Words", "Míos": "Mine", "Cómo es": "What it's like", "Cosas": "Things", "Tiempo": "Time", "Preguntas y enlaces": "Questions and links", "Sociales": "Social", "Tableros": "Boards",
      "Frases bien dichas": "Well-formed sentences", "Al juntar dibujos, Winclus pone el verbo como toca («yo querer comer» se dice «yo quiero comer») y ajusta «cansado» o «cansada» según quién habla.": "When you put pictures together, Winclus conjugates the verb (“yo querer comer” is said as “yo quiero comer”) and adjusts “cansado” or “cansada” depending on who is speaking.",
      "Cuando hablo de mí": "When I talk about myself", "Sin cambiar": "Unchanged", "En masculino": "Masculine", "En femenino": "Feminine", "Para que «yo estar cansado» se diga «estoy cansado» o «estoy cansada», como tú prefieras.": "So that “yo estar cansado” is said as “estoy cansado” or “estoy cansada”, whichever you prefer.",
      "Un tablero de dibujos (pictogramas ARASAAC): tocas los dibujos, se forma la frase y Winclus la dice con voz. Tiene temas, las palabras de todos los días por colores, tus propios tableros (con fotos) y un buscador con más de 12 000 dibujos.": "A board of pictures (ARASAAC pictograms): tap the pictures, the sentence forms and Winclus says it aloud. It has topics, everyday words by color, your own boards (with photos) and a search with more than 12,000 pictures.",
      "Nombre del tablero nuevo": "Name of the new board", "Crear tablero": "Create board", "Añadir dibujo de ARASAAC": "Add an ARASAAC picture", "Añadir foto": "Add a photo", "Palabra sin dibujo": "Word without a picture", "Añadir palabra": "Add a word", "Quitar dibujos": "Remove pictures", "Dejar de quitar": "Stop removing", "Compartir tablero": "Share board", "Cargar tablero de archivo": "Load a board from a file", "Borrar este tablero": "Delete this board", "¿Seguro? Toca otra vez para borrarlo": "Sure? Tap again to delete it",
      "Todavía no tienes tableros. Escribe un nombre arriba y pulsa «Crear tablero»; luego añade dibujos de ARASAAC, fotos o palabras.": "You have no boards yet. Type a name above and press “Create board”; then add ARASAAC pictures, photos or words.", "Este tablero está vacío. Añade dibujos de ARASAAC, fotos o palabras con los botones de arriba.": "This board is empty. Add ARASAAC pictures, photos or words with the buttons above.",
      "Toca un dibujo para añadirlo a «": "Tap a picture to add it to “", "Añadido a «": "Added to “", "Añadido.": "Added.", "Máximo 12 tableros": "12 boards at most", "Máximo 60 dibujos por tablero": "60 pictures per board at most", "Escribe un nombre": "Type a name", "Tablero creado": "Board created", "Tablero borrado": "Board deleted", "Quitado": "Removed", "Toca un dibujo para quitarlo": "Tap a picture to remove it", "Listo": "Done",
      "No se pudo usar la foto": "The photo could not be used", "Archivo guardado y enlace copiado": "File saved and link copied", "Archivo guardado": "File saved", "Archivo guardado (con fotos no cabe en un enlace)": "File saved (with photos it does not fit in a link)", "No se pudo leer el tablero": "The board could not be read", "Tablero cargado: ": "Board loaded: ", "El enlace no traía un tablero válido": "The link did not carry a valid board",
      "Palabra que buscar en ARASAAC": "Word to search in ARASAAC", "Escribe una palabra (casa, médico, jugar…)": "Type a word (house, doctor, play…)", "Buscar en ARASAAC": "Search ARASAAC", "Más de 12 000 dibujos. La palabra se envía a arasaac.org para buscarla.": "More than 12,000 pictures. The word is sent to arasaac.org to look it up.", "Escribe una palabra": "Type a word", "Este navegador no puede buscar": "This browser cannot search", "Buscando…": "Searching…", "dibujos": "pictures", "dibujos para": "pictures for", "Sin conexión con ARASAAC: solo la palabra": "No connection to ARASAAC: only the word",
      "Lo que más dices:": "What you say most:", "Tablero guardado en un archivo y enlace copiado. Quien abra el enlace tendrá el tablero.": "Board saved to a file and link copied. Whoever opens the link will have the board.", "Tablero guardado en un archivo. Pásalo a quien quieras y que lo cargue con «Cargar tablero de archivo».": "Board saved to a file. Give it to anyone and have them load it with “Load a board from a file”.",
      "Cómo avanza el marco": "How the frame moves", "Solo, cada cierto tiempo": "By itself, every so often", "Con dos pulsadores": "With two switches", "«Solo»: el marco pasa de una cosa a otra cada cierto tiempo y tú das la señal. «Con dos pulsadores»: una señal mueve el marco y la otra elige, sin tiempos.": "“By itself”: the frame moves from one item to the next every so often and you give the signal. “With two switches”: one signal moves the frame and the other chooses, with no timing.",
      "Señal para elegir": "Signal to choose", "Flecha derecha o abajo": "Right or down arrow", "Con dos pulsadores: la «Señal» de arriba mueve el marco y esta elige. Tienen que ser distintas. El clic con la cara siempre elige.": "With two switches: the “Signal” above moves the frame and this one chooses. They must be different. The face click always chooses.",
      "Barrer por zonas": "Scan by zones", "Primero marca las zonas de la página (menú, cabecera, contenido, pie) y, al elegir una, sus botones y enlaces. Menos pasos en páginas largas. Dos vueltas sin elegir y vuelve a las zonas.": "First it marks the page zones (menu, header, content, footer) and, once you choose one, its buttons and links. Fewer steps on long pages. Two rounds without choosing and it goes back to the zones.",
      "Poder tocar cualquier punto": "Be able to tap any point", "Añade «Cualquier punto» al barrido: una línea baja por la pantalla y la paras con la señal; otra cruza de lado a lado y la paras; ahí se hace clic. Para mapas y cosas sin botones.": "Adds “Any point” to the scan: a line moves down the screen and you stop it with the signal; another crosses from side to side and you stop it; a click happens there. For maps and things without buttons.",
      "Menú de acciones al elegir": "Action menu when choosing", "Al elegir algo de la página, en vez de hacer clic sale un menú: clic, clic largo, arrastrar, leer o escribir. Para quien necesita más que el clic.": "When you choose something on the page, instead of clicking a menu appears: click, long click, drag, read or type. For anyone who needs more than a click.",
      "Acelerar solo": "Speed up by itself", "Cada acierto baja un poco el tiempo; si el marco da una vuelta entera sin que elijas, sube. Nunca baja de la mitad del tiempo que pongas.": "Each hit lowers the time a little; if the frame goes a full round without you choosing, it rises. It never drops below half the time you set.",
      "Barrido con dos pulsadores": "Scanning with two switches", "Cualquier punto": "Any point", "Zona: ": "Zone: ", "Zona": "Zone", "elementos": "items", "menú": "menu", "cabecera": "header", "contenido": "content", "lateral": "sidebar", "pie": "footer", "formulario": "form", "resto": "rest", "página": "page", "Vuelvo a las zonas": "Back to the zones",
      "Más rápido: ": "Faster: ", "Más despacio: ": "Slower: ", "Qué hacer con ": "What to do with ", "Clic largo": "Long click", "Arrastrar": "Drag", "Leer": "Read", "Cancelar": "Cancel", "Cancelado": "Cancelled", "Arrastrando: elige dónde soltar": "Dragging: choose where to drop", "Soltado": "Dropped",
      "Da la señal cuando la línea esté a la altura": "Give the signal when the line is at the right height", "Ahora, cuando cruce": "Now, when it crosses", "Punto de barrido. Da la señal cuando la línea baje hasta donde quieres; después otra vez cuando cruce.": "Point scanning. Give the signal when the line comes down to where you want; then again when it crosses.",
      "Barrido con dos pulsadores activado. Una señal mueve el marco azul y la otra elige.": "Scanning with two switches on. One signal moves the blue frame and the other chooses.",
      "Resaltar títulos": "Highlight headings", "Los títulos de la página llevan fondo y borde: se ve de un vistazo dónde empieza cada parte.": "The page headings get a background and a border: you can see at a glance where each part starts.",
      "Resaltar dónde estás": "Highlight where you are", "Un marco grueso rodea el botón o el campo en el que estás, al llegar con Tab o con el puntero.": "A thick frame surrounds the button or field you are on, whether you got there with Tab or with the pointer.",
      "Silenciar la página": "Mute the page", "Deja sin sonido todos los vídeos y audios de la página, también los que arranquen después. Los vídeos incrustados de otros sitios (como YouTube) no se pueden silenciar desde aquí.": "Mutes every video and audio on the page, including those that start later. Videos embedded from other sites (such as YouTube) cannot be muted from here.",
      "Diccionario al tocar una palabra": "Dictionary when you tap a word", "Toca una palabra y sale qué significa, con un dibujo si lo hay. Mira en el glosario de este sitio, en ARASAAC y en Wikcionario (la palabra se envía a esos sitios para buscarla). En «Lectura limpia» también, y allí el botón «Sílabas» colorea cada sílaba.": "Tap a word and its meaning appears, with a picture when there is one. It looks in this site's glossary, in ARASAAC and in Wiktionary (the word is sent to those sites to look it up). It works in “Clean reading” too, where the “Syllables” button colors each syllable.",
      "Títulos resaltados": "Headings highlighted", "Foco resaltado": "Focus highlighted", "Página en silencio": "Page muted", "Diccionario al tocar": "Tap-to-define dictionary",
      "Buscando qué significa…": "Looking up what it means…", "No encontré qué significa. Prueba con la palabra en singular o sin terminación.": "I couldn't find what it means. Try the word in singular or without its ending.", "No encontré qué significa.": "I couldn't find what it means.",
      "Fuente: ": "Source: ", "dibujo de ARASAAC": "picture from ARASAAC", "el glosario de este sitio": "this site's glossary", "Wikcionario": "Wiktionary", "Diccionario": "Dictionary", "Sílabas con color": "Syllables in color", "Sílabas quitadas": "Syllables removed",
      "palabras buscadas en el diccionario": "words looked up in the dictionary", "textos separados en sílabas": "texts split into syllables",
      "Zoom de toda la página": "Zoom the whole page", "Agranda todo a la vez: letra, botones e imágenes. «Tamaño del texto» solo agranda la letra.": "Enlarges everything at once: text, buttons and images. “Text size” only enlarges the text.", "Texto a la izquierda": "Left-aligned text", "Zoom de la página": "Page zoom",
      "Colores de la página": "Page colors", "Los del sitio": "The site's own", "Amarillo sobre negro": "Yellow on black", "Negro sobre crema": "Black on cream", "Azul oscuro sobre blanco": "Dark blue on white", "Los que yo elija": "My own choice", "Cambia el color de todo el texto y del fondo. Para quien lee mejor con una combinación concreta. «Los que yo elija» deja escoger cualquiera.": "Changes the color of all the text and the background. For anyone who reads better with a specific combination. “My own choice” lets you pick any.", "Texto": "Text", "Fondo": "Background", "Lo que más tocas del panel: ": "What you use most in the panel: ", "Boca a la derecha": "Mouth to the right", "Boca a la izquierda": "Mouth to the left", "Fruncir los labios": "Pucker lips", "Sonreír": "Smile", "Meter el labio de abajo": "Tuck in lower lip",
      "Desactivada.": "Off.", "Aprendiendo: ": "Learning: ", " de 30 clics. Usa el puntero con la cabeza y haz clic por toda la página; con 30 calibrará los ojos sola.": " of 30 clicks. Use the pointer with your head and click all over the page; at 30 it will calibrate the eyes by itself.", " clics guardados.": " clicks saved.", " clics guardados. ": " clicks saved. ", "Aprendida de tus clics.": "Learned from your clicks.", "Afinada con tus clics.": "Refined with your clicks.",
      "Ojos calibrados": "Eyes calibrated", " (error unos ": " (error about ", " px)": " px)", ", aprendida de tus clics": ", learned from your clicks", ", afinada con tus clics": ", refined with your clicks", "Sin calibrar: mientras tanto el puntero irá con la cabeza (o calibra con 30 clics, ver abajo).": "Not calibrated: meanwhile the pointer follows your head (or calibrate with 30 clicks, see below).",
      "Todavía no hay cifras de uso en este navegador.": "No usage figures in this browser yet.", "Uso de Winclus en este navegador desde el ": "Winclus usage in this browser since ", " (sitio: ": " (site: ",
      "clics hechos con la cara": "clicks made with the face", "acciones con el barrido": "actions with scanning", "frases dichas con voz": "phrases said aloud", "frases dichas con pictogramas": "phrases said with pictograms", "veces que se abrió el teclado": "times the keyboard was opened", "dictados escritos": "dictations typed", "errores de formulario explicados": "form errors explained", "Si algo se ha descolocado y quieres volver a como estaba al principio.": "If something got out of place and you want it back the way it was at first."
    }
  };
  try { if (window.WinclusIdiomas) for (var idi in window.WinclusIdiomas) DICC[idi] = Object.assign(DICC[idi] || {}, window.WinclusIdiomas[idi]); } catch (e) {}
  var IDIOMA_UI = ((script && script.dataset.ui) || IDIOMA_PAGINA).split("-")[0].toLowerCase();
  if (!DICC[IDIOMA_UI] && IDIOMA_UI !== "es") IDIOMA_UI = "es";
  function T(s) { var d = DICC[IDIOMA_UI]; return (d && typeof s === "string" && d[s]) || s; }
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(ajustes)); } catch (e) {} }
  function leerJSON(clave, defecto) { try { var v = JSON.parse(localStorage.getItem(clave)); return v == null ? defecto : v; } catch (e) { return defecto; } }
  function escribirJSON(clave, valor) { try { if (valor == null) localStorage.removeItem(clave); else localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) {} }

  // -------------------------------------------------------------- estilo --
  var LOGO = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M14 22 34 78" stroke="#2743B4" stroke-width="20" stroke-linecap="round"/><path d="M42 30 62 82" stroke="#1AA89A" stroke-width="18" stroke-linecap="round"/><path d="M80 52 72 76" stroke="#34C26B" stroke-width="15" stroke-linecap="round"/><circle cx="76" cy="30" r="10" fill="#6B4FC2"/></svg>';
  var css = ''
    + '.wcl-root{position:fixed;left:0;top:0;width:0;height:0;z-index:2147483000;font:15px/1.45 "Segoe UI",system-ui,sans-serif;color:#101F3D}'
    + '.wcl-root *{box-sizing:border-box}'
    + '.wcl-btn{position:fixed;bottom:22px;' + LADO + ':22px;z-index:2147483010;width:60px;height:60px;border-radius:50%;border:0;background:' + opciones.color + ';box-shadow:0 8px 24px rgba(16,31,61,.35);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}'
    + '.wcl-btn svg{width:34px;height:34px}.wcl-btn:focus-visible{outline:3px solid #2743B4;outline-offset:3px;box-shadow:0 0 0 3px #fff}'
    + '.wcl-pausa{position:fixed;bottom:30px;' + LADO + ':92px;z-index:2147483010;display:none;min-height:44px;padding:8px 16px;border-radius:999px;border:0;background:#0A5C54;color:#fff;font:700 15px "Segoe UI",system-ui,sans-serif;box-shadow:0 6px 18px rgba(16,31,61,.3);cursor:pointer}'
    + '.wcl-pausa.en-pausa{background:#F2B705;color:#101F3D}'
    + '.wcl-pausa{max-width:calc(100vw - 120px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.wcl-panel{position:fixed;bottom:92px;' + LADO + ':22px;z-index:2147483011;width:360px;max-width:calc(100vw - 32px);max-height:calc(100vh - 120px);overflow:auto;background:#fff;color:#101F3D;border-radius:18px;box-shadow:0 18px 60px rgba(16,31,61,.28);display:none}'
    + '.wcl-panel.abierto{display:block}'
    + '.wcl-cab{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#101F3D;color:#fff;border-radius:18px 18px 0 0;position:sticky;top:0;z-index:2}'
    + '.wcl-cab svg{width:26px;height:26px}.wcl-cab b{flex:1;font-size:16px}.wcl-cab button{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;width:44px;height:44px;border-radius:8px}.wcl-cab button:hover{background:rgba(255,255,255,.15)}'
    + '.wcl-tabs{display:flex;background:#E8ECF3;position:sticky;top:64px;z-index:2}.wcl-tabs button{flex:1;min-height:44px;border:0;background:transparent;font:600 13px "Segoe UI",system-ui,sans-serif;color:#3F4B66;cursor:pointer;border-bottom:3px solid transparent}.wcl-tabs button[aria-selected="true"]{color:#2743B4;border-bottom-color:#2743B4;background:#fff}'
    + '.wcl-tab{display:none}.wcl-tab.activa{display:block}'
    + '.wcl-sec{padding:12px 16px;border-bottom:1px solid #E3E8F0}.wcl-sec h2{margin:0 0 6px;padding:0;border:0;background:none;font-family:inherit;font-weight:700;line-height:1.3;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#3F4B66}'
    + '.wcl-fila{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0}.wcl-fila>label,.wcl-fila>span:first-child{flex:1}'
    // Ayudas en palabras corrientes: bajo cada control (.wcl-ayuda), al principio de cada sección (.wcl-intro)
    + '.wcl-fila.con-ayuda{flex-wrap:wrap;row-gap:2px;padding-bottom:8px}.wcl-ayuda{flex-basis:100%;font-size:13px;line-height:1.35;color:#3F4B66}.wcl-intro{font-size:14px;line-height:1.4;color:#101F3D;margin:0 0 8px}'
    // Ajustes finos plegados: un solo botón que dice cuándo abrirlos
    + '.wcl-fino{margin:6px 0 2px;border:1px solid #D5DBE7;border-radius:12px;padding:0 12px}.wcl-fino summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-weight:700;font-size:14px;color:#2743B4;list-style:none}.wcl-fino summary::-webkit-details-marker{display:none}.wcl-fino summary::before{content:"▸";margin-right:8px;font-size:16px}.wcl-fino[open] summary::before{content:"▾"}.wcl-fino summary:focus-visible{outline:3px solid #2743B4;outline-offset:-3px}.wcl-fino>.wcl-ayuda{margin:-4px 0 6px}.wcl-fino[open]{padding-bottom:6px}'
    // Inicio: botones por situación («Veo poco», «No oigo bien»…) y lista de lo que está activado
    + '.wcl-situ{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0 10px}.wcl-situ button{min-height:64px;padding:8px 10px;border-radius:12px;border:2px solid #D5DBE7;background:#fff;color:#101F3D;font:700 14px/1.2 "Segoe UI",system-ui,sans-serif;cursor:pointer;text-align:left;display:flex;flex-direction:column;justify-content:center;gap:3px}.wcl-situ button:hover{border-color:#2743B4;background:#F3F5F9}.wcl-situ button small{display:block;font-weight:400;font-size:12px;color:#3F4B66}.wcl-situ button .ico{font-size:20px;line-height:1}'
    + '.wcl-situ button .ico img{width:40px;height:40px;display:block;border-radius:8px}'
    // Puesta: borde y fondo verdes y ✓ arriba a la derecha (la forma, no solo el color: el ✓ lo ve quien no distingue el verde)
    + '.wcl-situ button{position:relative}.wcl-situ button[aria-pressed="true"]{border-color:#1B6B3E;background:#E5F4EA}.wcl-situ button[aria-pressed="true"]::after{content:"✓";position:absolute;top:4px;right:8px;font-size:20px;font-weight:700;color:#1B6B3E}'
    // Vista sencilla: solo «¿Qué te cuesta?»; las pestañas salen con «Ver más opciones». Pie fijo abajo con la respuesta y los dos botones de siempre
    + '.wcl-panel.sencillo .wcl-tabs{display:none}.wcl-pie{position:sticky;bottom:0;z-index:2;background:#fff;border-top:1px solid #D5DBE7;padding:8px 14px 10px}'
    + '.wcl-listo{display:flex;align-items:flex-start;gap:8px}.wcl-listo .wcl-estado{flex:1;margin:0 0 6px}.wcl-listo .wcl-estado:empty{display:none}.wcl-quitar{min-height:44px;min-width:44px;padding:0 12px;border-radius:10px;border:2px solid #101F3D;background:#fff;color:#101F3D;font-weight:700;cursor:pointer}'
    + '.wcl-ayuda-grande{position:fixed;inset:0;z-index:2147483647;background:#B3261E;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:24px;font:700 clamp(40px,9vw,120px)/1.1 "Segoe UI",system-ui,sans-serif}.wcl-ayuda-grande span{font-size:clamp(18px,3vw,28px);font-weight:600}'
    + '#wcl-grab-texto{min-height:44px;box-sizing:border-box}'
    + '.wcl-pie-fila{display:flex;gap:6px}.wcl-pie-fila .wcl-big{flex:1;margin:0;font-size:14px;min-height:48px;padding:0 6px}.wcl-panel.facil .wcl-pie-fila{display:none}'
    // Primera vez: los botones de situación laten tres veces mientras la voz dice qué hacer
    + '@keyframes wcl-late{0%,100%{box-shadow:0 0 0 0 rgba(47,79,216,0)}50%{box-shadow:0 0 0 6px rgba(47,79,216,.35)}}.wcl-situ.destacar button{animation:wcl-late 1s 3}html.wcl-calma .wcl-situ.destacar button,html.wcl-anim .wcl-situ.destacar button{animation:none;border-color:#2743B4}'
    // «Léemelo»: en la cabecera de cada sección
    + '.wcl-sec h2{display:flex;align-items:center;justify-content:space-between;gap:8px}.wcl-leeme{min-height:44px;padding:0 10px;border-radius:999px;border:1px solid #8892A6;background:#fff;color:#101F3D;font:600 12px "Segoe UI",system-ui,sans-serif;text-transform:none;letter-spacing:0;cursor:pointer}.wcl-leeme:hover{background:#E8F7F3}'
    + '.wcl-confirma{border:2px solid #C8433B;border-radius:12px;padding:8px 12px;margin:4px 0}.wcl-confirma .wcl-big{margin:4px 0}'
    + '.wcl-fila.colores{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:8px 10px;align-items:center}.wcl-color{width:100%;min-width:44px;height:44px;border:1px solid #8892A6;border-radius:10px;padding:2px;background:#fff;cursor:pointer}'
    + '.wcl-activo{margin:0;padding:0;list-style:none}.wcl-activo li{display:flex;align-items:center;gap:8px;min-height:32px;font-size:14px}.wcl-activo li::before{content:"";width:10px;height:10px;border-radius:50%;background:#0A5C54;flex:none}.wcl-activo li.nada::before{background:#8892A6}'
    // El interruptor se ve de 46×26 pero se pulsa en 46×44 (AAA 2.5.5): el borde transparente amplía la zona sin cambiar el dibujo
    + '.wcl-sw{position:relative;width:46px;height:26px;border-radius:999px;background:#8892A6;border:9px solid transparent;box-sizing:content-box;background-clip:padding-box;cursor:pointer;flex:none;padding:0}.wcl-sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s}.wcl-sw[aria-checked="true"]{background:#0A5C54}.wcl-sw[aria-checked="true"]::after{left:23px}.wcl-sw:focus-visible{outline:3px solid #2743B4;outline-offset:2px}'
    + '.wcl-mm{display:flex;gap:6px;align-items:center}.wcl-mm button{width:44px;height:44px;border-radius:10px;border:1px solid #8892A6;background:#fff;font-size:18px;cursor:pointer;color:#101F3D}.wcl-mm span{min-width:52px;text-align:center;font-weight:600;font-size:14px}'
    + '.wcl-opc{display:flex;flex-wrap:wrap;gap:6px;padding:4px 0 6px}.wcl-opc button{min-height:44px;padding:0 12px;border-radius:10px;border:1px solid #8892A6;background:#fff;color:#101F3D;font:600 13px "Segoe UI",system-ui,sans-serif;cursor:pointer}.wcl-opc button[aria-pressed="true"]{background:#2743B4;border-color:#2743B4;color:#fff}'
    + '.wcl-sel{width:100%;min-height:38px;border-radius:10px;border:1px solid #8892A6;padding:0 8px;font:14px "Segoe UI",system-ui,sans-serif;background:#fff;color:#101F3D}'
    + '.wcl-estado{font-size:13px;color:#3F4B66;min-height:18px;padding:2px 0}'
    + '.wcl-big{width:100%;min-height:46px;border-radius:12px;border:0;background:#34C26B;color:#101F3D;font-weight:700;font-size:15px;cursor:pointer;margin:4px 0}.wcl-big.rojo{background:#F2B705}.wcl-big.suave{background:#E8F7F3}.wcl-big.azul{background:#2743B4;color:#fff}'
    + '.wcl-pie{padding:12px 16px;font-size:13px;color:#3F4B66}.wcl-pie a{color:#2743B4}'
    + '.wcl-area{width:100%;min-height:120px;border-radius:10px;border:1px solid #8892A6;padding:8px;font:14px "Segoe UI",system-ui,sans-serif;resize:vertical}'
    + '.wcl-cam-vista{position:relative;width:100%;aspect-ratio:4/3;background:#101F3D;border-radius:12px;overflow:hidden;display:none}.wcl-cam-vista canvas{width:100%;height:100%;display:block}'
    + '.wcl-cursor{position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #2743B4;background:rgba(47,79,216,.18);z-index:2147483020;pointer-events:none;display:none}'
    + '.wcl-cursor::after{content:"";position:absolute;left:11px;top:11px;width:6px;height:6px;border-radius:50%;background:#2743B4}'
    + '.wcl-cursor.clic{background:rgba(52,194,107,.5);border-color:#34C26B}.wcl-cursor.arrastre{border-color:#F2B705;background:rgba(242,183,5,.3)}'
    + '.wcl-anillo{position:absolute;left:-9px;top:-9px;width:46px;height:46px;pointer-events:none;display:none}'
    + '.wcl-aviso{position:fixed;left:0;top:0;z-index:2147483021;pointer-events:none;display:none;padding:6px 12px;border-radius:999px;background:#101F3D;color:#fff;font:700 14px "Segoe UI",system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3);white-space:nowrap;transform:translate(24px,24px)}.wcl-aviso.ambar{background:#F2B705;color:#101F3D}'
    + '.wcl-guia{position:fixed;left:0;right:0;height:38px;margin-top:-19px;background:rgba(242,183,5,.18);border-top:2px solid #F2B705;border-bottom:2px solid #F2B705;pointer-events:none;z-index:2147482999;display:none}'
    + '.wcl-video{position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px}'
    + '.wcl-menu{position:fixed;z-index:2147483015;display:none;pointer-events:none}.wcl-menu svg{display:block;overflow:visible}.wcl-menu path,.wcl-menu circle{fill:#fff;stroke:#8892A6;stroke-width:2}.wcl-menu .hov{fill:#2743B4;stroke:#2743B4}.wcl-menu text{font:700 13px "Segoe UI",system-ui,sans-serif;fill:#101F3D;text-anchor:middle;dominant-baseline:middle;pointer-events:none}.wcl-menu .hov+text{fill:#fff}.wcl-menu .centro text{fill:#3F4B66;font-weight:400}'
    + '.wcl-tec{position:fixed;left:0;right:0;z-index:2147483012;display:none;background:#F3F5F9;border-top:2px solid #8892A6;padding:6px;user-select:none;-webkit-user-select:none}.wcl-tec.arriba{border-top:0;border-bottom:2px solid #8892A6}.wcl-tec.visible{display:flex;flex-direction:column;gap:6px}'
    + '.wcl-tec .fila{display:flex;gap:6px;flex:1;min-height:0}.wcl-tec .fila.sug{flex:.75}'
    + '.wcl-tec button{flex:1 1 0;min-width:0;border-radius:10px;border:1px solid #7E8A9E;background:#fff;color:#101F3D;font:22px "Segoe UI",system-ui,sans-serif;cursor:pointer;padding:0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.wcl-tec button.esp{background:#E8ECF3;font-size:15px;font-weight:700}.wcl-tec button.pred{color:#2743B4;font-weight:700;font-size:17px;background:#F3F5F9;border-color:#F3F5F9}.wcl-tec button.pred:empty{visibility:hidden}'
    + '.wcl-tec button.frase{font-size:14px;white-space:normal;line-height:1.15}'
    + '.wcl-tec button.activa{background:#DCE4FA;border:3px solid #2743B4}.wcl-tec button.fija{background:#2743B4;color:#fff}.wcl-tec button.hover{background:#DCE4FA;border:3px solid #2743B4}.wcl-tec button.destello{background:#2743B4;color:#fff}'
    + '.wcl-tec .texto{font:14px "Segoe UI",system-ui,sans-serif;color:#3F4B66;padding:0 4px;min-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.wcl-calib{position:fixed;inset:0;z-index:2147483030;background:#1B2422;color:#F1ECE2;display:none;font:18px "Segoe UI",system-ui,sans-serif}.wcl-calib.visible{display:block}'
    + '.wcl-calib .punto{position:absolute;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:#F0B455;box-shadow:0 0 0 6px rgba(240,180,85,.3)}.wcl-calib .punto.grande{width:68px;height:68px;margin:-34px 0 0 -34px}.wcl-calib.puntogrande .punto{width:44px;height:44px;margin:-22px 0 0 -22px}.wcl-calib.puntogrande .punto.grande{width:104px;height:104px;margin:-52px 0 0 -52px}'
    + '.wcl-calib .txt{position:absolute;left:0;right:0;top:12%;text-align:center;padding:0 24px;font-size:22px}.wcl-calib .cancelar{position:absolute;right:16px;top:16px;min-height:44px;padding:0 16px;border-radius:10px;border:1px solid #F1ECE2;background:transparent;color:#F1ECE2;font:700 15px "Segoe UI",system-ui,sans-serif;cursor:pointer}'
    // Se des-invierte cada hijo del contenedor, nunca .wcl-root: un filter sobre él (0×0 en la esquina)
    // lo convertiría en bloque contenedor de sus hijos fixed y el botón y el panel saldrían de la pantalla.
    // (dentro del shadow root :host es el contenedor, que lleva la clase wcl-osc cuando el modo oscuro está activo)
    + 'html.wcl-oscuro img,html.wcl-oscuro video,:host(.wcl-osc)>*{filter:invert(1) hue-rotate(180deg)}'
    + ':host(.wcl-osc)>* img,:host(.wcl-osc)>* video{filter:none}'   // ya des-invertidos por su contenedor (fotos de la lectura limpia)
    + 'html.wcl-enlaces a{outline:3px solid #F2B705!important;outline-offset:2px;text-decoration:underline!important;background:rgba(242,183,5,.18)!important}'
    + 'html.wcl-anim *{animation-play-state:paused!important;transition:none!important;scroll-behavior:auto!important}'
    + 'html.wcl-lupa body{transition:transform .25s}'
    + '.wcl-leyendo{outline:3px solid #0A5C54!important;outline-offset:2px}'
    + '.wcl-iman{outline:3px solid #0A5C54!important;outline-offset:2px}'
    // Lo que se va a pulsar, marcado antes de pulsarlo: con los ojos no basta
    // con acertar, hay que VER que se ha acertado.
    + '.wcl-apuntado{outline:4px solid #2743B4!important;outline-offset:3px;box-shadow:0 0 0 4px rgba(39,67,180,.18)!important}'
    // Elegir entre varias cosas (o entre las opciones de un desplegable) con
    // botones grandes: un problema de puntería se convierte en uno de elegir.
    + '.wcl-elegir{position:fixed;z-index:2147483018;inset:auto;left:50%;top:50%;transform:translate(-50%,-50%);display:none;width:min(94vw,560px);max-height:86vh;overflow:auto;box-sizing:border-box;background:#fff;color:#101F3D;border:4px solid #2743B4;border-radius:16px;padding:14px;box-shadow:0 12px 40px rgba(0,0,0,.35);font:16px/1.4 "Segoe UI",system-ui,sans-serif}'
    + '.wcl-elegir h2{margin:2px 0 10px;font:700 20px/1.3 "Segoe UI",system-ui,sans-serif;color:#101F3D}'
    + '.wcl-elegir button{display:block;width:100%;min-height:64px;margin:0 0 10px;padding:10px 14px;border-radius:12px;border:2px solid #C9D2E3;background:#F4F7FC;color:#101F3D;font:600 19px/1.25 "Segoe UI",system-ui,sans-serif;text-align:left;cursor:pointer}'
    + '.wcl-elegir button:hover,.wcl-elegir button:focus{background:#2743B4;color:#fff;border-color:#2743B4;outline:none}'
    + '.wcl-elegir button .q{display:block;font-size:14px;font-weight:400;opacity:.75;margin-top:2px}'
    + '.wcl-elegir button.marcada{border-color:#0A5C54;background:#DFF3EE}'
    + '.wcl-elegir button.cerrar{min-height:52px;background:#E8ECF3;font-size:17px;text-align:center}'
    // Foco de teclado visible en todo el widget (azul 6,5:1 sobre blanco); en las teclas hacia dentro para que no se solapen
    + '.wcl-panel button:focus-visible,.wcl-panel select:focus-visible,.wcl-panel textarea:focus-visible,.wcl-panel input:focus-visible,.wcl-limpia button:focus-visible,.wcl-calib button:focus-visible{outline:3px solid #2743B4;outline-offset:2px}'
    + '.wcl-tec button:focus-visible{outline:3px solid #2743B4;outline-offset:-3px}'
    + '.wcl-consent{margin:8px 0;padding:12px;border-radius:12px;background:#FFF6DB;border:1px solid #C99A1E;font-size:14px;line-height:1.45}.wcl-consent p{margin:0 0 8px}'
    // Aviso visual de sonido (arriba, centrado) y subtítulos en vivo (abajo): grandes y con fondo, legibles de lejos
    + '.wcl-sonido{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483020;display:none;max-width:min(92vw,640px);padding:12px 20px;border-radius:14px;background:#101F3D;color:#fff;border:4px solid #F2B705;font:700 18px "Segoe UI",system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)}'
    + '.wcl-sonido.error{border-color:#E57373;font-weight:600;font-size:17px;text-align:left}'
    // Tablero de pictogramas: a pantalla completa, botones grandes, tira de frase arriba
    + '.wcl-pictos{position:fixed;inset:0;z-index:2147483013;display:none;flex-direction:column;background:#FBF8F1;color:#101F3D;font:16px "Segoe UI",system-ui,sans-serif}'
    + '.wcl-pictos .tira{display:flex;gap:10px;align-items:center;padding:10px 14px;background:#101F3D;color:#fff;min-height:88px;flex-wrap:wrap}.wcl-pictos .frase{flex:1;display:flex;gap:8px;align-items:center;overflow-x:auto;min-height:56px}.wcl-pictos .frase .vacia{color:#C8D0DC}.wcl-pictos .elegido{display:inline-flex;flex-direction:column;align-items:center;background:#fff;color:#101F3D;border-radius:10px;padding:4px 8px;font-size:13px}'
    + '.wcl-pictos .acciones{display:flex;gap:6px;flex-wrap:wrap}.wcl-pictos .acciones button{min-height:44px;padding:0 14px;border-radius:10px;border:0;background:#34C26B;color:#101F3D;font:700 15px "Segoe UI",system-ui,sans-serif;cursor:pointer}.wcl-pictos .acciones button:nth-child(n+2){background:#E8F7F3}'
    + '.wcl-pictos .sig{display:flex;gap:8px;align-items:center;padding:6px 14px;flex-wrap:wrap}.wcl-pictos .sig .et{font-weight:700;color:#3F4B66}.wcl-pictos .sig .picto{min-height:64px;min-width:84px;flex-direction:row;gap:6px}.wcl-pictos .sig .picto img{width:36px;height:36px}'
    + '.wcl-pictos .cats{display:flex;gap:6px;padding:6px 14px;flex-wrap:wrap}.wcl-pictos .cats button{min-height:44px;padding:0 14px;border-radius:999px;border:2px solid #8892A6;background:#fff;font:700 15px "Segoe UI",system-ui,sans-serif;cursor:pointer}.wcl-pictos .cats button[aria-selected="true"]{background:#2743B4;border-color:#2743B4;color:#fff}'
    + '.wcl-pictos .rejilla{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px;padding:10px 14px;align-content:start}'
    + '.wcl-pictos .picto{min-height:118px;border:2px solid #8892A6;border-radius:12px;background:#fff;color:#101F3D;font:600 15px "Segoe UI",system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px;cursor:pointer;text-align:center}.wcl-pictos .picto img{width:72px;height:72px;object-fit:contain}.wcl-pictos .picto.frase-guardada{font-size:16px}'
    + '.wcl-pictos .pie{padding:6px 14px;font-size:12px;color:#3F4B66;border-top:1px solid #E3E8F0}'
    // Familia 4: vistas del tablero, herramientas (buscar, tableros propios), colores de la clave de Fitzgerald, fotos, frase bien dicha
    + '.wcl-pictos .vistas{display:flex;gap:6px;padding:8px 14px 0;flex-wrap:wrap}.wcl-pictos .vistas button{min-height:44px;padding:0 16px;border-radius:10px;border:2px solid #101F3D;background:#fff;color:#101F3D;font:700 15px "Segoe UI",system-ui,sans-serif;cursor:pointer}.wcl-pictos .vistas button[aria-selected=true]{background:#101F3D;color:#fff}'
    + '.wcl-pictos .herr{display:none;gap:6px;padding:6px 14px;flex-wrap:wrap;align-items:center}.wcl-pictos .herr input{min-height:44px;box-sizing:border-box;font:16px "Segoe UI",system-ui,sans-serif;padding:0 10px;border:2px solid #8892A6;border-radius:10px;min-width:200px;background:#fff;color:#101F3D}.wcl-pictos .herr button{min-height:44px;padding:0 14px;border-radius:10px;border:0;background:#E8F7F3;color:#101F3D;font:700 15px "Segoe UI",system-ui,sans-serif;cursor:pointer}.wcl-pictos .herr button[aria-pressed=true]{background:#101F3D;color:#fff}.wcl-pictos .herr button.peligro{background:#FFE3E3;color:#7A1F1F}.wcl-pictos .herr .nota{font-size:13px;color:#3F4B66}'
    + '.wcl-pictos .picto.c-amarillo{border-color:#C99A00;border-top-width:8px}.wcl-pictos .picto.c-verde{border-color:#2E9E4F;border-top-width:8px}.wcl-pictos .picto.c-azul{border-color:#2743B4;border-top-width:8px}.wcl-pictos .picto.c-naranja{border-color:#D9700F;border-top-width:8px}.wcl-pictos .picto.c-marron{border-color:#8A5A2B;border-top-width:8px}.wcl-pictos .picto.c-gris{border-color:#6B7280;border-top-width:8px}.wcl-pictos .picto.c-morado{border-color:#7B3FB8;border-top-width:8px}.wcl-pictos .picto.c-rosa{border-color:#C92C6D;border-top-width:8px}'
    + '.wcl-pictos .cats button.c-amarillo{border-color:#C99A00;border-left-width:8px}.wcl-pictos .cats button.c-verde{border-color:#2E9E4F;border-left-width:8px}.wcl-pictos .cats button.c-azul{border-color:#2743B4;border-left-width:8px}.wcl-pictos .cats button.c-naranja{border-color:#D9700F;border-left-width:8px}.wcl-pictos .cats button.c-marron{border-color:#8A5A2B;border-left-width:8px}.wcl-pictos .cats button.c-gris{border-color:#6B7280;border-left-width:8px}.wcl-pictos .cats button.c-morado{border-color:#7B3FB8;border-left-width:8px}.wcl-pictos .cats button.c-rosa{border-color:#C92C6D;border-left-width:8px}'
    + '.wcl-pictos img.foto{object-fit:cover;border-radius:8px}.wcl-pictos .picto.quitar{border-color:#7A1F1F;background:#FFE3E3}.wcl-pictos .frase .dicha{width:100%;font-size:18px;color:#FFE45C;font-weight:700}.wcl-pictos .rejilla .aviso{grid-column:1/-1;font-size:17px;color:#3F4B66;max-width:40em}.wcl-pictos .sig .picto.reciente{min-height:44px;padding:0 12px}'
    + '.wcl-subvivo{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:2147483016;display:none;width:min(94vw,900px);min-height:64px;padding:12px 18px;border-radius:12px;background:rgba(0,0,0,.88);color:#fff;font:26px/1.35 "Segoe UI",system-ui,sans-serif;text-align:center}.wcl-subvivo .parcial{color:#C8D0DC}'
    // Números sobre enlaces y campos para las órdenes por voz («clic 12») y barra de confirmación del dictado
    + '.wcl-nums{position:fixed;inset:0;pointer-events:none;z-index:2147483018}.wcl-num{position:absolute;min-width:22px;height:22px;padding:0 5px;border-radius:6px;background:#F2B705;color:#101F3D;font:700 13px/22px "Segoe UI",system-ui,sans-serif;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.45)}'
    + '.wcl-dictconf{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:2147483017;display:none;width:min(94vw,720px);padding:14px 18px;border-radius:12px;background:#101F3D;color:#fff;font:18px/1.4 "Segoe UI",system-ui,sans-serif}.wcl-dictconf .t{display:block;font-size:22px;margin-bottom:10px}.wcl-dictconf button{min-height:44px;padding:0 16px;margin-right:8px;border-radius:10px;border:0;background:#34C26B;color:#101F3D;font:700 15px "Segoe UI",system-ui,sans-serif;cursor:pointer}.wcl-dictconf button.no{background:#E8ECF3}'
    + '.wcl-vivo{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}'
    // Móvil: va al FINAL para ganar a las reglas base (misma especificidad: manda la última). dvh: en iOS la barra del navegador
    + '@media (max-width:480px){.wcl-panel{left:8px;right:8px;width:auto;max-width:none;bottom:88px;max-height:calc(100vh - 100px);max-height:calc(100dvh - 100px);border-radius:16px}'
    + '.wcl-tabs{top:60px}.wcl-tabs button{font-size:11.5px;min-height:44px}.wcl-cab{padding:10px 12px}.wcl-sec{padding:10px 12px}.wcl-fila{gap:6px}.wcl-mm button{width:36px}'
    + '.wcl-tec button{font-size:17px;text-overflow:clip;padding:0 1px}.wcl-tec button.esp{font-size:11px;white-space:normal;line-height:1.05}.wcl-tec button.pred{font-size:14px}.wcl-tec{padding:4px;gap:4px}.wcl-tec .fila{gap:4px}'
    + '.wcl-btn{width:52px;height:52px;bottom:16px;' + LADO + ':16px}.wcl-btn svg{width:30px;height:30px}.wcl-pausa{bottom:22px;' + LADO + ':78px;font-size:13px;padding:6px 12px;min-height:40px}}';
  // El mismo CSS va dos veces: en el documento (reglas html.wcl-* y el contenedor) y dentro del shadow root (las piezas).
  // Con CSP estricta hace falta el nonce del <script> en los <style> que inyectamos.
  var NONCE = (script && script.nonce) || "";
  function estiloCon(texto) { var s = document.createElement("style"); if (NONCE) s.nonce = NONCE; s.textContent = texto; return s; }
  (document.head || raiz).appendChild(estiloCon(css));
  var estilosSombra = [css];   // se montan dentro del shadow root en montar()

  // ----------------------------------------------------------------- DOM --
  function el(tag, attrs, html) {
    // <svg> tiene que nacer en su espacio de nombres: con createElement sería un HTMLUnknownElement y sus <filter> no filtrarían nada
    var e = tag === "svg" ? document.createElementNS("http://www.w3.org/2000/svg", "svg") : document.createElement(tag);
    // El atributo style va por CSSOM: con CSP estricta (style-src con nonce) setAttribute("style") está prohibido
    if (attrs) for (var a in attrs) { if (a === "style") e.style.cssText = attrs[a]; else e.setAttribute(a, (a === "aria-label" || a === "title" || a === "placeholder") ? T(attrs[a]) : attrs[a]); }
    if (html != null) e.innerHTML = T(html);   // los textos del panel se traducen aquí, al crearlos
    return e;
  }
  function q(sel, base) { return (base || panel).querySelector(sel); }
  // Todo lo del widget cuelga de un contenedor fuera de <body>: así la lupa
  // puede agrandar el <body> sin que el panel, el puntero y el teclado se muevan.
  var cont = el("div", { "class": "wcl-root", "lang": IDIOMA_UI });
  // Las piezas viven en un shadow root: los estilos del sitio no entran y los del widget no salen.
  // Lo que se aplica a la página (html.wcl-oscuro, .wcl-lector, el <svg> de filtros) sigue en el documento.
  var sombra = cont.attachShadow ? cont.attachShadow({ mode: "open" }) : null, caja = sombra || cont;
  function enWidget(e) { return !!(e && (e === cont || (sombra && e.getRootNode && e.getRootNode() === sombra) || (e.closest && e.closest(".wcl-root")))); }
  function focoActual() { return (sombra && sombra.activeElement) || document.activeElement; }
  function elementoBajo(x, y) { var e = document.elementFromPoint(x, y); if (sombra && e === cont) e = sombra.elementFromPoint(x, y) || e; return e; }
  var boton = el("button", { "class": "wcl-btn", "aria-label": "Abrir accesibilidad Winclus", "aria-expanded": "false", "type": "button" }, LOGO);
  var btnPausa = el("button", { "class": "wcl-pausa", "type": "button", "aria-label": "Pausar el puntero" }, "Pausar");
  var panel = el("div", { "class": "wcl-panel", "role": "dialog", "aria-label": "Accesibilidad Winclus" });
  var cursor = el("div", { "class": "wcl-cursor", "aria-hidden": "true" }, '<svg class="wcl-anillo" viewBox="0 0 46 46"><circle cx="23" cy="23" r="20" fill="none" stroke="rgba(52,194,107,.3)" stroke-width="5"/><circle class="prog" cx="23" cy="23" r="20" fill="none" stroke="#34C26B" stroke-width="5" stroke-dasharray="125.7" stroke-dashoffset="125.7" transform="rotate(-90 23 23)"/></svg>');
  var aviso = el("div", { "class": "wcl-aviso", "aria-hidden": "true" });
  var vivo = el("div", { "class": "wcl-vivo", "role": "status", "aria-live": "polite" });   // el mismo aviso, para lectores de pantalla
  var sonidoEl = el("div", { "class": "wcl-sonido", "role": "status", "aria-live": "assertive" });
  var subvivoEl = el("div", { "class": "wcl-subvivo", "role": "log", "aria-live": "polite", "aria-label": "Subtítulos en vivo" });
  var guia = el("div", { "class": "wcl-guia", "aria-hidden": "true" });
  var menuEl = el("div", { "class": "wcl-menu", "aria-hidden": "true" });
  var tecEl = el("div", { "class": "wcl-tec", "role": "group", "aria-label": "Teclado en pantalla Winclus" });
  var calibEl = el("div", { "class": "wcl-calib", "role": "dialog", "aria-modal": "true", "aria-label": "Calibración de los ojos" }), calibFocoPrevio = null;
  calibEl.addEventListener("keydown", function (e) {   // el foco no sale del diálogo: su único control es Cancelar
    if (e.key === "Tab") { e.preventDefault(); var c = calibEl.querySelector(".cancelar"); if (c) c.focus(); }
  });
  var refrescos = [];   // funciones que ponen cada control según «ajustes»

  // Controles del panel. Todos se manejan con botones grandes (nada de
  // arrastrar deslizadores), como en la aplicación. Cada control puede llevar una
  // «ayuda»: una frase en palabras corrientes, siempre visible bajo el nombre, que
  // dice qué hace y para quién sirve (también la leen los lectores de pantalla,
  // por aria-describedby). Sin jerga: nada de «ganancia», «umbral» o «protanopia».
  function conAyuda(f, clave, ayuda) {
    if (!ayuda) return f;
    var a = el("div", { "class": "wcl-ayuda", "id": "wcl-a-" + clave }, ayuda);
    f.classList.add("con-ayuda");
    f.appendChild(a);   // la fila envuelve: nombre y control arriba, la ayuda debajo a todo lo ancho
    var ctrl = f.querySelector(".wcl-sw"); if (ctrl) ctrl.setAttribute("aria-describedby", "wcl-a-" + clave);
    return f;
  }
  function filaSw(clave, etiqueta, alCambiar, ayuda) {
    var id = "wcl-" + clave;
    var f = el("div", { "class": "wcl-fila" });
    f.appendChild(el("label", { "for": id }, etiqueta));
    var s = el("button", { "class": "wcl-sw", "role": "switch", "aria-checked": "false", "id": id, "type": "button" });
    f.appendChild(s);
    s.addEventListener("click", function () {
      ajustes[clave] = !ajustes[clave]; s.setAttribute("aria-checked", ajustes[clave] ? "true" : "false"); guardar(); contarPanel(etiqueta);
      if (alCambiar) alCambiar(ajustes[clave]);
    });
    refrescos.push(function () { s.setAttribute("aria-checked", ajustes[clave] ? "true" : "false"); });
    return conAyuda(f, clave, ayuda);
  }
  function filaPaso(clave, etiqueta, min, max, paso, formato, alCambiar, ayuda) {
    etiqueta = T(etiqueta);   // el HTML de la fila se compone aquí, así que se traduce antes
    // Cada botón dice qué reduce o aumenta y el valor actual se lee tras él (aria-describedby); el valor también es live
    var f = el("div", { "class": "wcl-fila" }, '<span id="wcl-l-' + clave + '">' + etiqueta + '</span><div class="wcl-mm" role="group" aria-labelledby="wcl-l-' + clave + '"><button type="button" aria-label="Reducir: ' + etiqueta + '" aria-describedby="wcl-v-' + clave + '">−</button><span id="wcl-v-' + clave + '" aria-live="polite"></span><button type="button" aria-label="Aumentar: ' + etiqueta + '" aria-describedby="wcl-v-' + clave + '">+</button></div>');
    conAyuda(f, clave, ayuda);
    var b = f.querySelectorAll("button"), v = f.querySelector("span[aria-live]");
    function poner(n) {
      if (!isFinite(n)) n = POR_DEFECTO[clave];   // un ajuste corrupto no puede dejar NaN
      n = Math.round(Math.min(max, Math.max(min, n)) / paso) * paso;
      n = +n.toFixed(4);
      ajustes[clave] = n; v.textContent = formato ? formato(n) : String(n); guardar();
      if (alCambiar) alCambiar(n);
    }
    b[0].addEventListener("click", function () { poner(ajustes[clave] - paso); contarPanel(etiqueta); });
    b[1].addEventListener("click", function () { poner(ajustes[clave] + paso); contarPanel(etiqueta); });
    refrescos.push(function () { v.textContent = formato ? formato(ajustes[clave]) : String(ajustes[clave]); });
    return f;
  }
  function filaOpc(clave, etiqueta, lista, alCambiar, objeto, ayuda) {
    var w = el("div");
    if (etiqueta) w.appendChild(el("div", { "class": "wcl-estado" }, etiqueta));
    if (ayuda) w.appendChild(el("div", { "class": "wcl-ayuda", "id": "wcl-a-" + clave }, ayuda));
    var g = el("div", { "class": "wcl-opc", "role": "group", "aria-label": etiqueta || clave });
    if (ayuda) g.setAttribute("aria-describedby", "wcl-a-" + clave);
    var botones = [];
    function valor() { return objeto ? objeto[clave] : ajustes[clave]; }
    lista.forEach(function (o) {
      var b = el("button", { "type": "button", "aria-pressed": "false" }, o[1]);
      b.addEventListener("click", function () {
        if (objeto) objeto[clave] = o[0]; else ajustes[clave] = o[0]; contarPanel(o[1]);
        guardar(); pintar(); if (alCambiar) alCambiar(o[0]);
      });
      botones.push([o[0], b]); g.appendChild(b);
    });
    function pintar() { botones.forEach(function (p) { p[1].setAttribute("aria-pressed", p[0] === valor() ? "true" : "false"); }); }
    refrescos.push(pintar);
    w.appendChild(g);
    return w;
  }
  function seccion(titulo, paraQuien) {
    // Cada sección empieza con su nombre y, si se le da, una frase que dice para quién es y qué consigue,
    // y un botón «Léemelo» que lee en voz alta la sección entera: nombres, estado y ayudas.
    var s = el("div", { "class": "wcl-sec" }, titulo ? "<h2>" + T(titulo) + "</h2>" : "");
    if (paraQuien) s.appendChild(el("div", { "class": "wcl-intro" }, paraQuien));
    if (titulo) {
      var l = el("button", { "type": "button", "class": "wcl-leeme", "aria-label": T("Leer esta sección en voz alta") }, "🔊 Léemelo");
      l.addEventListener("click", function () { contarPanel("Léemelo"); decirVoz(textoSeccion(s), true, true); });
      s.querySelector("h2").appendChild(l);
    }
    return s;
  }
  // Lo que se lee de una sección: título, para quién es y, por cada control, su nombre, cómo está y su ayuda.
  // Lo plegado en «Ajustes finos» solo se lee si está abierto.
  function textoSeccion(s) {
    var partes = [], h = s.querySelector("h2"), intro = s.querySelector(".wcl-intro");
    if (h) partes.push(h.firstChild.textContent.trim() + ".");
    if (intro) partes.push(intro.textContent.trim());
    var visible = function (e) { var d = e.closest("details"); return !d || d.open; };
    Array.prototype.forEach.call(s.querySelectorAll(".wcl-fila, .wcl-opc, .wcl-big, .wcl-situ button, .wcl-sec > .wcl-ayuda"), function (e) {
      if (!visible(e) || !e.getClientRects().length) return;   // ni lo plegado ni lo oculto por el modo elegido
      if (e.classList.contains("wcl-fila")) {
        var nombre = (e.querySelector("label, span") || e).firstChild.textContent.trim(), sw = e.querySelector(".wcl-sw"), val = e.querySelector("span[aria-live]"), ay = e.querySelector(".wcl-ayuda");
        partes.push(nombre + (sw ? (sw.getAttribute("aria-checked") === "true" ? T(": activado.") : T(": desactivado.")) : val ? ": " + val.textContent + "." : ".") + (ay ? " " + ay.textContent.trim() : ""));
      } else if (e.classList.contains("wcl-opc")) {
        var et = e.previousElementSibling, ay2 = et && et.classList.contains("wcl-ayuda") ? et : null, tit = ay2 ? ay2.previousElementSibling : et;
        var elegida = e.querySelector('[aria-pressed="true"]');
        partes.push((tit && tit.classList.contains("wcl-estado") ? tit.textContent.trim() + ": " : T("Opciones: ")) + Array.prototype.map.call(e.querySelectorAll("button"), function (b) { return b.textContent.trim(); }).join(", ") + "." + (elegida ? " " + T("Elegido: ") + elegida.textContent.trim() + "." : "") + (ay2 ? " " + ay2.textContent.trim() : ""));
      } else if (e.classList.contains("wcl-big") || e.closest(".wcl-situ")) {
        var sig = e.nextElementSibling;
        partes.push(T("Botón: ") + e.textContent.replace(/^[^\wÁ-ú¿]+/, "").trim() + "." + (sig && sig.classList.contains("wcl-ayuda") ? " " + sig.textContent.trim() : ""));
      }
    });
    return partes.join(" ");
  }
  // Ajustes finos: los números que casi nadie necesita tocar van plegados bajo un solo
  // botón, con una frase que dice cuándo abrirlos. Así la sección muestra solo lo esencial.
  function finos(cuando) {
    var d = el("details", { "class": "wcl-fino" }, '<summary>' + T("Ajustes finos") + '</summary>');
    d.appendChild(el("div", { "class": "wcl-ayuda" }, cuando || "Solo si algo no va bien. Los valores de fábrica funcionan para casi todo el mundo."));
    d.agregar = function (hijo) { d.appendChild(hijo); return d; };
    return d;
  }
  function botonGrande(texto, clase, alPulsar) {
    var b = el("button", { "type": "button", "class": "wcl-big " + (clase || "") }, texto);
    b.addEventListener("click", function (ev) { contarPanel(texto); alPulsar(ev); });
    return b;
  }
  // Botón que borra algo: pide confirmación en dos pasos dentro del panel (WCAG 3.3.4 y 3.3.6), sin
  // ventanas del navegador. El foco pasa a «No» para que un clic de más no borre nada.
  function botonPeligroso(texto, alConfirmar) {
    var caja2 = el("div"), b = botonGrande(texto, "suave", preguntar);
    caja2.appendChild(b);
    function preguntar() {
      var g = el("div", { "class": "wcl-confirma", "role": "group", "aria-label": T("Confirmar") });
      g.appendChild(el("div", { "class": "wcl-ayuda" }, T("¿Seguro? No se puede deshacer.") + " " + T(texto) + "."));
      var si = el("button", { "type": "button", "class": "wcl-big rojo" }, "Sí, borrar"), no = el("button", { "type": "button", "class": "wcl-big suave" }, "No, dejarlo como está");
      si.addEventListener("click", function () { contarPanel(texto + " (confirmado)"); volver(); alConfirmar(); });
      no.addEventListener("click", volver);
      g.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); volver(); } });
      g.appendChild(no); g.appendChild(si);
      caja2.replaceChild(g, b); no.focus(); avisar(T("¿Seguro?"));
      function volver() { if (g.parentNode) caja2.replaceChild(b, g); b.focus(); }
    }
    return caja2;
  }
  // Qué se toca del panel (solo cifras, en local): para saber qué opciones se usan y cuáles nunca,
  // y así quitar o explicar mejor lo que no se entiende. Las claves son los nombres en español.
  function contarPanel(clave) {
    try {
      if (!uso) { uso = JSON.parse(localStorage.getItem("winclus.uso") || "null") || { desde: new Date().toISOString().slice(0, 10), n: {} }; }
      uso.panel = uso.panel || {}; clave = String(clave).slice(0, 60); uso.panel[clave] = (uso.panel[clave] || 0) + 1; localStorage.setItem("winclus.uso", JSON.stringify(uso));
    } catch (e) {}
  }
  function masUsadoPanel() {
    var p = (uso && uso.panel) || {}, ks = Object.keys(p).sort(function (a, b) { return p[b] - p[a]; }).slice(0, 5);
    return ks.length ? T("Lo que más tocas del panel: ") + ks.map(function (k) { return T(k) + " (" + p[k] + ")"; }).join(", ") + "." : "";
  }
  function pct(n) { return n + " %"; }
  function ms(n) { return n + " ms"; }
  function px(n) { return n + " px"; }

  // --------------------------------------------------------------- voz --
  var leyendo = null, colaVoz = [];
  // Las voces neuronales del navegador (Edge «Natural», Google «Online», Apple «Premium/Enhanced») suenan mucho
  // más humanas: si hay una, va primero; y entre ellas, la del país de la persona (es-CO) antes que otras.
  function vozPreferida(vs) {
    if (!vs.length) return null;
    var neural = /natural|neural|online|premium|enhanced|wavenet/i, pais = IDIOMA_VOZ.toLowerCase();
    var mejor = vs.filter(function (v) { return neural.test(v.name) && v.lang.toLowerCase() === pais; })[0]
      || vs.filter(function (v) { return neural.test(v.name); })[0]
      || vs.filter(function (v) { return v.lang.toLowerCase() === pais; })[0];
    return mejor || vs[0];
  }
  function vocesEs() {
    if (!(window.speechSynthesis)) return [];
    // Voces del idioma del panel; si no hay ninguna, mejor sin voz fija (el navegador elige por el lang) que una en español
    return window.speechSynthesis.getVoices().filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf(IDIOMA_UI) === 0; });
  }
  // idioma: el de la página cuando se lee su contenido (WCAG 3.1.1); sin él, la voz en español del panel
  function decirVoz(texto, interrumpir, forzar, idioma) {
    if (!(window.speechSynthesis) || !texto) return;
    if (!ajustes.voz_activa && !forzar) return;
    if (interrumpir !== false) { window.speechSynthesis.cancel(); vozGen++; }
    texto = T(texto);
    var lang = IDIOMA_UI, voces = vocesEs(), v = null;
    if (idioma && !/^es\b/.test(idioma)) {   // página en otro idioma: una voz de ese idioma si la hay
      var todas = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [], base = idioma.split("-")[0];
      for (var j = 0; j < todas.length; j++) if (todas[j].lang && todas[j].lang.toLowerCase().indexOf(base) === 0) { v = todas[j]; break; }
      lang = idioma;
    } else {
      if (ajustes.voz_nombre) for (var i = 0; i < voces.length; i++) if (voces[i].name === ajustes.voz_nombre) v = voces[i];
      if (!v && voces.length) v = vozPreferida(voces);
      if (v) lang = v.lang;
    }
    var rate = Math.pow(1.18, isFinite(ajustes.voz_velocidad) ? ajustes.voz_velocidad : 0), pitch = tonoVoz();
    // Chrome corta las voces remotas a los ~15 s y no avisa: se habla por trozos de una frase (≤ 200 caracteres) encadenados
    var trozos = texto.match(/[^.!?…\n]{1,200}[.!?…\n]?/g) || [texto], k = 0, gen = vozGen;
    (function siguiente() {
      if (k >= trozos.length || gen !== vozGen) return;
      var u = new SpeechSynthesisUtterance(trozos[k++]);
      u.lang = lang; if (v) u.voice = v; u.rate = rate; u.pitch = pitch;
      u.onend = siguiente; u.onerror = function () { if (gen === vozGen) siguiente(); };
      window.speechSynthesis.speak(u);
    })();
  }
  var vozGen = 0;
  function tonoVoz() { var t = +ajustes.voz_tono; return isFinite(t) ? Math.max(0.5, Math.min(1.5, 1 + t / 10)) : 1; }   // −5 grave … +5 agudo
  function callar() { vozGen++; if (window.speechSynthesis) window.speechSynthesis.cancel(); if (leyendo) { leyendo.classList.remove("wcl-leyendo"); leyendo = null; } }
  function leerElemento(elm) {
    if (!elm || (enWidget(elm) && !(elm.closest && elm.closest(".wcl-limpia-texto")))) return;
    var bloque = elm.closest("p,h1,h2,h3,h4,h5,h6,li,td,th,a,button,label,figcaption,blockquote,summary,dd,dt,input,textarea") || elm;
    if (leyendo) leyendo.classList.remove("wcl-leyendo");
    leyendo = bloque; bloque.classList.add("wcl-leyendo");
    var esCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(bloque.tagName);   // <li> también tiene .value (numérico): no vale como criterio
    var t = esCampo ? (esSecreto(bloque) ? "campo de contraseña" : (bloque.value || bloque.placeholder || "")) : (bloque.innerText || bloque.textContent || "");
    decirVoz(t.trim().slice(0, 2000), true, true, IDIOMA_PAGINA);
  }
  function leerPagina() {
    var m = document.querySelector("main,article,[role=main]") || document.body;
    var texto = (m.innerText || "").replace(/\s+/g, " ").trim().slice(0, 15000);
    decirVoz(texto || "La página no tiene texto que leer.", true, true, texto ? IDIOMA_PAGINA : null);
  }
  // Con el ratón de verdad: leer lo que se pulsa (los clics del puntero virtual lo hacen desde clic())
  document.addEventListener("click", function (e) { if (ajustes.lectura && e.isTrusted && !e.target.closest(".wcl-root")) leerElemento(e.target); }, true);

  // ------------------------------------------------------------ sonido --
  var audioCtx = null;
  function pitido(hz, msDur) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();   // nace suspendido si no hubo gesto real: sin esto los pitidos son mudos
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = hz || 1000; g.gain.value = 0.08;
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + (msDur || 40) / 1000);
    } catch (e) {}
  }
  var avisoHasta = 0;
  var vivoTimer = 0;
  function avisar(texto, ambar, ms) {   // ms: cuánto se ve (0,9 s si no se dice)
    texto = T(texto);
    // Región live oculta: se vacía y se vuelve a llenar para que el mismo aviso («Clic») se anuncie cada vez
    clearTimeout(vivoTimer); vivo.textContent = ""; vivoTimer = setTimeout(function () { vivo.textContent = texto; }, 30);
    if (ajustes.avisos_visuales) {
      aviso.textContent = texto; aviso.classList.toggle("ambar", !!ambar); aviso.style.display = "block";
      aviso.style.transform = "translate(" + Math.min(P.x, window.innerWidth - 220) + "px," + Math.min(P.y + 24, window.innerHeight - 40) + "px)";
      var dura = ms || 900; avisoHasta = performance.now() + dura;
      setTimeout(function () { if (performance.now() >= avisoHasta) aviso.style.display = "none"; }, dura + 50);
    }
    if (ajustes.avisos_sonido) pitido(1000, 40);
  }

  // =================================================== detección de cara ==
  var P = { x: window.innerWidth / 2, y: window.innerHeight / 2 };   // puntero virtual
  var camaraActiva = false, pausado = false, video = null, flujo = null, landmarker = null;
  var det = { cara: false, t: 0, lm: null, bs: null, track: null, mirada: null, rasgos: null, relacion: 1, iris: null };
  var historialRasgos = [];   // [(t, rasgos, relacion)] últimos 1,5 s, para la calibración invisible
  var anclaParpadeo = null, baseAvisada = false;   // dónde estaba el puntero al empezar a cerrar los ojos

  function forma(nombre) { return det.bs && det.bs[nombre] != null ? det.bs[nombre] : 0; }

  // --- parpadeo (detectors/parpadeo.py) ---------------------------------
  var OJO_DER = [159, 145, 33, 133], OJO_IZQ = [386, 374, 362, 263];
  var PB = { N: 400, PERCENTIL: 60, MIN_BASE: 45, RESPALDO: 0.2, TOLERANCIA: 0.30, HISTERESIS: 0.12, HUECO: 0.09,
             INICIO: 0.15, FIN: 0.20, LARGO_MS: 1200, MAX_MS: 4000 };
  function dist(a, b) { return Math.hypot((a.x - b.x) * CAM_W, (a.y - b.y) * CAM_H); }
  function aperturaOjo(lm, p) {
    var ancho = dist(lm[p[2]], lm[p[3]]);
    return ancho < 1e-6 ? 0 : dist(lm[p[0]], lm[p[1]]) / ancho;
  }
  function percentil(arr, p) {
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var k = (s.length - 1) * p / 100, i = Math.floor(k), f = k - i;
    return s[i + 1] != null ? s[i] + (s[i + 1] - s[i]) * f : s[i];
  }
  var parpadeo = {
    bufDer: [], bufIzq: [], base: null, cerradosDesde: null, clicEmitido: false, largoEmitido: false, evento: null,
    tAnterior: null, cierreInicio: null, cierreFin: 0, cierreFlags: [false, false],
    episodioDesde: null, episodioMin: [9, 9], episodioAmbosMs: 0, episodioProfundo: false, ultimoEpisodio: null,
    estado: { relacion: 1, cerrados: false, cerradosMs: 0, listo: false, base: [0, 0], apertura: [0, 0] },
    reiniciar: function () { this.bufDer = []; this.bufIzq = []; this.base = null; this.cerradosDesde = null; this.evento = null; this.episodioDesde = null;
      this.cierreInicio = null; this.cierreFin = 0; this.cierreFlags = [false, false]; this.clicEmitido = false; this.largoEmitido = false; this.tAnterior = null; this.ultimoEpisodio = null;
      this.estado = { relacion: 1, cerrados: false, cerradosMs: 0, listo: false, base: [0, 0], apertura: [0, 0] }; },
    procesar: function (lm, bs, umbral, minMs, ahora) {
      var aDer = aperturaOjo(lm, OJO_DER), aIzq = aperturaOjo(lm, OJO_IZQ);
      var bsDer = bs ? bs.eyeBlinkRight : null, bsIzq = bs ? bs.eyeBlinkLeft : null;
      var tAnterior = this.tAnterior; this.tAnterior = ahora;
      var listo = this.bufDer.length >= PB.MIN_BASE;
      var enCierre = this.cerradosDesde !== null;
      var umbralEf = umbral + (enCierre ? PB.HISTERESIS : 0);
      var bDer = 0, bIzq = 0, rDer, rIzq, cDer, cIzq;
      if (listo) {
        if (!this.base) this.base = [percentil(this.bufDer, PB.PERCENTIL), percentil(this.bufIzq, PB.PERCENTIL)];
        bDer = this.base[0]; bIzq = this.base[1];
        rDer = bDer > 1e-6 ? aDer / bDer : 1; rIzq = bIzq > 1e-6 ? aIzq / bIzq : 1;
        if (bsDer != null) { rDer = Math.min(rDer, 1 - bsDer); rIzq = Math.min(rIzq, 1 - bsIzq); }
        cDer = rDer < umbralEf + PB.TOLERANCIA; cIzq = rIzq < umbralEf + PB.TOLERANCIA;
      } else {
        rDer = aDer / PB.RESPALDO; rIzq = aIzq / PB.RESPALDO;
        cDer = aDer < PB.RESPALDO; cIzq = aIzq < PB.RESPALDO;
      }
      var rMejor = Math.min(rDer, rIzq);
      var cerrados = cDer && cIzq && rMejor < umbralEf;
      var cierreEterno = enCierre && (ahora - this.cerradosDesde) * 1000 > PB.MAX_MS;
      if (!listo || !cerrados || cierreEterno) {
        this.bufDer.push(aDer); this.bufIzq.push(aIzq);
        if (this.bufDer.length > PB.N) { this.bufDer.shift(); this.bufIzq.shift(); }
        if (this.bufDer.length >= PB.MIN_BASE) { this.base = [percentil(this.bufDer, PB.PERCENTIL), percentil(this.bufIzq, PB.PERCENTIL)]; listo = true; }
      }
      // Episodio: desde que el mejor ojo empieza a cerrarse hasta que se abre
      var enEpisodio = this.episodioDesde !== null;
      if (rMejor < umbral + (enEpisodio ? PB.FIN : PB.INICIO)) {
        if (!enEpisodio) {
          this.episodioDesde = (tAnterior !== null && ahora - tAnterior > 0 && ahora - tAnterior < 0.2) ? (tAnterior + ahora) / 2 : ahora;
          this.episodioMin = [rDer, rIzq]; this.episodioAmbosMs = 0; this.episodioProfundo = false; this.clicEmitido = false;
        }
        this.episodioMin[0] = Math.min(this.episodioMin[0], rDer); this.episodioMin[1] = Math.min(this.episodioMin[1], rIzq);
        if (rMejor < umbralEf) this.episodioProfundo = true;
        var episodioMs = Math.round((ahora - this.episodioDesde) * 1000);
        if (this.episodioProfundo && !this.clicEmitido && episodioMs >= minMs && Math.max(rDer, rIzq) < umbral + PB.TOLERANCIA) {
          this.clicEmitido = true; this.evento = "clic"; this.episodioAmbosMs = Math.max(this.episodioAmbosMs, minMs);
        }
      } else if (enEpisodio) {
        var totalMs = Math.round((ahora - this.episodioDesde) * 1000), m = this.episodioMin, res;
        if (this.episodioAmbosMs >= minMs) res = "clic";
        else if (this.episodioAmbosMs > 0) res = "corto: " + this.episodioAmbosMs + " ms (hacen falta " + minMs + ")";
        else if (m[0] >= umbral + PB.TOLERANCIA) res = "guiño: el derecho se quedó abierto";
        else if (m[1] >= umbral + PB.TOLERANCIA) res = "guiño: el izquierdo se quedó abierto";
        else res = "no se cerraron bastante (" + Math.min(m[0], m[1]).toFixed(2) + ", hace falta menos de " + umbral.toFixed(2) + ")";
        if (totalMs >= 60 && totalMs <= PB.MAX_MS) this.ultimoEpisodio = { ms: totalMs, resultado: res, t: ahora };
        this.episodioDesde = null;
      }
      var cerradosMs = 0;
      if (cerrados) {
        if (this.cerradosDesde === null) {
          if (this.cierreInicio !== null && ahora - this.cierreFin < PB.HUECO) {
            this.cerradosDesde = this.cierreInicio; this.clicEmitido = this.cierreFlags[0]; this.largoEmitido = this.cierreFlags[1];
          } else {
            this.cerradosDesde = (tAnterior !== null && ahora - tAnterior > 0 && ahora - tAnterior < 0.2) ? (tAnterior + ahora) / 2 : ahora;
            this.largoEmitido = false;
          }
          this.cierreInicio = null;
        }
        cerradosMs = Math.round((ahora - this.cerradosDesde) * 1000);
        this.episodioAmbosMs = Math.max(this.episodioAmbosMs, cerradosMs);
        if (!this.clicEmitido && cerradosMs >= minMs) {
          this.clicEmitido = true; this.evento = "clic";
          this.anotarClicMs(cerradosMs);
        }
        if (!this.largoEmitido && cerradosMs >= this.msLargo()) { this.largoEmitido = true; this.evento = "largo"; }
      } else if (this.cerradosDesde !== null) {
        this.cierreInicio = this.cerradosDesde; this.cierreFin = ahora; this.cierreFlags = [this.clicEmitido, this.largoEmitido];
        this.cerradosDesde = null;
      }
      this.estado = { relacion: rMejor, cerrados: cerrados, cerradosMs: cerradosMs, listo: listo, base: [bDer, bIzq], apertura: [aDer, aIzq] };
    },
    // Cuánto hay que tener los ojos cerrados para que se abra el menú de clics.
    // No es un número fijo: hay quien cierra los ojos un segundo entero para
    // hacer un clic, y con 1,2 s el menú le salía en cada clic. Así que el
    // menú se pone siempre por encima de lo que tarda ESTA persona en pulsar
    // (su media por 1,8, más un margen), y además se puede cambiar o apagar.
    clicsMs: [],
    anotarClicMs: function (ms) {
      if (ms < 60 || ms > 3000) return;
      this.clicsMs.push(ms); if (this.clicsMs.length > 12) this.clicsMs.shift();
    },
    mediaClicMs: function () {
      if (this.clicsMs.length < 3) return 0;
      var suma = 0; for (var i = 0; i < this.clicsMs.length; i++) suma += this.clicsMs[i];
      return suma / this.clicsMs.length;
    },
    msLargo: function () {
      if (!ajustes.menu_ojos) return 1e9;                 // el menú, apagado
      var pedido = Math.max(600, ajustes.menu_largo_ms || PB.LARGO_MS);
      var media = this.mediaClicMs();
      return media ? Math.max(pedido, media * 1.8 + 200) : pedido;
    },
    tomarEvento: function () { var e = this.evento; this.evento = null; return e; },
    ojosAbiertos: function (margen) { return this.estado.relacion >= (margen || 0.7); }
  };
  // Para fiarse del iris basta con que los ojos no estén cerrándose: hay personas
  // (o sonrisas) con los ojos entrecerrados en reposo, alrededor del 65-70 %.
  function ojosParaMirar() { return !parpadeo.estado.cerrados && parpadeo.estado.relacion >= 0.5; }

  // --- mirada por iris (detectors/mirada.py) -----------------------------
  var IRIS_DER = [468, 469, 470, 471, 472], IRIS_IZQ = [473, 474, 475, 476, 477];
  var CONT_DER = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
  var CONT_IZQ = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
  var N_RASGOS = 15;
  function medirOjo(lm, iris, esq, parp, cont) {
    var ix = 0, iy = 0, i;
    for (i = 0; i < iris.length; i++) { ix += lm[iris[i]].x; iy += lm[iris[i]].y; }
    ix = ix / iris.length * CAM_W; iy = iy / iris.length * CAM_H;
    var cx = 0, cy = 0;
    for (i = 0; i < cont.length; i++) { cx += lm[cont[i]].x; cy += lm[cont[i]].y; }
    cx = cx / cont.length * CAM_W; cy = cy / cont.length * CAM_H;
    var anchoOjo = dist(lm[esq[0]], lm[esq[1]]);
    if (anchoOjo < 1e-6) return null;
    var py = (lm[parp[0]].y + lm[parp[1]].y) / 2 * CAM_H;
    var apertura = dist(lm[parp[0]], lm[parp[1]]) / anchoOjo;
    return [(ix - cx) / anchoOjo, (iy - cy) / anchoOjo, (iy - py) / anchoOjo, apertura, ix, iy];
  }
  function calcularMirada(lm, bs) {
    if (!lm || lm.length < 478) { det.mirada = null; det.rasgos = null; return; }
    var der = medirOjo(lm, IRIS_DER, [33, 133], [159, 145], CONT_DER);
    var izq = medirOjo(lm, IRIS_IZQ, [362, 263], [386, 374], CONT_IZQ);
    if (!der && !izq) { det.mirada = null; det.rasgos = null; return; }
    der = der || izq; izq = izq || der;
    var gx = (der[0] + izq[0]) / 2, gy = (der[1] + izq[1]) / 2, bx = 0, by = 0;
    if (bs) {
      bx = ((bs.eyeLookInLeft - bs.eyeLookOutLeft) + (bs.eyeLookOutRight - bs.eyeLookInRight)) / 2;
      by = ((bs.eyeLookDownLeft - bs.eyeLookUpLeft) + (bs.eyeLookDownRight - bs.eyeLookUpRight)) / 2;
    }
    det.mirada = [gx, gy];
    det.rasgos = [der[0], der[1], der[2], izq[0], izq[1], izq[2], bx, by, gx * gx, gy * gy, gx * gy, der[3], izq[3], gx * gx * gx, gy * gy * gy];
    det.pose = [lm[1].x, lm[1].y, Math.hypot(lm[33].x - lm[263].x, lm[33].y - lm[263].y)];   // dónde está la cabeza: nariz y separación de los ojos (cerca / lejos)
    det.iris = [[der[4], der[5]], [izq[4], izq[5]]];
  }

  // --- filtros (utils/filtro.py) -------------------------------------------
  function OneEuro(minCutoff, beta, dCutoff) { this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff || 1; this.reiniciar(); }
  OneEuro.prototype.reiniciar = function () { this.xPrev = null; this.dxPrev = 0; this.tPrev = null; };
  OneEuro.prototype.alpha = function (cutoff, dt) { var tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); };
  OneEuro.prototype.filtrar = function (x, t) {
    if (!isFinite(x)) return this.xPrev === null ? x : this.xPrev;   // un NaN no puede quedarse dentro del filtro para siempre
    if (this.xPrev === null) { this.xPrev = x; this.tPrev = t; return x; }
    var dt = Math.max(1e-3, t - this.tPrev); this.tPrev = t;
    var dx = (x - this.xPrev) / dt, ad = this.alpha(this.dCutoff, dt);
    var dxHat = ad * dx + (1 - ad) * this.dxPrev;
    var a = this.alpha(this.minCutoff + this.beta * Math.abs(dxHat), dt);
    var xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat; this.dxPrev = dxHat; return xHat;
  };
  function Fijacion() { this.reiniciar(); }
  Fijacion.prototype.reiniciar = function () { this.punto = null; this.fueraDesde = null; this.moviendo = false; };
  Fijacion.prototype.actualizar = function (x, y, radio, persistS, radioSalto, t) {
    var paso = 0.25;
    if (!this.punto) { this.punto = [x, y]; return this.punto; }
    var fx = this.punto[0], fy = this.punto[1], d = Math.hypot(x - fx, y - fy);
    if (d >= radioSalto) { this.punto = [x, y]; this.fueraDesde = null; this.moviendo = false; }
    else if (this.moviendo) {
      if (d <= 6) { this.punto = [x, y]; this.moviendo = false; } else this.punto = [fx + paso * (x - fx), fy + paso * (y - fy)];
    } else if (d > radio) {
      if (this.fueraDesde === null) this.fueraDesde = t;
      else if (t - this.fueraDesde >= persistS) { this.moviendo = true; this.fueraDesde = null; this.punto = [fx + paso * (x - fx), fy + paso * (y - fy)]; }
    } else this.fueraDesde = null;
    return this.punto;
  };
  Fijacion.prototype.fijarEn = function (x, y) { this.punto = [x, y]; this.fueraDesde = null; this.moviendo = false; };

  // --- calibración: regresión ridge (detectors/calibracion.py) -------------
  var LAMBDAS = [0.05, 0.15, 0.5, 1.5, 5.0], PESO_FIJOS = 8;
  function resolver(A, b) {   // sistema lineal por eliminación de Gauss con pivote
    var n = b.length, i, j, k, M = [];
    for (i = 0; i < n; i++) M.push(A[i].concat([b[i]]));
    for (i = 0; i < n; i++) {
      var p = i;
      for (k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
      var tmp = M[i]; M[i] = M[p]; M[p] = tmp;
      if (Math.abs(M[i][i]) < 1e-12) M[i][i] = 1e-12;
      for (k = i + 1; k < n; k++) { var f = M[k][i] / M[i][i]; for (j = i; j <= n; j++) M[k][j] -= f * M[i][j]; }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) { var s = M[i][n]; for (j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
    return x;
  }
  function filaX(r, media, desv) { var x = [1]; for (var i = 0; i < r.length; i++) x.push((r[i] - media[i]) / desv[i]); return x; }
  function ridge(X, y, lam, pesos) {
    var n = X[0].length, A = [], b = new Array(n).fill(0), i, j, k;
    for (i = 0; i < n; i++) { A.push(new Array(n).fill(0)); A[i][i] = i === 0 ? 0 : lam; }
    for (k = 0; k < X.length; k++) {
      var w = pesos ? pesos[k] : 1, xk = X[k];
      for (i = 0; i < n; i++) { var wi = w * xk[i]; b[i] += wi * y[k]; for (j = 0; j < n; j++) A[i][j] += wi * xk[j]; }
    }
    return resolver(A, b);
  }
  function prodEscalar(x, c) { var s = 0; for (var i = 0; i < x.length; i++) s += x[i] * c[i]; return s; }
  function mediana(a) { if (!a.length) return 0; var s = a.slice().sort(function (p, q) { return p - q; }); var m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function errorLoo(X, Pt, pesos, nFijos, lam) {
    var errores = [];
    for (var i = 0; i < nFijos; i++) {
      var Xm = [], px = [], py = [], pw = [];
      for (var k = 0; k < X.length; k++) if (k !== i) { Xm.push(X[k]); px.push(Pt[k][0]); py.push(Pt[k][1]); pw.push(pesos[k]); }
      var cx = ridge(Xm, px, lam, pw), cy = ridge(Xm, py, lam, pw);
      errores.push(Math.hypot(prodEscalar(X[i], cx) - Pt[i][0], prodEscalar(X[i], cy) - Pt[i][1]));
    }
    return errores;
  }
  // puntosFijos: [[x,y]], rasgosFijos: [rasgos]; extra: muestras sueltas con peso propio
  function ajustarModelo(puntosFijos, rasgosFijos, puntosExtra, rasgosExtra, pesosExtra, lamFija) {
    var Pf = puntosFijos.slice(), Rf = rasgosFijos.slice(), descartados = [], i, j, k;
    var Pe = puntosExtra || [], Re = rasgosExtra || [], We = pesosExtra || Pe.map(function () { return 1; });
    var media, desv, X, Pt, pesos, lam, errores, errMed;
    var candidatos = lamFija ? [lamFija] : LAMBDAS;
    for (var ronda = 0; ronda < 4; ronda++) {
      Pt = Pf.concat(Pe); var Rt = Rf.concat(Re);
      pesos = Pf.map(function () { return PESO_FIJOS; }).concat(We);
      media = new Array(N_RASGOS).fill(0); desv = new Array(N_RASGOS).fill(0);
      for (k = 0; k < Rt.length; k++) for (i = 0; i < N_RASGOS; i++) media[i] += Rt[k][i] / Rt.length;
      for (k = 0; k < Rt.length; k++) for (i = 0; i < N_RASGOS; i++) desv[i] += (Rt[k][i] - media[i]) * (Rt[k][i] - media[i]) / Rt.length;
      for (i = 0; i < N_RASGOS; i++) { desv[i] = Math.sqrt(desv[i]); if (desv[i] < 1e-9) desv[i] = 1; }
      X = Rt.map(function (r) { return filaX(r, media, desv); });
      var nFijos = Pf.length, mejor = null;
      for (j = 0; j < candidatos.length; j++) {
        var e = (nFijos >= 4 && candidatos.length > 1) ? errorLoo(X, Pt, pesos, nFijos, candidatos[j]) : [0];
        var med = mediana(e);
        if (!mejor || med < mejor[0]) mejor = [med, candidatos[j], e];
      }
      errMed = mejor[0]; lam = mejor[1]; errores = mejor[2];
      if (nFijos > 6 && descartados.length < 3) {
        var peor = 0; for (i = 1; i < errores.length; i++) if (errores[i] > errores[peor]) peor = i;
        if (errores[peor] > Math.max(2.5 * errMed, 150)) { descartados.push(Pf[peor]); Pf.splice(peor, 1); Rf.splice(peor, 1); continue; }
      }
      break;
    }
    var cx = ridge(X, Pt.map(function (p) { return p[0]; }), lam, pesos);
    var cy = ridge(X, Pt.map(function (p) { return p[1]; }), lam, pesos);
    return { media: media, desv: desv, coef_x: cx, coef_y: cy, monitor: [0, 0, window.innerWidth, window.innerHeight],
             puntos: Pf, lambda: lam, n_muestras: Pt.length, descartados: descartados, error_px: Math.round(errMed), sesgo: [0, 0] };
  }
  // Compensación de cabeza: con la mirada en el centro y la cabeza moviéndose un poco, se aprende cuánto se va la
  // predicción por cada movimiento (nariz a los lados, arriba y abajo, y acercarse o alejarse) y se corrige después
  function ajustarCabeza(modelo, muestras, ref) {   // muestras: [[rasgos, pose]] mirando al centro; ref: pose de la calibración
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2, X = [], ex = [], ey = [];
    muestras.forEach(function (m) { var q = predecir(modelo, m[0], true, true); X.push([1, m[1][0] - ref[0], m[1][1] - ref[1], m[1][2] - ref[2]]); ex.push(cx - q[0]); ey.push(cy - q[1]); });
    if (X.length < 12) return null;
    var tr = [], te = []; X.forEach(function (x, i) { (i % 2 ? te : tr).push(i); });   // mitad para ajustar, mitad para comprobar
    var fila = function (idx) { return idx.map(function (i) { return X[i]; }); }, col = function (v, idx) { return idx.map(function (i) { return v[i]; }); };
    var ax = ridge(fila(tr), col(ex, tr), 0.001, tr.map(function () { return 1; })), ay = ridge(fila(tr), col(ey, tr), 0.001, tr.map(function () { return 1; }));
    var antes = [], despues = [];
    te.forEach(function (i) { var dx = X[i][1] * ax[1] + X[i][2] * ax[2] + X[i][3] * ax[3], dy = X[i][1] * ay[1] + X[i][2] * ay[2] + X[i][3] * ay[3]; antes.push(Math.hypot(ex[i], ey[i])); despues.push(Math.hypot(ex[i] - dx, ey[i] - dy)); });
    var mA = mediana(antes), mD = mediana(despues);
    if (!(mD < mA * 0.9)) return { mejora_px: 0, antes_px: Math.round(mA), despues_px: Math.round(mD) };   // no ayuda: no se usa
    return { ref: ref.slice(), coef_x: ax.slice(1), coef_y: ay.slice(1), mejora_px: Math.round(mA - mD), antes_px: Math.round(mA), despues_px: Math.round(mD) };
  }
  function correccionCabeza(modelo) {
    var c = modelo.cabeza; if (!c || !c.coef_x || !det.pose) return [0, 0];
    var d = [det.pose[0] - c.ref[0], det.pose[1] - c.ref[1], det.pose[2] - c.ref[2]];
    return [d[0] * c.coef_x[0] + d[1] * c.coef_x[1] + d[2] * c.coef_x[2], d[0] * c.coef_y[0] + d[1] * c.coef_y[1] + d[2] * c.coef_y[2]];
  }
  function predecir(modelo, rasgos, sinSesgo, sinCabeza) {
    var fx = filaX(rasgos, modelo.media, modelo.desv), cab = sinCabeza ? [0, 0] : correccionCabeza(modelo);
    var x = prodEscalar(fx, modelo.coef_x) + (modelo.sesgo && !sinSesgo ? modelo.sesgo[0] : 0) + cab[0];
    var y = prodEscalar(fx, modelo.coef_y) + (modelo.sesgo && !sinSesgo ? modelo.sesgo[1] : 0) + cab[1];
    // El modelo se hizo con un tamaño de ventana; si cambió, se escala
    var m = modelo.monitor, ex = window.innerWidth / (m[2] - m[0] || 1), ey = window.innerHeight / (m[3] - m[1] || 1);
    x *= ex; y *= ey;
    if (sinSesgo) return [x, y];   // crudo, sin recortar (para recentrar)
    return [Math.min(Math.max(x, 0), window.innerWidth - 1), Math.min(Math.max(y, 0), window.innerHeight - 1)];
  }
  function modeloValido(m) {
    function ok(a, n) { return Array.isArray(a) && a.length === n && a.every(function (v) { return typeof v === "number" && isFinite(v); }); }
    return !!(m && ok(m.coef_x, N_RASGOS + 1) && ok(m.coef_y, N_RASGOS + 1) && ok(m.media, N_RASGOS) && ok(m.desv, N_RASGOS) && m.desv.every(function (d) { return d > 0; }) && ok(m.monitor, 4));
  }
  var calibracion = leerJSON("winclus.calibracion", null);
  if (!modeloValido(calibracion)) calibracion = null;
  var ojosCentro = leerJSON("winclus.ojos_centro", null);

  // --- cámara y MediaPipe ---------------------------------------------------
  var estadoEl = null, btnActivar = null, ultimoAviso = 0, ultimoT = -1;
  function decir(t) { t = T(t); if (estadoEl && estadoEl.textContent !== t) estadoEl.textContent = t; }   // solo cambios: la región live no repite lo mismo cada 1,5 s
  function decirSuave(t) { var a = performance.now(); if (a - ultimoAviso > 1500) { ultimoAviso = a; decir(t); } }
  function cargarDetectorDe(fuente) {
    return import(fuente.base + "/vision_bundle.mjs").then(function (mp) {
      return mp.FilesetResolver.forVisionTasks(fuente.base + "/wasm").then(function (fs) {
        var crear = function (delegado) {
          return mp.FaceLandmarker.createFromOptions(fs, {
            baseOptions: { modelAssetPath: fuente.modelo, delegate: delegado },
            runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: false
          });
        };
        return crear("GPU").catch(function () { return crear("CPU"); });   // sin WebGL2 (iframe sandbox, escritorio remoto, GPU bloqueada): CPU
      });
    });
  }
  var promesaDetector = null;
  function cargarDetector() {
    if (landmarker) return Promise.resolve();
    if (promesaDetector) return promesaDetector;   // dos activaciones seguidas no cargan dos detectores
    var errores = [];
    function intentar(i) {
      if (i >= FUENTES_MP.length) return Promise.reject(new Error("No se pudo descargar el detector de caras (" + errores.join(" · ") + ")"));
      return cargarDetectorDe(FUENTES_MP[i]).then(function (lm) { landmarker = lm; }, function (e) {
        errores.push(FUENTES_MP[i].base.replace(/^https?:\/\//, "").split("/")[0] + ": " + (e && e.message ? e.message : e));
        return intentar(i + 1);
      });
    }
    promesaDetector = intentar(0).then(function () { promesaDetector = null; }, function (e) { promesaDetector = null; throw e; });
    return promesaDetector;
  }
  function vistaCamara(ver) { var v = q(".wcl-cam-vista"); if (v) v.style.display = ver ? "block" : "none"; }
  // Consentimiento explícito antes de la primera activación: los rasgos de la cara son dato biométrico sensible (Ley 1581/2012)
  var consentEl = null;
  // El permiso sale donde está la persona: en la pestaña Cara junto a «Activar cámara» o, si no (Inicio, la voz,
  // la caja «Dímelo»), en Inicio debajo de «¿Qué te cuesta?». Antes salía siempre en la pestaña Cara, escondida:
  // quien tocaba «No puedo usar el ratón» no veía el botón para aceptar y parecía que no pasaba nada.
  function pedirConsentimientoCamara() {
    var enCara = tabs.cara.classList.contains("activa") && panel.classList.contains("abierto");
    if (consentEl && consentEl.offsetParent) { consentEl.querySelector("button").focus(); return; }
    if (consentEl) { consentEl.remove(); consentEl = null; }   // estaba en una pestaña que no se ve
    if (!enCara) { if (!panel.classList.contains("abierto")) abrir(true); elegirTab("inicio"); }
    var ancla = enCara ? btnActivar : situEl, vuelta = enCara ? btnActivar : situEl.querySelector('[data-situ="raton"]');
    consentEl = el("div", { "class": "wcl-consent", "role": "group", "aria-label": "Permiso para usar la cámara" },
      '<p>Para mover el puntero, Winclus mira tu cara con la cámara. El vídeo se analiza en este navegador y no se guarda ni se envía a ningún sitio. Si calibras los ojos, guarda en este navegador unos números sobre tu mirada (dato biométrico), que puedes borrar en «Más → Restablecer». <a href="https://winclus.com/privacidad" target="_blank" rel="noopener">Cómo tratamos tus datos</a>.</p>');
    var si = botonGrande("Acepto y activo la cámara", "", function () {
      escribirJSON("winclus.consentimiento_camara", { fecha: new Date().toISOString(), version: VERSION });
      consentidoAhora = true;   // aunque localStorage esté bloqueado (iframe de otro origen, modo privado): vale para esta sesión
      consentEl.remove(); consentEl = null; activarCamara();
    });
    var no = botonGrande("Ahora no", "suave", function () { consentEl.remove(); consentEl = null; if (vuelta) vuelta.focus(); pintarSitu(); });
    consentEl.appendChild(si); consentEl.appendChild(no);
    ancla.parentNode.insertBefore(consentEl, ancla.nextSibling);
    si.focus();
    try { consentEl.scrollIntoView({ block: "nearest" }); } catch (e) {}
  }
  var consentidoAhora = false, activando = false, reanudada = false;
  function activarCamara() {
    if (!opciones.camara || !btnActivar || activando) return;
    if (camaraActiva) { desactivarCamara(); return; }
    if (!consentidoAhora && !leerJSON("winclus.consentimiento_camara", null)) { pedirConsentimientoCamara(); return; }
    activando = true; var gen = ++generacion;   // si algo apaga la cámara mientras carga, esta activación se abandona
    btnActivar.disabled = true; decir("Cargando el detector de cara (unos segundos la primera vez)…");
    cargarDetector().then(function () {
      if (gen !== generacion) throw new Error("cancelado");
      decir("Detector listo. Pidiendo permiso para la cámara…");
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("Este navegador no da acceso a la cámara. Hace falta una página https (o localhost).");
      return navigator.mediaDevices.getUserMedia({ video: { width: CAM_W, height: CAM_H, facingMode: "user" }, audio: false }).catch(function (e) {
        var n = e && e.name;
        throw new Error(n === "NotAllowedError" ? "No hay permiso para la cámara. Pulsa el candado de la barra de direcciones y permite la cámara."
          : n === "NotFoundError" ? "No se encontró ninguna cámara." : n === "NotReadableError" ? "Otra aplicación está usando la cámara." : (e && e.message ? e.message : e));
      });
    }).then(function (f) {
      if (gen !== generacion) { f.getTracks().forEach(function (t) { t.stop(); }); throw new Error("cancelado"); }
      flujo = f;
      if (!video) { video = el("video", { "class": "wcl-video", "playsinline": "", "muted": "", "autoplay": "" }); caja.appendChild(video); }
      video.muted = true; video.playsInline = true;   // sin esto play() puede fallar si no hubo un clic real antes
      video.srcObject = f;
      return video.play();
    }).then(function () {
      if (gen !== generacion) throw new Error("cancelado");
      activando = false; camaraActiva = true; pausado = false; contar("camara"); reiniciarAyudaClic();
      escribirJSON("winclus.camara_seguir", true);   // la página siguiente de este sitio la vuelve a encender (reanudarCamara)
      parpadeo.reiniciar(); reiniciarPuntero();
      btnActivar.textContent = T("Apagar cámara"); btnActivar.classList.add("rojo"); btnActivar.disabled = false;
      btnPausa.style.display = "block"; pintarPausa();
      cursor.style.display = "block"; mover(window.innerWidth / 2, window.innerHeight / 2);
      vistaCamara(ajustes.camara_ver);
      decir("Cámara activa. Mira al centro un momento mientras aprende cómo son tus ojos abiertos.");
      if (reanudada) { reanudada = false; avisar("Cámara encendida otra vez, como la dejaste.", false, 5000); } else avisar("Activado");
      if (ajustes.modo_puntero === "ojos" && ajustes.ojos_modo !== "palanca" && !calibracion) {
        decir("Para mover el puntero con los ojos hay que calibrar una vez: en 3 segundos empieza la calibración (unos 40 s).");
        setTimeout(function () { if (camaraActiva && !calibracion && !calibrando) { abrir(false); empezarCalibracion(false); } }, 3000);
      }
      requestAnimationFrame(bucle.bind(null, gen));
    }).catch(function (err) {
      activando = false; reanudada = false;
      if (flujo) { flujo.getTracks().forEach(function (t) { t.stop(); }); flujo = null; }   // sin flujo huérfano con la luz de la cámara encendida
      if (video) { try { video.srcObject = null; } catch (x) {} }
      if (btnActivar) btnActivar.disabled = false;
      if (!(err && err.message === "cancelado")) decir("No se pudo activar: " + (err && err.message ? err.message : err));
    });
  }
  var generacion = 0;
  // porSalir: la página se va (pagehide). Se apaga la cámara, pero se recuerda que estaba encendida para que la
  // página siguiente la reanude; apagarla a mano (o Restablecer, o «Todo apagado») sí lo olvida.
  function desactivarCamara(porSalir) {
    if (porSalir !== true) escribirJSON("winclus.camara_seguir", null);
    generacion++; activando = false;   // invalida cualquier activación a medias
    if (btnActivar) btnActivar.disabled = false;
    camaraActiva = false; pausado = false; pintarPausa(); reiniciarAyudaClic(); quitarApuntado(); cerrarElegir();
    if (calibrando) cerrarCalibracion();
    if (flujo) { flujo.getTracks().forEach(function (t) { t.stop(); }); flujo = null; }
    if (video) video.srcObject = null;
    cursor.style.display = "none"; btnPausa.style.display = "none";
    cerrarMenu(); cerrarLupa(); soltarArrastre(); ocultarTeclado();   // las órdenes por voz siguen: no dependen de la cámara
    historialRasgos = []; anclaParpadeo = null; det.cara = false; det.track = null; det.rasgos = null; det.mirada = null;
    rvfcActivo = false; cuadroNuevo = true;
    vistaCamara(false);
    if (btnActivar) { btnActivar.textContent = T("Activar cámara"); btnActivar.classList.remove("rojo"); }
    decir("Cámara apagada.");
  }
  // La inferencia va a la tasa de la cámara, no a la del refresco de pantalla: requestVideoFrameCallback avisa de cada
  // cuadro nuevo (Chrome, Edge, Safari, Firefox ≥ 132); donde no existe se infiere en cada refresco como antes.
  // En modo ahorro, como mucho 15 veces por segundo. El puntero (vuelta) sí se mueve en cada refresco, para que vaya suave.
  var cuadroNuevo = true, rvfcActivo = false, ultimaInferencia = 0;
  function marcarCuadro(gen) { if (gen !== generacion || !camaraActiva) return; cuadroNuevo = true; video.requestVideoFrameCallback(marcarCuadro.bind(null, gen)); }   // una sola cadena por activación
  var fallosDeteccion = 0;
  function bucle(gen) {
    if (!camaraActiva || gen !== generacion) return;
    var t = performance.now();
    if (!rvfcActivo && video.requestVideoFrameCallback) { rvfcActivo = true; video.requestVideoFrameCallback(marcarCuadro.bind(null, gen)); }
    var toca = video.readyState >= 2 && t !== ultimoT && (!rvfcActivo || cuadroNuevo) && (!ajustes.ahorro || t - ultimaInferencia >= 66);
    if (toca) {
      ultimoT = t; cuadroNuevo = false; ultimaInferencia = t; det.inferencias = (det.inferencias || 0) + 1;
      var r = null;
      try { r = landmarker.detectForVideo(video, t); fallosDeteccion = 0; } catch (e) {
        // Contexto WebGL perdido (móvil que vuelve de segundo plano): tras 30 fallos seguidos se recrea el detector
        if (++fallosDeteccion === 30) { try { landmarker.close(); } catch (x) {} landmarker = null; fallosDeteccion = 0; decir("Reiniciando el detector de cara…"); cargarDetector().then(function () { decir("Detector listo."); }, function () { decir("No se pudo reiniciar el detector. Apaga y enciende la cámara."); }); }
      }
      if (r && r.faceLandmarks && r.faceLandmarks.length) procesarCara(r, t / 1000);
      else { if (det.cara) { bufTrack = []; delayCount = 0; trackUltimo = null; ultimaVel = null; } det.cara = false; det.track = null; det.rasgos = null; det.mirada = null; decirSuave("No veo tu cara. Ponte frente a la cámara con luz de frente."); }
    }
    try { vuelta(t / 1000); } catch (e) { if (window.console) console.warn("Winclus:", e); }
    if (ajustes.camara_ver && panel.classList.contains("abierto")) dibujarCamara();
    requestAnimationFrame(bucle.bind(null, gen));
  }
  function procesarCara(r, tS) {
    var lm = r.faceLandmarks[0], bs = {};
    var cats = r.faceBlendshapes && r.faceBlendshapes[0] && r.faceBlendshapes[0].categories;
    if (cats) for (var i = 0; i < cats.length; i++) bs[cats[i].categoryName] = cats[i].score;
    det.cara = true; det.t = tS; det.lm = lm; det.bs = cats ? bs : null;
    // La aplicación espeja la imagen: mover la cabeza a la derecha lleva el puntero a la derecha
    det.track = [(1 - lm[8].x) * CAM_W, lm[8].y * CAM_H];
    parpadeo.procesar(lm, det.bs, ajustes.parpadeo_umbral, ajustes.parpadeo_ms, tS);
    // Al cerrar los ojos la cabeza y las cejas se mueven un poco y el puntero se
    // desvía: el clic se hace donde estaba el puntero al EMPEZAR a cerrarlos
    if (parpadeo.episodioDesde !== null) { if (!anclaParpadeo) anclaParpadeo = [P.x, P.y]; } else anclaParpadeo = null;
    det.relacion = parpadeo.estado.relacion;
    calcularMirada(lm, det.bs);
    if (det.rasgos) {
      historialRasgos.push([tS, det.rasgos, det.relacion]);
      while (historialRasgos.length && tS - historialRasgos[0][0] > 1.5) historialRasgos.shift();
    }
    if (!parpadeo.estado.listo) { decirSuave("Aprendiendo tus ojos abiertos… (" + parpadeo.bufDer.length + "/" + PB.MIN_BASE + ")"); baseAvisada = false; }
    else if (!baseAvisada) { baseAvisada = true; ultimoAviso = 0; decirSuave("Listo. Mueve la cabeza para mover el puntero y cierra los ojos medio segundo para hacer clic. Para bajar la página, lleva el puntero al borde de abajo; para subir, al de arriba."); }
    else if (parpadeo.ultimoEpisodio && tS - parpadeo.ultimoEpisodio.t < 0.1) decirSuave("Ojos cerrados " + parpadeo.ultimoEpisodio.ms + " ms: " + parpadeo.ultimoEpisodio.resultado);
  }
  function dibujarCamara() {
    var lienzo = q(".wcl-cam-vista canvas"); if (!lienzo || !video) return;
    var c = lienzo.getContext("2d"), w = lienzo.width, h = lienzo.height;
    c.save(); c.translate(w, 0); c.scale(-1, 1); c.drawImage(video, 0, 0, w, h); c.restore();
    if (det.cara && det.lm) {
      var n = det.lm[1];
      c.fillStyle = "#F2B705"; c.beginPath(); c.arc((1 - n.x) * w, n.y * h, 5, 0, 6.3); c.fill();
      if (det.iris) det.iris.forEach(function (p) { c.strokeStyle = "#34C26B"; c.lineWidth = 2; c.beginPath(); c.arc(w - p[0] / CAM_W * w, p[1] / CAM_H * h, 4, 0, 6.3); c.stroke(); });
      c.fillStyle = "rgba(16,31,61,.7)"; c.fillRect(0, h - 22, w, 22); c.fillStyle = "#fff"; c.font = "12px system-ui";
      c.fillText("ojos " + Math.round(det.relacion * 100) + " %" + (parpadeo.estado.cerrados ? " · cerrados " + parpadeo.estado.cerradosMs + " ms" : ""), 6, h - 7);
    }
  }

  // ============================================================ puntero ==
  // controllers/mouse_controller.py: cabeza (velocidad), ojos directo, híbrido y palanca
  var bufTrack = [], prevX = 0, prevY = 0, delayCount = 0, kernel = null;
  var filtroDirecto = [new OneEuro(1, 0.004), new OneEuro(1, 0.004)], fijador = new Fijacion(), fijacion = null;
  var rasgosMuestras = [], rasgosUltimo = null, congeladoHasta = 0, ultimoSalto = 0, ultimoSaltoPunto = null, cabezaDesdeSalto = [0, 0];
  var miradaMuestras = [], centrandoPalanca = null, calibrando = false, trackUltimo = null, ultimaVel = null, miradaUltima = null;
  var SEL_CLICABLE = 'a[href],button,input,select,textarea,summary,label,[role=button],[role=link],[role=checkbox],[role=radio],[role=tab],[role=menuitem],[role=option],[role=switch],[onclick],[tabindex]:not([tabindex="-1"]),[contenteditable=""],[contenteditable="true"]';

  function kernelHamming(n) {   // np.hamming(2n)[:n], normalizado
    var M = 2 * n, k = [], s = 0, i;
    for (i = 0; i < n; i++) { var v = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (M - 1)); k.push(v); s += v; }
    for (i = 0; i < n; i++) k[i] /= s;
    return k;
  }
  function reiniciarPuntero() {
    bufTrack = []; delayCount = 0; rasgosMuestras = []; rasgosUltimo = null; miradaMuestras = []; trackUltimo = null; ultimaVel = null; miradaUltima = null;
    filtroDirecto[0].reiniciar(); filtroDirecto[1].reiniciar(); fijador.reiniciar(); fijacion = null;
    ultimoSaltoPunto = null; cabezaDesdeSalto = [0, 0];
  }
  var ultimoHover = null, ultimoMovX = -1, ultimoMovY = -1;
  function mover(x, y) {
    if (!isFinite(x) || !isFinite(y)) return;
    P.x = Math.max(0, Math.min(window.innerWidth - 1, x));
    P.y = Math.max(0, Math.min(window.innerHeight - 1, y));
    cursor.style.transform = "translate(" + P.x + "px," + P.y + "px)";
    if (ajustes.guia) guia.style.top = P.y + "px";
    if (ajustes.mascara) actualizarMascara(P.y);
    if (ajustes.lupa_pantalla) seguirLupaPantalla(P.x, P.y);
    marcarApuntadoPoco();
  }
  function moverRel(dx, dy) { mover(P.x + dx, P.y + dy); }
  function congelar(s) { congeladoHasta = performance.now() / 1000 + s; fijacion = null; fijador.reiniciar(); }
  function bajoPuntero(x, y) {
    var e = document.elementFromPoint(x == null ? P.x : x, y == null ? P.y : y);
    return enWidget(e) ? null : e;
  }
  function avisarHover() {   // que la página vea pasar el puntero (menús que se abren al pasar, etc.)
    if (Math.abs(P.x - ultimoMovX) < 1 && Math.abs(P.y - ultimoMovY) < 1) return;
    ultimoMovX = P.x; ultimoMovY = P.y;
    var e = bajoPuntero(); if (!e) return;
    var extra = { bubbles: true, cancelable: true, clientX: P.x, clientY: P.y, view: window, buttons: arrastrando ? 1 : 0 };
    if (e !== ultimoHover) {
      if (ultimoHover) { try { ultimoHover.dispatchEvent(new MouseEvent("mouseout", extra)); ultimoHover.dispatchEvent(new PointerEvent("pointerout", extra)); } catch (x) {} }
      try { e.dispatchEvent(new PointerEvent("pointerover", extra)); e.dispatchEvent(new MouseEvent("mouseover", extra)); } catch (x) {}
      ultimoHover = e;
      marcarApuntado(e);
    }
    try { e.dispatchEvent(new PointerEvent("pointermove", extra)); e.dispatchEvent(new MouseEvent("mousemove", extra)); } catch (x) {}
  }
  // Lo que se pulsaría si se hiciera clic ahora, con un marco bien visible:
  // con los ojos no basta con acertar, hay que ver que se ha acertado antes de
  // gastar el gesto. Si no hay nada debajo pero hay algo cerca, se marca eso.
  var apuntadoEl = null, apuntadoT = 0;
  function marcarApuntadoPoco() {
    // Mirar qué hay justo debajo es barato y se hace en cada movimiento; mirar
    // qué hay CERCA recorre la página entera, así que eso como mucho ocho
    // veces por segundo.
    if (!ajustes.apuntado_marcar || !camaraActiva) { quitarApuntado(); return; }
    var e = elementoBajo(P.x, P.y), obj = e && e.closest ? e.closest(SEL_CLICABLE) : null;
    if (obj && (enWidget(obj) || obj.disabled)) obj = null;
    if (obj) { ponerApuntado(obj); return; }
    var ahora = performance.now();
    if (ahora - apuntadoT < 120) return;
    apuntadoT = ahora;
    var cerca = candidatosCerca(P.x, P.y, ajustes.elegir_radio_px);
    ponerApuntado(cerca.length === 1 ? cerca[0].el : null);
  }
  function marcarApuntado(e) {
    if (!ajustes.apuntado_marcar || !camaraActiva) { quitarApuntado(); return; }
    var obj = e && e.closest ? e.closest(SEL_CLICABLE) : null;
    ponerApuntado(obj && !enWidget(obj) && !obj.disabled ? obj : null);
  }
  function ponerApuntado(objetivo) {
    if (objetivo === apuntadoEl) return;
    quitarApuntado();
    if (!objetivo) return;
    apuntadoEl = objetivo;
    try { apuntadoEl.classList.add("wcl-apuntado"); } catch (x) { apuntadoEl = null; }
  }
  function quitarApuntado() {
    if (!apuntadoEl) return;
    try { apuntadoEl.classList.remove("wcl-apuntado"); } catch (x) {}
    apuntadoEl = null;
  }

  function velocidadCabeza() {
    if (!det.track) return null;
    var n = Math.max(2, Math.min(30, ajustes.suavizado | 0));
    if (!kernel || kernel.length !== n) { kernel = kernelHamming(n); bufTrack = []; delayCount = 0; }
    // Cada fotograma de la cámara cuenta una vez aunque este bucle vaya a 60-144 Hz
    if (det.track === trackUltimo) return ultimaVel;
    trackUltimo = det.track;
    bufTrack.push(det.track); while (bufTrack.length > n) bufTrack.shift();
    var sx = 0, sy = 0, off = n - bufTrack.length;
    for (var i = 0; i < bufTrack.length; i++) { sx += kernel[i + off] * bufTrack[i][0]; sy += kernel[i + off] * bufTrack[i][1]; }
    if (!isFinite(sx) || !isFinite(sy)) { bufTrack = []; delayCount = 0; ultimaVel = null; return null; }
    var vx = sx - prevX, vy = sy - prevY; prevX = sx; prevY = sy;
    delayCount++; ultimaVel = null;
    if (delayCount < n + 12) return null;   // en espera hasta que el suavizado se llena
    var spd = ajustes.velocidad;
    vx *= spd; vy *= spd;
    if (ajustes.aceleracion) { vx *= acel(vx); vy *= acel(vy); }
    ultimaVel = [vx, vy];
    return ultimaVel;
  }
  function acel(v) { return 0.6 + 1.2 / (1 + Math.exp(-(Math.abs(v) - 3))); }

  function miradaFiltrada(tS) {
    if (!calibracion || !det.rasgos || !ojosParaMirar()) return null;   // parpadeo o sin cara: se queda donde está
    if (parpadeo.episodioDesde !== null) return null;   // mientras los ojos se cierran o se abren, el iris no vale: el puntero no se mueve
    if (det.rasgos === rasgosUltimo) return null;
    rasgosUltimo = det.rasgos;
    rasgosMuestras.push(det.rasgos); if (rasgosMuestras.length > 5) rasgosMuestras.shift();
    var med = [];
    for (var i = 0; i < N_RASGOS; i++) med.push(mediana(rasgosMuestras.map(function (r) { return r[i]; })));
    var p = estirarAlcance(predecir(calibracion, med));
    var suav = Math.max(1, ajustes.ojos_suavizado | 0);
    if (ajustes.ojos_quieto) suav = Math.max(12, suav);
    var corte = 3 / Math.pow(suav, 0.8);
    filtroDirecto[0].minCutoff = corte; filtroDirecto[1].minCutoff = corte; filtroDirecto[0].beta = 0.003; filtroDirecto[1].beta = 0.003;
    return [filtroDirecto[0].filtrar(p[0], tS), filtroDirecto[1].filtrar(p[1], tS)];
  }
  // La calibración mide los puntos con un margen del 8 % (MARGEN_C), así que
  // el modelo nunca predice más allá del 92 % de la pantalla: mirando a una
  // esquina el puntero se queda corto y ahí no se puede elegir nada. Esto
  // estira lo predicho alrededor del centro justo lo que falta para que la
  // zona calibrada cubra la pantalla entera.
  function estirarAlcance(p) {
    if (!ajustes.ojos_alcance) return p;
    var f = 1 / (1 - 2 * MARGEN_C), cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    return [Math.max(0, Math.min(window.innerWidth - 1, cx + (p[0] - cx) * f)),
            Math.max(0, Math.min(window.innerHeight - 1, cy + (p[1] - cy) * f))];
  }
  function moverDirecto(tS) {
    var p = miradaFiltrada(tS); if (!p) return;
    // «El puntero tiembla»: con un solo interruptor se pide más quietud (zona
    // de fijación más ancha y más tiempo dentro de ella) sin tener que
    // entender tres deslizadores.
    var radio = ajustes.ojos_quieto ? Math.max(90, ajustes.ojos_fijacion_px) : ajustes.ojos_fijacion_px;
    var persist = (ajustes.ojos_quieto ? Math.max(300, ajustes.ojos_persistencia_ms) : ajustes.ojos_persistencia_ms) / 1000;
    fijacion = fijador.actualizar(p[0], p[1], radio, persist, Math.max(3 * radio, 250), tS);
    mover(fijacion[0], fijacion[1]);
  }
  function moverHibrido(tS) {
    var vel = velocidadCabeza(), factor = ajustes.hibrido_cabeza / 100;
    var vx = vel ? vel[0] * factor : 0, vy = vel ? vel[1] * factor : 0;
    var cabezaQuieta = Math.hypot(vx, vy) < 0.6;
    var p = miradaFiltrada(tS);
    if (p) {
      var radio = ajustes.ojos_fijacion_px;
      fijacion = fijador.actualizar(p[0], p[1], radio, ajustes.ojos_persistencia_ms / 1000, Math.max(3 * radio, 250), tS);
      var salta = fijacion && !fijador.moviendo && (ultimoSaltoPunto === null ||
        (cabezaQuieta && Math.hypot(fijacion[0] - ultimoSaltoPunto[0], fijacion[1] - ultimoSaltoPunto[1]) >= ajustes.hibrido_salto_px));
      if (salta) { ultimoSalto = tS; ultimoSaltoPunto = fijacion.slice(); cabezaDesdeSalto = [0, 0]; mover(fijacion[0], fijacion[1]); return; }
    }
    if (!vel || (vx === 0 && vy === 0)) return;
    if (tS - ultimoSalto < ajustes.hibrido_pausa_ms / 1000) return;
    moverRel(vx, vy); cabezaDesdeSalto[0] += vx; cabezaDesdeSalto[1] += vy;
  }
  function afinadoConCabeza() { return Math.hypot(cabezaDesdeSalto[0], cabezaDesdeSalto[1]) >= 12; }
  function moverPalanca(tS) {
    if (!det.mirada) { miradaMuestras = []; return; }
    if (!ojosCentro) {   // sin centro: se toma de lo que se mira el primer segundo y medio
      centrandoPalanca = centrandoPalanca || []; if (det.mirada !== miradaUltima) { miradaUltima = det.mirada; centrandoPalanca.push(det.mirada); }
      decirSuave("Mira al centro de la pantalla: tomando el punto de reposo… " + centrandoPalanca.length + "/45");
      if (centrandoPalanca.length >= 45) { fijarCentroPalanca(centrandoPalanca); centrandoPalanca = null; }
      return;
    }
    var n = Math.max(1, ajustes.ojos_suavizado | 0);
    if (det.mirada !== miradaUltima) { miradaUltima = det.mirada; miradaMuestras.push(det.mirada); while (miradaMuestras.length > n) miradaMuestras.shift(); }
    if (!miradaMuestras.length) return;
    var gx = 0, gy = 0; miradaMuestras.forEach(function (m) { gx += m[0] / miradaMuestras.length; gy += m[1] / miradaMuestras.length; });
    var zona = ajustes.ojos_zona_muerta / 100, gan = ajustes.ojos_velocidad * 2, vert = ajustes.ojos_vertical / 100;
    function palanca(d) { var m = Math.abs(d) - zona; return m <= 0 ? 0 : Math.sign(d) * m * gan; }
    var vx = palanca(gx - ojosCentro[0]), vy = palanca(gy - ojosCentro[1]) * vert;
    vx = Math.max(-30, Math.min(30, vx)); vy = Math.max(-30, Math.min(30, vy));
    if (vx || vy) moverRel(vx, vy);
  }
  function fijarCentroPalanca(muestras) {
    ojosCentro = [mediana(muestras.map(function (m) { return m[0]; })), mediana(muestras.map(function (m) { return m[1]; }))];
    escribirJSON("winclus.ojos_centro", ojosCentro); decir("Punto de reposo de la palanca guardado."); avisar("Centrado");
  }

  function modoEfectivo() {
    if (ajustes.modo_puntero !== "ojos") return "cabeza";
    if (ajustes.ojos_modo === "palanca") return "palanca";
    return calibracion ? ajustes.ojos_modo : "cabeza";
  }
  function vuelta(tS) {
    if (calibrando) { tickCalibracion(tS); return; }
    if (!pausado && ajustes.puntero_externo) { tickClics(tS); tickBordes(tS); tickMenu(tS); tickTeclado(); cursor.style.opacity = ""; return; }   // el puntero lo lleva otro aparato (Tobii, Windows Eye Control): solo clics y gestos
    if (!pausado) {
      var modo = modoEfectivo(), congelado = tS < congeladoHasta;
      if (modo === "directo") { if (!congelado) moverDirecto(tS); }
      else if (modo === "hibrido") { if (!congelado) moverHibrido(tS); }
      else if (modo === "palanca") { if (!congelado) moverPalanca(tS); }
      else { var v = velocidadCabeza(); if (v && !congelado && (v[0] || v[1])) moverRel(v[0], v[1]); }   // congelado: se calcula pero no se aplica, para que al descongelar no salte
      if (modo !== "cabeza" && modo !== "hibrido" && det.track) velocidadCabeza();   // el búfer de cabeza al día para cambiar de modo sin salto
    }
    tickClics(tS);
    if (!pausado) { tickBordes(tS); tickIman(tS); tickMenu(tS); tickTeclado(); tickAyudaClic(tS); avisarHover(); }
    cursor.style.opacity = pausado ? ".35" : "";
  }

  // --- si el gesto de clic no sale, ofrecer otro ---------------------------
  // Un parpadeo no le sale igual a todo el mundo: hay quien no cierra los ojos
  // del todo, quien lleva gafas o quien tiene un párpado más caído. Si lleva
  // un buen rato moviendo el puntero y no ha conseguido pulsar ni una vez,
  // Winclus lo dice y ofrece otra forma, una sola vez por sesión.
  var camaraDesde = 0, recorrido = 0, ayudaClicHecha = false, ultimoPunto = null, clicAlEmpezar = 0;
  var AYUDA_CLIC_S = 45, AYUDA_CLIC_PX = 1500;
  function reiniciarAyudaClic() {
    camaraDesde = 0; recorrido = 0; ayudaClicHecha = false; ultimoPunto = null;
    clicAlEmpezar = ultimoClic;   // lo que cuenta es si consigue pulsar DESDE que encendió la cámara
  }
  function tickAyudaClic(tS) {
    if (!ajustes.ayuda_clic || ayudaClicHecha || !camaraActiva || ajustes.barrido || calibrando) return;
    if (!camaraDesde) camaraDesde = tS;
    if (ultimoPunto) recorrido += Math.hypot(P.x - ultimoPunto[0], P.y - ultimoPunto[1]);
    ultimoPunto = [P.x, P.y];
    if (ultimoClic !== clicAlEmpezar || tS - camaraDesde < AYUDA_CLIC_S || recorrido < AYUDA_CLIC_PX) return;
    ayudaClicHecha = true;
    var formas = [["quieto", "Pulsar quedándome quieto"], ["boca", "Pulsar abriendo la boca"],
                  ["cejas", "Pulsar subiendo las cejas"], ["parpadeo", "Pulsar cerrando los ojos"]];
    var opciones = formas.filter(function (f) { return f[0] !== ajustes.modo_clic; }).map(function (f) {
      return { texto: T(f[1]), al: function () {
        ajustes.modo_clic = f[0]; guardar(); reiniciarQuieto();
        refrescos.forEach(function (r) { r(); });   // los botones del panel, al día
        avisar(T(f[1])); decirVoz(T(f[1]), true, true);
      } };
    });
    opciones.push({ texto: T("Seguir igual"), al: function () {} });
    abrirElegir(T("¿No consigues hacer clic?"), opciones);
    decirVoz(T("Llevas un rato moviendo el puntero sin pulsar nada. ¿Quieres pulsar de otra forma?"), true, true);
  }

  // ------------------------------------------------- bajar y subir por los bordes --
  // La forma más sencilla de desplazar la página con la cara o los ojos: el puntero en el borde de abajo baja la
  // página (más deprisa cuanto más al borde) y en el de arriba la sube. Hay que quedarse 0,35 s para que empiece,
  // así pasar por el borde no mueve nada. Con el teclado en pantalla, el menú, la lupa o un arrastre no actúa.
  var bordeDesde = 0, bordeLado = 0, bordeAvisado = false;
  // La franja tiene que ser ancha: con los ojos el puntero llega como mucho al 92 % de la pantalla (la calibración
  // mide hasta ahí, con un margen del 8 %), así que una franja estrecha no se alcanzaría nunca mirando. 12 % de la
  // altura, entre 80 y 160 px. Con la cabeza el puntero sí llega al borde del todo y también entra.
  function bordePx() { return Math.max(80, Math.min(160, Math.round(window.innerHeight * 0.12))); }
  var bordeEl = el("div", { "class": "wcl-borde", "aria-hidden": "true" });
  // Señales para saber dónde apuntar: salen solas mientras la cámara está en marcha
  var guiaAbajo = el("div", { "class": "wcl-guia-borde abajo", "aria-hidden": "true" }, "▼ Bajar");
  var guiaArriba = el("div", { "class": "wcl-guia-borde arriba", "aria-hidden": "true" }, "▲ Subir");
  function guiasBorde(si) { guiaAbajo.classList.toggle("visible", !!si); guiaArriba.classList.toggle("visible", !!si); }
  function tickBordes(tS) {
    var H = window.innerHeight, B = bordePx(), lado = 0;
    var puede = ajustes.bordes_desplazan && !menuVisible && !tecVisible && !lupa && !calibrando && !arrastrando;
    if (puede) { if (P.y >= H - B) lado = 1; else if (P.y <= B) lado = -1; }
    if (lado !== bordeLado) { bordeLado = lado; bordeDesde = tS; bordeEl.classList.remove("abajo", "arriba"); }
    var desplazando = lado && tS - bordeDesde >= 0.35;
    guiasBorde(puede && camaraActiva && !pausado && !desplazando && !panel.classList.contains("abierto"));
    if (!desplazando) return;
    var prof = lado === 1 ? (P.y - (H - B)) / B : (B - P.y) / B;   // 0 al entrar en la franja, 1 pegado al borde
    var paso = lado * (3 + 9 * Math.min(1, Math.max(0, prof)));   // de 3 a 12 px por cuadro
    rueda(paso, false, P.x, Math.min(H - B - 20, Math.max(B + 20, P.y)));   // se desplaza lo que hay bajo el puntero, sin contar la franja del borde
    bordeEl.classList.toggle("abajo", lado === 1); bordeEl.classList.toggle("arriba", lado === -1);
    bordeEl.textContent = T(lado === 1 ? "Bajando: aparta el puntero del borde para parar" : "Subiendo: aparta el puntero del borde para parar");
    if (!bordeAvisado) { bordeAvisado = true; decirVoz(lado === 1 ? "Bajando. Aparta el puntero del borde para parar." : "Subiendo. Aparta el puntero del borde para parar.", true, true); }
  }
  caja.appendChild(bordeEl); caja.appendChild(guiaAbajo); caja.appendChild(guiaArriba);
  caja.appendChild(estiloCon('.wcl-borde{position:fixed;left:0;right:0;display:none;z-index:2147483003;text-align:center;padding:8px 12px;background:#2743B4;color:#fff;font:700 15px "Segoe UI",system-ui,sans-serif;pointer-events:none}.wcl-borde.abajo{display:block;bottom:0}.wcl-borde.arriba{display:block;top:0}'
    + '.wcl-guia-borde{position:fixed;left:50%;transform:translateX(-50%);display:none;z-index:2147483002;padding:6px 16px;border-radius:999px;background:rgba(16,31,61,.82);color:#fff;font:700 14px "Segoe UI",system-ui,sans-serif;pointer-events:none}.wcl-guia-borde.visible{display:block}.wcl-guia-borde.abajo{bottom:8px}.wcl-guia-borde.arriba{top:8px}'));

  // --------------------------------------------------------------- imán --
  // src/iman.py: puntero quieto 0,3 s cerca de un control → se pega a él
  var imanQuietoDesde = 0, imanX = 0, imanY = 0, imanHecho = false, imanEl = null;
  function esClicable(e) { return !!(e && e.closest && e.closest(SEL_CLICABLE)); }
  function tickIman(tS) {
    var modo = modoEfectivo();
    if (!ajustes.iman_activo || (modo === "cabeza" && !ajustes.iman_cabeza) || lupa || menuVisible || elegirAbierto() || tecladoContiene(P.x, P.y) || arrastrando) return;
    if (Math.abs(P.x - imanX) > 6 || Math.abs(P.y - imanY) > 6) { imanX = P.x; imanY = P.y; imanQuietoDesde = tS; imanHecho = false; return; }
    if (imanHecho || tS - imanQuietoDesde < 0.3) return;
    imanHecho = true;
    var e = bajoPuntero();
    if (!e || esClicable(e) || (e.closest && e.closest(".wcl-root"))) return;
    var r = ajustes.iman_radio_px, mejor = null, lista = document.querySelectorAll(SEL_CLICABLE);
    for (var i = 0; i < lista.length; i++) {
      var c = lista[i]; if (c.closest(".wcl-root")) continue;
      var b = c.getBoundingClientRect();
      if (!b.width || !b.height || b.width > 520 || b.height > 320) continue;
      if (b.right < 0 || b.bottom < 0 || b.left > window.innerWidth || b.top > window.innerHeight) continue;
      var nx = Math.max(b.left + 4, Math.min(b.right - 4, P.x)), ny = Math.max(b.top + 4, Math.min(b.bottom - 4, P.y));
      var d = Math.hypot(nx - P.x, ny - P.y);
      if (d <= r && (!mejor || d < mejor.d)) mejor = { d: d, x: nx, y: ny, el: c };
    }
    if (!mejor) return;
    var real = document.elementFromPoint(mejor.x, mejor.y);
    if (!real || !(mejor.el === real || mejor.el.contains(real) || real.contains(mejor.el))) return;   // hay algo encima
    congelar(0.3); mover(mejor.x, mejor.y); fijador.fijarEn(mejor.x, mejor.y); fijacion = [mejor.x, mejor.y];
    if (ultimoSaltoPunto) ultimoSaltoPunto = [mejor.x, mejor.y];
    imanX = P.x; imanY = P.y;
    if (imanEl) imanEl.classList.remove("wcl-iman");
    imanEl = mejor.el; imanEl.classList.add("wcl-iman"); setTimeout(function () { if (imanEl) imanEl.classList.remove("wcl-iman"); }, 900);
    avisar(nombreDe(mejor.el));
  }
  function nombreDe(e) {
    // Los campos de formulario se nombran por su etiqueta o placeholder, nunca por lo escrito (contraseñas, datos)
    var esCampo = e.matches && e.matches("input,textarea,select");
    var t = e.getAttribute("aria-label") || e.getAttribute("title") || (esCampo ? (etiquetaCampo(e) || e.placeholder || e.name) : (e.value || e.innerText || e.alt)) || e.tagName.toLowerCase();
    t = String(t).replace(/\s+/g, " ").trim(); return t.length > 28 ? t.slice(0, 27) + "…" : t;
  }

  // --------------------------------------------------------------- clics --
  // controllers/clics.py + keybinder.py: parpadeo, boca, cejas, quieto, gestos extra, menú, arrastre, lupa
  var arrastrando = false, arrastreEl = null, ultimoClic = 0, lupa = null, lupaDesde = 0;
  var qAncla = null, qDesde = 0, qYaClic = false, qArmado = false, qProgreso = 0;
  var gestoEstado = {}, RUEDA_ESPERA = 0.6, ruedaAvisada = false;
  var ACCIONES = [["nada", "Nada"], ["clic", "Clic"], ["derecho", "Clic derecho"], ["doble", "Doble clic"], ["rueda_abajo", "Bajar"], ["rueda_arriba", "Subir"],
                  ["menu", "Menú de clics"], ["pausa", "Pausar / seguir"], ["teclado", "Teclado"], ["recentrar", "Recentrar"], ["leer", "Leer en voz alta"]];
  var GESTOS = [["jawOpen", "Abrir la boca"], ["browInnerUp", "Subir las cejas"], ["mouthRight", "Boca a la derecha"], ["mouthLeft", "Boca a la izquierda"],
                ["mouthPucker", "Fruncir los labios"], ["mouthSmile", "Sonreír"], ["mouthRollLower", "Meter el labio de abajo"],
                ["guinoIzq", "Guiñar el ojo izquierdo"], ["guinoDer", "Guiñar el ojo derecho"], ["cabezaIzq", "Inclinar la cabeza a la izquierda"], ["cabezaDer", "Inclinar la cabeza a la derecha"]];
  // Familia 3: el guiño es un ojo cerrado con el otro abierto (un parpadeo normal da 0) y la inclinación sale del ángulo
  // entre los rabillos de los ojos (puntos 33 y 263); 22 grados valen 1. Izquierda y derecha como se ven en espejo, igual
  // que la boca y las cejas. MediaPipe no detecta la lengua fuera: no está.
  function inclinacionCabeza() { if (!det.lm || !det.lm[33] || !det.lm[263]) return 0; var d = det.lm[33], i = det.lm[263]; return Math.atan2(i.y - d.y, i.x - d.x) * 180 / Math.PI; }
  function valorGesto(nombre) {
    if (nombre === "mouthSmile") return (forma("mouthSmileLeft") + forma("mouthSmileRight")) / 2;
    if (nombre === "guinoIzq") return Math.max(0, forma("eyeBlinkRight") - forma("eyeBlinkLeft"));   // ojo derecho de la persona: en espejo, el izquierdo
    if (nombre === "guinoDer") return Math.max(0, forma("eyeBlinkLeft") - forma("eyeBlinkRight"));
    if (nombre === "cabezaIzq" || nombre === "cabezaDer") { var g = inclinacionCabeza(); return Math.min(1, Math.max(0, (nombre === "cabezaIzq" ? g : -g) / 22)); }
    return forma(nombre);
  }

  function tickClics(tS) {
    if (!det.cara) return;
    var evento = parpadeo.tomarEvento();
    if (pausado) { if (evento === "largo") reanudar(); return; }
    // El gesto vale donde estaba el puntero al empezar a cerrar los ojos (si no se fue lejos: entonces es que se estaba moviendo a propósito)
    if (evento && anclaParpadeo && !menuVisible && !arrastrando && Math.hypot(P.x - anclaParpadeo[0], P.y - anclaParpadeo[1]) < 80) { congelar(0.4); mover(anclaParpadeo[0], anclaParpadeo[1]); }
    if (evento === "largo") {
      cerrarLupa(); reiniciarQuieto();
      if (sobrePausar()) { pausar(); return; }
      if (menuVisible) cerrarMenu(); else abrirMenu();
      return;
    }
    if (lupa && tS - lupaDesde > ajustes.lupa_tiempo_max_s) cerrarLupa();
    tickGestos(tS);
    if (ajustes.modo_clic === "parpadeo") { if (evento === "clic") clic(); }
    else if (ajustes.modo_clic === "quieto") tickQuieto(tS);
  }
  function tickGestos(tS) {
    var umbral = ajustes.gestos_umbral / 100;
    for (var i = 0; i < GESTOS.length; i++) {
      var g = GESTOS[i][0], accion = ajustes.gestos[g] || "nada";
      if (ajustes.modo_clic === "boca" && g === "jawOpen") accion = "clic";
      if (ajustes.modo_clic === "cejas" && g === "browInnerUp") accion = "clic";
      // El interruptor apaga las «otras acciones» pero nunca el gesto con el que se hace clic
      if (!ajustes.gestos_activos && accion !== "clic") continue;
      if (accion === "nada") continue;
      var v = valorGesto(g), s = gestoEstado[g] || (gestoEstado[g] = { activo: false, desde: 0, sujeto: false });
      if (!s.activo && v > umbral) {
        s.activo = true; s.desde = tS; s.sujeto = false;
        if (accion === "clic") clic();
        else if (accion !== "rueda_abajo" && accion !== "rueda_arriba") accionGesto(accion);
      } else if (s.activo && v < umbral - 0.1) {
        s.activo = false;
        if (s.sujeto) { s.sujeto = false; soltarArrastre(); }
      } else if (s.activo) {
        if (accion === "clic" && !s.sujeto && !arrastrando && (tS - s.desde) * 1000 >= ajustes.hold_ms) { s.sujeto = true; empezarArrastre(); }
        // La rueda con un gesto tarda en arrancar (RUEDA_ESPERA) y empieza despacio: abrir la boca para hablar,
        // bostezar o respirar no debe llevarse la página. Antes bastaban 0,15 s y salía disparada.
        if (accion === "rueda_abajo" || accion === "rueda_arriba") {
          var llevado = tS - s.desde;
          if (llevado > RUEDA_ESPERA) {
            var v2 = 3 + 7 * Math.min(1, (llevado - RUEDA_ESPERA) / 1.2);   // de 3 a 10 px por cuadro en algo más de un segundo
            rueda(accion === "rueda_abajo" ? v2 : -v2, false);
            if (!ruedaAvisada) { ruedaAvisada = true; avisar(T("La página se mueve porque tienes el gesto puesto en «") + T(accion === "rueda_abajo" ? "Bajar" : "Subir") + T("». Se cambia en Clics.")); decirVoz("La página se mueve por el gesto de la cara. Si no lo quieres, apaga «Usar los gestos de la cara» en la pestaña Clics.", true, true); }
          }
        }
      }
    }
  }
  function accionGesto(accion) {
    if (accion === "derecho") clicDerecho();
    else if (accion === "doble") dobleClic();
    else if (accion === "menu") { if (menuVisible) cerrarMenu(); else abrirMenu(); }
    else if (accion === "pausa") pausar();
    else if (accion === "teclado") alternarTeclado();
    else if (accion === "recentrar") recentrar();
    else if (accion === "leer") leerElemento(bajoPuntero());
  }
  function clic() {
    if (ayudaEl) { pararAyuda(); return; }   // con el aviso de ayuda sonando, cualquier gesto lo para
    if (ajustes.barrido) { barridoSenal(); return; }   // con el barrido activo, el gesto de clic es la señal
    if (sobrePausar()) { avisar("Cierra los ojos 1,2 s para pausar", true); return; }
    if (menuVisible) { elegirOpcion(opcionEn(P.x, P.y)); return; }
    if (arrastrando) { soltarArrastre(); return; }
    if (tecladoContiene(P.x, P.y)) { pulsarTeclaEn(P.x, P.y); return; }
    // Primero, elegir: si cerca del puntero hay cosas pulsables, se enseñan
    // por su nombre en botones grandes. Antes esto lo resolvía la lupa, que
    // agranda la página entera y la descoloca; la lista no mueve nada y dice
    // qué es cada cosa. La lupa se queda para cuando NO hay nada pulsable
    // cerca (afinar sobre un mapa, una imagen o un texto).
    if (elegirCorresponde()) {
      var cerca = candidatosCerca(P.x, P.y, ajustes.elegir_radio_px);
      if (cerca.length > 1) { elegirEntreCandidatos(cerca); return; }
      if (cerca.length === 1) { pulsarCandidato(cerca[0], det.rasgos ? det.rasgos.slice() : null); return; }
    }
    if (lupaCorresponde()) {
      if (!lupa) { abrirLupa(); return; }
      var rasgosLupa = lupa.rasgos; cerrarLupa(); congelar(0.35);
      pulsar(); anotarClic(P.x, P.y, "lupa", rasgosLupa, ajustes.modo_clic === "parpadeo");
      return;
    }
    pulsar(); anotarClicPuntero(ajustes.modo_clic === "parpadeo");
  }
  function despachar(e, tipos, extra) {
    var base = { bubbles: true, cancelable: true, clientX: P.x, clientY: P.y, screenX: P.x, screenY: P.y, view: window, button: 0, buttons: 1 };
    if (extra) for (var k in extra) base[k] = extra[k];
    tipos.forEach(function (t) {
      try { e.dispatchEvent(/^pointer/.test(t) ? new PointerEvent(t, base) : new MouseEvent(t, base)); } catch (x) {}
    });
  }
  // --- elegir con los ojos ------------------------------------------------
  // Con la mirada el error real medido es de unos 75 px (winclus.com/comparar):
  // pedir que se acierte un enlace pequeño entre otros es pedir lo imposible.
  // Así que cuando cerca del puntero hay más de una cosa pulsable, Winclus no
  // adivina: enseña las candidatas por su nombre en botones grandes y se elige
  // de ahí. La misma lista sirve para los desplegables, porque el navegador no
  // deja abrir su lista nativa desde un clic simulado.
  var elegirEl = null, elegirRasgos = null;
  function elegirAbierto() { return !!(elegirEl && elegirEl.style.display === "block"); }
  function cerrarElegir() {
    if (!elegirEl) return;
    elegirEl.style.display = "none";
    while (elegirEl.firstChild) elegirEl.removeChild(elegirEl.firstChild);
    if (ajustes.barrido) { barridoLista = []; barridoI = -1; }
  }
  function abrirElegir(titulo, opciones) {
    if (!elegirEl) {
      elegirEl = el("div", { "class": "wcl-elegir", "role": "dialog", "aria-modal": "true" });
      caja.appendChild(elegirEl);
    }
    while (elegirEl.firstChild) elegirEl.removeChild(elegirEl.firstChild);
    elegirEl.setAttribute("aria-label", titulo);
    elegirEl.appendChild(el("h2", {}, titulo));
    opciones.forEach(function (o) {
      var b = el("button", { "type": "button" }, esc(o.texto) + (o.nota ? '<span class="q">' + esc(o.nota) + "</span>" : ""));
      if (o.marcada) b.classList.add("marcada");
      b.addEventListener("click", function () { cerrarElegir(); o.al(); });
      elegirEl.appendChild(b);
    });
    var cerrar = el("button", { "type": "button", "class": "cerrar" }, "✕ " + T("Cerrar"));
    cerrar.addEventListener("click", cerrarElegir);
    elegirEl.appendChild(cerrar);
    elegirEl.style.display = "block";
    try { elegirEl.querySelector("button").focus({ preventScroll: true }); } catch (e) {}
    if (ajustes.barrido) { barridoLista = []; barridoI = -1; }
    decirVoz(titulo + ". " + opciones.length + " " + T("opciones") + ".", true, true);
  }
  // Lo pulsable que hay a menos de `r` del puntero, de lo más cerca a lo más
  // lejos. Se quedan fuera lo enorme (una tarjeta entera no es un objetivo) y
  // lo que ya contiene a otro candidato, para no ofrecer dos veces lo mismo.
  function candidatosCerca(x, y, r) {
    var fuera = [], lista = document.querySelectorAll(SEL_CLICABLE);
    for (var i = 0; i < lista.length; i++) {
      var c = lista[i];
      if (enWidget(c) || c.disabled || !visibleEl(c)) continue;
      var b = c.getBoundingClientRect();
      if (!b.width || !b.height || b.width > 520 || b.height > 320) continue;
      var nx = Math.max(b.left + 2, Math.min(b.right - 2, x)), ny = Math.max(b.top + 2, Math.min(b.bottom - 2, y));
      var d = Math.hypot(nx - x, ny - y);
      if (d <= r) fuera.push({ el: c, d: d, x: nx, y: ny });
    }
    fuera.sort(function (a, b2) { return a.d - b2.d; });
    // Una etiqueta y su campo son la misma cosa para quien elige: se queda el
    // campo. Y lo que contiene a otro candidato tampoco se ofrece dos veces.
    var conCampo = {};
    fuera.forEach(function (o) { if (o.el.tagName === "LABEL" && o.el.htmlFor) conCampo[o.el.htmlFor] = true; });
    var limpia = [];
    fuera.forEach(function (o) {
      if (o.el.tagName === "LABEL" && o.el.htmlFor && document.getElementById(o.el.htmlFor)
          && fuera.some(function (x) { return x.el.id === o.el.htmlFor; })) return;
      for (var j = 0; j < limpia.length; j++) if (limpia[j].el.contains(o.el) || o.el.contains(limpia[j].el)) return;
      limpia.push(o);
    });
    return limpia.slice(0, 6);
  }
  function elegirCorresponde() {
    // Vale con los ojos y con la cabeza: el error de puntería lo tienen los
    // dos (con los ojos, unos 75 px; con la cabeza, el temblor). Con el ratón
    // no, porque quien usa el ratón ya acierta.
    return ajustes.elegir_cerca && camaraActiva && !elegirAbierto() && !lupa && !menuVisible
      && !arrastrando && !calibrando && !tecVisible;
  }
  function pulsarCandidato(c, rasgos) {
    congelar(0.3); mover(c.x, c.y); fijador.fijarEn(c.x, c.y); fijacion = [c.x, c.y];
    pulsar(true);
    // La calibración invisible aprende del sitio de verdad, con los rasgos de
    // cuando se hizo el gesto (igual que hace la lupa): elegir de la lista
    // enseña al modelo en vez de ensuciarlo.
    anotarClic(c.x, c.y, "elegir", rasgos || (det.rasgos ? det.rasgos.slice() : null),
               ajustes.modo_clic === "parpadeo");
  }
  function elegirEntreCandidatos(lista) {
    elegirRasgos = det.rasgos ? det.rasgos.slice() : null;
    var rasgos = elegirRasgos;
    abrirElegir(T("¿Cuál de estos?"), lista.map(function (c) {
      return { texto: nombreDe(c.el), nota: tipoDe(c.el), al: function () { pulsarCandidato(c, rasgos); } };
    }));
  }
  // --- temblor con el ratón de siempre ---------------------------------------
  // El imán y «¿Cuál de estos?» eran solo para la cámara. Aquí se hace lo mismo con los clics REALES del ratón
  // (isTrusted: los de la cámara y los de la página no pasan por aquí). Solo se interviene si el clic cae en algo
  // que no se pulsa y cerca hay algo que sí: se pulsa eso, o se pregunta cuál si hay varios. Y un segundo clic
  // en el mismo sitio al momento no cuenta. Un clic que ya cae en algo pulsable nunca se toca.
  var ultimoClicRaton = null;
  function pulsableBajo(t) {
    return !!(t && t.closest && (t.closest(SEL_CLICABLE) || t.closest("[onclick]") || getComputedStyle(t).cursor === "pointer"));
  }
  function pulsarConRaton(c) {
    var e = c.el, t = e.tagName;
    if (t === "SELECT") { e.focus(); elegirEnSelect(e); return; }
    if ((t === "INPUT" && !/^(checkbox|radio|button|submit|reset|image)$/i.test(e.type || "")) || t === "TEXTAREA") { e.focus(); return; }
    if (e.focus) e.focus();
    e.click();
  }
  document.addEventListener("click", function (e) {
    if (!ajustes.raton_temblor || !e.isTrusted || e.button !== 0 || enWidget(e.target)) return;
    var ahora = Date.now(), u = ultimoClicRaton;
    ultimoClicRaton = { t: ahora, x: e.clientX, y: e.clientY };
    if (u && ahora - u.t < (ajustes.raton_doble_ms || 600) && Math.hypot(e.clientX - u.x, e.clientY - u.y) < 24) {
      e.preventDefault(); e.stopImmediatePropagation(); avisar("Segundo clic sin querer: no cuenta"); return;
    }
    if (pulsableBajo(e.target)) return;
    if (window.getSelection && String(window.getSelection())) return;   // estaba seleccionando texto
    var cerca = candidatosCerca(e.clientX, e.clientY, ajustes.raton_radio_px || 40);
    if (!cerca.length) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (cerca.length === 1) { avisar(T("Pulsado:") + " " + nombreDe(cerca[0].el)); pulsarConRaton(cerca[0]); return; }
    abrirElegir(T("¿Cuál de estos?"), cerca.map(function (c) { return { texto: nombreDe(c.el), nota: tipoDe(c.el), al: function () { pulsarConRaton(c); } }; }));
  }, true);
  document.addEventListener("dblclick", function (e) { if (ajustes.raton_temblor && e.isTrusted && !enWidget(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  function tipoDe(e) {
    var rol = (e.getAttribute("role") || "").toLowerCase(), t = e.tagName.toLowerCase();
    if (t === "a" || rol === "link") return T("enlace");
    if (t === "button" || rol === "button") return T("botón");
    if (t === "select") return T("desplegable");
    if (t === "textarea") return T("campo de texto");
    if (t === "input") {
      var ti = (e.type || "text").toLowerCase();
      if (ti === "checkbox") return T("casilla");
      if (ti === "radio") return T("opción");
      if (ti === "submit" || ti === "button") return T("botón");
      return T("campo");
    }
    return "";
  }
  // Los desplegables: en vez de ir pasando opción por opción (que con los ojos
  // es inservible y además dispara «change» en cada paso), la lista entera.
  function elegirEnSelect(sel) {
    var opciones = [];
    Array.prototype.forEach.call(sel.options, function (o, i) {
      if (o.disabled) return;
      opciones.push({
        texto: (o.text || o.value || "").trim() || T("(vacío)"),
        marcada: i === sel.selectedIndex,
        al: function () {
          sel.selectedIndex = i;
          sel.dispatchEvent(new Event("input", { bubbles: true }));
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          avisar(o.text); decirVoz(o.text, true, true);
        }
      });
    });
    if (!opciones.length) return false;
    abrirElegir(etiquetaCampo(sel) || nombreDe(sel) || T("Elige una opción"), opciones);
    return true;
  }

  function pulsar(sinElegir) {
    ultimoClic = performance.now(); if (camaraActiva) contar("clics_cara");
    cursor.classList.add("clic"); setTimeout(function () { cursor.classList.remove("clic"); }, 220);
    var e = elementoBajo(P.x, P.y); if (!e) return;
    if (enWidget(e)) {   // controles del propio widget
      if (e.closest(".wcl-limpia-texto")) { if (definirEnPunto(P.x, P.y, e)) return; leerElemento(e); avisar("Leyendo"); return; }
      var b = e.closest("button,a,textarea");
      if (b && b.tagName === "TEXTAREA") { try { b.focus({ preventScroll: true }); } catch (x) {} objetivoTexto = b; avisar("Escribir aquí"); }
      else if (b) { try { b.click(); } catch (x) {} avisar("Clic"); }
      return;
    }
    var inter = e.closest(SEL_CLICABLE), el2 = inter || e;
    // Elegir en vez de adivinar: si cerca hay más de una cosa pulsable, se
    // pregunta cuál; y si no hay ninguna debajo pero sí una al lado, se va a
    // ella en vez de pulsar el vacío. `sinElegir` es la segunda vuelta, cuando
    // la persona ya ha elegido de la lista.
    if (!sinElegir && elegirCorresponde()) {
      var cerca = candidatosCerca(P.x, P.y, ajustes.elegir_radio_px);
      if (cerca.length > 1) { elegirEntreCandidatos(cerca); return; }
      if (cerca.length === 1 && cerca[0].el !== el2 && !cerca[0].el.contains(el2) && !el2.contains(cerca[0].el)) {
        pulsarCandidato(cerca[0]); return;
      }
    }
    if (el2.focus) try { el2.focus({ preventScroll: true }); } catch (x) {}
    if (!inter && definirEnPunto(P.x, P.y, e)) return;   // diccionario al toque: la palabra bajo el puntero
    if (ajustes.lectura && !inter) { leerElemento(e); avisar("Leyendo"); return; }
    if (el2.tagName === "SELECT" && el2.options.length && !el2.multiple) {
      // El navegador no deja abrir la lista nativa desde un clic simulado, así
      // que Winclus pone la suya con todas las opciones en botones grandes.
      if (elegirEnSelect(el2)) return;
      el2.selectedIndex = (Math.max(0, el2.selectedIndex) + 1) % el2.options.length;
      el2.dispatchEvent(new Event("input", { bubbles: true })); el2.dispatchEvent(new Event("change", { bubbles: true }));
      avisar(el2.options[el2.selectedIndex].text); return;
    }
    despachar(el2, ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]);
    avisar("Clic");
  }
  function clicDerecho() {
    var e = bajoPuntero(); if (!e) return;
    despachar(e, ["pointerdown", "mousedown", "pointerup", "mouseup", "contextmenu"], { button: 2, buttons: 2 });
    avisar("Clic derecho");
  }
  function dobleClic() {
    var e = bajoPuntero(); if (!e) return;
    var inter = e.closest(SEL_CLICABLE) || e;
    despachar(inter, ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "pointerdown", "mousedown", "pointerup", "mouseup", "click", "dblclick"], { detail: 2 });
    avisar("Doble clic");
  }
  function empezarArrastre() {
    var e = bajoPuntero(); if (!e) return;
    arrastreEl = e; arrastrando = true; cursor.classList.add("arrastre");
    despachar(e, ["pointerdown", "mousedown"]);
    avisar("Arrastrando: clic para soltar", true);
  }
  function soltarArrastre() {
    if (!arrastrando) return;
    arrastrando = false; cursor.classList.remove("arrastre");
    var e = bajoPuntero() || arrastreEl;
    if (e) despachar(e, ["pointerup", "mouseup"], { buttons: 0 });
    if (arrastreEl && arrastreEl !== e) despachar(arrastreEl, ["pointerup", "mouseup"], { buttons: 0 });
    arrastreEl = null; avisar("Soltado");
  }
  function desplazable(e) {
    while (e && e !== document.body && e !== raiz) {
      var cs = getComputedStyle(e);
      if (e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(cs.overflowY)) return e;
      e = e.parentElement;
    }
    return null;
  }
  function rueda(cantidad, suave, x, y) {
    var e = bajoPuntero(x, y), d = desplazable(e);
    var op = { top: cantidad, behavior: suave ? "smooth" : "auto" };
    if (d) d.scrollBy(op); else window.scrollBy(op);
  }

  // clic por permanencia
  function reiniciarQuieto() { qAncla = null; qYaClic = false; qArmado = false; qProgreso = 0; pintarAnillo(); }
  function tickQuieto(tS) {
    var radio = ajustes.quieto_radio_px, espera = ajustes.quieto_ms / 1000;
    if (!qAncla) { qAncla = [P.x, P.y]; qDesde = tS; qYaClic = true; qProgreso = 0; return; }
    if (Math.hypot(P.x - qAncla[0], P.y - qAncla[1]) > radio) { qAncla = [P.x, P.y]; qDesde = tS; qYaClic = false; qArmado = true; qProgreso = 0; pintarAnillo(); return; }
    if (qYaClic || !qArmado) { qProgreso = 0; pintarAnillo(); return; }
    qProgreso = Math.min(1, (tS - qDesde) / espera); pintarAnillo();
    if (qProgreso >= 1) { qYaClic = true; clic(); }
  }
  function pintarAnillo() {
    var a = cursor.querySelector(".wcl-anillo");
    var ver = ajustes.modo_clic === "quieto" && ajustes.quieto_anillo && qAncla && !qYaClic && qArmado && qProgreso > 0.05;
    a.style.display = ver ? "block" : "none";
    if (ver) a.querySelector(".prog").setAttribute("stroke-dashoffset", String(125.7 * (1 - qProgreso)));
  }

  // ---------------------------------------------------------------- lupa --
  // gui/lupa.py: en modo directo el primer gesto agranda la página alrededor del puntero y el segundo pulsa
  function lupaCorresponde() { return modoEfectivo() === "directo" && ajustes.lupa_activa && !ajustes.lupa_pantalla && !tecladoContiene(P.x, P.y) && !menuVisible; }
  function abrirLupa() {
    var b = document.body, r = b.getBoundingClientRect(), trfPrevio = b.style.transform, orgPrevio = b.style.transformOrigin;
    b.style.transformOrigin = (P.x - r.left) + "px " + (P.y - r.top) + "px";
    raiz.classList.add("wcl-lupa");
    b.style.transform = "scale(" + ajustes.lupa_zoom + ")";
    lupa = { rasgos: det.rasgos ? det.rasgos.slice() : null, trf: trfPrevio, org: orgPrevio }; lupaDesde = performance.now() / 1000;
    reiniciarQuieto(); qAncla = [P.x, P.y]; qDesde = lupaDesde; qArmado = true; qYaClic = false;
    avisar("Lupa: mira y vuelve a hacer el gesto");
  }
  function cerrarLupa() {
    if (!lupa) return;
    var l = lupa; lupa = null; document.body.style.transform = l.trf || ""; document.body.style.transformOrigin = l.org || "";
    setTimeout(function () { raiz.classList.remove("wcl-lupa"); }, 300);
  }

  // --------------------------------------------------------------- pausa --
  function sobrePausar() {
    if (btnPausa.style.display === "none") return false;
    var b = btnPausa.getBoundingClientRect();
    return P.x >= b.left && P.x <= b.right && P.y >= b.top && P.y <= b.bottom;
  }
  function pintarPausa() {
    btnPausa.textContent = pausado ? (window.innerWidth < 600 ? "En pausa · ojos 1,2 s" : "En pausa · ojos cerrados 1,2 s para seguir") : "Pausar";
    btnPausa.classList.toggle("en-pausa", pausado);
    btnPausa.setAttribute("aria-label", pausado ? "Reanudar el puntero" : "Pausar el puntero");
  }
  function pausar() {
    if (pausado) { reanudar(); return; }
    pausado = true; cerrarMenu(); cerrarLupa(); soltarArrastre(); reiniciarQuieto();
    pintarPausa(); avisar("En pausa", true); decir("Puntero en pausa. Cierra los ojos 1,2 segundos para seguir.");
  }
  function reanudar() { pausado = false; reiniciarPuntero(); reiniciarQuieto(); pintarPausa(); avisar("Activado"); decir("Puntero activo."); }
  btnPausa.addEventListener("click", function (e) { if (e.isTrusted) pausar(); });

  // ------------------------------------------------------- menú de clics --
  // gui/menu_clics.py: anillo de 8 sectores alrededor del puntero
  var RE = 170, RI = 58, RE_MAX = 170, menuVisible = false, menuCentro = [0, 0], menuAncla = null, menuDesde = 0, menuSectores = [], menuHover = null;
  function opcionesMenu() {
    var puedeRecentrar = modoEfectivo() === "directo" || modoEfectivo() === "hibrido";
    return [["derecho", "Clic derecho"], ["doble", "Doble clic"], arrastrando ? ["soltar", "Soltar"] : ["arrastrar", "Arrastrar"], ["teclado", "Teclado"],
            ["leer", "Leer aquí"], ["rueda_abajo", "Rueda abajo"], puedeRecentrar ? ["recentrar", "Recentrar"] : ["pausar", "Pausar"], ["rueda_arriba", "Rueda arriba"], ["ayuda", "Pedir ayuda"]];
  }
  function polar(r, gradosTk) { var a = gradosTk * Math.PI / 180; return [RE + 6 + r * Math.cos(a), RE + 6 - r * Math.sin(a)]; }
  function mostrarMenu(x, y) {
    // En pantallas estrechas el anillo se encoge para caber entero
    RE = Math.max(110, Math.min(RE_MAX, Math.floor(Math.min(window.innerWidth, window.innerHeight) / 2) - 10));
    RI = RE >= 150 ? 58 : 46;
    var lado = 2 * (RE + 6), m = lado / 2;
    var cx = Math.min(Math.max(x, m), window.innerWidth - m), cy = Math.min(Math.max(y, m), window.innerHeight - m);
    menuCentro = [cx, cy]; menuSectores = opcionesMenu();
    var n = menuSectores.length, paso = 360 / n, s = '<svg width="' + lado + '" height="' + lado + '" viewBox="0 0 ' + lado + ' ' + lado + '">';
    for (var i = 0; i < n; i++) {
      var a1 = 90 - (i + 0.5) * paso, a2 = a1 + paso;
      var p1 = polar(RE, a1), p2 = polar(RE, a2), p3 = polar(RI, a2), p4 = polar(RI, a1), pt = polar((RE + RI) / 2 + 6, a1 + paso / 2);
      s += '<g data-i="' + i + '"><path d="M' + p1[0] + ' ' + p1[1] + ' A' + RE + ' ' + RE + ' 0 0 0 ' + p2[0] + ' ' + p2[1] + ' L' + p3[0] + ' ' + p3[1] + ' A' + RI + ' ' + RI + ' 0 0 1 ' + p4[0] + ' ' + p4[1] + ' Z"/>';
      var palabras = menuSectores[i][1].split(" ");
      s += '<text x="' + pt[0] + '" y="' + (pt[1] - (palabras.length - 1) * 8) + '">' + palabras.map(function (w, k) { return '<tspan x="' + pt[0] + '" dy="' + (k ? 16 : 0) + '">' + w + '</tspan>'; }).join("") + '</text></g>';
    }
    s += '<g class="centro" data-i="c"><circle cx="' + m + '" cy="' + m + '" r="' + RI + '"/><text x="' + m + '" y="' + m + '">Cerrar</text></g></svg>';
    menuEl.innerHTML = s; menuEl.style.left = (cx - m) + "px"; menuEl.style.top = (cy - m) + "px"; menuEl.style.display = "block";
    menuVisible = true; menuHover = null; menuDesde = performance.now() / 1000;
  }
  function opcionEn(x, y) {
    var d = Math.hypot(x - menuCentro[0], y - menuCentro[1]);
    if (d > RE) return null;
    if (d < RI) return "cerrar";
    var ang = (Math.atan2(-(y - menuCentro[1]), x - menuCentro[0]) * 180 / Math.PI + 360) % 360, paso = 360 / menuSectores.length;
    var k = Math.floor(((90 + paso / 2 - ang + 360) % 360) / paso);
    return menuSectores[Math.min(k, menuSectores.length - 1)][0];
  }
  function tickMenu(tS) {
    if (!menuVisible) return;
    var clave = opcionEn(P.x, P.y), idx = clave === null ? null : (clave === "cerrar" ? "c" : String(menuSectores.findIndex(function (o) { return o[0] === clave; })));
    if (idx !== menuHover) {
      menuHover = idx; menuDesde = tS;
      var gs = menuEl.querySelectorAll("g");
      for (var i = 0; i < gs.length; i++) gs[i].firstChild.classList.toggle("hov", gs[i].getAttribute("data-i") === idx);
    }
    if (tS - menuDesde > 10) { cerrarMenu(); avisar("Menú cerrado"); }
  }
  // La rueda de opciones sale al tener los ojos cerrados más de la cuenta, y la
  // primera vez nadie sabe qué es ni de dónde ha salido: se explica. Y si se
  // abre dos veces seguidas sin que se elija nada, casi seguro que se está
  // abriendo sin querer (clic con parpadeo largo), así que se ofrece arreglarlo.
  var menuExplicado = false, menuSinUsar = 0, menuArreglado = false, menuUsado = false;
  function abrirMenu() {
    menuAncla = [P.x, P.y]; mostrarMenu(P.x, P.y); reiniciarQuieto();
    var seg = (parpadeo.msLargo() / 1000).toFixed(1).replace(".", ",");
    avisar(T("Menú de clics"));
    if (!menuExplicado) {
      menuExplicado = true;
      decirVoz(T("Este es el menú de clics. Sale cuando tienes los ojos cerrados más de ") + seg +
        T(" segundos. Mira una opción y ciérralos otra vez, o mira «Cerrar» para salir."), true, true);
    }
  }
  function cerrarMenu() {
    if (!menuVisible) return;
    menuVisible = false; menuEl.style.display = "none"; reiniciarQuieto();
    // Se cierra sin haber elegido nada: eso es lo que cuenta como «se abrió sin querer»
    if (menuUsado) { menuUsado = false; menuSinUsar = 0; return; }
    menuSinUsar++;
    if (menuSinUsar >= 2 && !menuArreglado && ajustes.menu_ojos && !elegirAbierto()) ofrecerArreglarMenu();
  }
  function ofrecerArreglarMenu() {
    menuArreglado = true;
    abrirElegir(T("¿Se te abre este menú sin querer?"), [
      { texto: T("Sí: no abrirlo con los ojos"), nota: T("Podrás seguir usándolo desde el panel"),
        al: function () { ajustes.menu_ojos = false; guardar(); refrescos.forEach(function (r) { r(); }); avisar(T("Menú apagado")); decirVoz(T("Hecho: el menú ya no se abre con los ojos."), true, true); } },
      { texto: T("Sí: pedir más tiempo con los ojos cerrados"), nota: T("Dos segundos y medio en vez de poco más de uno"),
        al: function () { ajustes.menu_largo_ms = 2500; guardar(); refrescos.forEach(function (r) { r(); }); avisar(T("Más tiempo para el menú")); decirVoz(T("Hecho: ahora hay que tener los ojos cerrados dos segundos y medio."), true, true); } },
      { texto: T("No: lo estoy usando bien"), al: function () { menuSinUsar = 0; } }
    ]);
  }
  function irAlAncla() { if (menuAncla) { congelar(0.4); mover(menuAncla[0], menuAncla[1]); } }
  // --- pedir ayuda a quien esté cerca -------------------------------------------
  // Para quien ya no puede hablar ni moverse (ELA avanzada, enclaustramiento): un aviso que se oye (pitidos y la voz
  // «Necesito ayuda») y se ve en toda la pantalla, SIN destellos (el color no parpadea: epilepsia fotosensible).
  // Se para con cualquier tecla, clic o gesto, y solo al minuto.
  var ayudaEl = null, ayudaTimer = 0, ayudaFin = 0, ayudaCtx = null;
  function pedirAyuda() {
    if (ayudaEl) return;
    ayudaEl = el("div", { "class": "wcl-ayuda-grande", "role": "alertdialog", "aria-label": T("Necesito ayuda") },
      "<b>" + T("Necesito ayuda") + "</b><span>" + T("Toca la pantalla o pulsa una tecla para pararlo") + "</span>");
    caja.appendChild(ayudaEl);
    var n = 0;
    function sonar() {
      try {
        ayudaCtx = ayudaCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (ayudaCtx.state === "suspended") ayudaCtx.resume();
        var o = ayudaCtx.createOscillator(), g = ayudaCtx.createGain(), t = ayudaCtx.currentTime;
        o.type = "square"; o.frequency.setValueAtTime(n % 2 ? 660 : 880, t);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        o.connect(g); g.connect(ayudaCtx.destination); o.start(t); o.stop(t + 0.5);
      } catch (e) {}
      if (n % 4 === 0) decirVoz(T("Necesito ayuda"), true, true);
      n++;
    }
    sonar(); ayudaTimer = setInterval(sonar, 1000); ayudaFin = setTimeout(pararAyuda, 60000);
    setTimeout(function () { if (!ayudaEl) return; document.addEventListener("keydown", pararAyuda, true); document.addEventListener("pointerdown", pararAyuda, true); }, 700);
    contar("ayuda");
  }
  function pararAyuda() {
    if (!ayudaEl) return;
    clearInterval(ayudaTimer); clearTimeout(ayudaFin); ayudaEl.remove(); ayudaEl = null;
    document.removeEventListener("keydown", pararAyuda, true); document.removeEventListener("pointerdown", pararAyuda, true);
    callar(); avisar("Aviso parado");
  }
  function elegirOpcion(clave) {
    if (clave && clave !== "cerrar") { menuSinUsar = 0; menuUsado = true; }   // se está usando: no es un accidente
    if (clave === "rueda_arriba" || clave === "rueda_abajo") {
      menuEl.style.display = "none"; rueda(clave === "rueda_abajo" ? 300 : -300, true, menuAncla[0], menuAncla[1]);
      avisar(clave === "rueda_abajo" ? "Rueda abajo" : "Rueda arriba"); mostrarMenu(menuAncla[0], menuAncla[1]); reiniciarQuieto(); return;
    }
    cerrarMenu();
    if (clave === "derecho") { irAlAncla(); clicDerecho(); }
    else if (clave === "doble") { irAlAncla(); dobleClic(); }
    else if (clave === "arrastrar") { irAlAncla(); empezarArrastre(); }
    else if (clave === "soltar") { irAlAncla(); soltarArrastre(); }
    else if (clave === "teclado") alternarTeclado();
    else if (clave === "leer") { irAlAncla(); leerElemento(bajoPuntero(menuAncla[0], menuAncla[1])); }
    else if (clave === "recentrar") recentrar();
    else if (clave === "pausar") pausar();
    else if (clave === "ayuda") pedirAyuda();
  }

  // ======================================================== escribir ==
  // gui/teclado_pantalla.py + prediccion.py + frases.py + voz: teclado en pantalla
  // con sugerencias, capa de frases, «Decir», dictado y órdenes por voz.
  var FRASES_DEFECTO = ["Sí", "No", "Gracias", "Necesito ayuda", "Tengo sed", "Tengo hambre", "Tengo dolor", "Quiero ir al baño",
                        "Tengo frío", "Tengo calor", "Estoy cansado", "Quiero descansar", "Llama a mi familia", "Espera un momento", "No entiendo", "Hasta luego"];
  FRASES_DEFECTO = FRASES_DEFECTO.map(T);   // las frases de ejemplo, en el idioma del panel
  var frases = leerJSON("winclus.frases", null) || FRASES_DEFECTO.slice();
  var aprendidas = leerJSON("winclus.palabras", {});
  var diccionario = null, cargandoDic = false;   // [[claveSinAcento, palabra, peso]] ordenado por clave
  var EXCLUIDAS_TEC = /^(puta|puto|mierda|joder|coño|cabr[oó]n|gilipollas|polla|cojones|carajo|pendej[oa]|zorra|maric[oó]n|verga|pinche|culo|follar|hostia|imb[eé]cil|idiota|est[uú]pid[oa]|bastardo|perra|capullo|tetas)s?$/i;

  function sinAcentos(t) { return t.toLowerCase().replace(/ñ/g, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(//g, "ñ"); }
  function cargarDiccionario() {
    if (diccionario || cargandoDic) return;
    cargandoDic = true;
    fetch(ORIGEN + "/palabras-" + IDIOMA_UI + ".txt").then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; }).then(function (txt) {   // sin lista para ese idioma: solo las palabras aprendidas
      var lista = txt.split(/\r?\n/).filter(Boolean), n = lista.length;
      diccionario = lista.map(function (w, i) { return [sinAcentos(w), w, n - i]; });
      for (var p in aprendidas) diccionario.push([sinAcentos(p), p, 20000 * aprendidas[p]]);
      diccionario.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
      cargandoDic = false; refrescarSugerencias();
    });
  }
  function sugerir(prefijo, n) {
    if (!prefijo || !diccionario) return [];
    var clave = sinAcentos(prefijo), lo = 0, hi = diccionario.length;
    while (lo < hi) { var m = (lo + hi) >> 1; if (diccionario[m][0] < clave) lo = m + 1; else hi = m; }
    var cand = [], limite = 4000;
    for (var i = lo; i < diccionario.length && diccionario[i][0].indexOf(clave) === 0 && limite-- > 0; i++) cand.push(diccionario[i]);
    cand.sort(function (a, b) { return b[2] - a[2]; });
    var salida = [];
    for (i = 0; i < cand.length && salida.length < n; i++) {
      var w = cand[i][1];
      if (EXCLUIDAS_TEC.test(w)) continue;
      if (prefijo.length > 1 && prefijo === prefijo.toUpperCase()) w = w.toUpperCase();
      else if (prefijo[0] === prefijo[0].toUpperCase() && prefijo[0] !== prefijo[0].toLowerCase()) w = w[0].toUpperCase() + w.slice(1);
      if (w.toLowerCase() === prefijo.toLowerCase() && cand.length > 1) continue;
      if (salida.indexOf(w) < 0) salida.push(w);
    }
    return salida;
  }
  function aprender(palabra) {
    palabra = palabra.trim(); if (palabra.length < 3 || !/^[a-záéíóúüñ]+$/i.test(palabra)) return;
    palabra = palabra === palabra.toUpperCase() ? palabra : palabra.toLowerCase();
    aprendidas[palabra] = (aprendidas[palabra] || 0) + 1; escribirJSON("winclus.palabras", aprendidas);
    if (diccionario) {
      var clave = sinAcentos(palabra), i;
      for (i = 0; i < diccionario.length; i++) if (diccionario[i][1] === palabra) { diccionario[i][2] += 20000; return; }
      diccionario.push([clave, palabra, 20000]); diccionario.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
    }
  }

  // Capas. Cada tecla: cadena (escribe ese texto) o [etiqueta, tipo, valor, ancho]
  var K_BORRAR = ["Borrar", "tecla", "backspace", 1.6], K_INTRO = ["Intro", "tecla", "enter", 1.6], K_IZQ = ["←", "tecla", "left", 1], K_DER = ["→", "tecla", "right", 1];
  var K_MAS = ["Más", "capa", "mas", 1.2], K_CERRAR = ["Ocultar", "cerrar", null, 1.5], K_ESPACIO = ["Espacio", "texto", " ", 5];
  var K_ABC = ["abc", "capa", "abc", 1.5], K_NUM = ["123", "capa", "123", 1.5], K_ACENTOS = ["áé", "capa", "acentos", 1.2];
  var K_DECIR = ["Decir", "decir", null, 1.3], K_FRASES = ["Frases", "capa", "frases", 1.3], K_DICTAR = ["Dictar", "dictar", null, 1.3];
  var FILA_ABAJO = [K_NUM, K_ACENTOS, K_ESPACIO, K_IZQ, K_DER, K_DECIR, K_FRASES, K_DICTAR, K_MAS, K_CERRAR];
  var CAPAS = {
    abc: ["qwertyuiop".split("").concat([K_BORRAR]), (IDIOMA_UI === "es" ? "asdfghjklñ" : "asdfghjkl'").split("").concat([K_INTRO]), [["Mayús", "mayus", null, 1.3]].concat("zxcvbnm,.".split(""), ["?"]), FILA_ABAJO],
    ABC: ["QWERTYUIOP".split("").concat([K_BORRAR]), (IDIOMA_UI === "es" ? "ASDFGHJKLÑ" : "ASDFGHJKL'").split("").concat([K_INTRO]), [["Mayús", "mayus", null, 1.3]].concat("ZXCVBNM;:".split(""), ["!"]), FILA_ABAJO],
    "123": ["1234567890".split("").concat([K_BORRAR]), "@#€$%&-+()".split("").concat([K_INTRO]), "!¿?¡\"':;/*".split(""), [K_ABC, K_ACENTOS, K_ESPACIO, K_IZQ, K_DER, K_DECIR, K_FRASES, K_DICTAR, K_MAS, K_CERRAR]],
    acentos: ["áéíóúüñ¿¡«".split("").concat([K_BORRAR]), "ÁÉÍÓÚÜÑ»ªº".split("").concat([K_INTRO]), "çÇ~^`´¨·=_".split(""), [K_ABC, K_NUM, K_ESPACIO, K_IZQ, K_DER, K_DECIR, K_FRASES, K_DICTAR, K_MAS, K_CERRAR]],
    mas: [
      [["Esc", "tecla", "escape", 1], ["Tab", "tecla", "tab", 1], ["Supr", "tecla", "delete", 1], ["Inicio", "tecla", "home", 1], ["Fin", "tecla", "end", 1], ["↑", "tecla", "up", 1], ["↓", "tecla", "down", 1], ["Seleccionar todo", "orden", "todo", 1.6], K_BORRAR],
      [["Copiar", "orden", "copiar", 1], ["Pegar", "orden", "pegar", 1], ["Cortar", "orden", "cortar", 1], ["Deshacer", "orden", "deshacer", 1], ["Rehacer", "orden", "rehacer", 1], ["Buscar en la página", "orden", "buscar", 1.6], ["Siguiente campo", "orden", "siguiente", 1.4], K_INTRO],
      [["RePág", "orden", "repag", 1], ["AvPág", "orden", "avpag", 1], ["Arriba del todo", "orden", "arriba", 1.3], ["Abajo del todo", "orden", "abajo", 1.3], ["Atrás", "orden", "atras", 1], ["Adelante", "orden", "adelante", 1], ["Recargar", "orden", "recargar", 1], ["Zoom +", "orden", "zoommas", 1], ["Zoom −", "orden", "zoommenos", 1]],
      [K_ABC, K_NUM, K_ESPACIO, K_IZQ, K_DER, ["Menú de clics", "orden", "menu", 1.4], ["Leer la página", "orden", "leerpagina", 1.4], ["Callar", "callar", null, 1], K_CERRAR]
    ]
  };
  var tecVisible = false, capa = "abc", bloqMayus = false, palabra = "", frase = "", sugerencias = [], teclas = [], tecHover = null, objetivoTexto = null;
  var tecTextoEl = null;

  // Dónde se escribe: el último campo de la página que tuvo el foco
  document.addEventListener("focusin", function (e) { if (esEditable(e.target)) objetivoTexto = e.target; });
  function esEditable(e) {
    if (!e || !e.closest || e.closest(".wcl-tec")) return false;
    if (e.isContentEditable) return true;
    if (e.tagName === "TEXTAREA") return !e.disabled && !e.readOnly;
    if (e.tagName === "INPUT") return !e.disabled && !e.readOnly && !/^(button|submit|reset|checkbox|radio|file|range|color|image|hidden)$/i.test(e.type || "text");
    return false;
  }
  function esSecreto(c) { return !!(c && c.tagName === "INPUT" && /^password$/i.test(c.type || "")); }
  function campo() {
    if (objetivoTexto && objetivoTexto.isConnected && esEditable(objetivoTexto)) return objetivoTexto;   // isConnected: también dentro del shadow root (área de frases)
    var a = document.activeElement; return esEditable(a) ? (objetivoTexto = a) : null;
  }
  function enfocar(c) { try { c.focus({ preventScroll: true }); } catch (e) {} }
  function fijarValor(c, valor, pos) {   // compatible con React y compañía
    var proto = c.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var d = Object.getOwnPropertyDescriptor(proto, "value");
    if (d && d.set) d.set.call(c, valor); else c.value = valor;
    try { c.setSelectionRange(pos, pos); } catch (e) {}
    c.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function insertarTexto(texto) {
    var c = campo();
    if (!c) { avisar("Pulsa primero en un campo de texto", true); return false; }
    enfocar(c);
    if (c.isContentEditable) { if (!document.execCommand("insertText", false, texto)) c.textContent += texto; return true; }
    var v = c.value, s = c.selectionStart == null ? v.length : c.selectionStart, f = c.selectionEnd == null ? v.length : c.selectionEnd;
    fijarValor(c, v.slice(0, s) + texto + v.slice(f), s + texto.length);
    return true;
  }
  function borrarAtras() {
    var c = campo(); if (!c) return;
    enfocar(c);
    if (c.isContentEditable) { document.execCommand("delete"); return; }
    var v = c.value, s = c.selectionStart == null ? v.length : c.selectionStart, f = c.selectionEnd == null ? v.length : c.selectionEnd;
    if (s === f && s > 0) s--;
    fijarValor(c, v.slice(0, s) + v.slice(f), s);
  }
  function teclaEspecial(nombre) {
    var c = campo();
    if (nombre === "enter") {
      if (c && c.tagName === "TEXTAREA") { insertarTexto("\n"); return; }
      if (c && c.isContentEditable) { document.execCommand("insertParagraph"); return; }
      var obj = c || document.activeElement || document.body;
      var ev = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true });
      var seguir = obj.dispatchEvent(ev);
      obj.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      if (seguir && c && c.form) { if (c.form.requestSubmit) c.form.requestSubmit(); else c.form.submit(); }
      return;
    }
    if (nombre === "backspace") { borrarAtras(); return; }
    if (nombre === "tab") { siguienteCampo(1); return; }
    if (nombre === "escape") { ocultarTeclado(); return; }
    if (!c) { if (nombre === "up") rueda(-120, true); if (nombre === "down") rueda(120, true); if (nombre === "home") window.scrollTo({ top: 0, behavior: "smooth" }); if (nombre === "end") window.scrollTo({ top: raiz.scrollHeight, behavior: "smooth" }); return; }
    enfocar(c);
    if (c.isContentEditable) {
      var sel = window.getSelection();
      if (nombre === "left") sel.modify("move", "backward", "character"); else if (nombre === "right") sel.modify("move", "forward", "character");
      else if (nombre === "up") sel.modify("move", "backward", "line"); else if (nombre === "down") sel.modify("move", "forward", "line");
      else if (nombre === "home") sel.modify("move", "backward", "lineboundary"); else if (nombre === "end") sel.modify("move", "forward", "lineboundary");
      else if (nombre === "delete") document.execCommand("forwardDelete");
      return;
    }
    var v = c.value, s = c.selectionStart == null ? v.length : c.selectionStart, f = c.selectionEnd == null ? v.length : c.selectionEnd;
    if (nombre === "left") s = Math.max(0, s - 1); else if (nombre === "right") s = Math.min(v.length, f + 1);
    else if (nombre === "home") s = v.lastIndexOf("\n", s - 1) + 1; else if (nombre === "end") { var e2 = v.indexOf("\n", f); s = e2 < 0 ? v.length : e2; }
    else if (nombre === "up" || nombre === "down") { var lineas = v.slice(0, s).split("\n"), col = lineas[lineas.length - 1].length, todas = v.split("\n"), li = lineas.length - 1 + (nombre === "up" ? -1 : 1); if (li < 0 || li >= todas.length) return; s = 0; for (var i = 0; i < li; i++) s += todas[i].length + 1; s += Math.min(col, todas[li].length); }
    else if (nombre === "delete") { if (s === f && f < v.length) f++; fijarValor(c, v.slice(0, s) + v.slice(f), s); return; }
    try { c.setSelectionRange(s, s); } catch (e) {}
  }
  function siguienteCampo(dir) {
    var lista = Array.prototype.filter.call(document.querySelectorAll(SEL_CLICABLE), function (e) { return !e.closest(".wcl-root") && e.tabIndex >= 0 && e.getBoundingClientRect().width > 0; });
    var act = focoActual(); if (enWidget(act)) act = objetivoTexto;   // desde el teclado en pantalla: seguir desde el campo donde se escribe
    var i = lista.indexOf(act), sig = lista[(i + dir + lista.length) % lista.length];
    if (sig) { enfocar(sig); sig.scrollIntoView({ block: "center", behavior: "smooth" }); if (esEditable(sig)) objetivoTexto = sig; avisar(nombreDe(sig)); }
  }
  function orden(nombre) {
    var c = campo();
    if (nombre === "copiar" || nombre === "cortar") {
      var sel = c && !c.isContentEditable ? c.value.slice(c.selectionStart, c.selectionEnd) : String(window.getSelection());
      if (!sel && c && !c.isContentEditable) sel = c.value;
      if (sel && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(sel).then(function () { avisar(nombre === "copiar" ? "Copiado" : "Cortado"); }, function () { avisar("No se pudo copiar", true); });
      else if (sel && c && !c.isContentEditable) { try { enfocar(c); c.select(); document.execCommand("copy"); avisar(nombre === "copiar" ? "Copiado" : "Cortado"); } catch (x) { avisar("Este navegador no deja usar el portapapeles aquí", true); } }
      else if (sel) avisar("Este navegador no deja usar el portapapeles aquí", true);
      if (nombre === "cortar" && c) { enfocar(c); if (c.isContentEditable) document.execCommand("delete"); else if (c.selectionStart !== c.selectionEnd) fijarValor(c, c.value.slice(0, c.selectionStart) + c.value.slice(c.selectionEnd), c.selectionStart); else fijarValor(c, "", 0); }
    } else if (nombre === "pegar") {
      if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { if (t) { insertarTexto(t); avisar("Pegado"); } }, function () { avisar("El navegador no deja leer el portapapeles", true); });
      else avisar("Este navegador no deja pegar desde aquí: usa Ctrl+V", true);
    } else if (nombre === "deshacer" || nombre === "rehacer") { if (c) { enfocar(c); document.execCommand(nombre === "deshacer" ? "undo" : "redo"); } }
    else if (nombre === "todo") { if (c) { enfocar(c); if (c.isContentEditable) document.execCommand("selectAll"); else c.select(); } else document.execCommand("selectAll"); }
    else if (nombre === "buscar") { var b = document.querySelector('input[type=search],input[name*=busc i],input[name*=search i],input[placeholder*=busc i],input[placeholder*=search i]'); if (b) { enfocar(b); objetivoTexto = b; b.scrollIntoView({ block: "center" }); avisar("Buscar"); } else avisar("La página no tiene buscador", true); }
    else if (nombre === "siguiente") siguienteCampo(1);
    else if (nombre === "repag") rueda(-window.innerHeight * 0.8, true); else if (nombre === "avpag") rueda(window.innerHeight * 0.8, true);
    else if (nombre === "arriba") window.scrollTo({ top: 0, behavior: "smooth" }); else if (nombre === "abajo") window.scrollTo({ top: raiz.scrollHeight, behavior: "smooth" });
    else if (nombre === "atras") history.back(); else if (nombre === "adelante") history.forward(); else if (nombre === "recargar") location.reload();
    else if (nombre === "zoommas") { ajustes.texto = Math.min(200, ajustes.texto + 10); aplicarTexto(); guardar(); }
    else if (nombre === "zoommenos") { ajustes.texto = Math.max(80, ajustes.texto - 10); aplicarTexto(); guardar(); }
    else if (nombre === "menu") { ocultarTeclado(); abrirMenu(); }
    else if (nombre === "leerpagina") leerPagina();
  }

  // --- dibujo del teclado ------------------------------------------------
  function pantallaEstrecha() { return window.innerWidth < 600; }
  function filasCapa(c) {
    if (c !== "frases") {
      var filas = CAPAS[c];
      // En pantallas estrechas la fila de abajo se parte en dos para que las teclas con texto quepan
      if (pantallaEstrecha() && filas[filas.length - 1] === FILA_ABAJO) {
        return filas.slice(0, -1).concat([[K_NUM, K_ACENTOS, K_ESPACIO, K_IZQ, K_DER, K_CERRAR], [K_DECIR, K_FRASES, K_DICTAR, K_MAS]]);
      }
      if (pantallaEstrecha() && c !== "mas" && c !== "abc" && c !== "ABC") {
        var ultima = filas[filas.length - 1];
        return filas.slice(0, -1).concat([[ultima[0], ultima[1], K_ESPACIO, K_IZQ, K_DER, K_CERRAR], [K_DECIR, K_FRASES, K_DICTAR, K_MAS]]);
      }
      return filas;
    }
    var filas = [], i;
    for (i = 0; i < frases.length; i += 4) filas.push(frases.slice(i, i + 4).map(function (f) { return [f, "frase", f, 1]; }));
    if (!filas.length) filas.push([["(Añade frases en la pestaña Escribir)", "frase", "", 1]]);
    filas.push([K_ABC, ["Callar", "callar", null, 1.3], K_DECIR, K_CERRAR]);
    return filas;
  }
  var ETIQUETA_CORTA = { backspace: "⌫", enter: "⏎", left: "←", right: "→" };
  function defTecla(d) {
    if (typeof d === "string") return { etiqueta: d, tipo: "texto", valor: d, ancho: 1 };
    var t = { etiqueta: d[0], tipo: d[1], valor: d[2], ancho: d[3] };
    if (pantallaEstrecha()) {   // en el móvil no caben las palabras en las teclas especiales
      if (t.tipo === "tecla" && ETIQUETA_CORTA[t.valor]) t.etiqueta = ETIQUETA_CORTA[t.valor];
      else if (t.tipo === "mayus") t.etiqueta = "⇧";
      else if (t.tipo === "cerrar") t.etiqueta = "✕";
    }
    return t;
  }
  function dibujarTeclado() {
    tecEl.innerHTML = ""; teclas = []; tecHover = null;
    tecEl.classList.toggle("arriba", ajustes.teclado_posicion === "arriba");
    tecEl.style.top = ajustes.teclado_posicion === "arriba" ? "0" : ""; tecEl.style.bottom = ajustes.teclado_posicion === "arriba" ? "" : "0";
    tecEl.style.height = (pantallaEstrecha() ? Math.max(ajustes.teclado_altura, 42) : ajustes.teclado_altura) + "vh";   // en el móvil las teclas necesitan más alto
    tecTextoEl = el("div", { "class": "texto", "aria-live": "polite" }); tecEl.appendChild(tecTextoEl);
    if (ajustes.teclado_prediccion && capa !== "frases") {
      var fs = el("div", { "class": "fila sug" });
      for (var i = 0; i < 5; i++) { var b = el("button", { "type": "button", "class": "pred" }); b.dataset.i = i; fs.appendChild(b); teclas.push({ tipo: "pred", el: b, indice: i, valor: "" }); }
      tecEl.appendChild(fs);
      cargarDiccionario();
    }
    filasCapa(capa).forEach(function (fila) {
      var f = el("div", { "class": "fila" });
      fila.forEach(function (d) {
        var t = defTecla(d), b = el("button", { "type": "button" }, t.etiqueta.replace(/</g, "&lt;"));   // tabulable: quien usa un pulsador con Tab también llega a las teclas y a las frases
        b.style.flexGrow = t.ancho; if (t.tipo !== "texto") b.classList.add("esp"); if (t.tipo === "frase") b.classList.add("frase");
        if ((t.tipo === "mayus" && (capa === "ABC" || bloqMayus)) || (t.tipo === "capa" && t.valor === capa)) b.classList.add("activa");
        if (t.tipo === "mayus" && bloqMayus) b.classList.add("fija");
        if (t.tipo === "dictar" && dictando) b.classList.add("fija");
        t.el = b; teclas.push(t); f.appendChild(b);
      });
      tecEl.appendChild(f);
    });
    // Con el ratón de verdad también funciona; mousedown no roba el foco al campo
    tecEl.onmousedown = function (e) { e.preventDefault(); };
    tecEl.onclick = function (e) {
      if (!e.isTrusted) return;
      var b = e.target.closest("button"), t = b && teclaDe(b); if (!t) return;
      // Pulsada con Intro o Espacio desde el teclado físico: el foco vuelve a la tecla (escribir lo lleva al campo),
      // y si el teclado se redibujó (Mayús, otra capa) a la tecla que ocupa el mismo sitio
      var conFoco = focoActual() === b, i = teclas.indexOf(t);
      pulsarTecla(t);
      if (conFoco) { var nb = b.isConnected ? b : (teclas[i] && teclas[i].el); if (nb) { try { nb.focus({ preventScroll: true }); } catch (x) {} } }
    };
    refrescarSugerencias(); pintarTexto();
  }
  function teclaDe(b) { for (var i = 0; i < teclas.length; i++) if (teclas[i].el === b) return teclas[i]; return null; }
  function pintarTexto() { if (tecTextoEl) tecTextoEl.textContent = frase ? "Escrito: " + (esSecreto(campo()) ? "••••" : frase.slice(-80)) : (campo() ? "Escribiendo en: " + nombreDe(campo()) : "Pulsa en un campo de la página para escribir en él, o escribe y pulsa «Decir»."); }
  function refrescarSugerencias() {
    sugerencias = ajustes.teclado_prediccion && !esSecreto(campo()) ? sugerir(palabra, 5) : [];
    teclas.forEach(function (t) { if (t.tipo === "pred") { t.valor = sugerencias[t.indice] || ""; t.el.textContent = t.valor; } });
  }
  function mostrarTeclado() { tecVisible = true; dibujarTeclado(); tecEl.classList.add("visible"); avisar("Teclado"); contar("teclado"); }
  function ocultarTeclado() { if (!tecVisible) return; tecVisible = false; tecEl.classList.remove("visible"); pararDictado(); }
  function alternarTeclado() { if (tecVisible) ocultarTeclado(); else mostrarTeclado(); }
  function tecladoContiene(x, y) { if (!tecVisible) return false; var r = tecEl.getBoundingClientRect(); return x >= r.left && x < r.right && y >= r.top && y < r.bottom; }
  function teclaEn(x, y) {
    var e = elementoBajo(x, y), b = e && e.closest && e.closest(".wcl-tec button");
    var t = b ? teclaDe(b) : null; return t && !(t.tipo === "pred" && !t.valor) ? t : null;
  }
  function tickTeclado() {
    if (!tecVisible) return;
    var t = tecladoContiene(P.x, P.y) ? teclaEn(P.x, P.y) : null;
    if (t === tecHover) return;
    if (tecHover) tecHover.el.classList.remove("hover");
    tecHover = t; if (t) t.el.classList.add("hover");
  }
  function pulsarTeclaEn(x, y) { var t = teclaEn(x, y); if (t) pulsarTecla(t); else avisar("Ahí no hay tecla", true); }
  function pulsarTecla(t) {
    if (ajustes.teclado_sonido) pitido(880, 25);
    t.el.classList.add("destello"); setTimeout(function () { t.el.classList.remove("destello"); }, 130);
    var tipo = t.tipo, valor = t.valor;
    if (tipo === "texto") escribir(valor);
    else if (tipo === "pred") completar(valor);
    else if (tipo === "tecla") {
      teclaEspecial(valor);
      if (valor === "backspace") { palabra = palabra.slice(0, -1); frase = frase.slice(0, -1); }
      else { terminarPalabra(valor === "enter"); if (valor === "enter") frase = ""; }
      refrescarSugerencias(); pintarTexto();
    }
    else if (tipo === "orden") { orden(valor); terminarPalabra(false); refrescarSugerencias(); }
    else if (tipo === "mayus") { if (capa === "ABC") { if (bloqMayus) { bloqMayus = false; capa = "abc"; } else bloqMayus = true; } else { capa = "ABC"; bloqMayus = false; } dibujarTeclado(); }
    else if (tipo === "capa") { capa = valor; bloqMayus = false; dibujarTeclado(); }
    else if (tipo === "cerrar") ocultarTeclado();
    else if (tipo === "decir") { if (frase.trim()) { hablarPersona(frase); contar("frases"); frase = ""; pintarTexto(); } else decirVoz("No hay nada escrito", true, true); }
    else if (tipo === "frase") { if (valor) { hablarPersona(valor); contar("frases"); } }
    else if (tipo === "callar") callar();
    else if (tipo === "dictar") alternarDictado();
  }
  function escribir(texto) {
    if (esSecreto(campo())) { insertarTexto(texto); palabra = ""; frase = ""; pintarTexto(); return; }   // contraseñas: ni se acumulan, ni se aprenden, ni se leen
    insertarTexto(texto); frase += texto;
    if (/^[a-záéíóúüñ]$/i.test(texto)) palabra += texto; else terminarPalabra(true);
    if (capa === "ABC" && !bloqMayus) { capa = "abc"; dibujarTeclado(); return; }
    refrescarSugerencias(); pintarTexto();
  }
  function completar(p) {
    if (!p) return;
    var resto = p.toLowerCase().indexOf(palabra.toLowerCase()) === 0 ? p.slice(palabra.length) : p;
    insertarTexto(resto + " "); aprender(p); frase += resto + " ";
    if (ajustes.voz_eco) decirVoz(p, false);
    palabra = ""; refrescarSugerencias(); pintarTexto();
    if (capa === "ABC" && !bloqMayus) { capa = "abc"; dibujarTeclado(); }
  }
  function terminarPalabra(aprende) {
    if (aprende && palabra) aprender(palabra);
    if (palabra && ajustes.voz_eco) decirVoz(palabra, false);
    palabra = "";
  }

  // --- dictado y órdenes por voz (Web Speech API) ---------------------------
  var Reconocedor = window.SpeechRecognition || window.webkitSpeechRecognition, dictando = false, rec = null, escuchando = false, recOrdenes = null;
  // Honestidad sobre la voz: la Web Speech API de Chrome y Edge no reconoce en el equipo, manda el audio a Google o Microsoft
  var AVISO_VOZ = "Aviso: mientras escuchas, el navegador envía tu voz a los servidores de Google o Microsoft para reconocerla; nada más sale de tu equipo. Más en winclus.com/privacidad.";
  function alternarDictado() { if (dictando) pararDictado(); else empezarDictado(); }
  // Un solo reconocedor vivo por página: en Chrome y Edge arrancar un segundo aborta al primero, y si cada uno se
  // reinicia en onend se abortan entre sí sin fin. Aquí, arrancar uno para al anterior, y un error grave
  // (sin micrófono, sin red, sin permiso, idioma no soportado) no reintenta.
  var recActivo = null;
  var ERRORES_VOZ = { "not-allowed": "Sin permiso para el micrófono", "service-not-allowed": "El reconocimiento de voz no está permitido en este navegador", "audio-capture": "No se encontró micrófono", "network": "El reconocimiento de voz necesita conexión a internet", "language-not-supported": "Este idioma no está disponible para reconocer la voz" };
  function crearReconocedor(cfg) {
    if (recActivo && recActivo.parar) { var viejo = recActivo; viejo.parar(); if (viejo.alSustituir) viejo.alSustituir("sustituido"); }   // quien usaba el micrófono se entera y apaga su botón
    var r = new Reconocedor(), vivo = true, fatal = false;
    r.alSustituir = cfg.onfatal;
    r.lang = IDIOMA_VOZ; r.continuous = true; r.interimResults = !!cfg.interim;
    r.onresult = cfg.onresult;
    r.onerror = function (e) {
      if (e.error === "no-speech" || e.error === "aborted") return;
      fatal = true; var msg = ERRORES_VOZ[e.error] || ("No se pudo reconocer la voz (" + e.error + ")");
      avisar(msg, true); decir(msg + "."); if (cfg.onfatal) cfg.onfatal(e.error);
    };
    r.onend = function () { if (vivo && !fatal && recActivo === r) setTimeout(function () { if (vivo && recActivo === r) { try { r.start(); } catch (x) {} } }, 250); };
    r.parar = function () { vivo = false; if (recActivo === r) recActivo = null; try { r.stop(); } catch (x) {} };
    recActivo = r; r.start(); return r;
  }
  function empezarDictado() {
    if (!Reconocedor) { avisar("Este navegador no dicta (usa Chrome o Edge)", true); return; }
    if (dictando) return;
    try {
      rec = crearReconocedor({ onresult: function (e) { for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { var t = e.results[i][0].transcript.trim(); if (t) manejarDictado(t); } }, onfatal: function () { pararDictado(); } });
      dictando = true; avisar("Dictando… habla"); if (tecVisible) dibujarTeclado();
    } catch (e) { avisar("No se pudo empezar el dictado", true); }
  }
  function pararDictado() { if (!dictando) return; dictando = false; if (rec && rec.parar) rec.parar(); if (tecVisible) dibujarTeclado(); avisar("Dictado parado"); }

  // Órdenes habladas: «baja», «sube», «clic», «pulsa contacto», «escribe hola», «lee», «teclado», «menú», «pausa»…
  function empezarEscucha() {
    if (!Reconocedor) { decir("Este navegador no reconoce la voz (usa Chrome o Edge)."); return; }
    if (escuchando) return;
    try {
      recOrdenes = crearReconocedor({ onresult: function (e) { for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) ejecutarOrden(e.results[i][0].transcript); }, onfatal: function () { pararEscucha(); } });
      escuchando = true; avisar("Escuchando órdenes");
    } catch (e) { avisar("No se pudo empezar a escuchar", true); }
    refrescos.forEach(function (f) { f(); });
  }
  function pararEscucha() { if (!escuchando) return; escuchando = false; if (recOrdenes && recOrdenes.parar) recOrdenes.parar(); refrescos.forEach(function (f) { f(); }); }

  // --- subtítulos en vivo: lo que se habla cerca del micrófono, en una barra grande abajo --------
  var subtitulando = false, recSub = null, subFinal = "";
  function empezarSubvivo() {
    if (!Reconocedor) { avisar("Este navegador no reconoce la voz (usa Chrome o Edge)", true); return; }
    if (subtitulando) return;
    subFinal = ""; subvivoEl.innerHTML = '<span class="final">Escuchando…</span> <span class="parcial"></span>'; subvivoEl.style.display = "block";
    try {
      recSub = crearReconocedor({ interim: true, onresult: function (e) {
        var parcial = "";
        for (var i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) subFinal += e.results[i][0].transcript + " "; else parcial += e.results[i][0].transcript; }
        subFinal = subFinal.slice(-220);   // solo lo último: cabe en dos líneas
        subvivoEl.querySelector(".final").textContent = subFinal.trim(); subvivoEl.querySelector(".parcial").textContent = parcial;
      }, onfatal: function () { pararSubvivo(); } });
      subtitulando = true;
    } catch (e) { subvivoEl.style.display = "none"; avisar("No se pudieron empezar los subtítulos", true); }
    refrescos.forEach(function (f) { f(); });
  }
  function pararSubvivo() { if (!subtitulando) return; subtitulando = false; if (recSub && recSub.parar) recSub.parar(); subvivoEl.style.display = "none"; refrescos.forEach(function (f) { f(); }); }

  // --- avisos visuales de sonido y subtítulos de los vídeos de la página ------------------------
  var sonidoTimer = 0;
  function nombreMedio(m) {
    var n = m.getAttribute("aria-label") || m.title || (m.closest("figure") && m.closest("figure").querySelector("figcaption") ? m.closest("figure").querySelector("figcaption").textContent : "");
    if (!n) { var src = m.currentSrc || m.src || ""; try { n = src && !/^(data|blob):/.test(src) ? decodeURIComponent(src.split("/").pop().split("?")[0]).replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ") : ""; } catch (e) { n = ""; } }
    return (n || (m.tagName === "VIDEO" ? "un vídeo" : "un audio")).trim().slice(0, 60);
  }
  function avisoSonido(m) {
    if (!ajustes.alertas_sonido || (m && (m.muted || m.volume === 0))) return;
    sonidoEl.textContent = "🔊 Está sonando: " + (m ? nombreMedio(m) : "algo en la página");
    sonidoEl.style.display = "block";
    try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) {}
    clearTimeout(sonidoTimer); sonidoTimer = setTimeout(function () { sonidoEl.style.display = "none"; }, 4000);
  }
  document.addEventListener("play", function (e) { if (e.target instanceof HTMLMediaElement && !enWidget(e.target)) avisoSonido(e.target); }, true);
  // Audios creados por código (new Audio) no están en el documento y no avisan por eventos: se envuelve play()
  try {
    var playOriginal = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { try { if (!this.isConnected) avisoSonido(this); limitarVolumen(this); } catch (e) {} return playOriginal.apply(this, arguments); };   // nunca romper el play() del sitio
  } catch (e) {}
  function aplicarSubtitulos() {
    if (!ajustes.subtitulos) return;
    var base = IDIOMA_PAGINA.split("-")[0];
    Array.prototype.forEach.call(document.querySelectorAll("video"), function (v) {
      var pistas = v.textTracks, elegida = null;
      for (var i = 0; i < pistas.length; i++) { var p = pistas[i]; if (p.kind !== "subtitles" && p.kind !== "captions") continue; if (!elegida || ((p.language || "").toLowerCase().indexOf(base) === 0 && (elegida.language || "").toLowerCase().indexOf(base) !== 0)) elegida = p; }
      for (var j = 0; j < pistas.length; j++) if (pistas[j].kind === "subtitles" || pistas[j].kind === "captions") pistas[j].mode = pistas[j] === elegida ? "showing" : "disabled";
    });
  }
  document.addEventListener("play", function (e) { if (ajustes.subtitulos && e.target && e.target.tagName === "VIDEO") aplicarSubtitulos(); }, true);
  // --- limitador de volumen (sonidos súbitos, hipersensibilidad): ningún medio de la página pasa del máximo -----
  var limitando = false;
  function limitarVolumen(m) {
    if (!(m instanceof HTMLMediaElement) || enWidget(m) || limitando) return;
    var max = Math.max(0.1, Math.min(1, (ajustes.volumen_max || 100) / 100));
    if (m.volume > max + 0.001) { limitando = true; try { m.volume = max; } catch (e) {} limitando = false; }
  }
  function limitarVolumenTodos() { Array.prototype.forEach.call(document.querySelectorAll("audio,video"), limitarVolumen); }
  document.addEventListener("play", function (e) { limitarVolumen(e.target); }, true);
  document.addEventListener("volumechange", function (e) { limitarVolumen(e.target); }, true);
  // --- silenciar la página (familia 1): ningún vídeo ni audio suena, tampoco los que arranquen después. Al apagarlo
  // solo se devuelve el sonido a los que silenció Winclus: lo que el sitio tenía en silencio se queda así --------
  var silenciados = [];
  function silenciar(m) {
    if (!(m instanceof HTMLMediaElement) || enWidget(m) || m.muted) return;
    try { m.muted = true; } catch (e) {}
    if (silenciados.indexOf(m) < 0) silenciados.push(m);
  }
  function aplicarSilencio() {
    if (ajustes.silencio) Array.prototype.forEach.call(document.querySelectorAll("audio,video"), silenciar);
    else { silenciados.forEach(function (m) { try { m.muted = false; } catch (e) {} }); silenciados = []; }
  }
  document.addEventListener("play", function (e) { if (ajustes.silencio) silenciar(e.target); }, true);
  document.addEventListener("volumechange", function (e) { if (ajustes.silencio) silenciar(e.target); }, true);
  // --- amplificar y aclarar la voz (hipoacusia): lo contrario del limitador. Cada medio pasa por
  // graves fuera (pasa-altos) → realce de la voz (2,5 kHz) → ganancia → limitador (que no distorsione) → altavoces.
  // Solo se toca lo que el navegador deja procesar: un medio de otro dominio sin CORS saldría EN SILENCIO por
  // Web Audio, así que se deja como está y se avisa (una vez) de que ese no se puede amplificar.
  var ctxAmp = null, cadenas = typeof WeakMap === "function" ? new WeakMap() : null, avisadoOtroSitio = false;
  function ampActiva() { return (ajustes.amplificar || 100) > 100 || !!ajustes.voz_clara; }
  function medioProcesable(m) {
    var src = m.currentSrc || m.src || ""; if (!src) return false;
    if (/^(blob|data):/i.test(src)) return true;
    try { var u = new URL(src, location.href); return u.origin === location.origin || !!m.crossOrigin; } catch (e) { return false; }
  }
  function ajustarCadena(c) {
    var t = ctxAmp.currentTime;
    c.graves.frequency.setValueAtTime(ajustes.voz_clara ? 150 : 10, t);
    c.voz.gain.setValueAtTime(ajustes.voz_clara ? 9 : 0, t);
    c.ganancia.gain.setValueAtTime(Math.max(1, Math.min(4, (ajustes.amplificar || 100) / 100)), t);
  }
  function amplificarMedio(m) {
    if (!(m instanceof HTMLMediaElement) || enWidget(m) || !cadenas) return;
    var c = cadenas.get(m);
    if (c) { ajustarCadena(c); if (ctxAmp.state === "suspended") ctxAmp.resume(); return; }
    if (!ampActiva()) return;
    if (!medioProcesable(m)) {
      if (!avisadoOtroSitio && (m.currentSrc || m.src)) { avisadoOtroSitio = true; avisar("Este vídeo viene de otro sitio: no se puede subir su volumen", true); }
      return;
    }
    try {
      ctxAmp = ctxAmp || new (window.AudioContext || window.webkitAudioContext)();
      var fuente = ctxAmp.createMediaElementSource(m);   // desde aquí el sonido de este medio va por la cadena, para siempre
      c = { graves: ctxAmp.createBiquadFilter(), voz: ctxAmp.createBiquadFilter(), ganancia: ctxAmp.createGain(), limite: ctxAmp.createDynamicsCompressor(), medidor: ctxAmp.createAnalyser() };
      c.graves.type = "highpass"; c.graves.Q.value = 0.7;
      c.voz.type = "peaking"; c.voz.frequency.value = 2500; c.voz.Q.value = 1;
      c.limite.threshold.value = -6; c.limite.knee.value = 6; c.limite.ratio.value = 20; c.limite.attack.value = 0.003; c.limite.release.value = 0.2;
      c.medidor.fftSize = 2048;
      fuente.connect(c.graves); c.graves.connect(c.voz); c.voz.connect(c.ganancia); c.ganancia.connect(c.limite); c.limite.connect(c.medidor); c.medidor.connect(ctxAmp.destination);
      cadenas.set(m, c); ajustarCadena(c);
      if (ctxAmp.state === "suspended") ctxAmp.resume();
    } catch (e) {}   // si el navegador no deja, el medio sigue sonando como siempre
  }
  function aplicarAmplificacion() { Array.prototype.forEach.call(document.querySelectorAll("audio,video"), amplificarMedio); }
  document.addEventListener("play", function (e) { amplificarMedio(e.target); }, true);
  // Nivel de salida (0 a 1) de un medio amplificado: para las pruebas y para el medidor del panel
  function nivelAmplificado(m) {
    var c = cadenas && cadenas.get(m); if (!c) return null;
    var d = new Float32Array(c.medidor.fftSize); c.medidor.getFloatTimeDomainData(d);
    var s = 0; for (var i = 0; i < d.length; i++) s += d[i] * d[i]; return Math.sqrt(s / d.length);
  }
  // Transcribir un medio de la página: los subtítulos en vivo escuchan por el micrófono lo que sale por los altavoces
  function transcribirMedio() {
    var medios = Array.prototype.filter.call(document.querySelectorAll("video,audio"), function (m) { return !enWidget(m) && (m.currentSrc || m.src || m.querySelector("source")); });
    if (!medios.length) { avisar("No hay vídeo ni audio en esta página", true); decirVoz("No hay vídeo ni audio en esta página.", true, true); return; }
    var m = medios.find(function (x) { return !x.paused; }) || medios[0];
    empezarSubvivo();
    try { m.muted = false; if (m.volume < 0.5) m.volume = 0.7; var pr = m.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
    avisar("Transcribiendo por el micrófono");
    decirVoz("Sube el volumen de los altavoces: el micrófono escuchará el audio y lo escribirá abajo.", true, true);
  }
  function ejecutarOrden(texto) {
    var t = sinAcentos(texto.trim()), m;
    var ok = function (msg) { avisar(msg); decir("Orden: " + texto); contar("ordenes"); };
    if (/^(baja|abajo|bajar)( un poco| mas)?$/.test(t)) { rueda(300, true); ok("Bajar"); }
    else if (/^(sube|arriba|subir)( un poco| mas)?$/.test(t)) { rueda(-300, true); ok("Subir"); }
    else if (/^(arriba|inicio) del todo$|^al principio$/.test(t)) { window.scrollTo({ top: 0, behavior: "smooth" }); ok("Arriba del todo"); }
    else if (/^(abajo|fin) del todo$|^al final$/.test(t)) { window.scrollTo({ top: raiz.scrollHeight, behavior: "smooth" }); ok("Abajo del todo"); }
    else if (/^(clic|click|pulsa|pulsar|dale)$/.test(t)) { pulsar(); }
    else if (/^(numeros|numera|numerar|muestra (los )?numeros|pon (los )?numeros)$/.test(t)) { mostrarNumeros(); }
    else if (/^(quita|oculta|esconde|borra)( los)? numeros$/.test(t)) { ocultarNumeros(); ok("Sin números"); }
    else if (numerosEl && (m = /^(?:(?:clic|click|pulsa|pulsar|dale|abre|elige|escribe en)(?: el| en| al)? )?([a-z0-9]+)$/.exec(t)) && numeroDicho(m[1])) { pulsarNumero(numeroDicho(m[1])); }
    else if (/^(clic|click) derecho$/.test(t)) { clicDerecho(); }
    else if (/^doble (clic|click)$/.test(t)) { dobleClic(); }
    else if ((m = /^(pulsa|pulsar|abre|abrir|ve a|ir a|entra en) (.+)$/.exec(t))) { pulsarPorTexto(m[2]) ? ok("Pulsar «" + m[2] + "»") : avisar("No encuentro «" + m[2] + "»", true); }
    else if ((m = /^(escribe|escribir|pon) (.+)$/.exec(t))) { insertarTexto(texto.trim().replace(/^\S+\s+/, "")); ok("Escribir"); }
    else if (/^(borra|borrar) (todo|el campo)$/.test(t)) { var c = campo(); if (c) { fijarValor(c, "", 0); ok("Borrado"); } }
    else if (/^(borra|borrar)( una letra)?$/.test(t)) { borrarAtras(); ok("Borrar"); }
    else if (/^(borra|borrar) (la )?palabra$/.test(t)) { var c2 = campo(); if (c2 && !c2.isContentEditable) { var v = c2.value.replace(/\s*\S+\s*$/, ""); fijarValor(c2, v, v.length); ok("Palabra borrada"); } }
    else if (/^(intro|enter|enviar|aceptar)$/.test(t)) { teclaEspecial("enter"); ok("Intro"); }
    else if (/^siguiente( campo)?$/.test(t)) { siguienteCampo(1); } else if (/^anterior( campo)?$/.test(t)) { siguienteCampo(-1); }
    else if (/^(lee|leer|lee esto|lee aqui)$/.test(t)) { leerElemento(bajoPuntero()); ok("Leer"); }
    else if (/^(lee|leer) la pagina$/.test(t)) { leerPagina(); ok("Leer la página"); }
    else if (/^(para|calla|callate|silencio|stop)$/.test(t)) { callar(); avisar("Callar"); }
    else if (/^(teclado|abre el teclado|cierra el teclado)$/.test(t)) { alternarTeclado(); }
    else if (/^(menu|menu de clics)$/.test(t)) { if (menuVisible) cerrarMenu(); else abrirMenu(); }
    else if (/^(pausa|pausar|para el puntero)$/.test(t)) { if (!pausado) pausar(); }
    else if (/^(sigue|seguir|continua|reanudar|activar)$/.test(t)) { if (pausado) reanudar(); }
    else if (/^(atras|volver|vuelve)$/.test(t)) { history.back(); } else if (/^(adelante)$/.test(t)) { history.forward(); }
    else if (/^(mas grande|texto mas grande|agranda)$/.test(t)) { orden("zoommas"); ok("Texto más grande"); }
    else if (/^(mas pequeno|texto mas pequeno|reduce)$/.test(t)) { orden("zoommenos"); ok("Texto más pequeño"); }
    else if (/^(centro|centrar|recentrar)$/.test(t)) { recentrar(); }
    else if (/^(ayuda|que puedo decir)$/.test(t)) { decirVoz("Puedes decir: baja, sube, clic, pulsa y el nombre de un enlace, escribe y el texto, borra, intro, lee, lee la página, calla, teclado, menú, pausa, sigue, atrás, más grande.", true, true); }
    else if (/^(donde estoy|en que pagina estoy|situacion)$/.test(t)) { dondeEstoy(); }
    else if (/^(explica|explicame|explicar)( esta| la)? pagina$|^(lectura|leer) facil$/.test(t)) { if (!limpiaEl) lecturaLimpia(); explicarFacil(); }
    else if ((m = /^(di|dice|decir) (.+)$/.exec(t))) { hablarPersona(texto.trim().replace(/^\S+\s+/, "")); }
    else if (!asistenteGuiado(texto)) avisar("No entendí: " + texto, true);   // lo que no es una orden se lo queda el asistente
  }
  // --- ayuda en formularios: dónde estoy, errores en lenguaje claro, pegar siempre permitido (WCAG 3.3.1, 3.3.3, 3.3.7, 3.3.8) ---
  var SEL_CAMPO = "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]),select,textarea,[contenteditable=''],[contenteditable='true']";
  function camposDelFormulario(c) {
    var raiz2 = c.form || c.closest("form") || document;
    return Array.prototype.filter.call(raiz2.querySelectorAll(SEL_CAMPO), function (e) { return !enWidget(e) && !e.disabled && visibleEl(e); });
  }
  function nombreCampo(e) { return etiquetaCampo(e) || nombreDe(e) || "campo sin nombre"; }
  var ultimoCampoAnunciado = null;
  document.addEventListener("focusin", function (ev) {
    var c = ev.target;
    if (!ajustes.formularios || !c || enWidget(c) || !c.matches || !c.matches(SEL_CAMPO) || c === ultimoCampoAnunciado) return;
    ultimoCampoAnunciado = c;
    if (c.hasAttribute("onpaste")) c.removeAttribute("onpaste");   // bloqueos de pegar del sitio (WCAG 3.3.8)
    var lista = camposDelFormulario(c), i = lista.indexOf(c);
    var texto = (i >= 0 && lista.length > 1 ? "Campo " + (i + 1) + " de " + lista.length + ": " : "") + nombreCampo(c) + (c.required || c.getAttribute("aria-required") === "true" ? ", obligatorio" : "");
    avisar(texto); if (ajustes.lectura || ajustes.lector) decirVoz(texto, true, false, IDIOMA_PAGINA);
  });
  document.addEventListener("focusout", function () { ultimoCampoAnunciado = null; });
  function explicarError(c) {
    var n = "«" + nombreCampo(c) + "»", v = c.validity;
    if (!v) return "Revisa " + n + ".";
    if (v.valueMissing) return "Falta rellenar " + n + ".";
    if (v.typeMismatch) return c.type === "email" ? n + " tiene que ser un correo, por ejemplo nombre@ejemplo.com." : c.type === "url" ? n + " tiene que ser una dirección web, por ejemplo https://ejemplo.com." : n + " no tiene el formato correcto.";
    if (v.tooShort) return n + " necesita al menos " + c.minLength + " caracteres; llevas " + c.value.length + ".";
    if (v.tooLong) return n + " admite como mucho " + c.maxLength + " caracteres; llevas " + c.value.length + ".";
    if (v.rangeUnderflow) return n + " tiene que ser " + c.min + " o más.";
    if (v.rangeOverflow) return n + " tiene que ser " + c.max + " o menos.";
    if (v.badInput) return n + " solo admite números.";
    if (v.patternMismatch) return c.title ? n + ": " + c.title : n + " no tiene el formato que pide el sitio.";
    if (v.stepMismatch) return n + " tiene que ir de " + c.step + " en " + c.step + ".";
    return c.validationMessage ? n + ": " + c.validationMessage : "Revisa " + n + ".";
  }
  var errorTimer = 0, erroresPendientes = [];
  function mostrarErrores() {
    if (!erroresPendientes.length) return;
    var textos = erroresPendientes.map(explicarError), primero = erroresPendientes[0]; erroresPendientes = []; contar("errores");
    var msg = (textos.length > 1 ? "Hay " + textos.length + " cosas por corregir. " : "") + textos.slice(0, 3).join(" ");
    sonidoEl.textContent = "✎ " + msg; sonidoEl.classList.add("error"); sonidoEl.style.display = "block";
    clearTimeout(sonidoTimer); sonidoTimer = setTimeout(function () { sonidoEl.style.display = "none"; sonidoEl.classList.remove("error"); }, 9000);
    decirVoz(msg, true, false, IDIOMA_PAGINA);
    try { primero.focus({ preventScroll: true }); primero.scrollIntoView({ block: "center" }); } catch (x) {}
  }
  document.addEventListener("invalid", function (ev) {
    if (!ajustes.formularios || !ev.target || enWidget(ev.target)) return;
    if (erroresPendientes.indexOf(ev.target) < 0) erroresPendientes.push(ev.target);
    clearTimeout(errorTimer); errorTimer = setTimeout(mostrarErrores, 30);   // todos los inválidos del envío llegan seguidos
  }, true);
  // Errores que marca el propio sitio con aria-invalid
  var ultimoInvalido = null, tInvalido = 0;
  try {
    new MutationObserver(function (ms) {
      if (!ajustes.formularios) return;
      ms.forEach(function (m) { var e = m.target; if (m.oldValue === "true") return; if (e === ultimoInvalido && Date.now() - tInvalido < 4000) return; if (e.getAttribute && e.getAttribute("aria-invalid") === "true" && !enWidget(e) && e.matches(SEL_CAMPO)) { ultimoInvalido = e; tInvalido = Date.now(); var d = e.getAttribute("aria-describedby"), t = d && document.getElementById(d.split(" ")[0]); var msg = "Revisa «" + nombreCampo(e) + "»" + (t && t.textContent.trim() ? ": " + t.textContent.trim() : "."); avisar(msg, true); decirVoz(msg, true, false, IDIOMA_PAGINA); } });
    }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["aria-invalid"], attributeOldValue: true });
  } catch (e) {}
  // Pegar siempre permitido: los manejadores del sitio no llegan a cancelar el pegado
  // Solo en <input> y <textarea> con texto: el evento sigue llegando al sitio (editores, chats con imágenes…),
  // pero no puede cancelar el pegado
  document.addEventListener("paste", function (ev) {
    var t = ev.target;
    if (!ajustes.formularios || !t || enWidget(t) || !t.tagName || (t.tagName !== "INPUT" && t.tagName !== "TEXTAREA")) return;
    if (ev.clipboardData && ev.clipboardData.files && ev.clipboardData.files.length) return;
    ev.preventDefault = function () {};
  }, true);

  // ================================ pictogramas (CAA) con ARASAAC ==
  // Tablero de comunicación para quien no lee ni escribe bien: pictogramas de ARASAAC (Gobierno de Aragón,
  // licencia CC BY-NC-SA) por categorías, tira de frase con voz, predicción del siguiente símbolo aprendida
  // del uso, y frases guardadas (que pasan también a la tecla «Frases» del teclado).
  var PICTO_IMG = "https://static.arasaac.org/pictograms/";
  var PICTOS = {
    "Básico": [["sí", 5584], ["no", 5526], ["hola", 6522], ["adiós", 6028], ["gracias", 8129], ["por favor", 8195], ["bien", 5397], ["mal", 5504], ["ayuda", 19524], ["esperar", 36914], ["no entiendo", 11697], ["más", 3220]],
    "Necesito": [["agua", 2248], ["comer", 6456], ["beber", 6061], ["dormir", 6479], ["baño", 6929], ["medicinas", 8163], ["dolor", 2367], ["dolor de cabeza", 28651], ["hambre", 35559], ["sed", 7273], ["frío", 4652], ["calor", 35561], ["cansado", 35537], ["silla de ruedas", 25471], ["cama", 25900], ["ducha", 32426], ["ropa", 7233]],
    "Siento": [["contento", 35547], ["triste", 35545], ["miedo", 10261], ["enfadado", 35539], ["aburrido", 35531], ["cansado", 35537], ["dolor", 2367], ["bien", 5397], ["mal", 5504]],
    "Personas": [["yo", 6632], ["tú", 6625], ["mamá", 2458], ["papá", 31146], ["familia", 38351], ["amigo", 25790], ["médico", 6561], ["enfermera", 2375], ["cuidador", 14662]],
    "Acciones": [["quiero", 11538], ["necesito", 37160], ["ir", 8142], ["venir", 32669], ["jugar", 23392], ["ver", 6564], ["leer", 7141], ["escribir", 2380], ["salir", 6606], ["pasear", 29951], ["lavar", 34826], ["llamar", 26479], ["comer", 6456], ["beber", 6061], ["dormir", 6479]],
    "Lugares": [["casa", 6964], ["hospital", 3116], ["colegio", 3082], ["parque", 2859], ["tienda", 35695], ["trabajo", 16087], ["baño", 6929]],
    "Comida": [["comida", 4610], ["agua", 2248], ["pan", 2494], ["fruta", 4653], ["comer", 6456], ["beber", 6061]],
    "Tiempo y cosas": [["ahora", 32747], ["hoy", 7131], ["mañana", 38278], ["más tarde", 7268], ["teléfono", 26479], ["televisión", 25498], ["música", 24791], ["dinero", 4630], ["coche", 2339], ["autobús", 2262]]
  };
  var PICTO_SIGUIENTES = { "yo": ["quiero", "necesito", "siento"], "quiero": ["agua", "comer", "ir", "dormir", "ver", "salir"], "necesito": ["ayuda", "baño", "medicinas", "agua", "dormir"], "ir": ["casa", "baño", "hospital", "parque"], "ver": ["televisión", "médico", "mamá"], "dolor": ["dolor de cabeza", "medicinas", "médico"] };
  var pictosEl = null, pictoFrase = [], pictoCat = "Básico", pictoVista = "temas", pictoUso = leerJSON("winclus.pictos_uso", {}), pictoFrases = leerJSON("winclus.pictos_frases", []);
  // Familia 4 (CAA): vocabulario nuclear (las palabras que cubren la mayor parte de lo que se dice, por función
  // gramatical y con los colores de la clave de Fitzgerald), tableros propios con dibujos de ARASAAC, fotos o solo
  // texto (los hace la familia o el terapeuta y se comparten por archivo o enlace), búsqueda de cualquier pictograma
  // de ARASAAC, frases bien dichas (conjugación del verbo y género de los adjetivos) e historial de lo dicho.
  // Los ids de NUCLEAR los genera herramientas/vocabulario_nuclear.js con la API de ARASAAC.
  var NUCLEAR = { "Personas": [["yo", 2617], ["tú", 2608], ["él", 6480], ["ella", 7029], ["nosotros", 7185], ["ellos", 7032], ["usted", 2608], ["mamá", 2458], ["papá", 31146], ["familia", 2392], ["amigo", 8487], ["amiga", 8486], ["hermano", 2423], ["hermana", 2422], ["abuelo", 2244], ["abuela", 2243], ["hijo", 9887], ["hija", 9885], ["bebé", 2275], ["niño", 2485], ["niña", 2484], ["hombre", 4665], ["mujer", 4703], ["médico", 2467], ["enfermera", 2375], ["profesor", 2457], ["cuidador", 7163], ["gente", 7117], ["todos", 5596], ["nadie", 11314], ["alguien", 37779]], "Acciones": [["querer", 5441], ["necesitar", 37160], ["tener", 7271], ["ser", 5581], ["estar", 5466], ["ir", 2432], ["venir", 11708], ["hacer", 11749], ["poder", 11750], ["dar", 17038], ["ver", 2474], ["mirar", 2474], ["oír", 2381], ["escuchar", 2381], ["hablar", 3345], ["decir", 9692], ["comer", 2349], ["beber", 2276], ["dormir", 2369], ["despertar", 8988], ["jugar", 2439], ["trabajar", 2599], ["estudiar", 2387], ["leer", 7141], ["escribir", 2380], ["abrir", 24825], ["cerrar", 2697], ["poner", 6627], ["quitar", 11751], ["ayudar", 4570], ["esperar", 8109], ["parar", 7195], ["seguir", 7038], ["empezar", 5431], ["terminar", 5358], ["buscar", 6946], ["encontrar", 5990], ["saber", 9034], ["pensar", 8662], ["sentir", 30196], ["gustar", 2418], ["amar", 6898], ["llorar", 3239], ["reír", 13354], ["caminar", 3251], ["correr", 2719], ["sentarse", 0], ["levantarse", 0], ["lavar", 5496], ["bañarse", 0], ["vestirse", 0], ["comprar", 6457], ["pagar", 6457], ["llamar", 4687], ["cantar", 2315], ["bailar", 2652], ["pintar", 2348], ["tocar", 3293], ["coger", 6452], ["dejar", 6215], ["llevar", 6139], ["traer", 7280], ["subir", 6617], ["bajar", 6053], ["entrar", 2742], ["salir", 2806], ["volver", 6248], ["cambiar", 8053], ["romper", 4735], ["arreglar", 6910], ["limpiar", 3351], ["cocinar", 2342], ["mover", 7167], ["saltar", 2804], ["nadar", 6568], ["viajar", 4671], ["vivir", 7302], ["olvidar", 26258], ["recordar", 11357], ["aprender", 8029], ["enseñar", 11308], ["preguntar", 9840], ["contestar", 9030], ["pedir", 5441], ["doler", 30620], ["descansar", 3299], ["respirar", 34377], ["toser", 3406], ["vomitar", 2777], ["tomar", 2276]], "Cómo es": [["bueno", 4581], ["malo", 4690], ["grande", 4658], ["pequeño", 4716], ["mucho", 5521], ["poco", 5546], ["más", 3220], ["menos", 3200], ["caliente", 4583], ["frío", 4652], ["nuevo", 4705], ["viejo", 4770], ["bonito", 11194], ["feo", 4648], ["rápido", 5306], ["lento", 4676], ["alto", 4557], ["bajo", 4571], ["largo", 4675], ["corto", 4615], ["fácil", 4645], ["difícil", 4629], ["lleno", 4688], ["vacío", 4767], ["limpio", 4680], ["sucio", 4750], ["fuerte", 4655], ["débil", 4620], ["feliz", 9907], ["triste", 2606], ["enfadado", 2374], ["cansado", 2314], ["enfermo", 7040], ["sano", 12293], ["contento", 3245], ["aburrido", 2245], ["asustado", 2261], ["nervioso", 11312], ["tranquilo", 31310], ["dulce", 4636], ["salado", 4739], ["rico", 4733], ["igual", 3423], ["diferente", 4628], ["otro", 17054], ["todo", 5596], ["nada", 29839], ["algo", 0], ["mío", 12264], ["tuyo", 12281], ["importante", 11470], ["bien", 5397], ["mal", 5504], ["mejor", 11470], ["peor", 39512], ["rojo", 2808], ["azul", 3355], ["verde", 4886], ["amarillo", 2648], ["negro", 2886], ["blanco", 2662]], "Cosas": [["agua", 2248], ["comida", 4611], ["pan", 2494], ["leche", 2445], ["fruta", 4653], ["carne", 2316], ["medicina", 8163], ["ropa", 7233], ["zapatos", 2622], ["cama", 2304], ["silla", 3155], ["mesa", 3129], ["puerta", 3244], ["ventana", 2611], ["coche", 2339], ["autobús", 2262], ["teléfono", 2586], ["televisión", 25498], ["ordenador", 2487], ["tableta", 25940], ["música", 11311], ["libro", 2450], ["juguete", 9813], ["pelota", 3241], ["dinero", 4630], ["llave", 8153], ["bolso", 2284], ["gafas", 3329], ["pañal", 2863], ["vaso", 2610], ["plato", 2532], ["cuchara", 2362], ["ducha", 2370], ["jabón", 2964], ["cepillo de dientes", 2694], ["peine", 2852], ["papel", 8349], ["bolígrafo", 2282], ["luz", 8619], ["silla de ruedas", 6212], ["perro", 2517], ["gato", 2406], ["sol", 2798], ["lluvia", 3123], ["regalo", 3149], ["fiesta", 7099], ["cumpleaños", 3087], ["foto", 7107], ["mano", 2928], ["cabeza", 2673], ["boca", 2663], ["ojo", 6573], ["oreja", 2871], ["nariz", 2887], ["pie", 2841], ["pierna", 8666], ["brazo", 2669], ["barriga", 2786], ["espalda", 2748], ["corazón", 2715], ["dolor", 2367]], "Lugares": [["casa", 2317], ["colegio", 3082], ["hospital", 3116], ["parque", 2859], ["tienda", 9117], ["trabajo", 16087], ["calle", 2299], ["cocina", 2341], ["habitación", 5988], ["baño", 6929], ["jardín", 2434], ["ciudad", 2704], ["playa", 2826], ["campo", 2683], ["iglesia", 3118], ["restaurante", 10283], ["aquí", 5382], ["allí", 5375], ["dentro", 5439], ["fuera", 5475], ["arriba", 5388], ["abajo", 5355], ["cerca", 30383], ["lejos", 30385], ["delante", 5438], ["detrás", 5443], ["encima", 5451], ["debajo", 5437]], "Tiempo": [["ahora", 13026], ["luego", 13080], ["después", 13080], ["antes", 13028], ["hoy", 7131], ["mañana", 7152], ["ayer", 6926], ["siempre", 17322], ["nunca", 5527], ["otra vez", 37162], ["pronto", 5306], ["tarde", 7268], ["temprano", 25704], ["noche", 7181], ["día", 7022], ["semana", 7244], ["hora", 7129], ["fin", 5358]], "Preguntas y enlaces": [["qué", 22624], ["quién", 9853], ["dónde", 7764], ["cuándo", 22621], ["cómo", 22619], ["por qué", 24763], ["cuánto", 24731], ["y", 3047], ["o", 3037], ["pero", 11377], ["porque", 11348], ["con", 7064], ["sin", 7813], ["para", 7194], ["de", 7074], ["a", 3021], ["en", 7034], ["no", 5526], ["sí", 5584], ["también", 11591], ["tampoco", 11593], ["muy", 25708], ["ya", 25736], ["todavía", 0]], "Sociales": [["hola", 6009], ["adiós", 5896], ["gracias", 8129], ["por favor", 8195], ["perdón", 11625], ["lo siento", 11625], ["ayuda", 12252], ["socorro", 0], ["vale", 0], ["no sé", 0], ["no entiendo", 27363], ["basta", 0], ["me gusta", 0], ["no me gusta", 0], ["te quiero", 0], ["buenos días", 6944], ["buenas noches", 6942], ["cómo estás", 0], ["más o menos", 0], ["espera", 16091], ["mira", 0], ["ven", 0], ["dame", 0], ["quiero", 0], ["no quiero", 6156]] };
  var COLOR_NUCLEAR = { "Personas": "amarillo", "Acciones": "verde", "Cómo es": "azul", "Cosas": "naranja", "Lugares": "marron", "Tiempo": "gris", "Preguntas y enlaces": "morado", "Sociales": "rosa" };
  var tableros = tablerosValidos(leerJSON("winclus.tableros", [])), tableroI = 0, historial = leerJSON("winclus.pictos_historial", {}), pictoBusqueda = [], pictoAgregarA = -1, quitando = false;
  function tablerosValidos(l) {
    if (!Array.isArray(l)) return [];
    return l.filter(function (t) { return t && typeof t.nombre === "string" && Array.isArray(t.items); }).slice(0, 12).map(function (t) {
      return { nombre: t.nombre.slice(0, 40), items: t.items.filter(function (p) { return Array.isArray(p) && typeof p[0] === "string"; }).slice(0, 60).map(function (p) { return [p[0].slice(0, 40), typeof p[1] === "number" ? p[1] : 0, typeof p[2] === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(p[2]) ? p[2] : ""]; }) };
    });
  }
  function guardarTableros() { escribirJSON("winclus.tableros", tableros); }
  function pictoDatos(nombre) {
    var c, i;
    for (c in PICTOS) for (i = 0; i < PICTOS[c].length; i++) if (PICTOS[c][i][0] === nombre) return PICTOS[c][i];
    for (c in NUCLEAR) for (i = 0; i < NUCLEAR[c].length; i++) if (NUCLEAR[c][i][0] === nombre) return NUCLEAR[c][i];
    for (c = 0; c < tableros.length; c++) for (i = 0; i < tableros[c].items.length; i++) if (tableros[c].items[i][0] === nombre) return tableros[c].items[i];
    return [nombre, 0];
  }
  function pictoBoton(p, alPulsar, color) {
    var b = el("button", { "type": "button", "class": "picto" + (color ? " c-" + color : ""), "aria-label": p[0] });
    if (p[2]) { var f = el("img", { "class": "foto", "alt": "", "width": "72", "height": "72" }); f.src = p[2]; b.appendChild(f); }
    else if (p[1]) { var img = el("img", { "alt": "", "loading": "lazy", "width": "72", "height": "72" }); img.src = PICTO_IMG + p[1] + "/" + p[1] + "_300.png"; img.onerror = function () { img.remove(); }; b.appendChild(img); }
    b.appendChild(el("span", {}, p[0]));
    b.addEventListener("click", function () { alPulsar(p); });
    return b;
  }
  // --- frases bien dichas: el primer verbo se conjuga según el sujeto (o «yo» si no lo hay) y los adjetivos en -o
  // concuerdan en género y número. Presente de indicativo: regulares por terminación e irregulares frecuentes.
  var IRREG = { ser: ["soy", "eres", "es", "somos", "son"], estar: ["estoy", "estás", "está", "estamos", "están"], ir: ["voy", "vas", "va", "vamos", "van"], tener: ["tengo", "tienes", "tiene", "tenemos", "tienen"], querer: ["quiero", "quieres", "quiere", "queremos", "quieren"], poder: ["puedo", "puedes", "puede", "podemos", "pueden"], hacer: ["hago", "haces", "hace", "hacemos", "hacen"], dar: ["doy", "das", "da", "damos", "dan"], ver: ["veo", "ves", "ve", "vemos", "ven"], venir: ["vengo", "vienes", "viene", "venimos", "vienen"], decir: ["digo", "dices", "dice", "decimos", "dicen"], saber: ["sé", "sabes", "sabe", "sabemos", "saben"], poner: ["pongo", "pones", "pone", "ponemos", "ponen"], salir: ["salgo", "sales", "sale", "salimos", "salen"], dormir: ["duermo", "duermes", "duerme", "dormimos", "duermen"], sentir: ["siento", "sientes", "siente", "sentimos", "sienten"], jugar: ["juego", "juegas", "juega", "jugamos", "juegan"], pensar: ["pienso", "piensas", "piensa", "pensamos", "piensan"], empezar: ["empiezo", "empiezas", "empieza", "empezamos", "empiezan"], encontrar: ["encuentro", "encuentras", "encuentra", "encontramos", "encuentran"], volver: ["vuelvo", "vuelves", "vuelve", "volvemos", "vuelven"], "oír": ["oigo", "oyes", "oye", "oímos", "oyen"], "reír": ["río", "ríes", "ríe", "reímos", "ríen"], despertar: ["despierto", "despiertas", "despierta", "despertamos", "despiertan"], recordar: ["recuerdo", "recuerdas", "recuerda", "recordamos", "recuerdan"], mover: ["muevo", "mueves", "mueve", "movemos", "mueven"], coger: ["cojo", "coges", "coge", "cogemos", "cogen"], seguir: ["sigo", "sigues", "sigue", "seguimos", "siguen"], pedir: ["pido", "pides", "pide", "pedimos", "piden"], traer: ["traigo", "traes", "trae", "traemos", "traen"], sentarse: ["me siento", "te sientas", "se sienta", "nos sentamos", "se sientan"], levantarse: ["me levanto", "te levantas", "se levanta", "nos levantamos", "se levantan"], "bañarse": ["me baño", "te bañas", "se baña", "nos bañamos", "se bañan"], vestirse: ["me visto", "te vistes", "se viste", "nos vestimos", "se visten"], doler: ["me duele", "te duele", "le duele", "nos duele", "les duele"], gustar: ["me gusta", "te gusta", "le gusta", "nos gusta", "les gusta"] };
  var SUJETOS = { yo: [0, ""], "tú": [1, ""], "él": [2, "m"], ella: [2, "f"], usted: [2, ""], nosotros: [3, "m"], ellos: [4, "m"], todos: [4, "m"], "mamá": [2, "f"], "papá": [2, "m"], familia: [2, "f"], amigo: [2, "m"], amiga: [2, "f"], hermano: [2, "m"], hermana: [2, "f"], abuelo: [2, "m"], abuela: [2, "f"], hijo: [2, "m"], hija: [2, "f"], "bebé": [2, "m"], "niño": [2, "m"], "niña": [2, "f"], hombre: [2, "m"], mujer: [2, "f"], "médico": [2, "m"], enfermera: [2, "f"], profesor: [2, "m"], cuidador: [2, "m"], gente: [2, "f"], nadie: [2, ""], alguien: [2, ""], perro: [2, "m"], gato: [2, "m"] };
  var VERBOS = NUCLEAR["Acciones"].map(function (p) { return p[0]; }).concat(PICTOS["Acciones"].map(function (p) { return p[0]; }));
  var ADJETIVOS = NUCLEAR["Cómo es"].map(function (p) { return p[0]; }).concat(PICTOS["Siento"].map(function (p) { return p[0]; }));
  function conjugar(v, persona) {
    if (IRREG[v]) return IRREG[v][persona];
    var m = /^(.+)(ar|er|ir)$/.exec(v); if (!m) return v;
    var t = m[2] === "ar" ? ["o", "as", "a", "amos", "an"] : m[2] === "er" ? ["o", "es", "e", "emos", "en"] : ["o", "es", "e", "imos", "en"];
    return m[1] + t[persona];
  }
  function pulirFrase(palabras) {
    var out = [], persona = 0, genero = ajustes.caa_genero === "m" || ajustes.caa_genero === "f" ? ajustes.caa_genero : "", plural = false, conj = false, sujeto = false;
    palabras.forEach(function (w) {
      var l = String(w).toLowerCase();
      if (!sujeto && !conj && SUJETOS[l]) { persona = SUJETOS[l][0]; genero = SUJETOS[l][1] || (persona === 0 ? genero : ""); plural = persona >= 3; sujeto = true; out.push(w); return; }
      if (!conj && (IRREG[l] || VERBOS.indexOf(l) >= 0)) {
        if ((l === "gustar" || l === "doler") && sujeto && out.length && SUJETOS[out[out.length - 1].toLowerCase()] && /^(yo|tú|él|ella|usted|nosotros|ellos)$/.test(out[out.length - 1].toLowerCase())) out.pop();   // «yo gustar» → «me gusta»
        out.push(conjugar(l, persona)); conj = true; return;
      }
      if (conj && ADJETIVOS.indexOf(l) >= 0 && /[oa]$/.test(l)) {
        var a = genero === "f" && /o$/.test(l) ? l.slice(0, -1) + "a" : l;
        out.push(plural ? a + "s" : a); return;
      }
      out.push(w);
    });
    var t = out.join(" ").replace(/\s+/g, " ").trim();
    return t;
  }
  function pictoTextoDicho() { var l = pictoFrase.map(function (p) { return p[0]; }); return ajustes.caa_gramatica ? pulirFrase(l) : l.join(" "); }
  function abrirPictos() {
    if (!pictosEl) {
      pictosEl = el("div", { "class": "wcl-pictos", "role": "dialog", "aria-label": "Tablero de pictogramas" },
        '<div class="tira"><div class="frase" aria-live="polite" aria-label="Frase"></div><div class="acciones"></div></div><div class="vistas" role="tablist" aria-label="Tableros"></div><div class="herr"></div><div class="sig"></div><div class="cats" role="tablist"></div><div class="rejilla"></div><div class="pie">Pictogramas de <a href="https://arasaac.org" target="_blank" rel="noopener">ARASAAC</a> (Gobierno de Aragón), licencia CC BY-NC-SA.</div>');
      var acc = pictosEl.querySelector(".acciones");
      [["Decir", function () { pictoDecir(); }], ["Borrar último", function () { pictoFrase.pop(); pintarPictos(); }], ["Borrar todo", function () { pictoFrase = []; pintarPictos(); }], ["Guardar frase", function () { pictoGuardar(); }], ["Teclado", function () { cerrarPictos(); mostrarTeclado(); }], ["Cerrar", function () { cerrarPictos(); }]].forEach(function (a) {
        var b = el("button", { "type": "button" }, a[0]); b.addEventListener("click", a[1]); acc.appendChild(b);
      });
      var vistas = pictosEl.querySelector(".vistas");
      [["temas", "Temas"], ["nuclear", "Palabras"], ["mios", "Míos"], ["buscar", "Buscar"]].forEach(function (v) {
        var b = el("button", { "type": "button", "role": "tab", "data-v": v[0] }, v[1]);
        b.addEventListener("click", function () { pictoVista = v[0]; pictoAgregarA = -1; quitando = false; if (v[0] === "nuclear" && !NUCLEAR[pictoCat]) pictoCat = "Personas"; if (v[0] === "temas" && !PICTOS[pictoCat] && pictoCat !== "Mis frases") pictoCat = "Básico"; pintarPictos(); });
        vistas.appendChild(b);
      });
      pictosEl.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); cerrarPictos(); } });
      caja.appendChild(pictosEl);
    }
    pictosEl.style.display = "flex"; pintarPictos();
    try { pictosEl.querySelector(".vistas button").focus(); } catch (e) {}
    decirVoz("Tablero de pictogramas. Toca los dibujos para formar una frase y pulsa Decir.", true, true);
  }
  function cerrarPictos() { if (pictosEl) pictosEl.style.display = "none"; }
  function pintarPictos() {
    var fr = pictosEl.querySelector(".frase"); fr.innerHTML = "";
    if (!pictoFrase.length) fr.appendChild(el("span", { "class": "vacia" }, "Toca los dibujos para formar tu frase"));
    pictoFrase.forEach(function (p) { var s = el("span", { "class": "elegido" }); if (p[2]) { var f = el("img", { "class": "foto", "alt": "", "width": "44", "height": "44" }); f.src = p[2]; s.appendChild(f); } else if (p[1]) { var i = el("img", { "alt": "", "width": "44", "height": "44" }); i.src = PICTO_IMG + p[1] + "/" + p[1] + "_300.png"; i.onerror = function () { i.remove(); }; s.appendChild(i); } s.appendChild(el("b", {}, p[0])); fr.appendChild(s); });
    if (pictoFrase.length && ajustes.caa_gramatica) { var dicha = pictoTextoDicho(); if (dicha !== pictoFrase.map(function (p) { return p[0]; }).join(" ")) fr.appendChild(el("span", { "class": "dicha" }, "→ " + esc2(dicha))); }
    pictosEl.querySelectorAll(".vistas button").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.v === pictoVista ? "true" : "false"); });
    var herr = pictosEl.querySelector(".herr"); herr.innerHTML = ""; herr.style.display = "none";
    var cats = pictosEl.querySelector(".cats"); cats.innerHTML = "";
    var rej = pictosEl.querySelector(".rejilla"); rej.innerHTML = "";
    var nombres = [], colorDe = function () { return ""; };
    if (pictoVista === "temas") nombres = Object.keys(PICTOS).concat(pictoFrases.length ? ["Mis frases"] : []);
    else if (pictoVista === "nuclear") { nombres = Object.keys(NUCLEAR); colorDe = function (c) { return COLOR_NUCLEAR[c] || ""; }; }
    else if (pictoVista === "mios") { nombres = tableros.map(function (t) { return t.nombre; }); if (!tableros.length) pictoCat = ""; else if (!tableros[tableroI]) tableroI = 0; }
    nombres.forEach(function (c, k) {
      var activo = pictoVista === "mios" ? k === tableroI : c === pictoCat;
      var b = el("button", { "type": "button", "role": "tab", "aria-selected": activo ? "true" : "false", "class": colorDe(c) ? "c-" + colorDe(c) : "" }, c);
      b.addEventListener("click", function () { if (pictoVista === "mios") tableroI = k; else pictoCat = c; quitando = false; pintarPictos(); });
      cats.appendChild(b);
    });
    if (pictoVista === "temas") {
      if (pictoCat === "Mis frases") pictoFrases.forEach(function (f) { var b = el("button", { "type": "button", "class": "picto frase-guardada" }, ""); b.appendChild(el("span", {}, f.texto)); b.addEventListener("click", function () { hablarPersona(f.texto); avisar(f.texto); anotarHistorial(f.texto); }); rej.appendChild(b); });
      else (PICTOS[pictoCat] || []).forEach(function (p) { rej.appendChild(pictoBoton(p, pictoElegir)); });
    } else if (pictoVista === "nuclear") {
      (NUCLEAR[pictoCat] || []).forEach(function (p) { rej.appendChild(pictoBoton(p, pictoElegir, COLOR_NUCLEAR[pictoCat])); });
    } else if (pictoVista === "mios") {
      pintarHerramientasMios(herr);
      var t = tableros[tableroI];
      if (!t) rej.appendChild(el("p", { "class": "aviso" }, "Todavía no tienes tableros. Escribe un nombre arriba y pulsa «Crear tablero»; luego añade dibujos de ARASAAC, fotos o palabras."));
      else if (!t.items.length) rej.appendChild(el("p", { "class": "aviso" }, "Este tablero está vacío. Añade dibujos de ARASAAC, fotos o palabras con los botones de arriba."));
      else t.items.forEach(function (p, k) { var b = pictoBoton(p, function () { if (quitando) { t.items.splice(k, 1); guardarTableros(); pintarPictos(); avisar("Quitado"); } else pictoElegir(p); }); if (quitando) b.classList.add("quitar"); rej.appendChild(b); });
    } else if (pictoVista === "buscar") {
      pintarHerramientasBuscar(herr);
      if (pictoAgregarA >= 0 && tableros[pictoAgregarA]) rej.appendChild(el("p", { "class": "aviso" }, T("Toca un dibujo para añadirlo a «") + esc2(tableros[pictoAgregarA].nombre) + "»."));
      pictoBusqueda.forEach(function (p) { rej.appendChild(pictoBoton(p, function (q) { if (pictoAgregarA >= 0 && tableros[pictoAgregarA]) { anadirATablero(pictoAgregarA, q); } else pictoElegir(q); })); });
    }
    var sig = pictosEl.querySelector(".sig"); sig.innerHTML = "";
    var ultimo = pictoFrase.length ? pictoFrase[pictoFrase.length - 1][0] : null, sugeridos = [];
    if (ultimo) {
      var apr = pictoUso[ultimo] || {}; Object.keys(apr).sort(function (a, b) { return apr[b] - apr[a]; }).forEach(function (n) { if (sugeridos.indexOf(n) < 0) sugeridos.push(n); });
      (PICTO_SIGUIENTES[ultimo] || []).forEach(function (n) { if (sugeridos.indexOf(n) < 0) sugeridos.push(n); });
    }
    if (sugeridos.length) { sig.appendChild(el("span", { "class": "et" }, "Siguiente:")); sugeridos.slice(0, 6).forEach(function (n) { sig.appendChild(pictoBoton(pictoDatos(n), pictoElegir)); }); }
    else if (!pictoFrase.length) {   // sin frase: lo que más se dice, primero
      var rec = Object.keys(historial).sort(function (a, b) { return historial[b] - historial[a]; }).slice(0, 6);
      if (rec.length) { sig.appendChild(el("span", { "class": "et" }, "Lo que más dices:")); rec.forEach(function (t) { var b = el("button", { "type": "button", "class": "picto reciente" }, ""); b.appendChild(el("span", {}, t)); b.addEventListener("click", function () { hablarPersona(t); avisar(t); anotarHistorial(t); contar("pictos"); }); sig.appendChild(b); }); }
    }
  }
  function pintarHerramientasMios(herr) {
    herr.style.display = "flex";
    var nombre = el("input", { "type": "text", "aria-label": "Nombre del tablero nuevo", "placeholder": "Nombre del tablero nuevo", "maxlength": "40" });
    var crear = el("button", { "type": "button" }, "Crear tablero");
    crear.addEventListener("click", function () { var n = nombre.value.trim(); if (!n) { avisar("Escribe un nombre", true); nombre.focus(); return; } if (tableros.length >= 12) { avisar("Máximo 12 tableros", true); return; } tableros.push({ nombre: n, items: [] }); tableroI = tableros.length - 1; guardarTableros(); pintarPictos(); avisar("Tablero creado"); });
    herr.appendChild(nombre); herr.appendChild(crear);
    if (!tableros[tableroI]) return;
    var b1 = el("button", { "type": "button" }, "Añadir dibujo de ARASAAC"); b1.addEventListener("click", function () { pictoAgregarA = tableroI; pictoVista = "buscar"; pintarPictos(); try { pictosEl.querySelector(".herr input").focus(); } catch (e) {} });
    var foto = el("input", { "type": "file", "accept": "image/*", "style": "display:none" });
    foto.addEventListener("change", function () { var f = foto.files[0]; foto.value = ""; if (f) fotoATablero(tableroI, f); });
    var b2 = el("button", { "type": "button" }, "Añadir foto"); b2.addEventListener("click", function () { foto.click(); });
    var palabra = el("input", { "type": "text", "aria-label": "Palabra sin dibujo", "placeholder": "Palabra sin dibujo", "maxlength": "40" });
    var b3 = el("button", { "type": "button" }, "Añadir palabra"); b3.addEventListener("click", function () { var p = palabra.value.trim(); if (!p) { palabra.focus(); return; } anadirATablero(tableroI, [p, 0, ""]); palabra.value = ""; });
    var b4 = el("button", { "type": "button", "aria-pressed": quitando ? "true" : "false" }, quitando ? "Dejar de quitar" : "Quitar dibujos"); b4.addEventListener("click", function () { quitando = !quitando; pintarPictos(); avisar(quitando ? "Toca un dibujo para quitarlo" : "Listo"); });
    var b5 = el("button", { "type": "button" }, "Compartir tablero"); b5.addEventListener("click", function () { compartirTablero(tableroI); });
    var carga = el("input", { "type": "file", "accept": ".json,.tablero", "style": "display:none" });
    carga.addEventListener("change", function () { var f = carga.files[0]; carga.value = ""; if (!f) return; var r = new FileReader(); r.onload = function () { try { importarTablero(JSON.parse(r.result)); } catch (e) { avisar("No se pudo leer el tablero", true); } }; r.readAsText(f); });
    var b6 = el("button", { "type": "button" }, "Cargar tablero de archivo"); b6.addEventListener("click", function () { carga.click(); });
    var b7 = el("button", { "type": "button", "class": "peligro" }, "Borrar este tablero"); b7.addEventListener("click", function () { if (b7.dataset.seguro !== "1") { b7.dataset.seguro = "1"; b7.textContent = T("¿Seguro? Toca otra vez para borrarlo"); setTimeout(function () { b7.dataset.seguro = "0"; b7.textContent = T("Borrar este tablero"); }, 4000); return; } tableros.splice(tableroI, 1); tableroI = 0; guardarTableros(); pintarPictos(); avisar("Tablero borrado"); });
    [b1, b2, foto, b3, palabra, b4, b5, b6, carga, b7].forEach(function (x) { herr.appendChild(x); });
  }
  function anadirATablero(k, p) {
    var t = tableros[k]; if (!t) return;
    if (t.items.length >= 60) { avisar("Máximo 60 dibujos por tablero", true); return; }
    t.items.push([p[0], p[1] || 0, p[2] || ""]); guardarTableros();
    pictoAgregarA = -1; pictoVista = "mios"; tableroI = k; pintarPictos(); avisar(T("Añadido a «") + t.nombre + "»"); decirVoz(p[0] + ". " + T("Añadido."), true, true);
  }
  // Una foto se reduce a 160 × 160 (recorte centrado) y se guarda como JPEG dentro del tablero: unos 8 KB por foto
  function fotoATablero(k, archivo) {
    var url = URL.createObjectURL(archivo), img = new Image();
    img.onload = function () {
      try {
        var c = document.createElement("canvas"), n = 160, cx = c.getContext("2d"), s = Math.min(img.width, img.height); c.width = n; c.height = n;
        cx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, n, n);
        var nombre = archivo.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 40) || "foto";
        anadirATablero(k, [nombre, 0, c.toDataURL("image/jpeg", 0.8)]);
      } catch (e) { avisar("No se pudo usar la foto", true); }
      URL.revokeObjectURL(url);
    };
    img.onerror = function () { avisar("No se pudo usar la foto", true); URL.revokeObjectURL(url); };
    img.src = url;
  }
  function tableroAEnlace(t) {
    var json = JSON.stringify({ winclus_tablero: VERSION, nombre: t.nombre, items: t.items });
    return location.href.replace(/#.*$/, "") + "#winclus-tablero=" + btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function compartirTablero(k) {
    var t = tableros[k]; if (!t) return;
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify({ winclus_tablero: VERSION, nombre: t.nombre, items: t.items })], { type: "application/json" })); a.download = t.nombre.replace(/[^\w áéíóúñ-]/gi, "") + ".tablero.json"; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    var conFotos = t.items.some(function (p) { return p[2]; }), enlace = conFotos ? "" : tableroAEnlace(t);
    if (enlace && enlace.length < 6000 && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(enlace).then(function () { avisar("Archivo guardado y enlace copiado"); decirVoz("Tablero guardado en un archivo y enlace copiado. Quien abra el enlace tendrá el tablero.", true, true); }, function () { avisar("Archivo guardado"); });
    else { avisar(conFotos ? "Archivo guardado (con fotos no cabe en un enlace)" : "Archivo guardado"); decirVoz("Tablero guardado en un archivo. Pásalo a quien quieras y que lo cargue con «Cargar tablero de archivo».", true, true); }
  }
  function importarTablero(j) {
    if (!j || typeof j.nombre !== "string" || !Array.isArray(j.items)) throw new Error("no es un tablero");
    var t = tablerosValidos([j])[0]; if (!t) throw new Error("no es un tablero");
    if (tableros.length >= 12) { avisar("Máximo 12 tableros", true); return; }
    tableros.push(t); tableroI = tableros.length - 1; guardarTableros();
    pictoVista = "mios"; if (pictosEl) pintarPictos();
    avisar(T("Tablero cargado: ") + t.nombre); decirVoz(T("Tablero cargado: ") + t.nombre, true, true);
  }
  function tableroDesdeEnlace() {
    var m = /[#&]winclus-tablero=([A-Za-z0-9_-]+)/.exec(location.hash || ""); if (!m) return;
    try { var b64 = m[1].replace(/-/g, "+").replace(/_/g, "/"); importarTablero(JSON.parse(decodeURIComponent(escape(atob(b64 + "===".slice((b64.length + 3) % 4)))))); }
    catch (e) { setTimeout(function () { avisar("El enlace no traía un tablero válido", true); }, 100); }
    try { history.replaceState(null, "", location.pathname + location.search + (location.hash || "").replace(/[#&]winclus-tablero=[A-Za-z0-9_-]+/, "")); } catch (e) {}
  }
  var buscandoPictos = 0;
  function pintarHerramientasBuscar(herr) {
    herr.style.display = "flex";
    var q = el("input", { "type": "search", "aria-label": "Palabra que buscar en ARASAAC", "placeholder": "Escribe una palabra (casa, médico, jugar…)", "maxlength": "40" });
    var b = el("button", { "type": "button" }, "Buscar en ARASAAC");
    var ir = function () { buscarEnArasaac(q.value); };
    b.addEventListener("click", ir); q.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); ir(); } });
    herr.appendChild(q); herr.appendChild(b);
    herr.appendChild(el("span", { "class": "nota" }, "Más de 12 000 dibujos. La palabra se envía a arasaac.org para buscarla."));
  }
  function buscarEnArasaac(texto) {
    texto = String(texto || "").trim(); if (!texto) { avisar("Escribe una palabra", true); return; }
    if (!window.fetch) { avisar("Este navegador no puede buscar", true); return; }
    var mio = ++buscandoPictos, idioma = IDIOMA_PAGINA.split("-")[0].toLowerCase();
    avisar("Buscando…");
    fetch("https://api.arasaac.org/api/pictograms/" + idioma + "/search/" + encodeURIComponent(texto), { signal: conTiempo(8000) })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (lista) {
        if (mio !== buscandoPictos) return;
        pictoBusqueda = (Array.isArray(lista) ? lista : []).slice(0, 30).map(function (p) { var k = (p.keywords || [])[0]; return [(k && k.keyword) || texto, p._id, ""]; });
        if (!pictoBusqueda.length) pictoBusqueda = [[texto, 0, ""]];
        pintarPictos(); avisar(pictoBusqueda.length + " " + T("dibujos")); decirVoz(pictoBusqueda.length + " " + T("dibujos para") + " " + texto, true, true);
      })
      .catch(function () { if (mio === buscandoPictos) { pictoBusqueda = [[texto, 0, ""]]; pintarPictos(); avisar("Sin conexión con ARASAAC: solo la palabra", true); } });
  }
  function pictoElegir(p) {
    var ultimo = pictoFrase.length ? pictoFrase[pictoFrase.length - 1][0] : null;
    if (ultimo) { pictoUso[ultimo] = pictoUso[ultimo] || {}; pictoUso[ultimo][p[0]] = (pictoUso[ultimo][p[0]] || 0) + 1; escribirJSON("winclus.pictos_uso", pictoUso); }
    pictoFrase.push(p); decirVoz(p[0], true, true); pintarPictos();
  }
  function pictoTexto() { return pictoTextoDicho(); }
  function anotarHistorial(t) {
    historial[t] = (historial[t] || 0) + 1;
    var claves = Object.keys(historial); if (claves.length > 40) { claves.sort(function (a, b) { return historial[a] - historial[b]; }); delete historial[claves[0]]; }
    escribirJSON("winclus.pictos_historial", historial);
  }
  function pictoDecir() { var t = pictoTexto(); if (t) { hablarPersona(t); avisar(t); contar("pictos"); anotarHistorial(t); } else decirVoz("No hay frase todavía", true, true); }
  function pictoGuardar() {
    var t = pictoTexto(); if (!t) return;
    if (!pictoFrases.some(function (f) { return f.texto === t; })) { pictoFrases.push({ texto: t, pictos: pictoFrase.slice() }); escribirJSON("winclus.pictos_frases", pictoFrases); }
    if (frases.indexOf(t) < 0 && frases.length < 64) { frases.push(t); escribirJSON("winclus.frases", frases); if (areaFrases) areaFrases.value = frases.join("\n"); }
    avisar("Frase guardada"); decirVoz("Frase guardada", true, true); pintarPictos();
  }

  // --- números sobre lo que se puede pulsar (tipo Voice Control): «números», «clic 12», «quita los números» ---
  var numerosEl = null, numerados = [], numerosTimer = 0;
  var PALABRAS_NUM = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20 };
  function mostrarNumeros() {
    ocultarNumeros(); numerosEl = el("div", { "class": "wcl-nums", "aria-hidden": "true" }); var n = 0;
    Array.prototype.forEach.call(document.querySelectorAll(SEL_CLICABLE), function (e) {
      if (n >= 200 || enWidget(e) || !visibleEl(e) || e.disabled) return;
      var r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return;
      n++; numerados.push(e);
      var b = el("span", { "class": "wcl-num" }, String(n)); b.style.left = Math.max(0, r.left - 4) + "px"; b.style.top = Math.max(0, r.top - 10) + "px"; numerosEl.appendChild(b);
    });
    caja.appendChild(numerosEl); avisar(n + " elementos numerados"); decir(n + " elementos numerados. Di «clic» y el número.");
  }
  function ocultarNumeros() { if (numerosEl) { numerosEl.remove(); numerosEl = null; } numerados = []; }
  function pulsarNumero(k) {
    var e = numerados[k - 1];
    if (!e) { avisar("No hay número " + k, true); return false; }
    ocultarNumeros();
    if (esEditable(e)) { enfocar(e); objetivoTexto = e; avisar("Escribir en " + nombreDe(e)); return true; }
    try { e.focus({ preventScroll: true }); } catch (x) {}
    despachar(e.closest(SEL_CLICABLE) || e, ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]); avisar("Clic en " + nombreDe(e));
    return true;
  }
  ["scroll", "resize"].forEach(function (t) { window.addEventListener(t, function () { if (numerosEl) { clearTimeout(numerosTimer); numerosTimer = setTimeout(mostrarNumeros, 150); } }, true); });
  function numeroDicho(s) { s = s.trim(); return /^\d+$/.test(s) ? parseInt(s, 10) : (PALABRAS_NUM[s] || 0); }

  // --- dictado con confirmación: lo dicho se muestra y se escribe solo tras «sí» (o el botón) ---
  var dictConfEl = null, dictPendiente = "";
  function manejarDictado(t) {
    if (!ajustes.dictado_confirmar) { escribirDictado(t); return; }
    var s = sinAcentos(t.toLowerCase()).replace(/[.,!?¿¡]/g, "").trim();
    if (dictPendiente && /^(si|vale|ok|acepto|correcto|escribe|escribelo)$/.test(s)) { confirmarDictado(); return; }
    if (dictPendiente && /^(no|cancela|cancelar|borra|borralo|descarta|otra vez)$/.test(s)) { descartarDictado(); return; }
    dictPendiente = t;
    if (!dictConfEl) {
      dictConfEl = el("div", { "class": "wcl-dictconf", "role": "dialog", "aria-label": "Confirmar lo dictado" }, '<span class="t"></span>');
      var si = el("button", { "type": "button" }, "Escribir (o di «sí»)"), no = el("button", { "type": "button", "class": "no" }, "Descartar (o di «no»)");
      si.addEventListener("click", confirmarDictado); no.addEventListener("click", descartarDictado);
      dictConfEl.appendChild(si); dictConfEl.appendChild(no); caja.appendChild(dictConfEl);
    }
    dictConfEl.querySelector(".t").textContent = "¿Escribo: «" + t + "»?"; dictConfEl.style.display = "block";
    decirVoz("¿Escribo " + t + "? Di sí o no.", true, true);
  }
  function escribirDictado(t) {
    // El espacio se decide por lo que hay en el campo antes del cursor, no por lo que recuerda el teclado
    var c = campo(), antes = "";
    if (c) antes = c.isContentEditable ? (c.textContent || "") : (c.value || "").slice(0, c.selectionStart == null ? undefined : c.selectionStart);
    var sep = antes && !/\s$/.test(antes) ? " " : "";
    insertarTexto(sep + t); frase += sep + t; palabra = ""; refrescarSugerencias(); pintarTexto(); contar("dictado");
  }
  function confirmarDictado() { if (dictPendiente) escribirDictado(dictPendiente); dictPendiente = ""; if (dictConfEl) dictConfEl.style.display = "none"; avisar("Escrito"); }
  function descartarDictado() { dictPendiente = ""; if (dictConfEl) dictConfEl.style.display = "none"; avisar("Descartado"); }

  function pulsarPorTexto(buscado) {
    buscado = sinAcentos(buscado); var lista = document.querySelectorAll(SEL_CLICABLE), mejor = null, mejorPunt = 0;
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i]; if (e.closest(".wcl-root") || !e.getBoundingClientRect().width) continue;
      var n = sinAcentos(nombreDe(e)), p = n === buscado ? 3 : n.indexOf(buscado) === 0 ? 2 : n.indexOf(buscado) >= 0 ? 1 : 0;
      if (p > mejorPunt) { mejorPunt = p; mejor = e; }
    }
    if (!mejor) return false;
    mejor.scrollIntoView({ block: "center" });
    var b = mejor.getBoundingClientRect(); mover(b.left + b.width / 2, b.top + b.height / 2); congelar(0.5);
    if (esEditable(mejor)) { enfocar(mejor); objetivoTexto = mejor; } else despachar(mejor, ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]);
    return true;
  }

  // ===================================================== calibración ==
  // gui/calibracion.py: 13 puntos fijos (centro + rejilla 4×3) y comprobación
  // con 4 puntos que no entran en el ajuste. Cada punto: 1,2 s para llegar y
  // 0,9 s midiendo con los ojos abiertos.
  var ESPERA_MS = 1200, MEDIDA_MS = 900, MARGEN_C = 0.08;
  var calib = null;
  // Rápida: 9 puntos (30 s). Normal: 13 (40 s). Completa: 25 (70 s). Como en la aplicación de Windows
  function rejillaCalibracion() {
    var modo = ajustes.calib_modo, xs, ys, p = [[0.5, 0.5]];
    if (modo === "rapida") { xs = [MARGEN_C, 0.5, 1 - MARGEN_C]; ys = [MARGEN_C, 0.5, 1 - MARGEN_C]; }
    else if (modo === "completa") { xs = [MARGEN_C, 0.29, 0.5, 0.71, 1 - MARGEN_C]; ys = xs; }
    else { xs = [MARGEN_C, 0.36, 0.64, 1 - MARGEN_C]; ys = [MARGEN_C, 0.5, 1 - MARGEN_C]; }
    ys.forEach(function (y) { xs.forEach(function (x) { if (!(x === 0.5 && y === 0.5)) p.push([x, y]); }); });
    return p.map(function (q) { return [q[0] * window.innerWidth, q[1] * window.innerHeight]; });
  }
  function tiemposCalib() { var k = ajustes.calib_lento ? 1.6 : 1; return [ESPERA_MS * k, MEDIDA_MS * k]; }
  var CABEZA_MS = 7000;
  function puntosComprobacion() { return [[0.28, 0.30], [0.72, 0.30], [0.28, 0.70], [0.72, 0.70]].map(function (q) { return [q[0] * window.innerWidth, q[1] * window.innerHeight]; }); }
  function empezarCalibracion(soloRecentrar) {
    if (!camaraActiva) { decir("Activa primero la cámara."); return; }
    cerrarMenu(); cerrarLupa(); ocultarTeclado(); soltarArrastre();
    calib = { fase: "puntos", puntos: soloRecentrar ? [[window.innerWidth / 2, window.innerHeight / 2]] : rejillaCalibracion(), i: -1, tInicio: 0, muestras: [],
              rasgosFijos: [], puntosHechos: [], poses: [], cabezaMuestras: [], comprob: null, recentrar: !!soloRecentrar, tFin: 0 };
    calibEl.classList.toggle("puntogrande", !!ajustes.calib_punto_grande);
    calibEl.innerHTML = '<div class="txt">' + (soloRecentrar ? "Mira el punto del centro sin mover la cabeza." : "Mira cada punto naranja hasta que desaparezca. No muevas la cabeza, solo los ojos.") + '</div><div class="punto"></div><button type="button" class="cancelar">Cancelar (o tecla Esc)</button>';
    calibEl.querySelector(".cancelar").addEventListener("click", cancelarCalibracion);
    calibEl.classList.add("visible"); calibrando = true; cursor.style.display = "none";
    calibFocoPrevio = focoActual(); try { calibEl.querySelector(".cancelar").focus({ preventScroll: true }); } catch (x) {}
    siguientePunto(performance.now() / 1000);
  }
  function siguientePunto(tS) {
    calib.i++; calib.muestras = []; calib.tInicio = tS;
    var lista = calib.fase === "comprobar" ? calib.comprob.puntos : calib.puntos;
    if (calib.i >= lista.length) { terminarFase(); return; }
    var p = lista[calib.i], pe = calibEl.querySelector(".punto");
    pe.style.left = p[0] + "px"; pe.style.top = p[1] + "px"; pe.classList.add("grande");
  }
  function tickCalibracion(tS) {
    if (!calib) return;
    parpadeo.tomarEvento();   // los cierres largos no cancelan: hay personas que cierran los ojos más de 1,2 s sin querer (medido el 15-sep-2026)
    if (calib.fase === "fin") { if (tS >= calib.tFin) cerrarCalibracion(); return; }
    var pe = calibEl.querySelector(".punto"), desde = (tS - calib.tInicio) * 1000, tiempos = tiemposCalib();
    if (calib.fase === "cabeza") {   // mirando al centro con la cabeza en movimiento: pares (rasgos, postura)
      if (det.rasgos && det.pose && ojosParaMirar() && det.rasgos !== calib.ultimo) { calib.ultimo = det.rasgos; calib.cabezaMuestras.push([det.rasgos, det.pose.slice()]); }
      if (desde >= CABEZA_MS) terminarFase();
      return;
    }
    if (desde < tiempos[0]) { if (desde > tiempos[0] * 0.6) pe.classList.remove("grande"); return; }
    if (desde < tiempos[0] + tiempos[1]) {
      if (det.rasgos && ojosParaMirar() && det.rasgos !== calib.ultimo) { calib.ultimo = det.rasgos; calib.muestras.push(det.rasgos); if (det.pose && calib.fase === "puntos") calib.poses.push(det.pose.slice()); }
      return;
    }
    // Si en los primeros cuatro puntos no se pudo medir nada, no tiene sentido seguir 30 s más
    if (calib.fase === "puntos" && calib.i === 3 && !calib.puntosHechos.length && calib.muestras.length < 5) {
      calibEl.querySelector(".txt").textContent = "No consigo medir tus ojos (abiertos al " + Math.round(parpadeo.estado.relacion * 100) + " %). Acércate a la cámara, con luz de frente y sin gafas oscuras, e inténtalo otra vez.";
      calib.fase = "fin"; calib.tFin = tS + 4; return;
    }
    var lista = calib.fase === "comprobar" ? calib.comprob.puntos : calib.puntos, p = lista[calib.i];
    if (calib.muestras.length >= 5) {
      var med = []; for (var i = 0; i < N_RASGOS; i++) med.push(mediana(calib.muestras.map(function (r) { return r[i]; })));
      if (calib.fase === "comprobar") { var q = predecir(calib.comprob.modelo, med); calib.comprob.errores.push(Math.hypot(q[0] - p[0], q[1] - p[1])); }
      else { calib.rasgosFijos.push(med); calib.puntosHechos.push(p); }
    }
    siguientePunto(tS);
  }
  function terminarFase() {
    var txt = calibEl.querySelector(".txt");
    if (calib.recentrar) {
      if (!calib.rasgosFijos.length || !calibracion) { txt.textContent = "No se pudo medir: mantén los ojos abiertos mirando el punto."; }
      else {
        var raw = predecir(calibracion, calib.rasgosFijos[0], true), m = calibracion.monitor;
        var ex = window.innerWidth / (m[2] - m[0]), ey = window.innerHeight / (m[3] - m[1]);
        calibracion.sesgo = [(window.innerWidth / 2 - raw[0]) / ex, (window.innerHeight / 2 - raw[1]) / ey];
        escribirJSON("winclus.calibracion", calibracion);
        txt.textContent = "Centro corregido (" + Math.round(window.innerWidth / 2 - raw[0]) + ", " + Math.round(window.innerHeight / 2 - raw[1]) + " px).";
      }
      calib.fase = "fin"; calib.tFin = performance.now() / 1000 + 1.5; return;
    }
    if (calib.fase === "puntos") {
      if (calib.puntosHechos.length < 6) { txt.textContent = "Faltaron puntos (" + calib.puntosHechos.length + " de " + calib.puntos.length + "): hay que mantener los ojos abiertos mirando cada punto. Inténtalo otra vez con más luz de frente."; calib.fase = "fin"; calib.tFin = performance.now() / 1000 + 4; return; }
      var modelo = ajustarModelo(calib.puntosHechos, calib.rasgosFijos);
      modelo.datos = { puntos: calib.puntosHechos, rasgos: calib.rasgosFijos, ancho: window.innerWidth, alto: window.innerHeight };
      calib.comprob = { modelo: modelo, puntos: puntosComprobacion(), errores: [] };
      calib.fase = "comprobar"; calib.i = -1; txt.textContent = "Comprobando: mira estos cuatro puntos.";
      siguientePunto(performance.now() / 1000); return;
    }
    if (calib.fase === "comprobar") {
      var mod = calib.comprob.modelo, err = calib.comprob.errores.length ? Math.round(mediana(calib.comprob.errores)) : null;
      mod.error_real_px = err; mod.origen = "calibracion"; mod.fecha = new Date().toISOString();
      calibracion = mod; escribirJSON("winclus.calibracion", mod); reiniciarPuntero();
      if (ajustes.calib_cabeza && calib.poses.length >= 5) {   // paso final: compensar los movimientos de la cabeza
        calib.fase = "cabeza"; calib.i = 0; calib.tInicio = performance.now() / 1000; calib.muestras = []; calib.cabezaMuestras = [];
        var pc = calibEl.querySelector(".punto"); pc.style.left = window.innerWidth / 2 + "px"; pc.style.top = window.innerHeight / 2 + "px"; pc.classList.remove("grande");
        txt.textContent = "Último paso: mira el punto del centro y mueve un poco la cabeza a los lados, arriba y abajo, sin dejar de mirarlo (7 segundos).";
        decirVoz("Mira el centro y mueve un poco la cabeza sin dejar de mirarlo.", true, true); return;
      }
      txt.textContent = "Calibración guardada. Error real: " + (err === null ? "sin medir" : "unos " + err + " px") + (err !== null && err > 150 ? ". Es alto: prueba con más luz, más cerca de la cámara, o usa el modo híbrido o la lupa." : ".");
      decirVoz("Calibración lista", true); calib.fase = "fin"; calib.tFin = performance.now() / 1000 + 3.5;
      refrescos.forEach(function (f) { f(); });
    }
    if (calib.fase === "cabeza") {
      var ref = [0, 1, 2].map(function (k) { return mediana(calib.poses.map(function (p) { return p[k]; })); }), cab = ajustarCabeza(calibracion, calib.cabezaMuestras, ref), e2 = calibracion.error_real_px;
      var msg = "Calibración guardada. Error real: " + (e2 == null ? "sin medir" : "unos " + e2 + " px") + ". ";
      if (cab && cab.coef_x) { calibracion.cabeza = cab; escribirJSON("winclus.calibracion", calibracion); msg += "Compensación de cabeza: mejora unos " + cab.mejora_px + " px al mover la cabeza."; }
      else msg += cab ? "La compensación de cabeza no mejoraba (" + cab.antes_px + " frente a " + cab.despues_px + " px): no se usa." : "Compensación de cabeza sin medir (hacen falta más muestras).";
      txt.textContent = msg; decirVoz("Calibración lista", true); calib.fase = "fin"; calib.tFin = performance.now() / 1000 + 4;
      refrescos.forEach(function (f) { f(); });
    }
  }
  function cancelarCalibracion() { if (!calib) return; calibEl.querySelector(".txt").textContent = "Calibración cancelada."; calib.fase = "fin"; calib.tFin = performance.now() / 1000 + 0.8; if (!camaraActiva) cerrarCalibracion(); }
  function cerrarCalibracion() {
    calib = null; calibrando = false; calibEl.classList.remove("visible"); if (camaraActiva) cursor.style.display = "block"; reiniciarPuntero();
    if (calibFocoPrevio && calibFocoPrevio.isConnected && calibFocoPrevio !== document.body) { try { calibFocoPrevio.focus({ preventScroll: true }); } catch (x) {} }
    calibFocoPrevio = null; refrescos.forEach(function (f) { f(); }); }
  function recentrar() { if (!calibracion) { avisar("Primero calibra los ojos", true); return; } empezarCalibracion(true); }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && calibrando) cancelarCalibracion(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && elegirAbierto()) { e.stopPropagation(); cerrarElegir(); } }, true);

  // --- calibración invisible (detectors/aprendizaje.py) ------------------
  // Cada clic hecho con la cabeza (o afinado con ella) es una muestra:
  // rasgos de los ojos justo antes del clic → punto de la pantalla.
  // Solo muestras completas y finitas: una con null o de otra versión dejaría un modelo NaN y el puntero ocular muerto
  function clicsValidos(lista) { return (Array.isArray(lista) ? lista : []).filter(function (c) { return c && Array.isArray(c.r) && c.r.length === N_RASGOS && c.r.every(function (v) { return typeof v === "number" && isFinite(v); }) && isFinite(c.x) && isFinite(c.y); }); }
  var clicsAprendidos = clicsValidos(leerJSON("winclus.clics", [])), clicsNuevos = 0, ultimoAjusteClics = 0;
  function anotarClicPuntero(porParpadeo) {
    var modo = modoEfectivo(), fuente;
    if (modo === "cabeza") fuente = "cabeza"; else if (modo === "palanca") fuente = "palanca";
    else if (modo === "hibrido" && afinadoConCabeza()) fuente = "hibrido"; else return;
    anotarClic(P.x, P.y, fuente, null, porParpadeo);
  }
  function anotarClic(x, y, fuente, rasgosDados, porParpadeo) {
    if (!ajustes.calib_invisible) return;
    var r = rasgosDados;
    if (!r) {
      var t = det.t, a = porParpadeo ? 0.9 : 0.5, b = porParpadeo ? 0.35 : 0.05, sel = [];
      for (var i = 0; i < historialRasgos.length; i++) { var h = historialRasgos[i]; if (h[0] >= t - a && h[0] <= t - b && h[2] >= 0.7) sel.push(h[1]); }
      if (sel.length < 4) return;
      for (var j = 0; j < 6; j++) { var col = sel.map(function (s) { return s[j]; }), m = col.reduce(function (p, q) { return p + q; }, 0) / col.length; var v = col.reduce(function (p, q) { return p + (q - m) * (q - m); }, 0) / col.length; if (Math.sqrt(v) > 0.10) return; }
      r = []; for (j = 0; j < N_RASGOS; j++) r.push(mediana(sel.map(function (s) { return s[j]; })));
    }
    clicsAprendidos.push({ x: x / window.innerWidth, y: y / window.innerHeight, r: r, f: fuente, t: Date.now() });
    if (clicsAprendidos.length > 400) clicsAprendidos.splice(0, clicsAprendidos.length - 400);
    escribirJSON("winclus.clics", clicsAprendidos); clicsNuevos++;
    if (clicsNuevos >= (calibracion ? 10 : 5) && Date.now() - ultimoAjusteClics > 120000) setTimeout(function () { ajustarConClics(false); refrescarEstadoAprendizaje(); }, 0);
    refrescarEstadoAprendizaje();
  }
  function ajustarConClics(forzado) {
    clicsNuevos = 0; ultimoAjusteClics = Date.now();
    var n = clicsAprendidos.length, valido = !!calibracion, minimo = valido ? 12 : 30;
    if (n < minimo) return "Aprendiendo: " + n + " de " + minimo + " clics.";
    var W = window.innerWidth, H = window.innerHeight;
    var P_ = clicsAprendidos.map(function (c) { return [c.x * W, c.y * H]; }), R_ = clicsAprendidos.map(function (c) { return c.r; });
    var xs = P_.map(function (p) { return p[0]; }), ys = P_.map(function (p) { return p[1]; });
    if (!valido && ((Math.max.apply(null, xs) - Math.min.apply(null, xs)) / W < 0.30 || (Math.max.apply(null, ys) - Math.min.apply(null, ys)) / H < 0.30)) return "Hacen falta clics más repartidos por la página.";
    var pesos = P_.map(function (p, i) { var edad = n - 1 - i; return edad < 40 ? 8 : edad < 80 ? 4 : edad < 120 ? 2 : 1; });
    // Prueba: uno de cada dos entre los últimos n/4·2
    var k = 2 * Math.floor(n / 4), test = {}, i;
    for (i = n - k; i < n; i += 2) test[i] = true;
    var Ptr = [], Rtr = [], Wtr = [], Pte = [], Rte = [];
    for (i = 0; i < n; i++) { if (test[i]) { Pte.push(P_[i]); Rte.push(R_[i]); } else { Ptr.push(P_[i]); Rtr.push(R_[i]); Wtr.push(pesos[i]); } }
    var base = calibracion && calibracion.datos ? calibracion.datos : null, Pb = [], Rb = [];
    if (base) { Pb = base.puntos.map(function (p) { return [p[0] * W / base.ancho, p[1] * H / base.alto]; }); Rb = base.rasgos; }
    function errorDe(m, Pp, Rr) { return mediana(Pp.map(function (p, j) { var q = predecir(m, Rr[j]); return Math.hypot(q[0] - p[0], q[1] - p[1]); })); }
    var mejor = null;
    LAMBDAS.forEach(function (lam) { var m = ajustarModelo(Pb, Rb, Ptr, Rtr, Wtr, lam); var e = Pte.length ? errorDe(m, Pte, Rte) : m.error_px; if (!mejor || e < mejor[0]) mejor = [e, lam]; });
    var err = mejor[0];
    if (!isFinite(err)) return "No se pudo ajustar con estos clics.";
    if (!valido && err > 200) return "Todavía no acierta bastante (" + Math.round(err) + " px). Sigue haciendo clics.";
    if (valido && !forzado) {
      var errActual = Pte.length ? errorDe(calibracion, Pte, Rte) : 1e9;
      if (err > 150 || err >= errActual) return "La calibración actual sigue siendo mejor (" + Math.round(errActual) + " px frente a " + Math.round(err) + ").";
    }
    var modelo = ajustarModelo(Pb, Rb, P_, R_, pesos, mejor[1]);
    modelo.datos = base; modelo.origen = base ? "clics+calibracion" : "clics"; modelo.error_real_px = Math.round(err); modelo.fecha = new Date().toISOString();
    calibracion = modelo; escribirJSON("winclus.calibracion", modelo); reiniciarPuntero();
    avisar(base ? "Calibración afinada con tus clics" : "Ojos calibrados con tus clics");
    return "Ajustada con " + n + " clics (error " + Math.round(err) + " px).";
  }
  function estadoAprendizaje() {
    var n = clicsAprendidos.length;
    if (!ajustes.calib_invisible) return T("Desactivada.");
    if (!calibracion) return n < 30 ? T("Aprendiendo: ") + n + T(" de 30 clics. Usa el puntero con la cabeza y haz clic por toda la página; con 30 calibrará los ojos sola.") : n + T(" clics guardados.");
    return n + T(" clics guardados. ") + (calibracion.origen === "clics" ? T("Aprendida de tus clics.") : calibracion.origen === "clics+calibracion" ? T("Afinada con tus clics.") : "");
  }
  var estadoAprEl = null;
  function refrescarEstadoAprendizaje() { if (estadoAprEl) estadoAprEl.textContent = estadoAprendizaje(); }

  // =============================================================== panel ==
  // Pensado para entenderse sin manual: la primera pestaña pregunta «¿qué te cuesta?» y
  // enciende lo que ayuda; cada opción lleva un nombre en palabras corrientes y una frase
  // de ayuda debajo que dice qué hace y para quién sirve; los números que casi nadie
  // toca van plegados en «Ajustes finos»; y «Lo que tienes activado» dice en todo momento
  // qué está haciendo Winclus, con un botón para apagarlo todo.
  panel.innerHTML = '<div class="wcl-cab">' + LOGO + '<b>Winclus</b><button type="button" aria-label="Cerrar">×</button></div>';
  var TABS = [["inicio", "Inicio"], ["ver", "Ver"], ["oir", "Oír"], ["cara", "Cara"], ["clics", "Clics"], ["escribir", "Escribir"], ["mas", "Más"]];
  var tabsEl = el("div", { "class": "wcl-tabs", "role": "tablist" }), tabs = {};
  TABS.forEach(function (t) {
    var b = el("button", { "type": "button", "role": "tab", "aria-selected": "false", "tabindex": "-1", "id": "wcl-tab-" + t[0], "aria-controls": "wcl-panel-" + t[0] }, t[1]);
    b.addEventListener("click", function () { elegirTab(t[0]); });
    tabsEl.appendChild(b);
    tabs[t[0]] = el("div", { "class": "wcl-tab", "role": "tabpanel", "id": "wcl-panel-" + t[0], "aria-labelledby": "wcl-tab-" + t[0] });
  });
  panel.appendChild(tabsEl);
  // Patrón Tabs de la APG del W3C: una sola pestaña tabulable, flechas para cambiar, Inicio y Fin a los extremos
  tabsEl.addEventListener("keydown", function (e) {
    var i = TABS.findIndex(function (t) { return t[0] === (e.target.id || "").replace("wcl-tab-", ""); });
    if (i < 0) return;
    var j = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i + TABS.length - 1) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault(); elegirTab(TABS[j][0]); q("#wcl-tab-" + TABS[j][0]).focus();
  });
  function elegirTab(nombre) {
    // Ir a cualquier pestaña que no sea Inicio (desde el panel, la voz, «Confundo los colores»…) enseña las pestañas
    if (nombre !== "inicio" && btnVerMas && panel.classList.contains("sencillo")) vistaCompleta(true);
    TABS.forEach(function (t) {
      var activa = t[0] === nombre, b = q("#wcl-tab-" + t[0]);
      tabs[t[0]].classList.toggle("activa", activa); b.setAttribute("aria-selected", activa ? "true" : "false"); b.setAttribute("tabindex", activa ? "0" : "-1");
    });
    try { sessionStorage.setItem("winclus.tab", nombre); } catch (e) {}
    if (nombre === "inicio" && activoEl) pintarActivo();   // «Lo que tienes activado» al día nada más entrar
  }
  function grupo(cuando) { var g = el("div"); g.dataset.cuando = cuando; return g; }

  // --- Inicio: ¿qué te cuesta? ---
  // La gente no conoce los nombres de las funciones; conoce lo que le pasa. Cada botón se pone y se quita
  // (aria-pressed, con ✓): al ponerlo enciende lo que ayuda y dice en una frase qué ha hecho; al quitarlo deja
  // esos ajustes exactamente como estaban antes de ponerlo. Se pueden sumar varios.
  var s = seccion("¿Qué te cuesta?", "Toca lo que te pase y Winclus enciende lo que ayuda. Puedes tocar varios. Tócalo otra vez para quitarlo.");
  // Cada situación lleva un pictograma de ARASAAC (los mismos dibujos del tablero de comunicación, que muchas
  // personas con discapacidad cognitiva ya conocen); si la imagen no carga, queda el emoji.
  // Dos clases: las que cambian ajustes («claves»: se guardan y se deshacen tal cual) y las que abren algo
  // (cámara, tablero, lectura, teclado: están puestas mientras está abierto).
  var SITUACIONES = [
    { id: "veo", ico: "👁️", t: "Veo poco", s: "Letra grande y más contraste", picto: 6564, claves: ["texto", "contraste"],
      poner: function () { ajustes.texto = Math.max(ajustes.texto, 150); ajustes.contraste = true; },
      dice: "Texto más grande y más contraste. Si necesitas más, di «lupa»." },
    { id: "noveo", ico: "🦯", t: "No veo", s: "Una voz te lee la página", picto: 11615, claves: ["lector"],
      poner: function () { ajustes.lector = true; }, luego: function (si) { activarLector(si); },
      dice: "Lector encendido: la flecha abajo lee lo siguiente y la flecha arriba lo anterior. F1 te explica todas las teclas." },
    { id: "colores", ico: "🎨", t: "Confundo los colores", s: "Colores que se distinguen", picto: 5968, claves: ["dalton", "enlaces"],
      poner: function () { if (ajustes.dalton === "no") ajustes.dalton = "deutan"; ajustes.enlaces = true; },
      dice: "Colores corregidos para el rojo y el verde, y enlaces subrayados. En «Ver más opciones», pestaña Ver, puedes elegir otra corrección." },
    { id: "oir", ico: "👂", t: "No oigo bien", s: "Avisos en pantalla y subtítulos", picto: 6572, claves: ["alertas_sonido", "subtitulos"],
      poner: function () { ajustes.alertas_sonido = true; ajustes.subtitulos = true; },
      dice: "Avisos en pantalla cuando algo suene y subtítulos grandes en los vídeos. Para lo que se habla cerca, pulsa «Subtítulos en vivo». Si oyes algo pero poco, en «Ver más opciones», pestaña Oír, puedes subir el volumen por encima de lo normal." },
    { id: "raton", ico: "🖱️", t: "No puedo usar el ratón", s: "Mover el puntero con la cara", picto: 2546,
      activo: function () { return camaraActiva || activando; },
      abrir: function () {
        if (!opciones.camara) return "En esta página la cámara no está disponible. Prueba «Solo puedo pulsar un botón» o «Me cuesta escribir».";
        activarCamara();
        return consentEl ? "Primero, el permiso: lee el aviso que sale aquí mismo y pulsa «Acepto y activo la cámara»." : "Vamos a usar la cámara: mueve la cabeza y el puntero te sigue; cierra los ojos un momento para hacer clic.";
      },
      cerrar: function () { if (camaraActiva || activando) desactivarCamara(); return "Cámara apagada."; } },
    { id: "pulsador", ico: "🔘", t: "Solo puedo pulsar un botón", s: "Winclus va marcando y tú pulsas", picto: 6195, claves: ["barrido"],
      poner: function () { ajustes.barrido = true; }, luego: function () { aplicarBarrido(); },
      dice: "Winclus va marcando cada cosa con un marco azul: cuando esté en lo que quieres, pulsa tu botón." },
    { id: "hablar", ico: "🗣️", t: "No puedo hablar", s: "Dibujos y frases con voz", picto: 6517,
      activo: function () { return !!(pictosEl && pictosEl.style.display !== "none"); },
      abrir: function () { abrirPictos(); return "Tablero de dibujos: toca los que quieras y pulsa Decir."; },
      cerrar: function () { cerrarPictos(); return "Tablero de dibujos cerrado."; } },
    { id: "leer", ico: "📖", t: "Me cuesta leer o entender", s: "La página en fácil y en voz alta", picto: 7141,
      activo: function () { return !!limpiaEl; },
      abrir: function () {
        if (!limpiaEl) lecturaLimpia();
        explicarFacil();
        setTimeout(function () { if (limpiaEl) leerConResaltado(); }, 600);   // después de la explicación en fácil
        return "Te muestro la página en fácil y te la leo en voz alta. Pulsa «Callar» para parar.";
      },
      cerrar: function () { cerrarLimpia(); return "Lectura cerrada."; } },
    { id: "escribir", ico: "⌨️", t: "Me cuesta escribir", s: "Teclado en pantalla y dictado", picto: 2380,
      activo: function () { return tecVisible; },
      abrir: function () { mostrarTeclado(); return "Teclado en pantalla abierto. Pulsa un campo y escribe."; },
      cerrar: function () { ocultarTeclado(); return "Teclado cerrado."; } },
    { id: "marea", ico: "🌀", t: "La pantalla me marea", s: "Sin destellos ni movimiento", picto: 35569, claves: ["calma", "animaciones"],
      poner: function () { ajustes.calma = true; ajustes.animaciones = true; },
      dice: "Modo calma: sin destellos, animaciones ni vídeos que arranquen solos." }
  ];
  function situacion(id) { for (var i = 0; i < SITUACIONES.length; i++) if (SITUACIONES[i].id === id) return SITUACIONES[i]; return null; }
  function listaSitu() { if (!Array.isArray(ajustes.situaciones)) ajustes.situaciones = []; if (!ajustes.situ_antes || typeof ajustes.situ_antes !== "object") ajustes.situ_antes = {}; return ajustes.situaciones; }
  function situActiva(x) {
    if (x.activo) return !!x.activo();
    if (listaSitu().indexOf(x.id) < 0) return false;
    // si la persona ya lo quitó a mano en las pestañas, deja de contar como puesta
    return x.claves.some(function (k) { return ajustes[k] !== POR_DEFECTO[k]; });
  }
  function ponerSituacion(id) {
    var x = situacion(id); if (!x) return "";
    if (x.abrir) { var r = x.abrir(); pintarSitu(); return r; }
    var l = listaSitu();
    if (!situActiva(x)) {   // se guarda cómo estaba cada ajuste para poder dejarlo igual al quitarlo
      var antes = {}; x.claves.forEach(function (k) { antes[k] = ajustes[k]; }); ajustes.situ_antes[x.id] = antes;
      if (l.indexOf(x.id) < 0) l.push(x.id);
      x.poner(); guardar(); aplicarTodo(); if (x.luego) x.luego(true); refrescos.forEach(function (f) { f(); });
    }
    pintarSitu(); return x.dice;
  }
  function quitarSituacion(id) {
    var x = situacion(id); if (!x) return "";
    if (x.cerrar) { var r = x.cerrar(); pintarSitu(); return r; }
    var l = listaSitu(), antes = ajustes.situ_antes[x.id] || {};
    x.claves.forEach(function (k) { ajustes[k] = Object.prototype.hasOwnProperty.call(antes, k) ? antes[k] : POR_DEFECTO[k]; });
    delete ajustes.situ_antes[x.id]; ajustes.situaciones = l.filter(function (y) { return y !== x.id; });
    guardar(); aplicarTodo(); if (x.luego) x.luego(false); refrescos.forEach(function (f) { f(); });
    pintarSitu(); return T("Quitado:") + " " + T(x.t) + ". " + T("Todo está como antes.");
  }
  var situEl = el("div", { "class": "wcl-situ" }), ultimaSitu = null;
  SITUACIONES.forEach(function (x) {
    var b = el("button", { "type": "button", "aria-pressed": "false" });
    b.dataset.situ = x.id;
    var ico = el("span", { "class": "ico", "aria-hidden": "true" }, x.ico);
    if (x.picto) { var img = el("img", { "alt": "", "width": "40", "height": "40", "loading": "lazy" }); img.src = PICTO_IMG + x.picto + "/" + x.picto + "_300.png"; img.onerror = function () { img.remove(); }; ico.textContent = ""; ico.appendChild(img); ico.dataset.emoji = x.ico; }
    b.appendChild(ico); b.appendChild(el("span", {}, x.t)); b.appendChild(el("small", {}, x.s));
    b.addEventListener("click", function () {
      contarPanel(x.t); contar("asistente");
      var quitar = situActiva(x), r = quitar ? quitarSituacion(x.id) : ponerSituacion(x.id);
      ultimaSitu = quitar ? null : x.id; pintarSitu();   // el «Quitar» del pie apunta a esta
      responder(r);
    });
    situEl.appendChild(b);
  });
  function pintarSitu() {
    Array.prototype.forEach.call(situEl.querySelectorAll("button"), function (b) {
      var x = situacion(b.dataset.situ), si = !!(x && situActiva(x));
      b.setAttribute("aria-pressed", si ? "true" : "false");
    });
    if (btnQuitarUlt) { var u = ultimaSitu && situacion(ultimaSitu); btnQuitarUlt.style.display = u && situActiva(u) ? "" : "none"; }
  }
  refrescos.push(pintarSitu);
  s.appendChild(situEl);
  var btnAyuda = botonGrande("🔔 Pedir ayuda a quien esté cerca", "suave", function () { pedirAyuda(); }); btnAyuda.id = "wcl-pedir-ayuda"; s.appendChild(btnAyuda);
  // La respuesta («Listo: …») y los dos botones de siempre van en el pie del panel, fijo abajo: se ven sin bajar
  var respuestaEl = el("div", { "class": "wcl-estado", "id": "wcl-respuesta", "aria-live": "polite" }, "");
  var btnQuitarUlt = null;
  function responder(r) {
    if (!r) return;
    respuestaEl.textContent = T(r);
    avisar(T(r).slice(0, 60)); decir(r); decirVoz(r, true, true);
  }
  // Las dos cosas que más se piden en un trámite, a un toque desde Inicio
  s.appendChild(botonGrande("Explícame esta página en fácil", "azul", function () { if (!limpiaEl) lecturaLimpia(); explicarFacil(); }));
  s.appendChild(el("div", { "class": "wcl-ayuda" }, "Quita lo que sobra y cuenta la página con palabras corrientes y frases cortas: de qué va, lo más importante y los pasos."));
  s.appendChild(botonGrande("🔊 Léeme esta página", "suave", leerPagina));
  s.appendChild(cajaAsistente());
  tabs.inicio.appendChild(s);

  s = seccion("Lo que tienes activado", "Para saber qué está haciendo Winclus ahora mismo.");
  var activoEl = el("ul", { "class": "wcl-activo" });
  function activos() {
    var a = ajustes, l = [];
    if (a.texto !== 100) l.push(T("Texto al") + " " + a.texto + " %");
    if (a.contraste) l.push("Alto contraste"); if (a.oscuro) l.push("Modo oscuro"); if (a.enlaces) l.push("Enlaces resaltados"); if (a.guia) l.push("Guía de lectura");
    if (a.cursor_grande) l.push("Cursor grande"); if (a.animaciones) l.push("Sin movimiento"); if (a.dalton !== "no") l.push("Colores corregidos"); if (a.calma) l.push("Modo calma"); if (a.colores !== "no") l.push("Colores de la página"); if (a.letra !== "no") l.push("Tipo de letra"); if (a.alinear) l.push("Texto a la izquierda"); if (a.interlineado !== 100) l.push("Espacio entre renglones"); if (a.zoom_pagina !== 100) l.push("Zoom de la página");
    if (a.titulos) l.push("Títulos resaltados"); if (a.foco) l.push("Foco resaltado"); if (a.silencio) l.push("Página en silencio"); if (a.diccionario) l.push("Diccionario al tocar");
    if (a.lupa_pantalla) l.push("Lupa de pantalla"); if (a.mascara) l.push("Ver solo una franja"); if (a.dislexia) l.push("Letras separadas"); if (a.sinimg) l.push("Imágenes atenuadas");
    if (a.lectura) l.push("Leer lo que se pulsa"); if (a.lector) l.push("Lector de pantalla"); if (a.alertas_sonido) l.push("Avisos cuando algo suena"); if (a.subtitulos) l.push("Subtítulos grandes");
    if (a.amplificar > 100) l.push(T("Volumen subido al") + " " + a.amplificar + " %"); if (a.voz_clara) l.push("Voz más clara");
    if (a.raton_temblor) l.push("Ayuda con el temblor del ratón");
    if (escuchando) l.push("Escuchando órdenes"); if (subtitulando) l.push("Subtítulos en vivo");
    if (camaraActiva) l.push(a.puntero_externo ? "Puntero de otro aparato, clics con la cara" : a.modo_puntero === "ojos" ? "Puntero con los ojos" : "Puntero con la cabeza");
    if (a.barrido) l.push(a.barrido_modo === "pasos" ? "Barrido con dos pulsadores" : "Barrido con un pulsador");
    if (camaraActiva && !a.gestos_activos) l.push("Gestos de la cara apagados"); if (tecVisible) l.push("Teclado en pantalla"); if (dictando) l.push("Dictado"); if (a.facil) l.push("Modo fácil");
    return l.map(T);
  }
  function pintarActivo() {
    var l = activos(); activoEl.innerHTML = "";
    if (!l.length) activoEl.appendChild(el("li", { "class": "nada" }, "Nada todavía: la página se ve como siempre."));
    l.forEach(function (t) { activoEl.appendChild(el("li", {}, t)); });
    btnApagar.style.display = l.length ? "" : "none";
  }
  function apagarTodo() {
    ["contraste", "oscuro", "enlaces", "guia", "cursor_grande", "animaciones", "calma", "lupa_pantalla", "mascara", "dislexia", "sinimg", "lectura", "lector", "alertas_sonido", "subtitulos", "barrido", "facil", "titulos", "foco", "silencio", "diccionario"].forEach(function (k) { ajustes[k] = POR_DEFECTO[k]; });
    ajustes.texto = 100; ajustes.dalton = "no"; ajustes.colores = "no"; ajustes.letra = "no"; ajustes.alinear = false; ajustes.interlineado = 100; ajustes.zoom_pagina = 100;
    ajustes.amplificar = 100; ajustes.voz_clara = false; aplicarAmplificacion(); ajustes.raton_temblor = false;
    ajustes.situaciones = []; ajustes.situ_antes = {}; ultimaSitu = null; guardar();
    if (camaraActiva) desactivarCamara(); pararEscucha(); pararSubvivo(); pararDictado(); ocultarTeclado(); cerrarLimpia(); cerrarPictos(); ocultarNumeros();
    aplicarTodo(); aplicarLupaPantalla(); aplicarBarrido(); activarLector(false); refrescos.forEach(function (f) { f(); });
    avisar("Todo apagado"); decirVoz("Todo apagado. La página vuelve a verse como siempre. Tus ajustes de cámara y tus frases se conservan.", true, true);
  }
  s.appendChild(activoEl);
  var btnApagar = botonGrande("Apagar todo lo activado", "suave", apagarTodo);
  s.appendChild(btnApagar);
  refrescos.push(pintarActivo);
  setInterval(function () { if (panel.classList.contains("abierto") && tabs.inicio.classList.contains("activa")) { pintarActivo(); pintarSitu(); } }, 1500);   // la cámara, el teclado o el dictado cambian sin pasar por «refrescos»
  tabs.inicio.appendChild(s);

  s = seccion("Panel sencillo");
  s.appendChild(filaSw("facil", "Modo fácil", function () { refrescos.forEach(function (f) { f(); }); }, "Deja solo unos pocos botones grandes: leer, callar, texto más grande, contraste, lectura limpia, lupa y cámara. Para quien se pierde con tantas opciones."));
  tabs.inicio.appendChild(s);

  // --- Ver ---
  s = seccion("Ver mejor", "Para quien ve poco, se cansa con la pantalla o pierde el renglón.");
  s.appendChild(filaPaso("texto", "Tamaño del texto", 80, 200, 10, pct, aplicarTexto, "Agranda o achica toda la letra de la página."));
  s.appendChild(filaSw("contraste", "Alto contraste", aplicarClases, "Letras negras sobre fondo claro y colores más marcados, para distinguir mejor."));
  s.appendChild(filaSw("oscuro", "Modo oscuro", aplicarClases, "Fondo oscuro y letras claras: menos luz en los ojos."));
  s.appendChild(filaSw("enlaces", "Resaltar enlaces", aplicarClases, "Los enlaces se ven subrayados y con fondo, para encontrarlos a la primera."));
  s.appendChild(filaSw("titulos", "Resaltar títulos", aplicarClases, "Los títulos de la página llevan fondo y borde: se ve de un vistazo dónde empieza cada parte."));
  s.appendChild(filaSw("foco", "Resaltar dónde estás", aplicarClases, "Un marco grueso rodea el botón o el campo en el que estás, al llegar con Tab o con el puntero."));
  s.appendChild(filaSw("guia", "Guía de lectura", aplicarClases, "Una línea de color sigue al puntero para no perder el renglón que lees."));
  s.appendChild(filaSw("cursor_grande", "Cursor del ratón grande", aplicarClases, "Una flecha más grande, para no perder el ratón de vista."));
  s.appendChild(filaSw("animaciones", "Quitar el movimiento", aplicarClases, "Para las animaciones y los carruseles que se mueven solos."));
  tabs.ver.appendChild(s);
  s = seccion("Leer con menos esfuerzo", "Para dislexia, cansancio o cuando la página tiene demasiadas cosas.");
  s.appendChild(botonGrande("Lectura limpia: solo el texto, grande", "azul", lecturaLimpia));
  s.appendChild(el("div", { "class": "wcl-ayuda" }, "Quita menús, anuncios y adornos y deja solo el texto, grande. Desde ahí puedes oírlo o pedir que te lo explique en fácil."));
  s.appendChild(filaSw("lupa_pantalla", "Lupa de pantalla", aplicarLupaPantalla, "Agranda la zona de la página que está alrededor del puntero, como una lupa de verdad."));
  s.appendChild(filaPaso("lupa_pantalla_zoom", "Cuánto agranda la lupa", 2, 16, 1, function (n) { return "×" + n; }, aplicarLupaPantalla, "×2 es el doble de grande; ×4, cuatro veces."));
  s.appendChild(filaSw("mascara", "Ver solo una franja", aplicarClases, "Oscurece toda la página menos una franja a la altura del puntero, para concentrarte en un renglón."));
  s.appendChild(filaSw("dislexia", "Letras y palabras más separadas", aplicarClases, "Más aire entre letras, palabras y renglones: se leen con menos esfuerzo."));
  s.appendChild(filaSw("sinimg", "Atenuar imágenes y vídeos", aplicarClases, "Las imágenes se ven muy suaves, para que no distraigan del texto."));
  // Familias 1 y 6: diccionario al toque, con el dibujo de ARASAAC. Las sílabas van en la barra de la lectura limpia
  s.appendChild(filaSw("diccionario", "Diccionario al tocar una palabra", aplicarClases, "Toca una palabra y sale qué significa, con un dibujo si lo hay. Mira en el glosario de este sitio, en ARASAAC y en Wikcionario (la palabra se envía a esos sitios para buscarla). En «Lectura limpia» también, y allí el botón «Sílabas» colorea cada sílaba."));
  // Familia 1 (overlays): lo que ellos hacen y faltaba aquí
  s.appendChild(filaOpc("letra", "Tipo de letra", [["no", "La del sitio"], ["legible", "Legible"], ["dislexia", "Para dislexia"]], aplicarClases, null, "«Legible» es una letra clara y ancha (Verdana). «Para dislexia» es OpenDyslexic: la base de cada letra pesa más para que no bailen ni se den la vuelta."));
  s.appendChild(filaPaso("interlineado", "Espacio entre renglones", 100, 250, 10, pct, aplicarClases, "100 % es el del sitio. 150 % es lo que recomiendan las normas para leer con menos esfuerzo."));
  s.appendChild(filaSw("alinear", "Texto alineado a la izquierda", aplicarClases, "Quita el texto justificado: los huecos entre palabras dejan de ser desiguales y la vista no se pierde."));
  s.appendChild(filaPaso("zoom_pagina", "Zoom de toda la página", 100, 200, 10, pct, aplicarClases, "Agranda todo a la vez: letra, botones e imágenes. «Tamaño del texto» solo agranda la letra."));
  tabs.ver.appendChild(s);
  s = seccion("Colores y calma", "Para quien confunde colores o se marea con destellos y movimiento.");
  s.appendChild(filaOpc("dalton", "Si confundes colores", [["no", "Ninguna"], ["protan", "No distingo el rojo"], ["deutan", "No distingo el verde"], ["tritan", "No distingo el azul"], ["gris", "Todo en gris"]], aplicarClases, null, "Cambia los colores de la página para que se distingan. Prueba uno y quédate con el que mejor veas."));
  s.appendChild(filaSw("calma", "Modo calma", aplicarClases, "Sin destellos, sin animaciones y sin vídeos que arranquen solos. Colores más suaves. Para epilepsia fotosensible, migrañas o sensibilidad."));
  // AAA 1.4.8: la persona elige los colores de texto y fondo de toda la página
  s.appendChild(filaOpc("colores", "Colores de la página", [["no", "Los del sitio"], ["amarillo_negro", "Amarillo sobre negro"], ["negro_crema", "Negro sobre crema"], ["azul_blanco", "Azul oscuro sobre blanco"], ["propios", "Los que yo elija"]], aplicarTodo, null, "Cambia el color de todo el texto y del fondo. Para quien lee mejor con una combinación concreta. «Los que yo elija» deja escoger cualquiera."));
  var fCol = el("div", { "class": "wcl-fila colores" }, '<label for="wcl-color_texto">' + T("Texto") + '</label><input type="color" id="wcl-color_texto" class="wcl-color"><label for="wcl-color_fondo">' + T("Fondo") + '</label><input type="color" id="wcl-color_fondo" class="wcl-color">');
  var inCol = fCol.querySelectorAll("input");
  inCol[0].addEventListener("input", function () { ajustes.color_texto = inCol[0].value; guardar(); aplicarColores(); });
  inCol[1].addEventListener("input", function () { ajustes.color_fondo = inCol[1].value; guardar(); aplicarColores(); });
  refrescos.push(function () { fCol.style.display = ajustes.colores === "propios" ? "" : "none"; inCol[0].value = ajustes.color_texto; inCol[1].value = ajustes.color_fondo; });
  s.appendChild(fCol);
  tabs.ver.appendChild(s);

  // --- Oír ---
  s = seccion("Escuchar", "Para quien prefiere oír la página o ve poco.");
  s.appendChild(filaSw("lectura", "Leer en voz alta lo que se pulsa", null, "Al pulsar un texto, un botón o un enlace, Winclus lo lee con voz."));
  s.appendChild(botonGrande("Leer la página", "suave", leerPagina));
  s.appendChild(botonGrande("¿Dónde estoy?", "suave", dondeEstoy));
  s.appendChild(el("div", { "class": "wcl-ayuda" }, "Dice el nombre de la página, en qué parte estás y qué apartados tiene."));
  s.appendChild(botonGrande("Callar", "suave", callar));
  tabs.oir.appendChild(s);
  s = seccion("Lector de pantalla", "Para personas ciegas o con muy poca visión que no tienen instalado un lector.");
  s.appendChild(filaSw("lector", "Lector de pantalla activado", activarLector, "Lee la página con voz y se maneja con el teclado: ↓ ↑ leen, ← → letra a letra, h encabezados, l enlaces, b botones, f campos, d zonas, t tablas (Ctrl+Alt+flechas por las celdas), a listas, r lee todo, Ctrl+F busca, Intro activa, F1 ayuda. Dice los estados (marcado, obligatorio, no válido) y los avisos que cambian solos. Si ya usas NVDA, JAWS o VoiceOver, déjalo apagado: se pisarían."));
  if (/Windows/.test(navigator.userAgent)) {
    s.appendChild(botonGrande("Descargar NVDA (lector gratuito para Windows)", "suave", function () { window.open("https://www.nvaccess.org/download/", "_blank", "noopener"); }));
    s.appendChild(el("div", { "class": "wcl-ayuda" }, "NVDA lee todo el sistema, no solo esta página: es gratis y de código abierto. Si lo instalas, deja apagado el lector de Winclus."));
  }
  s.appendChild(filaOpc("lector_verbosidad", "Cuánto explica el lector", [["principiante", "Mucho"], ["normal", "Normal"], ["experto", "Poco"]], null, null, "«Mucho»: dice qué es cada cosa, su nombre y qué tecla pulsar. «Normal»: qué es y su nombre. «Poco»: el nombre y una palabra, para quien ya se lo sabe."));
  tabs.oir.appendChild(s);
  s = seccion("Voz", "La voz con la que Winclus habla y dice tus frases.");
  s.appendChild(filaSw("voz_activa", "Voz activada (Decir y frases)", null, "Apágala si no quieres que Winclus hable en ningún momento."));
  var fVoz = el("div", { "class": "wcl-fila" }, '<span id="wcl-l-voz">' + T("Voz") + '</span><div class="wcl-mm" role="group" aria-labelledby="wcl-l-voz"><button type="button" aria-label="' + T("Voz anterior") + '" aria-describedby="wcl-voz-nombre">−</button><span id="wcl-voz-nombre" aria-live="polite"></span><button type="button" aria-label="' + T("Voz siguiente") + '" aria-describedby="wcl-voz-nombre">+</button></div>');
  var bv = fVoz.querySelectorAll("button"), vv = fVoz.querySelector("#wcl-voz-nombre"); vv.style.minWidth = "120px"; vv.style.fontSize = "12px";
  function cambiarVoz(d) { var vs = vocesEs(); if (!vs.length) return; var i = vs.findIndex(function (v) { return v.name === ajustes.voz_nombre; }); i = (i + d + vs.length) % vs.length; ajustes.voz_nombre = vs[i].name; guardar(); pintarVoz(); }
  function pintarVoz() { var vs = vocesEs(); var v = vs.find(function (x) { return x.name === ajustes.voz_nombre; }) || vozPreferida(vs); vv.textContent = v ? v.name.replace(/Microsoft |Google |Desktop| - .*$/g, "") : "sin voces en español"; }
  bv[0].addEventListener("click", function () { cambiarVoz(-1); }); bv[1].addEventListener("click", function () { cambiarVoz(1); });
  refrescos.push(pintarVoz);
  try { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = pintarVoz; } catch (e) {}   // sin síntesis de voz (algunas WebView) el panel debe seguir montándose
  s.appendChild(fVoz);
  s.appendChild(filaPaso("voz_velocidad", "Velocidad de la voz", -5, 5, 1, function (n) { return n > 0 ? "+" + n : String(n); }, null, "Menos de 0 habla más despacio; más de 0, más deprisa."));
  s.appendChild(filaPaso("voz_tono", "Tono de la voz", -5, 5, 1, function (n) { return n > 0 ? "+" + n : String(n); }, null, "Menos de 0 suena más grave; más de 0, más agudo."));
  s.appendChild(filaSw("voz_eco", "Leer cada palabra al escribirla", null, "Al escribir con el teclado en pantalla, dice cada palabra que terminas."));
  s.appendChild(botonGrande("Probar la voz", "suave", function () { decirVoz("Hola, soy la voz de Winclus.", true, true); }));
  tabs.oir.appendChild(s);
  // --- mis frases con mi voz (banco de mensajes) -------------------------------------------
  // Quien va a perder el habla (ELA, por ejemplo) graba AHORA las frases que más usa; cuando luego las pulse
  // (teclado, tablero, «Decir», «di…»), Winclus las dice con SU voz en vez de con la sintética. Las grabaciones se
  // guardan solo en este navegador (IndexedDB), nunca salen del equipo; «Borrar» y «Restablecer todo» las quitan.
  var grabaciones = {}, grabadora = null, grabTrozos = [], grabTimer = 0, sonandoGrab = null;
  function claveFrase(t) { return sinAcentos(String(t || "")).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
  function bdVoz(fn) {
    try {
      var r = indexedDB.open("winclus-voz", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("frases", { keyPath: "clave" }); };
      r.onsuccess = function () { fn(r.result); };
      r.onerror = function () {};
    } catch (e) {}
  }
  function cargarGrabaciones() {
    bdVoz(function (db) {
      var q = db.transaction("frases", "readonly").objectStore("frases").getAll();
      q.onsuccess = function () { grabaciones = {}; (q.result || []).forEach(function (g) { grabaciones[g.clave] = g; }); refrescos.forEach(function (f) { f(); }); };
    });
  }
  function guardarGrabacion(texto, blob) {
    var g = { clave: claveFrase(texto), texto: texto, blob: blob, fecha: new Date().toISOString() };
    grabaciones[g.clave] = g;
    bdVoz(function (db) { db.transaction("frases", "readwrite").objectStore("frases").put(g); });
  }
  function borrarGrabacion(clave) { delete grabaciones[clave]; bdVoz(function (db) { db.transaction("frases", "readwrite").objectStore("frases").delete(clave); }); }
  function borrarTodasGrabaciones() { grabaciones = {}; try { indexedDB.deleteDatabase("winclus-voz"); } catch (e) {} }
  function reproducirGrabacion(g) {
    callar();
    try { if (sonandoGrab) sonandoGrab.pause(); sonandoGrab = new Audio(URL.createObjectURL(g.blob)); var p = sonandoGrab.play(); if (p && p.catch) p.catch(function () { decirVoz(g.texto, true, true); }); }
    catch (e) { decirVoz(g.texto, true, true); }
  }
  // Lo que dice la persona (no los mensajes de Winclus): con su voz grabada si la hay, si no con la sintética
  function hablarPersona(texto) { var g = grabaciones[claveFrase(texto)]; if (g && g.blob) { reproducirGrabacion(g); return; } decirVoz(texto, true, true); }
  function empezarGrabar(texto) {
    if (!navigator.mediaDevices || !window.MediaRecorder) { avisar("Este navegador no deja grabar", true); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (flujo) {
      grabTrozos = []; grabadora = new MediaRecorder(flujo);
      grabadora.ondataavailable = function (e) { if (e.data && e.data.size) grabTrozos.push(e.data); };
      grabadora.onstop = function () {
        flujo.getTracks().forEach(function (t) { t.stop(); }); clearTimeout(grabTimer);
        var b = new Blob(grabTrozos, { type: (grabadora && grabadora.mimeType) || "audio/webm" }); grabadora = null;
        if (b.size) { guardarGrabacion(texto, b); avisar("Frase guardada con tu voz"); decir(T("Guardada:") + " «" + texto + "»"); }
        refrescos.forEach(function (f) { f(); });
      };
      grabadora.start(); grabTimer = setTimeout(pararGrabar, 20000);
      avisar("Grabando… di la frase"); refrescos.forEach(function (f) { f(); });
    }, function () { avisar("No hay permiso para el micrófono", true); });
  }
  function pararGrabar() { if (grabadora && grabadora.state !== "inactive") grabadora.stop(); }
  cargarGrabaciones();

  s = seccion("Hablar por mí", "Para quien no puede hablar o no lee ni escribe bien.");
  s.appendChild(botonGrande("Tablero de pictogramas", "azul", abrirPictos));
  s.appendChild(el("div", { "class": "wcl-ayuda" }, "Un tablero de dibujos (pictogramas ARASAAC): tocas los dibujos, se forma la frase y Winclus la dice con voz. Tiene temas, las palabras de todos los días por colores, tus propios tableros (con fotos) y un buscador con más de 12 000 dibujos."));
  s.appendChild(filaSw("caa_gramatica", "Frases bien dichas", function () { if (pictosEl) pintarPictos(); }, "Al juntar dibujos, Winclus pone el verbo como toca («yo querer comer» se dice «yo quiero comer») y ajusta «cansado» o «cansada» según quién habla."));
  s.appendChild(filaOpc("caa_genero", "Cuando hablo de mí", [["n", "Sin cambiar"], ["m", "En masculino"], ["f", "En femenino"]], function () { if (pictosEl) pintarPictos(); }, null, "Para que «yo estar cansado» se diga «estoy cansado» o «estoy cansada», como tú prefieras."));
  s.appendChild(el("div", { "class": "wcl-estado" }, "Tus frases de siempre, una por línea (hasta 16). Aparecen en la tecla «Frases» del teclado y en el tablero, para decirlas de un toque."));
  var areaFrases = el("textarea", { "class": "wcl-area", "aria-label": "Frases para decir" }); areaFrases.value = frases.join("\n");
  s.appendChild(areaFrases);
  s.appendChild(botonGrande("Guardar frases", "", function () {
    var limpias = []; areaFrases.value.split("\n").forEach(function (f) { f = f.replace(/\s+/g, " ").trim(); if (f && limpias.indexOf(f) < 0 && limpias.length < 16) limpias.push(f); });
    frases = limpias; escribirJSON("winclus.frases", frases); areaFrases.value = frases.join("\n"); avisar("Frases guardadas"); if (tecVisible && capa === "frases") dibujarTeclado();
  }));
  s.appendChild(botonGrande("Volver a las de ejemplo", "suave", function () { frases = FRASES_DEFECTO.slice(); escribirJSON("winclus.frases", null); areaFrases.value = frases.join("\n"); }));
  tabs.oir.appendChild(s);
  s = seccion("Mis frases con mi voz", "Para quien va a perder el habla (ELA, por ejemplo): grábalas ahora y Winclus las dirá con tu voz.");
  var filaGrab = el("div", { "class": "wcl-fila" });
  filaGrab.appendChild(el("label", { "for": "wcl-grab-texto" }, "Frase que vas a grabar"));
  var inpGrab = el("input", { "type": "text", "id": "wcl-grab-texto", "class": "wcl-sel", "list": "wcl-grab-lista-frases", "autocomplete": "off", "placeholder": "Por ejemplo: Tengo sed" });
  var dlGrab = el("datalist", { "id": "wcl-grab-lista-frases" });
  filaGrab.appendChild(inpGrab); s.appendChild(filaGrab); s.appendChild(dlGrab);
  var btnGrab = botonGrande("● Grabar esta frase", "azul", function () {
    if (grabadora) { pararGrabar(); return; }
    var t = inpGrab.value.replace(/\s+/g, " ").trim();
    if (!t) { avisar("Escribe primero la frase", true); inpGrab.focus(); return; }
    empezarGrabar(t);
  });
  btnGrab.id = "wcl-grabar"; s.appendChild(btnGrab);
  s.appendChild(el("div", { "class": "wcl-ayuda" }, "Escribe la frase, pulsa «Grabar» y dila con tu voz; pulsa otra vez para guardarla. Cuando pulses esa frase en el teclado, en el tablero o con «Decir», sonará tu voz. Se guardan solo en este navegador: no salen de tu equipo."));
  var listaGrab = el("ul", { "class": "wcl-activo", "id": "wcl-grab-lista" });
  s.appendChild(listaGrab);
  refrescos.push(function () {
    btnGrab.textContent = T(grabadora ? "■ Parar y guardar" : "● Grabar esta frase"); btnGrab.classList.toggle("rojo", !!grabadora);
    dlGrab.innerHTML = ""; frases.forEach(function (f) { dlGrab.appendChild(el("option", { "value": f })); });
    listaGrab.innerHTML = "";
    var claves = Object.keys(grabaciones);
    if (!claves.length) { listaGrab.appendChild(el("li", { "class": "nada" }, "Todavía no has grabado ninguna frase.")); return; }
    claves.forEach(function (k) {
      var g = grabaciones[k], li = el("li", {}, "");
      var sp = el("span", {}, ""); sp.textContent = g.texto; li.appendChild(sp);
      var oir = el("button", { "type": "button", "class": "wcl-quitar", "aria-label": T("Oír") + ": " + g.texto }, "▶"); oir.addEventListener("click", function () { reproducirGrabacion(g); });
      var bor = el("button", { "type": "button", "class": "wcl-quitar", "aria-label": T("Borrar") + ": " + g.texto }, "🗑"); bor.addEventListener("click", function () { borrarGrabacion(k); refrescos.forEach(function (f) { f(); }); });
      li.appendChild(oir); li.appendChild(bor); listaGrab.appendChild(li);
    });
  });
  tabs.oir.appendChild(s);
  s = seccion("Mandar con la voz", "Para manejar la página hablando, sin manos.");
  s.appendChild(el("div", { "class": "wcl-ayuda" }, T("Di «baja», «sube», «clic» y el nombre de un enlace, «escribe» y el texto, «lee», «teclado», «menú», «pausa», «sigue», «ayuda»… ") + T(AVISO_VOZ)));
  var btnEscucha = botonGrande("Escuchar órdenes", "azul", function () { if (escuchando) pararEscucha(); else empezarEscucha(); });
  refrescos.push(function () { btnEscucha.textContent = escuchando ? "Dejar de escuchar" : "Escuchar órdenes"; btnEscucha.classList.toggle("rojo", escuchando); });
  s.appendChild(btnEscucha);
  tabs.oir.appendChild(s);
  // --- para personas sordas o con hipoacusia ---
  s = seccion("Sonidos y subtítulos", "Para quien no oye o oye poco.");
  s.appendChild(filaSw("alertas_sonido", "Avisar en pantalla cuando algo suena", null, "Si la página hace un sonido (un aviso, una alarma), sale un cartel para que lo veas."));
  s.appendChild(filaSw("subtitulos", "Subtítulos grandes en los vídeos", aplicarClases, "Si el vídeo trae subtítulos, se muestran grandes y con fondo para leerlos bien."));
  s.appendChild(filaPaso("amplificar", "Subir el volumen por encima de lo normal", 100, 400, 25, pct, aplicarAmplificacion, "Para quien oye poco: los vídeos y audios de esta página suenan más fuerte que su volumen normal, sin que se rompa el sonido. Los vídeos de otros sitios (como YouTube) no se pueden tocar."));
  s.appendChild(filaSw("voz_clara", "Voz más clara", aplicarAmplificacion, "Quita los graves que tapan y realza las frecuencias de la voz: lo que se dice en los vídeos se entiende mejor."));
  s.appendChild(filaPaso("volumen_max", "Volumen máximo de vídeos y audios", 10, 100, 10, pct, limitarVolumenTodos, "Ningún vídeo ni audio de la página sonará más alto que esto."));
  s.appendChild(filaSw("silencio", "Silenciar la página", aplicarSilencio, "Deja sin sonido todos los vídeos y audios de la página, también los que arranquen después. Los vídeos incrustados de otros sitios (como YouTube) no se pueden silenciar desde aquí."));
  s.appendChild(botonGrande("Transcribir el vídeo o audio de la página (micrófono)", "suave", transcribirMedio));
  var btnSubvivo = botonGrande("Subtítulos en vivo (micrófono)", "azul", function () { if (subtitulando) pararSubvivo(); else empezarSubvivo(); });
  refrescos.push(function () { btnSubvivo.textContent = subtitulando ? "Parar los subtítulos en vivo" : "Subtítulos en vivo (micrófono)"; btnSubvivo.classList.toggle("rojo", subtitulando); });
  s.appendChild(btnSubvivo);
  s.appendChild(el("div", { "class": "wcl-ayuda" }, T("Escribe en pantalla lo que se habla cerca (una videollamada, una consulta) usando el micrófono. ") + T(AVISO_VOZ)));
  if (opciones.relevo) {
    s.appendChild(el("div", { "class": "wcl-estado" }, "Si te comunicas en Lengua de Señas Colombiana: el Centro de Relevo de MinTIC te pone un intérprete por videollamada, gratis."));
    s.appendChild(botonGrande("Centro de Relevo (intérprete de LSC)", "suave", function () { window.open(URL_RELEVO, "_blank", "noopener"); }));
    s.appendChild(botonGrande("Diccionario de Lengua de Señas (INSOR)", "suave", function () { window.open(URL_DICCIONARIO_LSC, "_blank", "noopener"); }));
  }
  tabs.oir.appendChild(s);

  // --- Cara (puntero con la cámara) ---
  s = seccion("Usar con la cara", "Para quien no puede usar el ratón con las manos.");
  if (opciones.camara) {
    estadoEl = el("div", { "class": "wcl-estado", "id": "wcl-estado", "aria-live": "polite" }, "Mueve el puntero con la cabeza o con los ojos y haz clic con un gesto. Para bajar la página, lleva el puntero al borde de abajo; para subir, al de arriba. La cámara se procesa aquí mismo: nada sale de tu equipo.");
    s.appendChild(estadoEl);
    btnActivar = botonGrande("Activar cámara", "", activarCamara); s.appendChild(btnActivar);
    var vista = el("div", { "class": "wcl-cam-vista" }, '<canvas width="320" height="240" aria-label="Vista de la cámara"></canvas>'); s.appendChild(vista);
    s.appendChild(filaSw("camara_ver", "Ver la cámara", function (v) { vistaCamara(v && camaraActiva); }, "Muestra aquí lo que ve la cámara, para comprobar que tu cara sale entera y con luz."));
    s.appendChild(filaSw("camara_seguir", "Seguir con la cámara al cambiar de página", function (v) { escribirJSON("winclus.camara_seguir", v && camaraActiva ? true : null); },
      "Si dejas la cámara encendida y abres otra página de este sitio, se vuelve a encender sola: nadie tiene que pulsar nada. Solo si ya diste permiso a la cámara. Si la apagas con «Apagar cámara», no vuelve a encenderse sola."));
    s.appendChild(filaSw("bordes_desplazan", "Bajar y subir llevando el puntero al borde", null, "Lleva el puntero a la parte de abajo de la pantalla, donde pone «Bajar», y la página baja sola; arriba, donde pone «Subir», sube. Apártalo y para. También bajas abriendo la boca y subes con las cejas, o diciendo «baja» y «sube»."));
    s.appendChild(filaSw("puntero_externo", "Otro aparato mueve el puntero", null, "Si ya tienes un rastreador de mirada (Tobii, Windows Eye Control) o cualquier aparato que mueva el puntero, márcalo: Winclus no lo toca y pone encima el clic por parpadeo, los gestos, el menú, el teclado y la voz."));
    var fCam = finos("Si el equipo se calienta o quieres saber qué detecta la cámara.");
    fCam.agregar(filaSw("ahorro", "Gastar menos batería", null, "Analiza menos imágenes por segundo: el puntero va un poco menos fino, pero el equipo se calienta menos."));
    // Lectura en vivo del detector, para diagnosticar el parpadeo sin adivinar
    var diag = el("div", { "class": "wcl-estado", "style": "font-family:Consolas,monospace;font-size:12px;white-space:pre-wrap" }); fCam.agregar(diag);
    setInterval(function () {
      if (!camaraActiva) { diag.textContent = ""; return; }
      var e = parpadeo.estado, bs = det.bs || {};
      diag.textContent = (det.cara ? "Cara: sí" : "Cara: NO") + " · modo " + modoEfectivo() + (pausado ? " · EN PAUSA" : "")
        + "\nOjos abiertos: " + Math.round(e.relacion * 100) + " % (" + (e.listo ? "referencia lista" : "aprendiendo " + parpadeo.bufDer.length + "/" + PB.MIN_BASE) + ")"
        + "\nApertura der/izq: " + e.apertura[0].toFixed(3) + " / " + e.apertura[1].toFixed(3) + " · normal " + e.base[0].toFixed(3) + " / " + e.base[1].toFixed(3)
        + "\nParpadeo MediaPipe der/izq: " + (bs.eyeBlinkRight || 0).toFixed(2) + " / " + (bs.eyeBlinkLeft || 0).toFixed(2)
        + "\nCerrados: " + (e.cerrados ? e.cerradosMs + " ms" : "no") + " · umbral " + ajustes.parpadeo_umbral + " · mínimo " + ajustes.parpadeo_ms + " ms"
        + (parpadeo.ultimoEpisodio ? "\nÚltimo cierre: " + parpadeo.ultimoEpisodio.ms + " ms → " + parpadeo.ultimoEpisodio.resultado : "");
    }, 250);
    s.appendChild(fCam);
    tabs.cara.appendChild(s);

    s = seccion("Cómo se mueve el puntero", "Con la cabeza funciona desde el primer momento. Con los ojos hay que calibrar una vez.");
    // Al elegir los ojos sin calibración, se calibra en el acto (en la aplicación la
    // calibración ya estaba guardada; aquí hay que hacerla una vez por navegador)
    function alElegirOjos() {
      reiniciarPuntero();
      if (ajustes.modo_puntero !== "ojos" || ajustes.ojos_modo === "palanca" || calibracion) return;
      if (!camaraActiva) { decir("Para usar los ojos: activa la cámara y pulsa «Calibrar los ojos». Hasta entonces el puntero va con la cabeza."); return; }
      decir("Sin calibrar todavía: empieza la calibración (unos 40 s)."); abrir(false); empezarCalibracion(false);
    }
    s.appendChild(filaOpc("modo_puntero", "", [["cabeza", "Con la cabeza"], ["ojos", "Con los ojos"]], alElegirOjos, null, "Con la cabeza: giras un poco la cabeza y el puntero va hacia allí. Con los ojos: el puntero va a donde miras."));
    var gCab = grupo("cabeza hibrido");
    gCab.appendChild(filaPaso("velocidad", "Velocidad con la cabeza", 5, 60, 5, null, null, "Cuánto recorre el puntero con cada giro de cabeza. Si se te va lejos, bájala; si no llega, súbela."));
    var fCab = finos("Si el puntero tiembla o no responde como quieres.");
    fCab.agregar(filaPaso("suavizado", "Quietud del puntero", 2, 20, 1, null, null, "Más alto: menos temblor, pero responde un poco más tarde."));
    fCab.agregar(filaSw("aceleracion", "Más rápido si te mueves rápido", null, "Un giro lento mueve poco el puntero (para afinar) y uno rápido lo mueve mucho (para cruzar la pantalla)."));
    gCab.appendChild(fCab);
    s.appendChild(gCab);
    var gOjos = grupo("ojos");
    gOjos.appendChild(filaOpc("ojos_modo", "Cómo responden los ojos", [["directo", "Va a donde miro"], ["hibrido", "Miro y afino con la cabeza"], ["palanca", "Como una palanca"]], alElegirOjos, null, "«Va a donde miro» es lo más directo. «Miro y afino con la cabeza» salta con la mirada y termina con un giro pequeño de cabeza: más preciso. «Como una palanca»: mirar hacia un lado empuja el puntero hacia allí y mirar al centro lo para; no necesita calibrar."));
    var estadoCalib = el("div", { "class": "wcl-estado" });
    refrescos.push(function () {
      estadoCalib.textContent = calibracion ? T("Ojos calibrados") + (calibracion.error_real_px != null ? T(" (error unos ") + calibracion.error_real_px + T(" px)") : "") + (calibracion.origen === "clics" ? T(", aprendida de tus clics") : calibracion.origen === "clics+calibracion" ? T(", afinada con tus clics") : "") + "." : T("Sin calibrar: mientras tanto el puntero irá con la cabeza (o calibra con 30 clics, ver abajo).");
    });
    var gCalib = grupo("directo hibrido");
    gCalib.appendChild(estadoCalib);
    var btnCalibrar = botonGrande("Calibrar los ojos (unos 40 s)", "azul", function () { abrir(false); empezarCalibracion(false); });
    refrescos.push(function () { btnCalibrar.textContent = T(ajustes.calib_modo === "rapida" ? "Calibrar los ojos (unos 30 s)" : ajustes.calib_modo === "completa" ? "Calibrar los ojos (unos 70 s)" : "Calibrar los ojos (unos 40 s)"); });
    gCalib.appendChild(btnCalibrar);
    gCalib.appendChild(el("div", { "class": "wcl-ayuda" }, "Miras unos puntos que van saliendo, sin mover la cabeza. Así Winclus aprende a dónde miras. Se hace una vez por navegador."));
    gCalib.appendChild(botonGrande("Recentrar (mirar al centro 2 s)", "suave", function () { abrir(false); recentrar(); }));
    gCalib.appendChild(el("div", { "class": "wcl-ayuda" }, "Si el puntero se ha ido de sitio: mira al centro de la pantalla dos segundos y vuelve a su sitio."));
    var gLupa = grupo("directo");
    gLupa.appendChild(filaSw("lupa_activa", "Lupa para afinar el clic", null, "Con los ojos es difícil acertar en un botón pequeño: el primer gesto agranda la zona y el segundo pulsa donde miras."));
    gLupa.appendChild(filaPaso("lupa_zoom", "Cuánto agranda la lupa", 2, 4, 1, function (n) { return "×" + n; }, null, null));
    gOjos.appendChild(gCalib);
    gOjos.appendChild(gLupa);
    var gHib = grupo("hibrido");
    gHib.appendChild(filaPaso("hibrido_cabeza", "Cuánto manda la cabeza", 10, 100, 10, pct, null, "Más alto: la cabeza afina más, pero el puntero se mueve más al girarla."));
    gOjos.appendChild(gHib);
    var gPal = grupo("palanca");
    gPal.appendChild(botonGrande("Centrar (mira al centro)", "suave", function () { ojosCentro = null; centrandoPalanca = null; escribirJSON("winclus.ojos_centro", null); }));
    gPal.appendChild(el("div", { "class": "wcl-ayuda" }, "Mira al centro de la pantalla: desde ahí, mirar a un lado empuja el puntero hacia ese lado."));
    gPal.appendChild(filaPaso("ojos_velocidad", "Velocidad", 10, 100, 10, null, null, "Cuánto se mueve el puntero mientras miras hacia un lado."));
    gOjos.appendChild(gPal);
    var gQuieto = grupo("directo hibrido");
    gQuieto.appendChild(filaSw("ojos_quieto", "El puntero tiembla: dejarlo más quieto", null,
      "Suaviza más la mirada y ensancha la zona en la que el puntero no se mueve. Va un pelín más lento, pero se queda donde lo dejas."));
    gQuieto.appendChild(filaSw("ojos_alcance", "Llegar a los bordes de la pantalla", null,
      "La calibración mide con un margen, así que mirando a una esquina el puntero se queda corto. Con esto se estira lo justo para alcanzarlas."));
    gOjos.appendChild(gQuieto);
    var fOjos = finos("Si el puntero con los ojos tiembla, salta o no llega a los bordes.");
    var fOjosCalib = grupo("directo hibrido");
    fOjosCalib.appendChild(filaPaso("ojos_suavizado", "Quietud del puntero", 1, 30, 1, null, null, "Más alto: menos temblor, pero responde un poco más tarde."));
    fOjosCalib.appendChild(filaPaso("ojos_fijacion_px", "Zona en la que no se mueve", 20, 150, 10, px, null, "Mientras la mirada se queda dentro de esta zona, el puntero no se mueve. Más grande: más quieto, menos preciso."));
    fOjosCalib.appendChild(filaOpc("calib_modo", "Cómo de larga es la calibración", [["rapida", "Rápida"], ["normal", "Normal"], ["completa", "Completa"]], null, null, "Rápida: 9 puntos, 30 segundos. Normal: 13 puntos, 40 segundos. Completa: 25 puntos, 70 segundos y más precisión."));
    fOjosCalib.appendChild(filaSw("calib_lento", "Más tiempo en cada punto", null, "Si no te da tiempo a llegar con la vista a cada punto."));
    fOjosCalib.appendChild(filaSw("calib_punto_grande", "Punto más grande", null, "Para quien ve peor el punto naranja."));
    fOjosCalib.appendChild(filaSw("calib_cabeza", "Paso final de compensación de cabeza", null, "Al terminar, miras el centro moviendo un poco la cabeza: Winclus aprende a corregir el puntero cuando la cabeza no está exactamente como al calibrar. Se guarda solo si mejora, y dice cuánto."));
    fOjosCalib.appendChild(botonPeligroso("Olvidar la calibración", function () { calibracion = null; escribirJSON("winclus.calibracion", null); reiniciarPuntero(); refrescos.forEach(function (f) { f(); }); }));
    fOjos.agregar(fOjosCalib);
    var fHib = grupo("hibrido");
    fHib.appendChild(filaPaso("hibrido_salto_px", "Distancia mínima para saltar", 50, 400, 25, px, null, "Si miras a un sitio más cerca que esto, el puntero no salta: lo llevas con la cabeza."));
    fOjos.agregar(fHib);
    var fPal = grupo("palanca");
    fPal.appendChild(filaPaso("ojos_zona_muerta", "Centro que no empuja", 0, 15, 1, pct, null, "Zona alrededor del centro en la que mirar no mueve el puntero. Más grande: más fácil pararlo."));
    fPal.appendChild(filaPaso("ojos_vertical", "Fuerza hacia arriba y abajo", 50, 300, 25, pct, null, "Los ojos se mueven menos en vertical que en horizontal: esto lo compensa."));
    fOjos.agregar(fPal);
    gOjos.appendChild(fOjos);
    s.appendChild(gOjos);
    tabs.cara.appendChild(s);

    s = seccion("Elegir sin acertar", "Con los ojos o la cara es difícil dar en un enlace pequeño: no hace falta.");
    s.appendChild(filaSw("elegir_cerca", "Preguntarme cuál, si hay varias cosas cerca", null,
      "En vez de adivinar, Winclus enseña lo que hay alrededor del puntero (enlaces, botones, campos) en botones grandes y eliges de la lista. Los desplegables también se abren así, con todas sus opciones."));
    s.appendChild(filaSw("apuntado_marcar", "Marcar lo que voy a pulsar", null,
      "Rodea con un marco azul lo que se pulsaría si hicieras el gesto ahora, para verlo antes de gastarlo."));
    s.appendChild(filaSw("ayuda_clic", "Ofrecerme otra forma de pulsar si no me sale", null,
      "Si llevas un rato moviendo el puntero sin conseguir pulsar nada, Winclus te lo dice y te ofrece pulsar quedándote quieto, abriendo la boca o subiendo las cejas."));
    tabs.cara.appendChild(s);

    s = seccion("Imán a los botones", "Para el temblor o los movimientos involuntarios.");
    s.appendChild(filaSw("iman_activo", "Imán activado", null, "Si el puntero se queda cerca de un botón o un enlace, se pega a él solo: no hace falta acertar."));
    var fIman = finos("Si el imán se pega a lo que no quieres o no llega.");
    fIman.agregar(filaPaso("iman_radio_px", "Desde qué distancia se pega", 30, 200, 10, px, null, "Más grande: se pega desde más lejos."));
    fIman.agregar(filaSw("iman_cabeza", "También con la cabeza", null, "El imán viene pensado para los ojos; actívalo si con la cabeza también te ayuda."));
    s.appendChild(fIman);
    tabs.cara.appendChild(s);

    s = seccion("Aprender de mis clics", "Para no tener que calibrar: Winclus aprende solo.");
    s.appendChild(filaSw("calib_invisible", "Aprender de mis clics", refrescarEstadoAprendizaje, "Cada vez que haces clic con la cabeza, Winclus mira a dónde mirabas. Con unos 30 clics ya sabe usar tus ojos sin calibrar."));
    estadoAprEl = el("div", { "class": "wcl-estado", "aria-live": "polite" }); s.appendChild(estadoAprEl); refrescos.push(refrescarEstadoAprendizaje);
    var fApr = finos("Si quieres forzar el ajuste o empezar de cero.");
    fApr.agregar(botonGrande("Ajustar ahora", "suave", function () { estadoAprEl.textContent = ajustarConClics(true) || estadoAprendizaje(); refrescos.forEach(function (f) { f(); }); }));
    fApr.agregar(botonPeligroso("Olvidar los clics", function () { clicsAprendidos = []; escribirJSON("winclus.clics", null); refrescarEstadoAprendizaje(); }));
    s.appendChild(fApr);
    tabs.cara.appendChild(s);
  } else {
    s.appendChild(el("div", { "class": "wcl-estado" }, "El control con la cámara está desactivado en esta página."));
    tabs.cara.appendChild(s);
  }

  // --- Clics ---
  s = seccion("Cómo se hace clic", "El gesto con el que pulsas cuando usas la cámara.");
  s.appendChild(filaOpc("modo_clic", "", [["parpadeo", "Cerrar los ojos"], ["boca", "Abrir la boca"], ["cejas", "Subir las cejas"], ["quieto", "Quedarse quieto"]], reiniciarQuieto, null, "Cerrar los ojos un momento (más que un parpadeo normal), abrir la boca, subir las cejas o dejar el puntero quieto un instante sobre lo que quieres."));
  var gParp = grupo("parpadeo");
  gParp.appendChild(filaPaso("parpadeo_ms", "Cuánto tiempo cerrar los ojos", 100, 800, 50, ms, null, "Los parpadeos normales duran menos y no cuentan. Si hace clic solo, súbelo; si no te sale, bájalo."));
  var fParp = finos("Si el clic no sale o sale sin querer.");
  var fCierre = el("div", { "class": "wcl-fila" }, '<span id="wcl-l-cierre">' + T("Cuánto hay que cerrarlos") + '</span><div class="wcl-mm" role="group" aria-labelledby="wcl-l-cierre"><button type="button" aria-label="' + T("Menos") + '">−</button><span aria-live="polite"></span><button type="button" aria-label="' + T("Más") + '">+</button></div>');
  conAyuda(fCierre, "cierre", "Si el clic no sale, bájalo; si se dispara solo, súbelo. Abajo ves cuánto duró tu último cierre y si contó como clic.");
  var bc = fCierre.querySelectorAll("button"), vc = fCierre.querySelector("span[aria-live]");
  function pintarCierre() { vc.textContent = Math.round((1 - ajustes.parpadeo_umbral) * 100) + " %"; }
  function cambiarCierre(d) { var c = Math.round((1 - ajustes.parpadeo_umbral) * 100) + d; c = Math.max(25, Math.min(65, c)); ajustes.parpadeo_umbral = +(1 - c / 100).toFixed(2); guardar(); pintarCierre(); }
  bc[0].addEventListener("click", function () { cambiarCierre(-5); }); bc[1].addEventListener("click", function () { cambiarCierre(5); });
  refrescos.push(pintarCierre); fParp.agregar(fCierre);
  var estadoParp = el("div", { "class": "wcl-estado", "aria-live": "off" }); fParp.agregar(estadoParp);
  setInterval(function () { if (!camaraActiva) { estadoParp.textContent = ""; return; } if (parpadeo.ultimoEpisodio) estadoParp.textContent = "Último cierre: " + parpadeo.ultimoEpisodio.ms + " ms → " + parpadeo.ultimoEpisodio.resultado; }, 300);
  gParp.appendChild(fParp);
  s.appendChild(gParp);
  var gQ = grupo("quieto");
  gQ.appendChild(filaPaso("quieto_ms", "Cuánto tiempo quieto", 500, 3000, 100, ms, null, "El puntero tiene que estar quieto este tiempo para que cuente como clic."));
  gQ.appendChild(filaSw("quieto_anillo", "Mostrar el anillo que se llena", null, "Un círculo alrededor del puntero se va llenando: cuando se completa, hace clic."));
  var fQ = finos("Si el temblor te impide quedarte quieto.");
  fQ.agregar(filaPaso("quieto_radio_px", "Cuánto puede temblar", 20, 100, 10, px, null, "Mientras el puntero no salga de esta zona, cuenta como quieto."));
  gQ.appendChild(fQ);
  s.appendChild(gQ);
  s.appendChild(filaSw("menu_ojos", "Abrir el menú de clics cerrando los ojos", null,
    "Con los ojos cerrados un rato sale una rueda con clic derecho, doble clic, arrastrar, rueda, teclado, leer, recentrar y pausar. Si se te abre sin querer porque cierras mucho los ojos al pulsar, apágalo: el menú sigue estando en «Más»."));
  var fMenu = finos("Si el menú se abre sin querer o cuesta abrirlo.");
  fMenu.agregar(filaPaso("menu_largo_ms", "Cuánto hay que cerrar los ojos", 800, 3000, 100, ms, null,
    "Si al hacer clic cierras los ojos mucho rato, sube este tiempo. Winclus además lo sube solo si ve que tus clics duran casi lo mismo, para que el menú no te salga al pulsar."));
  s.appendChild(fMenu);
  tabs.clics.appendChild(s);
  s = seccion("Otras acciones con gestos", "Cada gesto de la cara puede hacer una cosa: bajar, subir, clic derecho…");
  s.appendChild(filaSw("gestos_activos", "Usar los gestos de la cara", null, "Si la página se mueve o pasan cosas sin querer al hablar, bostezar o respirar, apaga esto: los gestos dejan de hacer nada. El gesto con el que haces clic sigue funcionando."));
  GESTOS.forEach(function (g) { s.appendChild(filaOpc(g[0], g[1], ACCIONES, null, ajustes.gestos)); });
  var fGes = finos("Si un gesto se dispara solo o no lo reconoce.");
  fGes.agregar(filaPaso("gestos_umbral", "Cuánto hay que marcar el gesto", 30, 80, 5, pct, null, "Más alto: hay que hacer el gesto más exagerado (menos disparos sin querer)."));
  fGes.agregar(filaPaso("hold_ms", "Mantener el gesto para arrastrar", 150, 800, 50, ms, null, "Si mantienes el gesto de clic este tiempo, en vez de clic empieza a arrastrar."));
  s.appendChild(fGes);
  tabs.clics.appendChild(s);
  s = seccion("Avisos", "Para saber que el clic se ha hecho.");
  s.appendChild(filaSw("avisos_visuales", "Etiqueta junto al puntero", null, "Un cartelito junto al puntero dice «Clic», «Arrastrando», «En pausa»…"));
  s.appendChild(filaSw("avisos_sonido", "Pitido al hacer clic"));
  tabs.clics.appendChild(s);
  s = seccion("Barrido con un solo pulsador", "Para quien solo puede accionar una cosa: un pulsador, una tecla o un gesto.");
  s.appendChild(filaSw("barrido", "Barrido activado", aplicarBarrido, "Winclus va marcando uno a uno los botones, enlaces y campos de la página (y las teclas del teclado en pantalla). Cuando el marco está en lo que quieres, das la señal. El clic con la cara también vale. Escape lo pausa y lo reanuda."));
  s.appendChild(filaOpc("barrido_senal", "Señal", [["espacio", "Espacio"], ["intro", "Intro"], ["cualquiera", "Cualquier tecla"], ["raton", "Clic del ratón"]], null, null, "Con qué das la señal. Un pulsador normalmente hace de tecla Espacio o de clic."));
  s.appendChild(filaPaso("barrido_ms", "Tiempo en cada elemento", 400, 4000, 100, function (n) { return (n / 1000).toFixed(1) + " s"; }, function () { if (ajustes.barrido) barridoReprogramar(); }, "Cuánto se queda el marco en cada cosa antes de pasar a la siguiente. Si no te da tiempo, súbelo."));
  s.appendChild(filaSw("barrido_voz", "Decir en voz alta lo marcado", null, "Dice el nombre de cada cosa que va marcando, por si no la ves bien."));
  // Familia 5: dos pulsadores, zonas, punto de barrido, menú de acciones y aceleración
  s.appendChild(filaOpc("barrido_modo", "Cómo avanza el marco", [["auto", "Solo, cada cierto tiempo"], ["pasos", "Con dos pulsadores"]], function () { aplicarBarrido(); refrescos.forEach(function (f) { f(); }); }, null, "«Solo»: el marco pasa de una cosa a otra cada cierto tiempo y tú das la señal. «Con dos pulsadores»: una señal mueve el marco y la otra elige, sin tiempos."));
  var fS2 = filaOpc("barrido_senal2", "Señal para elegir", [["intro", "Intro"], ["espacio", "Espacio"], ["flecha", "Flecha derecha o abajo"], ["raton", "Clic del ratón"]], null, null, "Con dos pulsadores: la «Señal» de arriba mueve el marco y esta elige. Tienen que ser distintas. El clic con la cara siempre elige.");
  refrescos.push(function () { fS2.style.display = ajustes.barrido_modo === "pasos" ? "" : "none"; });
  s.appendChild(fS2);
  s.appendChild(filaSw("barrido_grupos", "Barrer por zonas", function () { if (ajustes.barrido) aplicarBarrido(); }, "Primero marca las zonas de la página (menú, cabecera, contenido, pie) y, al elegir una, sus botones y enlaces. Menos pasos en páginas largas. Dos vueltas sin elegir y vuelve a las zonas."));
  s.appendChild(filaSw("barrido_punto", "Poder tocar cualquier punto", function () { if (ajustes.barrido) aplicarBarrido(); }, "Añade «Cualquier punto» al barrido: una línea baja por la pantalla y la paras con la señal; otra cruza de lado a lado y la paras; ahí se hace clic. Para mapas y cosas sin botones."));
  s.appendChild(filaSw("barrido_menu", "Menú de acciones al elegir", null, "Al elegir algo de la página, en vez de hacer clic sale un menú: clic, clic largo, arrastrar, leer o escribir. Para quien necesita más que el clic."));
  s.appendChild(filaSw("barrido_acelerar", "Acelerar solo", function () { barridoMs = 0; if (ajustes.barrido) barridoReprogramar(); }, "Cada acierto baja un poco el tiempo; si el marco da una vuelta entera sin que elijas, sube. Nunca baja de la mitad del tiempo que pongas."));
  tabs.clics.appendChild(s);

  s = seccion("Si la mano tiembla con el ratón", "Para quien usa su propio ratón pero con temblor: Parkinson, temblor esencial, esclerosis múltiple.");
  s.appendChild(filaSw("raton_temblor", "Ayudarme a pulsar con el ratón", null, "Si el clic cae al lado de un botón o un enlace, Winclus pulsa el que tenías cerca (o te pregunta cuál, si hay varios). Y si el dedo pulsa dos veces sin querer, el segundo clic no cuenta."));
  var fTem = finos("Si ignora clics que sí querías o no llega a lo que tienes cerca.");
  fTem.agregar(filaPaso("raton_doble_ms", "Tiempo para no contar un segundo clic", 300, 1200, 100, function (n) { return (n / 1000).toFixed(1) + " s"; }, null, "Si pulsas otra vez en el mismo sitio antes de este tiempo, no cuenta. Más largo: ignora más clics sin querer."));
  fTem.agregar(filaPaso("raton_radio_px", "Hasta qué distancia busca lo que tienes cerca", 20, 80, 10, px, null, "Más grande: te ayuda aunque el clic caiga más lejos del botón."));
  s.appendChild(fTem);
  tabs.clics.appendChild(s);

  // --- Escribir ---
  s = seccion("Teclado en pantalla", "Para escribir sin el teclado de verdad: con el puntero, con la cara o con un pulsador.");
  s.appendChild(botonGrande("Mostrar / ocultar el teclado", "azul", alternarTeclado));
  s.appendChild(el("div", { "class": "wcl-ayuda" }, "Pulsa en un campo de la página y escribe con el puntero. Tiene sugerencias de palabras y las teclas «Decir», «Frases» y «Dictar»."));
  s.appendChild(filaOpc("teclado_posicion", "Dónde sale", [["abajo", "Abajo"], ["arriba", "Arriba"]], function () { if (tecVisible) dibujarTeclado(); }));
  s.appendChild(filaPaso("teclado_altura", "Altura", 20, 50, 2, pct, function () { if (tecVisible) dibujarTeclado(); }, "Qué parte de la pantalla ocupa el teclado. Más alto: teclas más grandes."));
  s.appendChild(filaSw("teclado_prediccion", "Sugerir palabras", function () { if (tecVisible) dibujarTeclado(); }, "Mientras escribes propone palabras completas para tocarlas de una vez. Aprende las que usas."));
  s.appendChild(filaSw("teclado_sonido", "Sonido al pulsar"));
  s.appendChild(botonPeligroso("Olvidar las palabras aprendidas", function () { aprendidas = {}; escribirJSON("winclus.palabras", null); diccionario = null; cargarDiccionario(); avisar("Olvidadas"); }));
  tabs.escribir.appendChild(s);
  s = seccion("Dictado", "Para escribir hablando.");
  var btnDictar = botonGrande("Dictar", "azul", alternarDictado);
  refrescos.push(function () { btnDictar.textContent = dictando ? "Parar el dictado" : "Dictar"; btnDictar.classList.toggle("rojo", dictando); });
  s.appendChild(btnDictar);
  s.appendChild(el("div", { "class": "wcl-ayuda" }, T("Pulsa en un campo, habla y se escribe lo que dices (Chrome o Edge). ") + T(AVISO_VOZ)));
  s.appendChild(filaSw("dictado_confirmar", "Confirmar antes de escribir lo dictado", null, "Te enseña lo que ha entendido y esperas a decir «sí» o «no» antes de que se escriba."));
  tabs.escribir.appendChild(s);
  s = seccion("Ayuda en formularios", "Para no perderse rellenando un trámite.");
  s.appendChild(filaSw("formularios", "Ayuda en formularios", null, "Al entrar en un campo te dice cuál es y cuántos quedan («Campo 3 de 8: Correo, obligatorio»); si el sitio marca un error, lo explica en lenguaje claro; y deja pegar aunque el sitio lo bloquee."));
  tabs.escribir.appendChild(s);

  // --- Más ---
  s = seccion("Lo que consigo con Winclus", "Cuántas cosas has hecho con ayuda de Winclus. Solo cifras, sin datos personales.");
  var usoEl = el("div", { "class": "wcl-estado", "style": "white-space:pre-line" }, "");
  refrescos.push(function () { usoEl.textContent = resumenUso(); });
  s.appendChild(usoEl);
  s.appendChild(botonGrande("Copiar el resumen de uso", "suave", function () {
    var t = resumenUso() + "\nSolo cifras, sin datos personales. Winclus " + VERSION + ".";
    var listo = function () { avisar("Resumen copiado"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(listo, function () { window.prompt("Copia este resumen:", t); }); else window.prompt("Copia este resumen:", t);
  }));
  if (opciones.metricas) {
    s.appendChild(filaSw("metricas_compartir", "Compartir mis cifras de uso con este sitio", enviarMetricasSiToca, "Este sitio puede recibir estas cifras y qué opciones del panel se tocan (solo números, sin nada personal) para saber cuántas personas consiguen hacer sus gestiones con Winclus y qué opciones no se entienden. Se envían una vez por semana, solo si lo activas."));
  }
  tabs.mas.appendChild(s);
  function enviarMetricasSiToca() {
    if (!opciones.metricas || !ajustes.metricas_compartir || !uso) return;
    var ultimo = leerJSON("winclus.uso_enviado", 0), ahora = Date.now();
    if (ahora - ultimo < 7 * 86400000) return;
    try {
      fetch(opciones.metricas, { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ sitio: location.hostname, version: VERSION, desde: uso.desde, cifras: uso.n, panel: uso.panel || {} }) })
        .then(function () { escribirJSON("winclus.uso_enviado", ahora); }).catch(function () {});
    } catch (e) {}
  }
  setTimeout(enviarMetricasSiToca, 5000);
  s = seccion("Mis ajustes en otro sitio", "Para no volver a configurarlo todo en otro navegador, otro equipo u otra página.");
  s.appendChild(botonGrande("Copiar enlace con mis ajustes", "suave", function () {
    var enlace = perfilAEnlace();
    var listo = function () { avisar("Enlace copiado"); decirVoz("Enlace copiado. Ábrelo en otro equipo o guárdalo en favoritos: lleva tu configuración.", true, true); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(enlace).then(listo, function () { window.prompt("Copia este enlace:", enlace); });
    else window.prompt("Copia este enlace:", enlace);
  }));
  s.appendChild(el("div", { "class": "wcl-ayuda" }, "Lo más fácil: el enlace lleva dentro tus ajustes. Ábrelo en otro equipo o guárdalo en favoritos y todo queda igual."));
  s.appendChild(botonGrande("Guardar mis ajustes en un archivo", "suave", function () {
    var perfil = { winclus: VERSION, ajustes: ajustes, calibracion: calibracion, ojos_centro: ojosCentro, frases: frases, palabras: aprendidas, clics: clicsAprendidos, tableros: tableros };
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(perfil)], { type: "application/json" })); a.download = "perfil.winclus"; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }));
  // Perfil por enlace: la configuración viaja en el propio enlace (#winclus=…), sin cuentas ni servidores.
  // Al abrir cualquier página con Winclus y ese enlace, se importa y el enlace se limpia.
  function importarPerfil(p) {
    if (!p || !p.ajustes || typeof p.ajustes !== "object") throw new Error("no es un perfil");
    fusionarAjustes(p.ajustes); guardar(); if (modeloValido(p.calibracion)) { calibracion = p.calibracion; escribirJSON("winclus.calibracion", calibracion); }
    if (p.ojos_centro) { ojosCentro = p.ojos_centro; escribirJSON("winclus.ojos_centro", ojosCentro); }
    if (Array.isArray(p.frases) && p.frases.every(function (x) { return typeof x === "string"; })) { frases = p.frases.slice(0, 64); escribirJSON("winclus.frases", frases); areaFrases.value = frases.join("\n"); }
    if (p.palabras && typeof p.palabras === "object") { aprendidas = p.palabras; escribirJSON("winclus.palabras", aprendidas); diccionario = null; }
    if (Array.isArray(p.clics)) { clicsAprendidos = clicsValidos(p.clics); escribirJSON("winclus.clics", clicsAprendidos); }
    if (Array.isArray(p.tableros)) { tableros = tablerosValidos(p.tableros); guardarTableros(); if (pictosEl) pintarPictos(); }
    aplicarTodo(); aplicarBarrido(); activarLector(!!ajustes.lector); avisar("Perfil importado");
  }
  function perfilActual() { return { winclus: VERSION, ajustes: ajustes, calibracion: calibracion, ojos_centro: ojosCentro, frases: frases, palabras: aprendidas }; }
  function perfilAEnlace() {
    var json = JSON.stringify(perfilActual()), b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    var h = (location.hash || "").replace(/[#&]winclus=[A-Za-z0-9_-]+/, "");   // se conserva la ruta de las SPA (#/tramites/…)
    return location.href.replace(/#.*$/, "") + (h.length > 1 ? h + "&" : "#") + "winclus=" + b64;
  }
  function perfilDeEnlace() {
    var m = /[#&]winclus=([A-Za-z0-9_-]+)/.exec(location.hash || "");
    if (!m) return null;
    try { var b64 = m[1].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(decodeURIComponent(escape(atob(b64 + "===".slice((b64.length + 3) % 4))))); } catch (e) { return false; }   // false: venía algo, pero roto
  }
  var entrada = el("input", { "type": "file", "accept": ".winclus,.json", "style": "display:none" });
  entrada.addEventListener("change", function () {
    var f = entrada.files[0]; if (!f) return;
    var lector2 = new FileReader();   // FileReader: Blob.text() no existe en Safari < 14
    lector2.onload = function () { try { importarPerfil(JSON.parse(lector2.result)); } catch (x) { avisar("No se pudo leer el perfil", true); } };
    lector2.onerror = function () { avisar("No se pudo leer el perfil", true); };
    lector2.readAsText(f);
    entrada.value = "";
  });
  s.appendChild(entrada);
  s.appendChild(botonGrande("Cargar mis ajustes desde un archivo", "suave", function () { entrada.click(); }));
  s.appendChild(el("div", { "class": "wcl-ayuda" }, "El archivo (.winclus) guarda ajustes, calibración de los ojos, frases, palabras aprendidas y tus tableros de dibujos."));
  tabs.mas.appendChild(s);
  s = seccion("Empezar de cero", "Si algo se ha descolocado y quieres volver a como estaba al principio.");
  s.appendChild(botonPeligroso("Restablecer todo", function () {
    desactivarCamara(); consentidoAhora = false;   // también si estaba activándose
    borrarTodasGrabaciones(); pararAyuda();   // las frases con tu voz también se borran
    fusionarAjustes(JSON.parse(JSON.stringify(POR_DEFECTO))); guardar();
    calibracion = null; ojosCentro = null; clicsAprendidos = []; frases = FRASES_DEFECTO.slice(); aprendidas = {}; diccionario = null;
    tableros = []; historial = {}; pictoFrase = [];
    ["winclus.calibracion", "winclus.ojos_centro", "winclus.clics", "winclus.frases", "winclus.palabras", "winclus.consentimiento_camara", "winclus.camara_seguir", "winclus.visto", "winclus.tableros", "winclus.pictos_historial"].forEach(function (k) { escribirJSON(k, null); });
    try { sessionStorage.removeItem("winclus.tab"); } catch (e) {}
    areaFrases.value = frases.join("\n"); reiniciarPuntero(); refrescarEstadoAprendizaje(); aplicarTodo();
    cerrarLimpia(); cerrarPictos(); aplicarBarrido(); activarLector(false); ocultarNumeros(); avisar("Todo restablecido");
  }));
  s.appendChild(el("div", { "class": "wcl-ayuda" }, "Borra de este navegador todo lo que Winclus guarda: ajustes, calibración de los ojos, clics aprendidos, frases, palabras y el permiso de la cámara."));
  tabs.mas.appendChild(s);
  s = seccion("Acerca de");
  s.appendChild(el("div", { "class": "wcl-pie", "style": "padding:0" }, 'Winclus widget ' + VERSION + '. Sin cuentas, sin rastreo y sin servidores propios: la cámara, la calibración y tus ajustes se quedan en este navegador. Solo el dictado y las órdenes por voz usan el reconocedor del navegador (Google o Microsoft). <a href="https://winclus.com/privacidad" target="_blank" rel="noopener">Política de tratamiento de datos</a>.<br><br>¿Quieres controlar todo el ordenador con la cara? <a href="https://winclus.com/#contacto" target="_blank" rel="noopener">Comunícate con nosotros</a>.'));
  tabs.mas.appendChild(s);

  TABS.forEach(function (t) { panel.appendChild(tabs[t[0]]); });

  // --- Pie fijo: qué acaba de hacer Winclus, «Volver a como estaba» y «Ver más opciones» ---
  // Se abre en la vista sencilla (solo «¿Qué te cuesta?»); las pestañas de siempre salen con «Ver más opciones».
  var pieEl = el("div", { "class": "wcl-pie" }), listoEl = el("div", { "class": "wcl-listo" });
  btnQuitarUlt = el("button", { "type": "button", "class": "wcl-quitar" }, "Quitar");
  btnQuitarUlt.style.display = "none";
  btnQuitarUlt.addEventListener("click", function () { if (!ultimaSitu) return; var id = ultimaSitu; ultimaSitu = null; responder(quitarSituacion(id)); });
  listoEl.appendChild(respuestaEl); listoEl.appendChild(btnQuitarUlt); pieEl.appendChild(listoEl);
  var filaPie = el("div", { "class": "wcl-pie-fila" });
  var btnComoEstaba = el("button", { "type": "button", "class": "wcl-big suave", "id": "wcl-como-estaba" }, "↺ Volver a como estaba");
  btnComoEstaba.addEventListener("click", function () { apagarTodo(); respuestaEl.textContent = T("Todo está como al principio."); pintarSitu(); });
  var btnVerMas = el("button", { "type": "button", "class": "wcl-big suave", "id": "wcl-ver-mas", "aria-expanded": "false" }, "⚙ Ver más opciones");
  btnVerMas.addEventListener("click", function () {
    if (panel.classList.contains("sencillo")) {
      vistaCompleta(true); elegirTab("ver"); q("#wcl-tab-ver").focus();
      decir("Todas las opciones, por pestañas: Ver, Oír, Cara, Clics, Escribir y Más.");
    } else {
      vistaCompleta(false); elegirTab("inicio");
      var p = situEl.querySelector("button"); if (p) p.focus();
    }
  });
  filaPie.appendChild(btnComoEstaba); filaPie.appendChild(btnVerMas); pieEl.appendChild(filaPie);
  panel.appendChild(pieEl);
  function vistaCompleta(si) {
    panel.classList.toggle("sencillo", !si);
    btnVerMas.textContent = T(si ? "← Volver a lo sencillo" : "⚙ Ver más opciones");
    btnVerMas.setAttribute("aria-expanded", si ? "true" : "false");
    try { sessionStorage.setItem("winclus.vista", si ? "completa" : "sencilla"); } catch (e) {}
  }
  var vistaGuardada = ""; try { vistaGuardada = sessionStorage.getItem("winclus.vista") || ""; } catch (e) {}
  vistaCompleta(vistaGuardada === "completa");

  // ==================================== más necesidades: diez en total ==
  // 7) ceguera: lector de pantalla básico · 8) daltonismo: corrección de color ·
  // 9) epilepsia fotosensible y sensibilidad sensorial: modo calma ·
  // 10) discapacidad cognitiva y TDAH: lectura limpia, máscara de enfoque, modo fácil
  var css2 = ''
    + 'html.wcl-calma *,html.wcl-calma *::before,html.wcl-calma *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}'
    + 'html.wcl-dislexia body{letter-spacing:.05em;word-spacing:.16em;line-height:1.8}html.wcl-dislexia body p,html.wcl-dislexia body li{max-width:38em;text-align:left!important}html.wcl-dislexia body p{margin-bottom:2.7em!important}'   // AAA 1.4.8: renglón ≤ 80 caracteres, sin justificar, párrafos a 1,5 veces el interlineado
    // Familia 1 (overlays): tipo de letra, interlineado y alineación sobre toda la página. OpenDyslexic (OFL) se sirve desde winclus.com/fuentes
    + 'html.wcl-letra-legible body,html.wcl-letra-legible body *:not(code):not(pre):not(kbd):not(samp){font-family:Verdana,"Segoe UI",Arial,sans-serif!important}html.wcl-letra-dislexia body,html.wcl-letra-dislexia body *:not(code):not(pre):not(kbd):not(samp){font-family:"OpenDyslexic",Verdana,Arial,sans-serif!important}'
    + 'html.wcl-alinear body p,html.wcl-alinear body li,html.wcl-alinear body td,html.wcl-alinear body th,html.wcl-alinear body dd,html.wcl-alinear body dt,html.wcl-alinear body blockquote,html.wcl-alinear body h1,html.wcl-alinear body h2,html.wcl-alinear body h3,html.wcl-alinear body h4,html.wcl-alinear body figcaption{text-align:left!important}'
    + 'html.wcl-interlineado body,html.wcl-interlineado body *:not(svg):not(canvas){line-height:var(--wcl-lh)!important}'
    // Familia 1: títulos con fondo y borde, foco con marco grueso, cursor de ayuda donde el diccionario responde
    + 'html.wcl-titulos body h1,html.wcl-titulos body h2,html.wcl-titulos body h3,html.wcl-titulos body h4{background:#FFF3C4!important;color:#101F3D!important;border:3px solid #2743B4!important;border-left-width:12px!important;padding:.2em .5em!important;border-radius:6px!important}'
    + 'html.wcl-foco body :focus,html.wcl-foco body :focus-visible{outline:5px solid #2743B4!important;outline-offset:3px!important;box-shadow:0 0 0 9px #FFE45C!important}'
    + 'html.wcl-dicc body p,html.wcl-dicc body li,html.wcl-dicc body h1,html.wcl-dicc body h2,html.wcl-dicc body h3,html.wcl-dicc body td,html.wcl-dicc body dd,html.wcl-dicc body blockquote{cursor:help}'
    + '.wcl-defin{position:fixed;z-index:2147483016;width:340px;max-width:calc(100vw - 24px);box-sizing:border-box;background:#fff;color:#1d1d1d;border:3px solid #2743B4;border-radius:12px;padding:12px 14px;box-shadow:0 8px 30px rgba(0,0,0,.25);font:16px/1.5 "Segoe UI",system-ui,sans-serif;text-align:left}'
    + '.wcl-defin b{display:block;font-size:20px;color:#101F3D}.wcl-defin img{float:right;width:96px;height:96px;margin:0 0 6px 10px;border-radius:8px;background:#fff}.wcl-defin p{margin:6px 0}.wcl-defin small{color:#3F4B66;display:block;clear:both;font-size:13px}'
    + '.wcl-defin .botones{display:flex;gap:6px;margin-top:8px;clear:both}.wcl-defin button{min-height:44px;min-width:44px;padding:0 12px;border-radius:10px;border:0;background:#E8F7F3;color:#101F3D;font:700 15px "Segoe UI",system-ui,sans-serif;cursor:pointer}'
    // Familia 6: sílabas en la lectura limpia, dos colores AAA que se alternan (y un fondo tenue por si no se distinguen)
    + '.wcl-limpia .w.t-nombre{color:#2743B4}.wcl-limpia .w.t-verbo{color:#0A5C54}.wcl-limpia .w.t-adj{color:#8A4B00}.wcl-leyenda-tipos{display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:.8em;font-weight:700;margin:0 0 1em;padding:8px 12px;background:#fff;border-radius:10px;border:1px solid #E3E8F0}.wcl-leyenda-tipos small{font-weight:400;color:#3F4B66}'
    + '.wcl-limpia .facil .pregunta button{min-height:44px;padding:0 12px;border-radius:10px;border:0;background:#101F3D;color:#fff;font:700 15px "Segoe UI",system-ui,sans-serif;cursor:pointer;margin-left:6px}.wcl-limpia .facil .pregunta .resp{color:#0A5C54;border-bottom:3px solid #0A5C54}'
    + '.wcl-limpia .sil.s1{color:#2743B4}.wcl-limpia .sil.s2{color:#1d1d1d;background:#E8F7F3;border-radius:3px}.wcl-limpia .w.act .sil{color:#101F3D;background:none}'
    // AAA 1.4.8: colores de texto y fondo elegidos por la persona, sobre toda la página (el widget vive fuera de <body> y no se ve afectado)
    + 'html.wcl-colores body,html.wcl-colores body *:not(img):not(video):not(svg):not(canvas):not(picture){color:var(--wcl-fg)!important;background-color:var(--wcl-bg)!important;border-color:var(--wcl-fg)!important;background-image:none!important;text-shadow:none!important;box-shadow:none!important}html.wcl-colores body a{text-decoration:underline!important}'
    + 'html.wcl-sinimg body img,html.wcl-sinimg body video,html.wcl-sinimg body iframe,html.wcl-sinimg body picture,html.wcl-sinimg body canvas{opacity:.12!important}'
    + '.wcl-mascara{position:fixed;left:0;right:0;background:rgba(10,14,25,.62);pointer-events:none;z-index:2147482998;display:none}'
    + '.wcl-limpia{position:fixed;inset:0;z-index:2147483014;background:#FBF8F1;color:#1d1d1d;overflow:auto;font:20px/1.9 "Segoe UI",system-ui,sans-serif;letter-spacing:.02em}'
    + '.wcl-limpia-barra{position:sticky;top:0;display:flex;gap:8px;align-items:center;padding:10px 14px;background:#101F3D;color:#fff;z-index:1;flex-wrap:wrap}.wcl-limpia-barra b{flex:1;font-size:16px}'
    + '.wcl-limpia-barra button{min-height:44px;min-width:44px;padding:0 14px;border-radius:10px;border:0;background:#E8F7F3;color:#101F3D;font:700 15px "Segoe UI",system-ui,sans-serif;cursor:pointer}'
    + '.wcl-limpia-texto{max-width:36rem;margin:0 auto;padding:28px 20px 80px}.wcl-limpia-texto h1,.wcl-limpia-texto h2,.wcl-limpia-texto h3,.wcl-limpia-texto h4{line-height:1.3;margin:1.2em 0 .4em;color:#101F3D}.wcl-limpia-texto p{margin:0 0 1em}.wcl-limpia-texto figure{margin:1em 0}.wcl-limpia-texto img{max-width:100%;border-radius:10px}.wcl-limpia-texto figcaption{font-size:.8em;color:#555}'
    + '.wcl-limpia .w.act{background:#F2B705;color:#101F3D;border-radius:3px}.wcl-limpia abbr{text-decoration:underline dotted #0A5C54;text-decoration-thickness:2px;cursor:help}'
    + '.wcl-limpia .facil{background:#E8F7F3;border-left:6px solid #0A5C54;padding:12px 16px;border-radius:0 10px 10px 0}.wcl-limpia .facil h2{font-size:1.15em;margin:1em 0 .4em}.wcl-limpia .facil .nota{font-size:.8em;color:#3F4B66}'
    + '.wcl-guia-caja{margin:4px 0 10px}.wcl-guia-caja label{display:block;font-weight:700;margin-bottom:6px}.wcl-guia-fila{display:flex;gap:6px}.wcl-guia-fila input{flex:1;min-width:0}.wcl-guia-fila .wcl-big{width:auto;min-width:44px;padding:0 14px;margin:0}'
    + '.wcl-facil{display:none;padding:12px 16px 16px}.wcl-facil .wcl-big{min-height:64px;font-size:19px;margin:6px 0}.wcl-panel.facil .wcl-tabs,.wcl-panel.facil .wcl-tab{display:none}.wcl-panel.facil .wcl-facil{display:block}'
    + 'html.wcl-lupap{overflow-x:hidden}html.wcl-lupap body{transition:none!important}'
    // Cursor grande y de alto contraste para el ratón real (baja visión): flecha negra con borde blanco de 48 px
    + 'html.wcl-cursorg,html.wcl-cursorg *,:host(.wcl-cursorg) *{cursor:url("data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M6 4l30 24-13 1 8 14-6 3-8-14-9 10z" fill="#000" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>') + '") 6 4,auto!important}'
    + '.wcl-lector{outline:4px solid #F2B705!important;outline-offset:3px;box-shadow:0 0 0 8px rgba(242,183,5,.25)!important}'
    + '.wcl-busca{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483016;display:none;gap:8px;align-items:center;flex-wrap:wrap;background:#fff;color:#101F3D;border:3px solid #2743B4;border-radius:12px;padding:10px 14px;box-shadow:0 8px 30px rgba(0,0,0,.25);font:16px "Segoe UI",system-ui,sans-serif}.wcl-busca label{font-weight:700}.wcl-busca input{min-height:44px;box-sizing:border-box;font:16px "Segoe UI",system-ui,sans-serif;padding:0 10px;border:2px solid #8892A6;border-radius:10px;min-width:220px;background:#fff;color:#101F3D}.wcl-busca button{min-height:44px;min-width:44px;padding:0 12px;border-radius:10px;border:0;background:#E8F7F3;color:#101F3D;font:700 15px "Segoe UI",system-ui,sans-serif;cursor:pointer}'
    // Barrido: lo marcado ahora (en la página o dentro del widget) y la fila del teclado en curso
    + '.wcl-barrido{outline:5px solid #2743B4!important;outline-offset:3px;box-shadow:0 0 0 9px rgba(47,79,216,.28)!important}'
    + '.wcl-barrido-fila{outline:4px solid #2743B4!important;outline-offset:1px;border-radius:12px}'
    // Familia 5: zona marcada, líneas del punto de barrido, botón «Cualquier punto» y menú de acciones
    + '.wcl-zona{position:fixed;display:none;z-index:2147483005;border:4px dashed #2743B4;border-radius:10px;background:rgba(47,79,216,.10);pointer-events:none;box-sizing:border-box}.wcl-zona span{position:absolute;left:-4px;top:-30px;background:#2743B4;color:#fff;font:700 14px "Segoe UI",system-ui,sans-serif;padding:3px 10px;border-radius:8px 8px 0 0;white-space:nowrap}'
    + '.wcl-punto-h,.wcl-punto-v{position:fixed;display:none;z-index:2147483012;background:#2743B4;box-shadow:0 0 0 2px #fff,0 0 12px rgba(39,67,180,.7);pointer-events:none}.wcl-punto-h{left:0;right:0;height:4px}.wcl-punto-v{top:0;bottom:0;width:4px}'
    + '.wcl-punto-btn{display:none;position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483004;min-height:44px;padding:0 18px;border-radius:22px;border:0;background:#101F3D;color:#fff;font:700 15px "Segoe UI",system-ui,sans-serif;cursor:pointer}.wcl-punto-btn.visible{display:block}'
    + '.wcl-bmenu{position:fixed;z-index:2147483013;display:flex;flex-wrap:wrap;gap:6px;max-width:300px;box-sizing:border-box;background:#fff;border:3px solid #2743B4;border-radius:12px;padding:8px;box-shadow:0 8px 30px rgba(0,0,0,.25)}.wcl-bmenu button{min-height:44px;min-width:44px;padding:0 12px;border-radius:10px;border:0;background:#E8F7F3;color:#101F3D;font:700 15px "Segoe UI",system-ui,sans-serif;cursor:pointer}'
    // Subtítulos de los vídeos de la página: grandes, con fondo y sin transparencias (solo se pueden estilar desde el documento)
    + 'html.wcl-subs video::cue{font-size:1.5em;line-height:1.4;color:#fff;background:rgba(0,0,0,.9)}';
  (document.head || raiz).appendChild(estiloCon(css2)); estilosSombra.push(css2);
  // Filtros de color (daltonización de Fidaner: M = I + E·(I − S), con la simulación de Machado 2009)
  var ES_FIREFOX = !!(window.CSS && CSS.supports && CSS.supports("-moz-appearance", "none")), filtroCuerpo = "";   // Firefox actual ya no expone MozAppearance en style
  var FILTROS = el("svg", { "style": "position:absolute;width:0;height:0", "aria-hidden": "true" },
    '<filter id="wcl-f-protan" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0.479 0.477 0.044 0 0  0.597 -0.689 1.091 0 0  0 0 0 1 0"/></filter>'
    + '<filter id="wcl-f-deutan" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0.163 0.725 0.112 0 0  0.455 -0.645 1.191 0 0  0 0 0 1 0"/></filter>'
    + '<filter id="wcl-f-tritan" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  -0.100 1.123 -0.022 0 0  -0.184 -0.638 1.821 0 0  0 0 0 1 0"/></filter>'
    + '<filter id="wcl-f-gris" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/></filter>');
  var mascaraArriba = el("div", { "class": "wcl-mascara", "aria-hidden": "true" }), mascaraAbajo = el("div", { "class": "wcl-mascara", "aria-hidden": "true" });
  function actualizarMascara(y) {
    if (!ajustes.mascara) return;
    var banda = 70;
    mascaraArriba.style.top = "0"; mascaraArriba.style.height = Math.max(0, y - banda) + "px";
    mascaraAbajo.style.top = (y + banda) + "px"; mascaraAbajo.style.bottom = "0"; mascaraAbajo.style.height = "";
  }
  document.addEventListener("mousemove", function (e) { if (ajustes.mascara && !camaraActiva) actualizarMascara(e.clientY); if (ajustes.lupa_pantalla && !camaraActiva) seguirLupaPantalla(e.clientX, e.clientY); });

  // --- lupa de pantalla (magnificador): toda la página agrandada alrededor del puntero ---
  // Como el punto bajo el puntero siempre es el contenido real, mover el puntero recorre la página
  // como una lupa de mano. Sustituye a un magnificador como MAGic dentro de la página.
  function seguirLupaPantalla(x, y) {
    var b = document.body; if (!b) return;
    b.style.transformOrigin = (x - b.offsetLeft) + "px " + (y + window.scrollY - b.offsetTop) + "px";
  }
  // En táctil no hay mousemove: la lupa sigue al dedo
  document.addEventListener("touchmove", function (e) { if (ajustes.lupa_pantalla && !camaraActiva && e.touches && e.touches[0]) seguirLupaPantalla(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  function aplicarLupaPantalla() {
    var b = document.body; if (!b) return;
    raiz.classList.toggle("wcl-lupap", !!ajustes.lupa_pantalla);
    if (ajustes.lupa_pantalla) { if (lupa) cerrarLupa(); seguirLupaPantalla(P.x, P.y); b.style.transform = "scale(" + ajustes.lupa_pantalla_zoom + ")"; }
    else if (!lupa) { b.style.transform = ""; b.style.transformOrigin = ""; }
  }

  // --- modo calma: nada que parpadee, se mueva solo o suene sin pedirlo -----
  var ultimaInteraccion = 0;
  ["pointerdown", "keydown", "touchstart"].forEach(function (t) { document.addEventListener(t, function () { ultimaInteraccion = performance.now(); }, true); });
  document.addEventListener("play", function (e) {
    if (!ajustes.calma || !e.target || !(e.target instanceof HTMLMediaElement)) return;
    if (performance.now() - ultimaInteraccion > 1500) { try { e.target.pause(); } catch (x) {} }   // reproducción automática, no pedida
  }, true);
  function congelarGifs(si) {
    document.querySelectorAll("body img").forEach(function (im) {
      if (si) {
        if (!/\.gif(\?|#|$)/i.test(im.currentSrc || im.src) || im.dataset.wclGif) return;
        try {
          var c = document.createElement("canvas"); c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height;
          c.getContext("2d").drawImage(im, 0, 0); var quieto = c.toDataURL();
          im.dataset.wclGif = im.src; im.src = quieto;
        } catch (x) {}   // imagen de otro dominio: no se puede copiar, se deja
      } else if (im.dataset.wclGif) { im.src = im.dataset.wclGif; delete im.dataset.wclGif; }
    });
  }
  var calmaPrev = false;
  function aplicarCalma(si) {
    raiz.classList.toggle("wcl-calma", si);
    // Solo al pasar de apagado a encendido: tocar otro interruptor no debe parar el vídeo que la persona está viendo
    if (si && !calmaPrev) document.querySelectorAll("video,audio").forEach(function (m) { try { m.pause(); m.autoplay = false; m.removeAttribute("autoplay"); m.loop = false; } catch (x) {} });
    congelarGifs(si); calmaPrev = !!si;
  }

  // --- lectura limpia: solo el texto de la página, grande y sin distracciones ---
  var limpiaEl = null, limpiaTam = 20;
  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function visibleEl(e) { var r = e.getBoundingClientRect(); if (!r.width && !r.height) return false; var cs = getComputedStyle(e); return cs.visibility !== "hidden" && cs.display !== "none"; }
  function lecturaLimpia() {
    if (limpiaEl) { cerrarLimpia(); return; }
    contar("limpia");
    var m = document.querySelector("main,article,[role=main]") || document.body, partes = [], bloques = [];
    m.querySelectorAll("h1,h2,h3,h4,p,li,blockquote,img,figcaption").forEach(function (e) {
      if (e.closest(".wcl-root,nav,header,footer,aside,[aria-hidden=true]") || !visibleEl(e)) return;
      if (e.tagName === "IMG") { if (e.alt && (e.naturalWidth > 80)) partes.push('<figure><img src="' + esc(e.currentSrc || e.src) + '" alt="' + esc(e.alt) + '"><figcaption>' + esc(e.alt) + '</figcaption></figure>'); return; }
      if (e.querySelector("p,li,h1,h2,h3,h4,blockquote")) return;   // contenedor: sus hijos ya se listan
      var t = (e.innerText || "").replace(/\s+/g, " ").trim(); if (!t) return;
      var tag = e.tagName === "LI" ? "p" : e.tagName.toLowerCase();
      bloques.push({ tag: e.tagName.toLowerCase(), texto: t });
      partes.push("<" + tag + ">" + (e.tagName === "LI" ? "• " : "") + esc(t) + "</" + tag + ">");
    });
    bloquesLimpia = bloques;
    limpiaEl = el("div", { "class": "wcl-limpia", "role": "dialog", "aria-label": "Lectura limpia" },
      '<div class="wcl-limpia-barra"><b>Lectura limpia</b><button type="button" data-a="facil">Explicar en fácil</button><button type="button" data-a="leer">Leer en voz alta</button><button type="button" data-a="callar">Callar</button><button type="button" data-a="silabas" aria-pressed="false">Sílabas</button><button type="button" data-a="tipos" aria-pressed="false">Tipos de palabra</button><button type="button" data-a="menos" aria-label="Texto más pequeño">A−</button><button type="button" data-a="mas" aria-label="Texto más grande">A+</button><button type="button" data-a="cerrar" aria-label="Cerrar la lectura limpia">✕ Cerrar</button></div>'
      + '<div class="wcl-limpia-texto">' + (partes.join("") || "<p>Esta página no tiene texto que mostrar.</p>") + "</div>");
    limpiaEl.style.fontSize = limpiaTam + "px";
    limpiaEl.addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      var a = b.dataset.a;
      if (a === "cerrar") cerrarLimpia();
      else if (a === "leer") leerConResaltado();
      else if (a === "facil") explicarFacil();
      else if (a === "callar") callar();
      else if (a === "silabas") alternarSilabas();
      else if (a === "tipos") alternarTipos();
      else if (a === "resp") { var p = b.parentElement; b.replaceWith(el("b", { "class": "resp" }, esc2(b.dataset.r))); decirVoz(b.dataset.r, true, true); }
      else { limpiaTam = Math.max(16, Math.min(34, limpiaTam + (a === "mas" ? 2 : -2))); limpiaEl.style.fontSize = limpiaTam + "px"; }
    });
    caja.appendChild(limpiaEl); abrir(false);
    try { limpiaEl.querySelector("button").focus(); } catch (x) {}
    refrescos.forEach(function (f) { f(); });
  }
  // --- «Explícame esta página»: lectura fácil (WCAG 3.1.5) ---------------------------------------------
  // Sin servidor: reglas (frases cortas, jerga jurídica y administrativa cambiada por palabras corrientes, glosario
  // al pasar el cursor, lo importante primero). Con data-explicar="URL", se pide a ese servicio (IA) y se muestra.
  var GLOSARIO = [
    ["radicar", "entregar", "Entregar un documento oficialmente"], ["subsanar", "corregir", "Corregir lo que falta o está mal"], ["diligenciar", "rellenar", "Rellenar un formulario"],
    ["adjuntar", "añadir", "Añadir un archivo o documento"], ["acreditar", "demostrar", "Demostrar con un documento"], ["notificar", "avisar", "Avisar oficialmente"],
    ["requerimiento", "aviso", "Aviso oficial que pide algo"], ["trámite", "gestión", "Paso que hay que hacer ante una entidad"], ["solicitud", "petición", "Lo que se pide"],
    ["solicitar", "pedir", "Pedir"], ["efectuar", "hacer", "Hacer"], ["realizar", "hacer", "Hacer"], ["vigencia", "tiempo que vale", "Durante cuánto tiempo vale"],
    ["prorrogar", "alargar el plazo", "Dar más tiempo"], ["prórroga", "más tiempo", "Tiempo extra que se concede"], ["sanción", "multa o castigo", "Castigo por incumplir"],
    ["no obstante", "pero", "Pero"], ["sin embargo", "pero", "Pero"], ["asimismo", "también", "También"], ["por consiguiente", "por eso", "Por eso"],
    ["en virtud de", "por", "Por"], ["conforme a", "según", "Según"], ["de conformidad con", "según", "Según"], ["a la mayor brevedad", "pronto", "Lo antes posible"],
    ["previo a", "antes de", "Antes de"], ["posterior a", "después de", "Después de"], ["con antelación", "antes", "Antes"], ["a través de", "por", "Por medio de"],
    ["en el evento de que", "si", "Si"], ["en caso de que", "si", "Si"], ["siempre y cuando", "solo si", "Solo si"], ["deberá", "tiene que", "Es obligatorio"],
    ["deberán", "tienen que", "Es obligatorio"], ["obligatorio", "que hay que hacer sí o sí", "No se puede saltar"], ["facultativo", "opcional", "Se puede elegir"],
    ["subsidio", "ayuda económica", "Dinero que da el Estado"], ["beneficiario", "quien recibe la ayuda", "La persona que recibe algo"], ["expedir", "entregar", "Hacer y entregar un documento"],
    ["certificado", "documento que demuestra algo", "Papel oficial que demuestra algo"], ["copia auténtica", "copia oficial", "Copia con validez legal"], ["sede electrónica", "página web oficial", "La web de la entidad para hacer gestiones"],
    ["PQRSD", "quejas y peticiones", "Peticiones, quejas, reclamos, sugerencias y denuncias"], ["derecho de petición", "petición formal", "Pedir algo por escrito a una entidad, que debe responder"],
    ["inhabilidad", "prohibición", "Algo que impide participar"], ["persona natural", "persona", "Una persona, no una empresa"], ["persona jurídica", "empresa u organización", "Una empresa, asociación o entidad"]
  ];
  function esc2(t) { return t.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  // Sin «lookbehind» en las expresiones regulares: un literal así rompe el archivo entero en Safari e iOS anteriores a 16.4
  function frasesDe(texto) {
    var t = texto.replace(/\s+/g, " "), out = [], ini = 0, re = /[.!?]\s+(?=[A-ZÁÉÍÓÚÑ¿¡"«(])/g, m;
    while ((m = re.exec(t))) { out.push(t.slice(ini, m.index + 1)); ini = m.index + m[0].length; }
    out.push(t.slice(ini));
    return out.map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function acortar(frase, nivel) {   // una idea por frase: se parte por «;», «:», por « y »/« pero »… y, si sigue larga, por la coma del medio
    nivel = nivel || 0;
    var palabras = frase.split(" ").length;
    if (palabras <= 22 || nivel > 3) return [frase];
    var trozos = frase.split(/;\s+|:\s+(?=[a-záéíóú])/);
    if (trozos.length === 1) trozos = frase.split(/,\s+(?=(?:y|pero|aunque|porque|por lo que|lo cual|el cual|la cual|que|siempre y cuando|en el evento de que|en caso de que|adjuntando|para que)\s)/);
    if (trozos.length === 1 && palabras > 28) {   // por la coma más cercana al medio
      var comas = [], re = /,\s+/g, m; while ((m = re.exec(frase))) comas.push(m.index);
      if (comas.length) { var mitad = frase.length / 2, mejor = comas.reduce(function (a, b) { return Math.abs(b - mitad) < Math.abs(a - mitad) ? b : a; }); trozos = [frase.slice(0, mejor), frase.slice(mejor + 1)]; }
    }
    var salida = [];
    trozos.forEach(function (t) {
      t = t.trim().replace(/^(y|pero|aunque|porque|que|lo cual|el cual|la cual|adjuntando|para que)\s+/i, function (m) { return m.charAt(0).toUpperCase() + m.slice(1); });
      t = t.charAt(0).toUpperCase() + t.slice(1);
      if (!/[.!?]$/.test(t)) t += ".";
      (trozos.length > 1 ? acortar(t, nivel + 1) : [t]).forEach(function (x) { salida.push(x); });
    });
    return salida;
  }
  // Una sola pasada (términos largos primero): así una regla no vuelve a casar dentro del title que puso otra
  var RE_GLOSARIO = new RegExp("\\b(" + GLOSARIO.map(function (g) { return g[0]; }).sort(function (a, b) { return b.length - a.length; }).map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")\\b", "gi");
  function conGlosario(frase) {
    return esc2(frase).replace(RE_GLOSARIO, function (m) {
      var g = null; for (var i = 0; i < GLOSARIO.length; i++) if (GLOSARIO[i][0].toLowerCase() === m.toLowerCase()) { g = GLOSARIO[i]; break; }
      if (!g) return m;
      return '<abbr title="' + esc2(g[0] + ": " + g[2]).replace(/"/g, "&quot;") + '">' + esc2(g[1]) + "</abbr>";
    });
  }
  // Resumen en tres frases: las frases con más palabras «de peso» (las que más se repiten en la página), en su orden
  var VACIAS = /^(que|para|como|pero|esta|este|esto|esa|ese|eso|con|sin|por|del|los|las|una|uno|unos|unas|sus|más|muy|también|cuando|donde|desde|hasta|sobre|entre|ante|bajo|cada|otro|otra|otros|otras|todo|toda|todos|todas|puede|pueden|debe|deben|deberá|deberán|será|serán|hay|han|has|son|está|están|tiene|tienen|hacer|ser|estar|haber|tener|dicho|dicha|mismo|misma|según|así|solo|sólo|donde|cual|cuales|quien|quienes|aquí|allí|ahora|luego|entonces|además|porque|aunque|mientras|través|mediante|durante|cualquier)$/;
  function palabrasPeso(t) { return sinAcentos(t).replace(/[^a-zñ ]/g, " ").split(/\s+/).filter(function (w) { return w.length > 4 && !VACIAS.test(w); }); }
  function resumenTres(bloques) {
    var frases = [];
    bloques.forEach(function (b) { if (b.tag === "p" || b.tag === "li") frasesDe(b.texto).forEach(function (f) { if (f.split(" ").length >= 6) frases.push(f); }); });
    if (frases.length <= 3) return frases;
    var freq = {}; frases.forEach(function (f) { palabrasPeso(f).forEach(function (w) { freq[w] = (freq[w] || 0) + 1; }); });
    var puntuadas = frases.map(function (f, i) { var ps = palabrasPeso(f), p = 0; ps.forEach(function (w) { p += freq[w]; }); return { i: i, f: f, p: ps.length ? p / Math.sqrt(ps.length) : 0 }; });
    return puntuadas.sort(function (a, b) { return b.p - a.p; }).slice(0, 3).sort(function (a, b) { return a.i - b.i; }).map(function (x) { return x.f; });
  }
  // Preguntas de comprobación: una frase importante con su palabra de más peso tapada; «Ver respuesta» la enseña y la dice
  function preguntasComprobacion(bloques, frases) {
    var freq = {}; bloques.forEach(function (b) { palabrasPeso(b.texto).forEach(function (w) { freq[w] = (freq[w] || 0) + 1; }); });
    var out = [], usadas = [];
    frases.forEach(function (f) {
      var mejor = "", mejorP = 0;
      f.split(/\s+/).forEach(function (tok) { var m = RE_NUCLEO.exec(tok); if (!m) return; var w = sinAcentos(m[2]); if (w.length > 5 && !VACIAS.test(w) && usadas.indexOf(w) < 0 && (freq[w] || 0) >= mejorP && /^[a-zñ]+$/.test(w) && !GLOSARIO.some(function (g) { return sinAcentos(g[0]) === w; })) { mejor = m[2]; mejorP = freq[w] || 0; } });   // nunca se tapa (ni se enseña) una palabra de jerga: la respuesta debe ser corriente
      if (!mejor) return; usadas.push(sinAcentos(mejor));
      var hueco = f.replace(new RegExp("(^|[^A-Za-zÁÉÍÓÚÑáéíóúñü])" + mejor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-zÁÉÍÓÚÑáéíóúñü])"), "$1_____");
      out.push('<p class="pregunta">' + T("¿Qué palabra falta?") + " «" + conGlosario(hueco) + '» <button type="button" data-a="resp" data-r="' + esc2(mejor).replace(/"/g, "&quot;") + '">' + T("Ver respuesta") + "</button></p>");
    });
    return out.slice(0, 3);
  }
  function seccionesComprension(bloques) {
    var tres = resumenTres(bloques), html = "";
    if (tres.length) html += "<h2>" + T("En tres frases") + "</h2>" + tres.map(function (f) { return "<p>" + conGlosario(acortar(f)[0]) + "</p>"; }).join("");
    var pq = preguntasComprobacion(bloques, tres);
    if (pq.length) html += "<h2>" + T("Compruebo que lo entendí") + "</h2>" + pq.join("");
    return html;
  }
  function explicarPorReglas(bloques) {   // bloques: [{tag, texto}]
    var titulo = bloques.filter(function (b) { return /^h[12]$/.test(b.tag); }).map(function (b) { return b.texto; })[0] || document.title || "esta página";
    var parrafos = bloques.filter(function (b) { return b.tag === "p" && b.texto.split(" ").length > 6; });
    var importante = [], resto = [];
    parrafos.forEach(function (b, i) { var fs = frasesDe(b.texto); if (fs[0] && i < 6) importante.push(acortar(fs[0])[0]); fs.forEach(function (f) { acortar(f).forEach(function (c) { resto.push(c); }); }); });
    var html = '<div class="facil"><h2>De qué va esta página</h2><p>' + conGlosario(titulo) + "</p>";
    if (importante.length) html += "<h2>Lo más importante</h2><ul>" + importante.map(function (f) { return "<li>" + conGlosario(f) + "</li>"; }).join("") + "</ul>";
    var pasos = bloques.filter(function (b) { return b.tag === "li"; }).map(function (b) { return b.texto; });
    if (pasos.length) html += "<h2>Pasos o lista</h2><ol>" + pasos.slice(0, 12).map(function (p) { return "<li>" + conGlosario(p) + "</li>"; }).join("") + "</ol>";
    html += seccionesComprension(bloques);
    if (resto.length) html += "<h2>Todo el texto, en frases cortas</h2>" + resto.slice(0, 120).map(function (f) { return "<p>" + conGlosario(f) + "</p>"; }).join("");
    html += '<p class="nota">Versión en lenguaje claro hecha por reglas: frases cortas y palabras corrientes. Las palabras subrayadas explican el término original al pasar el cursor. Si algo importa de verdad, confírmalo en el texto original.</p></div>';
    return html;
  }
  var explicando = false, bloquesLimpia = [];
  function explicarFacil() {
    if (!limpiaEl || explicando) return;
    if (limpiaEl.dataset.facil !== "1") contar("facil");
    var cont2 = limpiaEl.querySelector(".wcl-limpia-texto");
    if (limpiaEl.dataset.facil === "1") { cont2.innerHTML = limpiaEl.dataset.original; limpiaEl.dataset.facil = "0"; refrescoLimpia("Texto original"); return; }
    limpiaEl.dataset.original = cont2.innerHTML;
    var texto = bloquesLimpia.map(function (b) { return b.texto; }).join("\n");
    if (opciones.explicar) {
      explicando = true; refrescoLimpia("Pidiendo la explicación…"); cont2.innerHTML = '<div class="facil"><p>Preparando una explicación en lenguaje claro…</p></div>';
      var mio = limpiaEl, ac = window.AbortController ? new AbortController() : null;   // si se cierra la lectura mientras tanto, la respuesta se ignora
      if (ac) setTimeout(function () { ac.abort(); }, 20000);   // sin respuesta en 20 s: reglas
      fetch(opciones.explicar, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: texto.slice(0, 20000), idioma: IDIOMA_PAGINA, titulo: document.title }), signal: ac ? ac.signal : undefined })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) { var t = (j && (j.texto || j.text)) || ""; if (!t) throw new Error("vacío"); if (limpiaEl === mio) cont2.innerHTML = '<div class="facil">' + t.split(/\n{2,}/).map(function (p) { return /^#+\s/.test(p) ? "<h2>" + esc2(p.replace(/^#+\s/, "")) + "</h2>" : "<p>" + conGlosario(p) + "</p>"; }).join("") + seccionesComprension(bloquesLimpia) + '<p class="nota">Explicación generada con inteligencia artificial: puede tener errores. Confirma lo importante en el texto original.</p></div>'; })
        .catch(function () { if (limpiaEl === mio) cont2.innerHTML = explicarPorReglas(bloquesLimpia); })
        .then(function () { explicando = false; if (limpiaEl !== mio) return; mio.dataset.facil = "1"; refrescoLimpia("Texto en fácil"); decirVoz("Listo. Esta es la explicación en lenguaje claro.", true, true); });
    } else {
      cont2.innerHTML = explicarPorReglas(bloquesLimpia); limpiaEl.dataset.facil = "1"; refrescoLimpia("Texto en fácil"); decirVoz("Esta es la página en lenguaje claro.", true, true);
    }
  }
  function refrescoLimpia(estado) { var b = limpiaEl && limpiaEl.querySelector('[data-a="facil"]'); if (b) b.textContent = limpiaEl.dataset.facil === "1" ? "Ver el original" : "Explicar en fácil"; if (estado) avisar(estado); }

  // --- leer con resaltado palabra a palabra (el navegador avisa de cada palabra con el evento boundary) ---
  function envolverPalabras(cont2) {   // cada palabra en un <span class="w">, una sola vez (lectura resaltada, sílabas y diccionario)
    if (!cont2 || cont2.querySelector(".w")) return;
    var tw = document.createTreeWalker(cont2, NodeFilter.SHOW_TEXT), nodos = []; while (tw.nextNode()) nodos.push(tw.currentNode);
    nodos.forEach(function (n) { if (!n.nodeValue.trim() || n.parentElement.closest("button")) return; var f = document.createDocumentFragment(); n.nodeValue.split(/(\s+)/).forEach(function (p) { if (!p) return; if (/^\s+$/.test(p)) f.appendChild(document.createTextNode(p)); else { var s = document.createElement("span"); s.className = "w"; s.textContent = p; f.appendChild(s); } }); n.parentNode.replaceChild(f, n); });
  }
  function leerConResaltado() {
    var cont2 = limpiaEl.querySelector(".wcl-limpia-texto");
    envolverPalabras(cont2);
    var palabras = Array.prototype.slice.call(cont2.querySelectorAll(".w")), texto = palabras.map(function (s) { return s.textContent; }).join(" ").slice(0, 15000);
    var inicios = [], pos = 0; palabras.forEach(function (s) { inicios.push(pos); pos += s.textContent.length + 1; });
    if (!(window.speechSynthesis) || !texto) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(texto); u.lang = IDIOMA_PAGINA; u.rate = Math.pow(1.18, ajustes.voz_velocidad || 0); u.pitch = tonoVoz();
    var actual = null;
    u.onboundary = function (e) {
      if (e.name && e.name !== "word") return;
      var i = 0; while (i + 1 < inicios.length && inicios[i + 1] <= e.charIndex) i++;
      if (actual) actual.classList.remove("act"); actual = palabras[i]; if (actual) { actual.classList.add("act"); actual.scrollIntoView({ block: "center", behavior: "auto" }); }
    };
    u.onend = function () { if (actual) actual.classList.remove("act"); };
    window.speechSynthesis.speak(u);
  }

  // --- sílabas (familia 6): separar y colorear las sílabas del español por reglas -----------------------------
  // Reglas de la RAE: una consonante entre vocales va con la siguiente (ca-sa); dos se reparten (par-te) salvo los
  // grupos bl, br, cl, cr, dr, fl, fr, gl, gr, kl, kr, pl, pr, tr y los dígrafos ch, ll, rr, que no se parten (ha-blar,
  // pe-rro); con tres o más, las dos últimas van juntas solo si forman uno de esos grupos (ins-truc-ción, trans-por-te).
  // Vocales: dos fuertes (a, e, o) o cualquiera con í/ú acentuadas hacen hiato (le-er, pa-ís); débil + fuerte o dos
  // débiles distintas, diptongo (cie-lo, ciu-dad). «tl» se parte (at-le-ta), como en la mayor parte del ámbito hispano.
  function silabear(pal) {
    var p = String(pal).toLowerCase();
    if (!/^[a-záéíóúüñ]+$/.test(p) || p.length < 2) return [String(pal)];
    var V = "aeiouáéíóúü", fuerte = function (c) { return "aeoáéóíú".indexOf(c) >= 0; };
    var nucleos = [], i = 0;
    while (i < p.length) {
      if (V.indexOf(p.charAt(i)) < 0) { i++; continue; }
      var ini = i; i++;
      while (i < p.length && V.indexOf(p.charAt(i)) >= 0) {
        var a = p.charAt(i - 1), b = p.charAt(i);
        if ((fuerte(a) && fuerte(b)) || a === b) { nucleos.push([ini, i]); ini = i; }
        i++;
      }
      nucleos.push([ini, i]);
    }
    if (nucleos.length < 2) return [String(pal)];
    var insep = function (a, b) { return /^[bcdfgkpt]$/.test(a) && /^[lr]$/.test(b) && !(a === "t" && b === "l"); };
    var cortes = [];
    for (var n = 0; n + 1 < nucleos.length; n++) {
      var cIni = nucleos[n][1], cFin = nucleos[n + 1][0], unidades = [], u = cIni;
      while (u < cFin) { var dos = p.slice(u, u + 2); if (u + 1 < cFin && (dos === "ch" || dos === "ll" || dos === "rr")) { unidades.push(dos); u += 2; } else { unidades.push(p.charAt(u)); u++; } }
      var k = unidades.length <= 1 ? 0 : unidades.length === 2 ? (insep(unidades[0], unidades[1]) ? 0 : 1) : (insep(unidades[unidades.length - 2], unidades[unidades.length - 1]) ? unidades.length - 2 : unidades.length - 1);
      var pos = cIni; for (var m = 0; m < k; m++) pos += unidades[m].length;
      cortes.push(pos);
    }
    var out = [], prev = 0; cortes.forEach(function (c) { out.push(String(pal).slice(prev, c)); prev = c; }); out.push(String(pal).slice(prev));
    return out;
  }
  var RE_NUCLEO = /^([^A-Za-zÀ-ɏḀ-ỿ]*)([A-Za-zÀ-ɏḀ-ỿ]+)([^A-Za-zÀ-ɏḀ-ỿ]*)$/;   // signos antes, la palabra, signos después
  function aplicarSilabas(cont2, si) {
    if (!cont2) return;
    envolverPalabras(cont2);
    Array.prototype.forEach.call(cont2.querySelectorAll(".w"), function (w) {
      var t = w.textContent;
      if (!si) { if (w.querySelector(".sil")) w.textContent = t; return; }
      if (w.querySelector(".sil")) return;
      var m = RE_NUCLEO.exec(t), sil = m ? silabear(m[2]) : null;
      if (!sil || sil.length < 2) return;
      w.textContent = "";
      if (m[1]) w.appendChild(document.createTextNode(m[1]));
      sil.forEach(function (s, i) { var e = document.createElement("span"); e.className = "sil " + (i % 2 ? "s2" : "s1"); e.textContent = s; w.appendChild(e); });
      if (m[3]) w.appendChild(document.createTextNode(m[3]));
    });
  }
  // --- tipos de palabra (familia 6): nombres, verbos y cualidades con un color cada uno, por reglas (aproximado)
  var DETERMINANTES = /^(el|la|los|las|un|una|unos|unas|del|al|este|esta|estos|estas|ese|esa|esos|esas|mi|tu|su|mis|tus|sus|nuestro|nuestra|cada|todo|toda|todos|todas|otro|otra|dos|tres|cuatro|cinco)$/;
  var NO_ADJ = /^(al|ante|durante|mediante|bastante|delante|adelante|general|total|final|actual|principal|especial|oficial|legal|digital)$/;
  var FORMAS_VERBO = [];
  for (var vI in IRREG) FORMAS_VERBO = FORMAS_VERBO.concat(IRREG[vI].map(function (f) { return f.replace(/^(me|te|se|nos|les?) /, ""); }));
  function tipoPalabra(anterior, palabra) {
    var w = String(palabra || "").toLowerCase(), a = String(anterior || "").toLowerCase();
    if (!/^[a-záéíóúñü]+$/.test(w) || w.length < 3) return "";
    if (DETERMINANTES.test(a)) return "nombre";
    if (ADJETIVOS.indexOf(w) >= 0) return "adj";
    if (VERBOS.indexOf(w) >= 0 || FORMAS_VERBO.indexOf(w) >= 0) return "verbo";
    if (w.length > 4 && !NO_ADJ.test(w) && /(oso|osa|osos|osas|ivo|iva|ivos|ivas|able|ables|ible|ibles|ante|antes|ente|entes)$/.test(w)) return "adj";
    if (w.length > 4 && /(ar|er|ir|ando|iendo|ado|ados|ido|idos|aron|ieron|aba|aban|ía|ían|ará|arán|erá|erán|irá|irán|aría|arían|ería|erían|iría|irían|emos|imos|amos)$/.test(w) && !/(ar|er|ir)$/.test(w.slice(0, -2)) && !/^(lugar|hogar|mujer|mejor|peor|mayor|menor|ayer|lunes|martes|junio|julio|poder|deber|haber|placer)$/.test(w)) return "verbo";
    if (/^[A-ZÁÉÍÓÚÑ]/.test(String(palabra)) && a && !/[.!?¿¡]$/.test(a)) return "nombre";
    return "";
  }
  function aplicarTipos(cont2, si) {
    if (!cont2) return;
    envolverPalabras(cont2);
    var ley = cont2.querySelector(".wcl-leyenda-tipos"); if (ley) ley.remove();
    var ws = Array.prototype.slice.call(cont2.querySelectorAll(".w")), anterior = "";
    ws.forEach(function (w) {
      w.classList.remove("t-nombre", "t-verbo", "t-adj");
      var m = RE_NUCLEO.exec(w.textContent), nucleo = m ? m[2] : "";
      if (si && nucleo) { var t = tipoPalabra(anterior, nucleo); if (t) w.classList.add("t-" + t); }
      anterior = m ? nucleo + (m[3] || "") : w.textContent;
    });
    if (si) cont2.insertBefore(el("div", { "class": "wcl-leyenda-tipos", "aria-label": "Leyenda de colores" }, '<span class="t-nombre">' + T("Nombres") + '</span><span class="t-verbo">' + T("Acciones") + '</span><span class="t-adj">' + T("Cualidades") + '</span><small>' + T("Por reglas, aproximado") + "</small>"), cont2.firstChild);
  }
  function alternarTipos() {
    if (!limpiaEl) return;
    var si = limpiaEl.dataset.tipos !== "1"; limpiaEl.dataset.tipos = si ? "1" : "0";
    aplicarTipos(limpiaEl.querySelector(".wcl-limpia-texto"), si);
    var b = limpiaEl.querySelector('[data-a="tipos"]'); if (b) b.setAttribute("aria-pressed", si ? "true" : "false");
    avisar(si ? "Nombres en azul, acciones en verde, cualidades en naranja" : "Colores quitados"); if (si) contar("tipos");
  }
  function alternarSilabas() {
    if (!limpiaEl) return;
    var si = limpiaEl.dataset.silabas !== "1"; limpiaEl.dataset.silabas = si ? "1" : "0";
    aplicarSilabas(limpiaEl.querySelector(".wcl-limpia-texto"), si);
    var b = limpiaEl.querySelector('[data-a="silabas"]'); if (b) b.setAttribute("aria-pressed", si ? "true" : "false");
    avisar(si ? "Sílabas con color" : "Sílabas quitadas"); if (si) contar("silabas");
  }

  // --- diccionario al toque (familias 1 y 6): qué significa una palabra, con dibujo ---------------------------
  // Por orden: el glosario del sitio (window.WinclusGlosario = {palabra: definición} o data-glosario="URL" con ese
  // JSON), el glosario de trámites del widget, ARASAAC (pictograma y significado) y Wikcionario. La palabra sale del
  // navegador hacia ARASAAC y Wikcionario solo cuando la persona toca una palabra con el diccionario encendido.
  var diccEl = null, glosarioSitio = null, diccCache = {};
  var ES_LETRA = /[A-Za-zÀ-ɏḀ-ỿ'’-]/;
  function limpiarPalabra(p) { return String(p || "").replace(/^[^A-Za-zÀ-ɏḀ-ỿ]+|[^A-Za-zÀ-ɏḀ-ỿ]+$/g, "").toLowerCase(); }
  function glosarioDelSitio() {
    if (glosarioSitio) return Promise.resolve(glosarioSitio);
    var g = window.WinclusGlosario;
    if (g && typeof g === "object") { glosarioSitio = g; return Promise.resolve(g); }
    if (opciones.glosario && window.fetch) return fetch(opciones.glosario).then(function (r) { return r.json(); }).then(function (j) { glosarioSitio = (j && typeof j === "object") ? j : {}; return glosarioSitio; }).catch(function () { glosarioSitio = {}; return glosarioSitio; });
    glosarioSitio = {}; return Promise.resolve(glosarioSitio);
  }
  function buscarEnGlosario(g, palabra) { var p = sinAcentos(palabra); for (var k in g) if (typeof g[k] === "string" && sinAcentos(String(k)) === p) return g[k]; return ""; }
  function conTiempo(ms) { var ac = window.AbortController ? new AbortController() : null; if (ac) setTimeout(function () { ac.abort(); }, ms); return ac ? ac.signal : undefined; }
  function definirPalabra(palabra) {   // → Promise<{palabra, definicion, imagen, fuente}>
    palabra = limpiarPalabra(palabra);
    if (!palabra) return Promise.resolve(null);
    if (diccCache[palabra]) return Promise.resolve(diccCache[palabra]);
    var res = { palabra: palabra, definicion: "", imagen: "", fuente: "" }, idioma = IDIOMA_PAGINA.split("-")[0].toLowerCase();
    return glosarioDelSitio().then(function (g) {
      var d = buscarEnGlosario(g, palabra); if (d) { res.definicion = d; res.fuente = T("el glosario de este sitio"); return; }
      for (var i = 0; i < GLOSARIO.length; i++) if (sinAcentos(GLOSARIO[i][0]) === sinAcentos(palabra)) { res.definicion = GLOSARIO[i][2] + " (" + GLOSARIO[i][1] + ")"; res.fuente = "Winclus"; return; }
    }).then(function () {
      if (!window.fetch) return;
      return fetch("https://api.arasaac.org/api/pictograms/" + idioma + "/search/" + encodeURIComponent(palabra), { signal: conTiempo(6000) })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (lista) {
          if (!lista || !lista.length) return;
          var mejor = null, kw = null;
          for (var i = 0; i < lista.length && !mejor; i++) { var ks = lista[i].keywords || []; for (var j = 0; j < ks.length; j++) if (sinAcentos(String(ks[j].keyword || "")) === sinAcentos(palabra)) { mejor = lista[i]; kw = ks[j]; break; } }
          if (!mejor) return;   // ARASAAC devuelve también parecidos: sin coincidencia exacta, el dibujo sería de otra cosa
          res.imagen = PICTO_IMG + mejor._id + "/" + mejor._id + "_300.png";
          if (!res.definicion && kw && kw.meaning) { res.definicion = String(kw.meaning); res.fuente = "ARASAAC"; }
        }).catch(function () {});
    }).then(function () {
      if (res.definicion || !window.fetch) return;
      return fetch("https://" + idioma + ".wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&origin=*&titles=" + encodeURIComponent(palabra), { signal: conTiempo(6000) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var pags = j && j.query && j.query.pages, ext = ""; if (!pags) return;
          for (var k in pags) if (pags[k].extract) ext = pags[k].extract;
          // El extracto trae las acepciones numeradas («1 Que tiene…»); se toma la primera y, si no hay, la primera línea larga que no sea un título
          var lineas = ext.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
          var def = lineas.filter(function (l) { return /^\d+\s+\S/.test(l); }).map(function (l) { return l.replace(/^\d+\s+/, ""); })[0] || lineas.filter(function (l) { return l.length > 20 && !/^=/.test(l); })[0] || "";
          if (def) { res.definicion = def.slice(0, 220); res.fuente = T("Wikcionario"); }
        }).catch(function () {});
    }).then(function () { diccCache[palabra] = res; return res; });
  }
  function cerrarDicc() { if (diccEl) { diccEl.remove(); diccEl = null; } }
  function colocarDicc(d, x, y) {
    d.style.left = "0px"; d.style.top = "0px";
    var r = d.getBoundingClientRect(), w = r.width || 340, h = r.height || 120;
    var lx = Math.max(12, Math.min(x - w / 2, window.innerWidth - w - 12)), ly = y + 18;
    if (ly + h > window.innerHeight - 12) ly = Math.max(12, y - h - 18);
    d.style.left = lx + "px"; d.style.top = ly + "px";
  }
  function mostrarDefinicion(palabra, x, y) {
    palabra = limpiarPalabra(palabra); if (!palabra) return;
    cerrarDicc(); contar("diccionario");
    var d = el("div", { "class": "wcl-defin", "role": "dialog", "aria-label": "Diccionario" });
    d.innerHTML = "<b>" + esc2(palabra) + "</b><p>" + T("Buscando qué significa…") + "</p>";
    d.addEventListener("click", function (ev) { var b = ev.target.closest("button"); if (!b) return; if (b.dataset.a === "cerrar") cerrarDicc(); else decirVoz(d.dataset.voz || palabra, true, true); });
    diccEl = d; caja.appendChild(d); colocarDicc(d, x, y);
    definirPalabra(palabra).then(function (r) {
      if (diccEl !== d) return;
      var def = r && r.definicion ? r.definicion : "", html = "";
      if (r && r.imagen) html += '<img src="' + esc(r.imagen) + '" alt="" width="96" height="96">';
      html += "<b>" + esc2(palabra) + "</b><p>" + (def ? esc2(def) : T("No encontré qué significa. Prueba con la palabra en singular o sin terminación.")) + "</p>";
      if (r && (r.fuente || r.imagen)) html += "<small>" + (r.fuente ? T("Fuente: ") + esc2(r.fuente) : "") + (r.imagen ? (r.fuente ? " · " : "") + T("dibujo de ARASAAC") : "") + "</small>";
      html += '<div class="botones"><button type="button" data-a="leer">🔊 ' + T("Léemelo") + '</button><button type="button" data-a="cerrar">✕ ' + T("Cerrar") + "</button></div>";
      d.innerHTML = html; var im = d.querySelector("img"); if (im) im.onerror = function () { im.remove(); };
      d.dataset.voz = palabra + ". " + (def || T("No encontré qué significa."));
      colocarDicc(d, x, y); decirVoz(d.dataset.voz, true, true);
    });
  }
  // La palabra que hay bajo un punto de la pantalla (también dentro de la lectura limpia, que vive en el shadow root)
  function palabraEnPunto(x, y) {
    var nodo = null, off = 0;
    try {
      if (document.caretPositionFromPoint) { var cp = document.caretPositionFromPoint(x, y, { shadowRoots: sombra ? [sombra] : [] }); if (cp) { nodo = cp.offsetNode; off = cp.offset; } }
      else if (document.caretRangeFromPoint) { var r = document.caretRangeFromPoint(x, y); if (r) { nodo = r.startContainer; off = r.startOffset; } }
    } catch (e) {}
    if (nodo && nodo.nodeType === 3) {
      var w = nodo.parentElement && nodo.parentElement.closest && nodo.parentElement.closest(".w");   // con sílabas, el nodo es una sílaba: vale la palabra entera
      if (w) return limpiarPalabra(w.textContent);
      var t = nodo.nodeValue, i = off, j = off;
      while (i > 0 && ES_LETRA.test(t.charAt(i - 1))) i--;
      while (j < t.length && ES_LETRA.test(t.charAt(j))) j++;
      return limpiarPalabra(t.slice(i, j));
    }
    // Navegadores que no entran en el shadow root: en la lectura limpia se envuelve cada palabra y se mira qué hay debajo
    if (limpiaEl) { envolverPalabras(limpiaEl.querySelector(".wcl-limpia-texto")); var s = caja.elementFromPoint ? caja.elementFromPoint(x, y) : null; if (s && s.closest) { s = s.closest(".w"); if (s) return limpiarPalabra(s.textContent); } }
    return "";
  }
  var SEL_NO_DICC = "a,button,input,textarea,select,label,summary,[contenteditable],[role=button],[role=link],[role=tab],[role=menuitem],.wcl-defin";
  function definirEnPunto(x, y, objetivo) {
    if (!ajustes.diccionario) return false;
    var t = objetivo || elementoBajo(x, y); if (!t) return false;
    if (enWidget(t)) { if (!(t.closest && t.closest(".wcl-limpia-texto")) || t.closest(".wcl-defin")) return false; }
    else if (t.closest && t.closest(SEL_NO_DICC)) return false;
    var p = palabraEnPunto(x, y);
    if (!p) { cerrarDicc(); return false; }
    mostrarDefinicion(p, x, y); return true;
  }
  document.addEventListener("click", function (e) {
    if (!ajustes.diccionario || !e.isTrusted) return;   // los clics del puntero facial pasan por pulsar()
    definirEnPunto(e.clientX, e.clientY, (e.composedPath && e.composedPath()[0]) || e.target);
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && diccEl) { e.stopPropagation(); cerrarDicc(); } }, true);

  // --- «¿Dónde estoy?» (WCAG 2.4.8): título, sección actual, ruta de migas y mapa de encabezados ---
  function dondeEstoy() {
    var encs = Array.prototype.filter.call(document.querySelectorAll("h1,h2,h3"), function (h) { return !enWidget(h) && visibleEl(h) && h.innerText.trim(); });
    var actual = null; for (var i = 0; i < encs.length; i++) { if (encs[i].getBoundingClientRect().top <= window.innerHeight * 0.4) actual = encs[i]; else break; }
    var migas = document.querySelector('[aria-label*="miga" i],[aria-label*="breadcrumb" i],.breadcrumb,.breadcrumbs,.migas');
    var partes = ["Estás en: " + (document.title || location.hostname) + "."];
    if (migas && migas.innerText.trim()) partes.push("Ruta: " + migas.innerText.replace(/\s+/g, " ").trim() + ".");
    if (actual) partes.push("Sección: " + actual.innerText.trim() + ".");
    partes.push("La página tiene " + encs.length + " encabezado" + (encs.length === 1 ? "" : "s") + (encs.length ? ": " + encs.slice(0, 8).map(function (h) { return h.innerText.trim(); }).join("; ") + (encs.length > 8 ? "…" : "") : "") + ".");
    var pct = Math.round(100 * (window.scrollY + window.innerHeight) / Math.max(1, document.documentElement.scrollHeight));
    partes.push("Llevas leído el " + Math.min(100, pct) + " % de la página.");
    var t = partes.join(" "); decir(t); avisar("¿Dónde estoy?"); decirVoz(t, true, true, IDIOMA_PAGINA);
    return t;
  }

  function cerrarLimpia() { if (!limpiaEl) return; callar(); cerrarDicc(); limpiaEl.remove(); limpiaEl = null; explicando = false; refrescos.forEach(function (f) { f(); }); }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && limpiaEl) cerrarLimpia(); });

  // --- lector de pantalla dentro de la página (familia 2) ---------
  // Flechas ↓↑ recorren el contenido; h encabezados (1 a 6 por nivel), l enlaces, b botones, f campos, c casillas y
  // opciones, i o g imágenes, d zonas de la página, t tablas, a listas (con Mayús, hacia atrás); ←→ leen por carácter
  // y Ctrl+←→ por palabra; s deletrea; Ctrl+Alt+flechas van por las celdas de una tabla diciendo su cabecera; r lee
  // todo desde aquí con resaltado; Ctrl+F busca texto; Intro activa; Espacio repite; Esc calla o sale del modo
  // formulario; F1 o ? ayuda. Dice rol y estado (marcado, expandido, obligatorio, no válido, no disponible) y lo que
  // cambia en las regiones vivas (aria-live, alertas). Tres niveles de verbosidad; velocidad y tono de la voz.
  // No sustituye a NVDA, JAWS o VoiceOver: si están, se deja apagado (el panel lo dice).
  var lectorEl = null, lectorLista = [], lectorPos = 0, leyendoTodo = false, buscaEl = null, buscaUltima = "", vivasObs = null, vivasUltimo = "", ultimoContenedor = null;
  var SEL_LECTOR = "h1,h2,h3,h4,h5,h6,p,li,dt,dd,td,th,a[href],button,input,select,textarea,summary,label,figcaption,blockquote,img,[role=button],[role=link],[role=checkbox],[role=switch],[role=radio],[role=tab],[role=menuitem]";
  var BLOQUE_TEXTO = /^(P|H[1-6]|LI|DT|DD|TD|TH|BLOCKQUOTE|FIGCAPTION|LABEL)$/;
  var SEL_ZONAS = "header,nav,main,aside,footer,form,section[aria-label],section[aria-labelledby],[role=banner],[role=navigation],[role=main],[role=complementary],[role=contentinfo],[role=search],[role=form],[role=region][aria-label],[role=dialog]";
  var NOMBRE_ZONA = { HEADER: "cabecera", NAV: "menú", MAIN: "contenido principal", ASIDE: "lateral", FOOTER: "pie", FORM: "formulario", SECTION: "sección", banner: "cabecera", navigation: "menú", main: "contenido principal", complementary: "lateral", contentinfo: "pie", search: "búsqueda", form: "formulario", region: "sección", dialog: "diálogo" };
  function bloquesLector(filtro) {
    var lista = [];
    document.querySelectorAll(SEL_LECTOR).forEach(function (e) {
      if (e.closest(".wcl-root") || !visibleEl(e) || e.closest("[aria-hidden=true]")) return;
      if (filtro && !filtro(e)) return;
      if (e.tagName === "IMG" && !e.alt) return;
      if (BLOQUE_TEXTO.test(e.tagName) && !(e.innerText || "").trim()) return;
      if (!filtro) {
        // dentro de un párrafo, los enlaces y botones se leen con el propio párrafo (con «l» y «b» se llega a ellos)
        if ((e.tagName === "A" || e.tagName === "BUTTON" || e.tagName === "LABEL") && e.parentElement && e.parentElement.closest("p,li,td,th,dd,h1,h2,h3,h4,h5,h6,figcaption,blockquote")) return;
        if (BLOQUE_TEXTO.test(e.tagName) && e.querySelector("p,li,h1,h2,h3,h4,h5,h6") && e.tagName !== "LI") return;
        if (e.tagName === "LI" && e.querySelector("li")) return;
        if (e.tagName === "LABEL" && e.querySelector("input,select,textarea")) return;
      }
      lista.push(e);
    });
    return lista;
  }
  function etiquetaCampo(e) {
    var l = e.labels && e.labels[0] ? e.labels[0].innerText : (e.closest("label") ? e.closest("label").innerText : "");
    return (l || e.getAttribute("aria-label") || e.placeholder || e.title || e.name || "").replace(/\s+/g, " ").trim();
  }
  function nivelVerb() { return ajustes.lector_verbosidad === "principiante" || ajustes.lector_verbosidad === "experto" ? ajustes.lector_verbosidad : "normal"; }
  // Estados ARIA y nativos, en palabras; con «principiante» y «normal» también la descripción (aria-describedby)
  function estadoDe(e) {
    var s = [], v = nivelVerb(), exp = e.getAttribute("aria-expanded");
    if (exp === "true") s.push("expandido"); else if (exp === "false") s.push("contraído");
    if (e.getAttribute("aria-pressed") === "true") s.push("pulsado");
    if (e.getAttribute("aria-selected") === "true") s.push("seleccionado");
    var cur = e.getAttribute("aria-current"); if (cur && cur !== "false") s.push("actual");
    if (e.required || e.getAttribute("aria-required") === "true") s.push("obligatorio");
    if (e.getAttribute("aria-invalid") === "true") s.push("no válido");
    if (e.disabled || e.getAttribute("aria-disabled") === "true") s.push("no disponible");
    var d = e.getAttribute("aria-describedby"), desc = "";
    if (d && v !== "experto") { var de = document.getElementById(d.split(" ")[0]); if (de) desc = (de.innerText || "").replace(/\s+/g, " ").trim().slice(0, 160); }
    return (s.length ? ", " + s.join(", ") : "") + (desc ? ". " + desc : "");
  }
  // Según la verbosidad: principiante dice rol, nombre y qué tecla pulsar; normal, rol y nombre; experto, nombre y rol corto
  function conRol(rol, nombre, pista) {
    var v = nivelVerb();
    if (v === "experto") return nombre + ", " + rol.toLowerCase();
    return rol + ": " + nombre + (v === "principiante" && pista ? ". " + pista : "");
  }
  function describir(e) {
    var t = (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim(), n = e.tagName, rol = e.getAttribute("role") || "", est = estadoDe(e);
    if (/^H[1-6]$/.test(n)) return conRol("Encabezado nivel " + n[1], t) + est;
    if (n === "A" || rol === "link") return conRol("Enlace", t || nombreDe(e), "Intro para abrirlo") + est;
    if (n === "BUTTON" || rol === "button") return conRol("Botón", t || nombreDe(e), "Intro para pulsarlo") + est;
    if (rol === "checkbox" || rol === "switch") return conRol(rol === "switch" ? "Interruptor" : "Casilla", (e.getAttribute("aria-checked") === "true" ? (rol === "switch" ? "activado, " : "marcada, ") : (rol === "switch" ? "desactivado, " : "sin marcar, ")) + (t || nombreDe(e)), "Intro para cambiarlo") + est;
    if (rol === "radio") return conRol("Opción", (e.getAttribute("aria-checked") === "true" ? "elegida, " : "no elegida, ") + (t || nombreDe(e)), "Intro para elegirla") + est;
    if (rol === "tab") return conRol("Pestaña", t || nombreDe(e), "Intro para abrirla") + est;
    if (rol === "menuitem") return conRol("Opción de menú", t || nombreDe(e), "Intro para elegirla") + est;
    if (n === "INPUT") {
      var tipo = (e.type || "text").toLowerCase(), et = etiquetaCampo(e);
      if (tipo === "checkbox") return conRol("Casilla", (e.checked ? "marcada, " : "sin marcar, ") + et, "Intro para cambiarla") + est;
      if (tipo === "radio") return conRol("Opción", (e.checked ? "elegida, " : "no elegida, ") + et, "Intro para elegirla") + est;
      if (tipo === "submit" || tipo === "button") return conRol("Botón", e.value || et, "Intro para pulsarlo") + est;
      if (tipo === "password") return conRol("Campo de contraseña", et, "Intro para escribir") + est;
      return conRol("Campo de texto", et + (e.value ? ": " + (esSecreto(e) ? "con datos" : e.value.slice(0, 200)) : ", vacío"), "Intro para escribir") + est;
    }
    if (n === "SELECT") return conRol("Lista desplegable", etiquetaCampo(e) + ": " + (e.options[e.selectedIndex] ? e.options[e.selectedIndex].text : ""), "Flechas para cambiar") + est;
    if (n === "TEXTAREA") return conRol("Área de texto", etiquetaCampo(e) + (e.value ? ": " + e.value.slice(0, 200) : ", vacía"), "Intro para escribir") + est;
    if (n === "IMG") return conRol("Imagen", e.alt);
    if (n === "SUMMARY") return conRol("Desplegable " + (e.parentElement && e.parentElement.open ? "abierto" : "cerrado"), t, "Intro para abrirlo o cerrarlo") + est;
    if (n === "LI") { var lista = e.parentElement, k = lista ? Array.prototype.indexOf.call(lista.children, e) + 1 : 0, tot = lista ? lista.children.length : 0; return (nivelVerb() === "experto" ? t : "Elemento " + k + " de " + tot + ": " + t) + est; }
    if (n === "TD" || n === "TH") return describirCelda(e);
    return t + est;
  }
  // --- tablas: fila, columna y cabeceras de cada celda; Ctrl+Alt+flechas van por las celdas
  function celdaInfo(c) {
    var fila = c.parentElement, tabla = c.closest("table"); if (!fila || !tabla) return null;
    var col = Array.prototype.indexOf.call(fila.children, c), filas = Array.prototype.slice.call(tabla.rows), r = filas.indexOf(fila), cabCol = "", cabFila = "";
    for (var i = 0; i < filas.length; i++) { var th = filas[i].children[col]; if (filas[i] !== fila && th && th.tagName === "TH" && (i === 0 || filas[i].parentElement.tagName === "THEAD")) { cabCol = (th.innerText || "").replace(/\s+/g, " ").trim(); break; } }
    var thFila = fila.querySelector("th"); if (thFila && thFila !== c && c.tagName !== "TH") cabFila = (thFila.innerText || "").replace(/\s+/g, " ").trim();
    return { fila: r + 1, col: col + 1, nFilas: filas.length, nCols: fila.children.length, cabCol: cabCol, cabFila: cabFila, tabla: tabla };
  }
  function describirCelda(c) {
    var i = celdaInfo(c), t = (c.innerText || "").replace(/\s+/g, " ").trim(); if (!i) return "Celda: " + t;
    if (nivelVerb() === "experto") return (i.cabCol ? i.cabCol + ": " : "") + (t || "vacía");
    return (c.tagName === "TH" ? "Cabecera, " : "") + "fila " + i.fila + ", columna " + i.col + (i.cabCol ? ", " + i.cabCol : "") + (i.cabFila ? ", " + i.cabFila : "") + ": " + (t || "vacía");
  }
  function moverCelda(dx, dy) {
    var c = lectorEl && lectorEl.closest && lectorEl.closest("td,th"); if (!c) { anunciar("No estás en una tabla. Pulsa t para ir a una."); return; }
    var i = celdaInfo(c); if (!i) return;
    var f = i.tabla.rows[i.fila - 1 + dy]; if (!f) { anunciar(dy > 0 ? "Última fila." : "Primera fila."); return; }
    var col = i.col - 1 + dx; if (col < 0) { anunciar("Primera columna."); return; } if (col >= f.children.length) { anunciar("Última columna."); return; }
    irLector(f.children[col]);
  }
  function anunciar(texto, sinCortar) { decirVoz(texto, !sinCortar, true, IDIOMA_PAGINA); decir(texto.slice(0, 120)); }
  function irLector(e, texto) {
    if (lectorEl) lectorEl.classList.remove("wcl-lector");
    lectorEl = e; lectorPos = 0; e.classList.add("wcl-lector");
    try { e.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (x) { e.scrollIntoView(); }
    if (e.tabIndex >= 0 || /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(e.tagName)) { try { e.focus({ preventScroll: true }); } catch (x) {} }
    anunciar(texto || describir(e));
  }
  function moverLector(paso, filtro, nombre) {
    var lista = filtro ? bloquesLector(filtro) : (lectorLista = bloquesLector());
    if (!lista.length) { anunciar("No hay " + (nombre || "contenido") + " en esta página."); return; }
    var i = lectorEl ? lista.indexOf(lectorEl) : -1;
    if (i < 0 && lectorEl) {   // el elemento actual no está en esta lista: se busca el siguiente en el orden del documento
      for (var k = 0; k < lista.length; k++) if (lectorEl.compareDocumentPosition(lista[k]) & Node.DOCUMENT_POSITION_FOLLOWING) { i = paso > 0 ? k - 1 : k; break; }
      if (i < 0 && k === lista.length) { if (paso > 0) { anunciar("No hay más " + (nombre || "elementos") + " después de aquí."); return; } i = lista.length; }
    }
    var j = i + paso;
    if (j < 0) { anunciar("Principio de la página. " + describir(lista[0])); irLector(lista[0]); return; }
    if (j >= lista.length) { anunciar("Final de la página."); return; }
    irLector(lista[j]);
  }
  // Zonas, tablas y listas: contenedores; se va al primer bloque legible de cada uno y se anuncia qué es
  function moverEntre(contenedores, paso, nombre, texto) {
    var lista = contenedores.filter(function (c) { return !enWidget(c) && visibleEl(c) && bloquesLector().some(function (b) { return c.contains(b); }); });
    if (!lista.length) { anunciar("No hay " + nombre + " en esta página."); return; }
    var i = -1;
    if (lectorEl) {
      // Si se llegó aquí con esta misma tecla, se sigue desde ese contenedor; si no, el más interior que contenga el elemento (un menú dentro del contenido)
      if (ultimoContenedor && ultimoContenedor.contains(lectorEl) && lista.indexOf(ultimoContenedor) >= 0) i = lista.indexOf(ultimoContenedor);
      else for (var k = 0; k < lista.length; k++) if (lista[k].contains(lectorEl)) i = k;
      if (i < 0) { for (k = 0; k < lista.length; k++) if (lectorEl.compareDocumentPosition(lista[k]) & Node.DOCUMENT_POSITION_FOLLOWING) { i = paso > 0 ? k - 1 : k; break; } if (k === lista.length) i = paso > 0 ? -1 : lista.length; }
    }
    var j = i + paso;
    if (j < 0) { anunciar("Es la primera de las " + nombre + "."); return; }
    if (j >= lista.length) { anunciar("No hay más " + nombre + " después de aquí."); return; }
    var c = lista[j], b = bloquesLector().filter(function (x) { return c.contains(x); })[0];
    ultimoContenedor = c;
    irLector(b || c, texto(c, j + 1, lista.length) + ". " + describir(b || c));
  }
  function nombreZona(z) {
    var n = z.getAttribute("aria-label") || (z.getAttribute("aria-labelledby") && document.getElementById(z.getAttribute("aria-labelledby")) ? document.getElementById(z.getAttribute("aria-labelledby")).innerText : "");
    return (NOMBRE_ZONA[z.getAttribute("role") || ""] || NOMBRE_ZONA[z.tagName] || "zona") + (n ? " " + n.replace(/\s+/g, " ").trim() : "");
  }
  function irZonas(paso) { moverEntre(Array.prototype.slice.call(document.querySelectorAll(SEL_ZONAS)), paso, "zonas", function (z, k, n) { return "Zona " + k + " de " + n + ", " + nombreZona(z) + ", " + bloquesLector().filter(function (b) { return z.contains(b); }).length + " elementos"; }); }
  function irTablas(paso) { moverEntre(Array.prototype.slice.call(document.querySelectorAll("table")), paso, "tablas", function (t, k, n) { var cap = t.caption ? ", " + t.caption.innerText.trim() : (t.getAttribute("aria-label") ? ", " + t.getAttribute("aria-label") : ""); return "Tabla " + k + " de " + n + cap + ", " + t.rows.length + " filas por " + (t.rows[0] ? t.rows[0].children.length : 0) + " columnas. Ctrl más Alt y flechas van por las celdas"; }); }
  function irListas(paso) { moverEntre(Array.prototype.slice.call(document.querySelectorAll("ul,ol,[role=list]")).filter(function (l) { return !l.closest("nav") || true; }), paso, "listas", function (l, k, n) { return "Lista " + k + " de " + n + ", " + l.children.length + " elementos"; }); }
  // --- leer por carácter, por palabra y deletrear, dentro del bloque actual
  var NOMBRES_SIGNOS = { " ": "espacio", ".": "punto", ",": "coma", ";": "punto y coma", ":": "dos puntos", "!": "cierra exclamación", "¡": "abre exclamación", "?": "cierra interrogación", "¿": "abre interrogación", "-": "guion", "_": "guion bajo", "(": "abre paréntesis", ")": "cierra paréntesis", "\"": "comillas", "'": "apóstrofo", "@": "arroba", "#": "almohadilla", "/": "barra", "\\": "barra invertida", "%": "por ciento", "€": "euro", "$": "dólar", "&": "y comercial", "*": "asterisco", "+": "más", "=": "igual", "«": "abre comillas", "»": "cierra comillas", "…": "puntos suspensivos", "·": "punto medio" };
  function nombreCaracter(c) { if (NOMBRES_SIGNOS[c]) return NOMBRES_SIGNOS[c]; if (/[A-ZÁÉÍÓÚÑÜ]/.test(c)) return "mayúscula " + c.toLowerCase(); return c; }
  function textoLector() { if (!lectorEl) return ""; return (esEditable(lectorEl) ? (esSecreto(lectorEl) ? "" : (lectorEl.value || "")) : (lectorEl.innerText || lectorEl.textContent || "")).replace(/\s+/g, " ").trim(); }
  function moverCaracter(paso) { var t = textoLector(); if (!t) { anunciar("Nada que leer aquí."); return; } lectorPos = Math.max(0, Math.min(t.length - 1, lectorPos + paso)); anunciar(nombreCaracter(t.charAt(lectorPos))); }
  function palabrasLector(t) { var re = /\S+/g, ps = [], m; while ((m = re.exec(t))) ps.push([m.index, m.index + m[0].length, m[0]]); return ps; }
  function moverPalabra(paso) {
    var t = textoLector(); if (!t) { anunciar("Nada que leer aquí."); return; }
    var ps = palabrasLector(t), i = -1;
    for (var k = 0; k < ps.length; k++) if (lectorPos >= ps[k][0] && lectorPos < ps[k][1]) { i = k; break; }
    if (i < 0) i = paso > 0 ? -1 : ps.length;
    i = Math.max(0, Math.min(ps.length - 1, i + paso)); lectorPos = ps[i][0]; anunciar(ps[i][2]);
  }
  function deletrear() {
    var t = textoLector(); if (!t) { anunciar("Nada que deletrear."); return; }
    var ps = palabrasLector(t), pal = ps.length ? ps[0][2] : t;
    for (var k = 0; k < ps.length; k++) if (lectorPos >= ps[k][0] && lectorPos < ps[k][1]) { pal = ps[k][2]; break; }
    anunciar(pal + ", " + pal.split("").map(nombreCaracter).join(", "));
  }
  // --- leer todo desde aquí, bloque a bloque, con el resaltado siguiendo la voz
  function leerTodo() {
    var lista = bloquesLector(); if (!lista.length) { anunciar("No hay contenido que leer."); return; }
    var i = lectorEl ? lista.indexOf(lectorEl) : 0; if (i < 0) i = 0;
    callar(); leyendoTodo = true; var gen = vozGen, voces = vocesEs(), v = null;
    if (ajustes.voz_nombre) for (var q = 0; q < voces.length; q++) if (voces[q].name === ajustes.voz_nombre) v = voces[q];
    if (!v && voces.length) v = vozPreferida(voces);
    (function paso(k) {
      if (!leyendoTodo || gen !== vozGen || k >= lista.length || !window.speechSynthesis) { leyendoTodo = false; return; }
      var e = lista[k]; if (lectorEl) lectorEl.classList.remove("wcl-lector"); lectorEl = e; lectorPos = 0; e.classList.add("wcl-lector");
      try { e.scrollIntoView({ block: "center" }); } catch (x) {}
      var u = new SpeechSynthesisUtterance(describir(e).slice(0, 1500)); u.lang = /^es\b/.test(IDIOMA_PAGINA) && v ? v.lang : IDIOMA_PAGINA; if (v && /^es\b/.test(IDIOMA_PAGINA)) u.voice = v;
      u.rate = Math.pow(1.18, isFinite(ajustes.voz_velocidad) ? ajustes.voz_velocidad : 0); u.pitch = tonoVoz();
      u.onend = function () { paso(k + 1); }; u.onerror = function () { if (gen === vozGen) paso(k + 1); };
      window.speechSynthesis.speak(u);
    })(i);
  }
  // --- buscar texto en la página (Ctrl+F propio, dentro del widget)
  function abrirBusqueda() {
    if (!buscaEl) {
      buscaEl = el("div", { "class": "wcl-busca", "role": "dialog", "aria-label": "Buscar en la página" }, '<label for="wcl-busca-q">' + T("Buscar en la página") + '</label><input id="wcl-busca-q" type="search" autocomplete="off"><button type="button" data-a="sig">' + T("Siguiente") + '</button><button type="button" data-a="ant">' + T("Anterior") + '</button><button type="button" data-a="cerrar">✕ ' + T("Cerrar") + "</button>");
      buscaEl.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); buscar(e.shiftKey ? -1 : 1); } else if (e.key === "Escape") { e.stopPropagation(); cerrarBusqueda(); } });
      buscaEl.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; if (b.dataset.a === "sig") buscar(1); else if (b.dataset.a === "ant") buscar(-1); else cerrarBusqueda(); });
      caja.appendChild(buscaEl);
    }
    buscaEl.style.display = "flex"; var q = buscaEl.querySelector("input"); q.value = buscaUltima; q.focus(); q.select();
    anunciar("Buscar en la página. Escribe y pulsa Intro; Escape cierra.");
  }
  function cerrarBusqueda() { if (buscaEl) buscaEl.style.display = "none"; if (lectorEl && lectorEl.focus) { try { lectorEl.focus({ preventScroll: true }); } catch (x) {} } }
  function buscar(paso) {
    var q = buscaEl.querySelector("input").value.trim(); if (!q) { anunciar("Escribe algo que buscar."); return; }
    buscaUltima = q;
    var nq = sinAcentos(q), lista = bloquesLector().filter(function (e) { return sinAcentos(e.innerText || e.textContent || "").indexOf(nq) >= 0; });
    if (!lista.length) { anunciar("No se encuentra " + q + "."); return; }
    var i = lectorEl ? lista.indexOf(lectorEl) : -1, j = ((i < 0 ? (paso > 0 ? -1 : 0) : i) + paso + lista.length) % lista.length;
    irLector(lista[j], "Coincidencia " + (j + 1) + " de " + lista.length + ". " + describir(lista[j]));
    lectorPos = Math.max(0, sinAcentos(textoLector()).indexOf(nq));
  }
  // --- regiones vivas: lo que cambia en aria-live, alertas, estados y registros se dice solo
  function observarVivas(si) {
    if (vivasObs) { vivasObs.disconnect(); vivasObs = null; }
    if (!si || !window.MutationObserver || !document.body) return;
    var pendiente = 0, textos = [], urgente = false;
    vivasObs = new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        var t = m.target.nodeType === 3 ? m.target.parentElement : m.target; if (!t || !t.closest) return;
        var viva = t.closest("[aria-live=polite],[aria-live=assertive],[role=alert],[role=status],[role=log]"); if (!viva || enWidget(viva) || viva.getAttribute("aria-live") === "off") return;
        var texto = (viva.innerText || viva.textContent || "").replace(/\s+/g, " ").trim(); if (!texto || textos.indexOf(texto) >= 0) return;
        textos.push(texto); if (viva.getAttribute("aria-live") === "assertive" || viva.getAttribute("role") === "alert") urgente = true;
      });
      if (!textos.length) return;
      clearTimeout(pendiente);
      pendiente = setTimeout(function () { var t = textos.join(". ").slice(0, 400); textos = []; var u = urgente; urgente = false; if (t !== vivasUltimo || u) { vivasUltimo = t; anunciar((u ? "Aviso: " : "") + t, !u); } }, 250);
    });
    vivasObs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  var FILTROS_LECTOR = {
    h: [function (e) { return /^H[1-6]$/.test(e.tagName); }, "encabezados"],
    l: [function (e) { return e.tagName === "A" || e.getAttribute("role") === "link"; }, "enlaces"],
    b: [function (e) { return e.tagName === "BUTTON" || e.getAttribute("role") === "button" || (e.tagName === "INPUT" && /^(submit|button)$/i.test(e.type)); }, "botones"],
    f: [function (e) { return /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && !/^(submit|button|hidden)$/i.test(e.type || ""); }, "campos de formulario"],
    c: [function (e) { return (e.tagName === "INPUT" && /^(checkbox|radio)$/i.test(e.type)) || /^(checkbox|switch|radio)$/.test(e.getAttribute("role") || ""); }, "casillas ni opciones"],
    i: [function (e) { return e.tagName === "IMG"; }, "imágenes"],
    g: [function (e) { return e.tagName === "IMG"; }, "imágenes"]
  };
  var AYUDA_LECTOR = "Flecha abajo y arriba leen el contenido; izquierda y derecha, letra a letra; con Control, palabra a palabra; s deletrea. h encabezados y 1 a 6 por nivel, l enlaces, b botones, f campos, c casillas, i imágenes, d zonas, t tablas, a listas; con Mayús hacia atrás. Control más Alt y flechas van por las celdas de una tabla. r lee todo desde aquí. Control más F busca. Intro activa lo leído, Espacio lo repite, Escape calla o sale de un campo. Tabulador recorre los enlaces y botones como siempre.";
  function activarLector(si) {
    if (si) {
      var enc = bloquesLector(FILTROS_LECTOR.h[0]).length, enl = bloquesLector(FILTROS_LECTOR.l[0]).length, zon = document.querySelectorAll(SEL_ZONAS).length;
      lectorEl = null; lectorLista = bloquesLector(); observarVivas(true);
      anunciar("Lector de pantalla de Winclus activado. " + (document.title || "Página") + ". " + enc + " encabezados, " + enl + " enlaces" + (zon ? " y " + zon + " zonas" : "") + ". Flecha abajo para leer, h encabezados, l enlaces, d zonas, Intro para activar, F1 para ayuda.");
    } else { if (lectorEl) lectorEl.classList.remove("wcl-lector"); lectorEl = null; leyendoTodo = false; observarVivas(false); cerrarBusqueda(); callar(); }
  }
  document.addEventListener("focusin", function (e) {
    if (!ajustes.lector || !e.target || e.target.closest(".wcl-root") || e.target === lectorEl) return;
    lectorEl = e.target; lectorPos = 0; anunciar(describir(e.target) + (esEditable(e.target) && nivelVerb() !== "experto" ? ". Modo formulario: escribe; Escape vuelve a leer." : ""));
  });
  document.addEventListener("keydown", function (e) {
    if (!ajustes.lector) return;
    var act = document.activeElement, k = e.key, paso = e.shiftKey ? -1 : 1, hecho = true;
    if (act === cont) return;   // el foco está dentro del widget: sus controles se manejan solos
    if (e.ctrlKey && e.altKey && /^Arrow(Up|Down|Left|Right)$/.test(k)) { moverCelda(k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : 0, k === "ArrowDown" ? 1 : k === "ArrowUp" ? -1 : 0); e.preventDefault(); return; }
    if (e.ctrlKey && !e.altKey && !e.shiftKey && (k === "f" || k === "F")) { abrirBusqueda(); e.preventDefault(); return; }
    if (esEditable(act)) {   // modo formulario: el teclado es para el campo; Escape vuelve al modo lectura
      if (k === "Escape") { try { act.blur(); } catch (x) {} anunciar("Modo lectura. Flechas para leer."); e.preventDefault(); }
      else if (k === "F1") { anunciar(AYUDA_LECTOR); e.preventDefault(); }
      return;
    }
    if (e.ctrlKey && !e.altKey && (k === "ArrowRight" || k === "ArrowLeft")) { moverPalabra(k === "ArrowRight" ? 1 : -1); e.preventDefault(); return; }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (leyendoTodo && k !== "r") { leyendoTodo = false; callar(); }
    // Sobre un control real de la página el lector no se queda con las teclas que el control necesita:
    // Espacio e Intro los ejecuta el navegador (botón, casilla, enlace, desplegable) y luego se lee el resultado;
    // listas, opciones, deslizadores, pestañas y menús usan las flechas y las letras por su cuenta.
    var control = act && act !== document.body && act.closest && !act.closest(".wcl-root") && act.closest(SEL_CLICABLE);
    if (control) {
      // Intro también marca casillas y opciones (el navegador solo lo hace con Espacio): una tecla para todo
      if (k === "Enter" && ((act.tagName === "INPUT" && /^(checkbox|radio)$/i.test(act.type)) || /^(checkbox|switch|radio)$/.test(act.getAttribute("role") || ""))) { try { act.click(); } catch (x) {} e.preventDefault(); }
      if (k === " " || k === "Enter") { setTimeout(function () { if (lectorEl) anunciar(describir(lectorEl)); }, 300); return; }
      var rol = act.getAttribute("role") || "";
      if (act.tagName === "SELECT" || (act.tagName === "INPUT" && /^(radio|range|number|date|time|month|week|color)$/i.test(act.type || ""))
          || /^(listbox|option|combobox|slider|spinbutton|tab|menuitem|menuitemradio|menuitemcheckbox|radio|tree|treeitem|grid|gridcell|scrollbar)$/.test(rol)) return;
    }
    var kl = k.length === 1 ? k.toLowerCase() : k;
    if (k === "ArrowDown") moverLector(1); else if (k === "ArrowUp") moverLector(-1);
    else if (k === "ArrowRight") moverCaracter(1); else if (k === "ArrowLeft") moverCaracter(-1);
    else if (k === "Home") { var l0 = bloquesLector(); if (l0.length) irLector(l0[0]); }
    else if (k === "End") { var l1 = bloquesLector(); if (l1.length) irLector(l1[l1.length - 1]); }
    else if (/^[1-6]$/.test(k)) moverLector(paso, function (x) { return x.tagName === "H" + k; }, "encabezados de nivel " + k);
    else if (kl === "d") irZonas(paso); else if (kl === "t") irTablas(paso); else if (kl === "a") irListas(paso);
    else if (kl === "r") leerTodo(); else if (kl === "s") deletrear();
    else if (FILTROS_LECTOR[kl] && k.length === 1) { var f = FILTROS_LECTOR[kl]; moverLector(paso, f[0], f[1]); }
    else if (k === "Enter" && lectorEl && !esEditable(lectorEl)) {
      if (lectorEl.tagName === "SUMMARY") lectorEl.click(); else despachar(lectorEl.closest(SEL_CLICABLE) || lectorEl, ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]);
      setTimeout(function () { if (lectorEl) anunciar(describir(lectorEl)); }, 300);
    }
    else if (k === " " && lectorEl) anunciar(describir(lectorEl));
    else if (k === "Escape") { leyendoTodo = false; callar(); }
    else if (k === "F1" || k === "?") anunciar(AYUDA_LECTOR);
    else hecho = false;
    if (hecho) e.preventDefault();
  }, true);

  // --- asistente guiado: «¿Qué quieres hacer?» (COGA, mayores): con tus palabras, sin buscar en el panel ---------
  var GUIA = [
    // «No veo» (ceguera) va antes que «no veo bien», que no la atrapa
    [/\bno veo\b(?! bien)|\bciego|\bciega|ceguera|invidente/, function () { return ponerSituacion("noveo"); }],
    [/no veo bien|veo poco|letra (muy )?peque|mas grande|agrand|no puedo leer/, function () { return ponerSituacion("veo"); }],
    [/\blupa\b|ampliar|zoom/, function () { ajustes.lupa_pantalla = true; guardar(); aplicarLupaPantalla(); refrescos.forEach(function (f) { f(); }); return "Lupa de pantalla activada: sigue al puntero."; }],
    [/no oigo|oigo poco|sord|hipoacus|subtitul|no escucho/, function () { return ponerSituacion("oir"); }],
    [/no puedo (usar|mover) (el |la )?(raton|mouse|mano|manos)|con la cara|con la cabeza|con los ojos|sin manos|cuadriple|tetraple/, function () { return ponerSituacion("raton"); }],
    [/pulsador|un solo boton|barrido|solo puedo pulsar/, function () { return ponerSituacion("pulsador"); }],
    [/no puedo hablar|no hablo|hablar por mi|pictograma|dibujos|comunicar/, function () { return ponerSituacion("hablar"); }],
    [/escribir|teclado|escribo/, function () { return ponerSituacion("escribir"); }],
    [/no entiendo|explica|facil|sencillo|que dice|resumen|resume/, function () { if (!limpiaEl) lecturaLimpia(); explicarFacil(); return "Te muestro la página en lenguaje claro."; }],
    [/leer|lee|leeme|en voz alta/, function () { lecturaLimpia(); return "Lectura limpia abierta: solo el texto, grande, con botón para leerlo en voz alta."; }],
    [/donde estoy|perdid|en que pagina/, function () { return dondeEstoy(); }],
    [/calma|nervios|me marea|movimiento|destello|parpade[ao]n|epilep|migra/, function () { return ponerSituacion("marea"); }],
    [/colores|daltoni|rojo y verde|no distingo/, function () { return ponerSituacion("colores"); }],
    [/socorro|auxilio|emergencia|llama a alguien|llamar a alguien|pedir ayuda|que venga alguien/, function () { pedirAyuda(); return "Pidiendo ayuda con sonido y en toda la pantalla. Cualquier tecla, clic o gesto lo para."; }],
    [/tiembla|temblor|parkinson|pulso|se me va el raton|se me va el mouse/, function () { ajustes.raton_temblor = true; guardar(); refrescos.forEach(function (f) { f(); }); return "Te ayudo con el ratón: si el clic cae al lado de un botón, pulso el que tenías cerca, y un segundo clic sin querer no cuenta."; }],
    [/contact|llamar|telefono|correo|hablar con alguien|persona|ayuda humana|pqrs|queja|reclamo/, function () { return pulsarPorTexto("contacto") || pulsarPorTexto("contáctenos") || pulsarPorTexto("pqrs") || pulsarPorTexto("atención") ? "Te llevo a la página de contacto." : "No encuentro un enlace de contacto en esta página."; }],
    [/^(quiero |necesito |busco |ir a |abrir |entrar (a|en) |ve a |donde esta |encuentra )?(el |la |los |las |un |una )?(.+)$/, function (m) { var t = m[m.length - 1].replace(/\?$/, "").trim(); return t && pulsarPorTexto(t) ? "Te llevo a «" + t + "»." : ""; }]
  ];
  function asistenteGuiado(texto) {
    var t = sinAcentos((texto || "").trim().replace(/[¿?¡!.]/g, "")), respuesta = "";
    if (!t) return false;
    for (var i = 0; i < GUIA.length && !respuesta; i++) { var m = GUIA[i][0].exec(t); if (m) { try { respuesta = GUIA[i][1](m); } catch (e) { respuesta = ""; } if (respuesta === "" && i < GUIA.length - 1) break; } }
    contar("asistente");
    if (!respuesta) respuesta = "No sé hacer eso todavía. Puedes decirme: no veo bien, no oigo, no puedo usar el ratón, escribir, leer, explica esta página, dónde estoy, calma, contacto, o el nombre de un enlace.";
    if (respuestaEl) respuestaEl.textContent = T(respuesta);   // en el pie del panel queda escrito qué se ha hecho
    pintarSitu();
    avisar(respuesta.slice(0, 60)); decir(respuesta); decirVoz(respuesta, true, true);
    return true;
  }
  function cajaAsistente(sufijo) {
    var id = "wcl-que" + (sufijo || "");
    var w = el("div", { "class": "wcl-guia-caja" }, '<label for="' + id + '">' + T("¿Qué quieres hacer? Dímelo con tus palabras") + '</label>');
    var fila = el("div", { "class": "wcl-guia-fila" });
    var inp = el("input", { "type": "text", "id": id, "class": "wcl-sel", "placeholder": "Por ejemplo: no veo bien, quiero escribir, contacto…", "autocomplete": "off" });
    var ir = el("button", { "type": "button", "class": "wcl-big", "aria-label": "Hacerlo" }, "Ir");
    var mic = el("button", { "type": "button", "class": "wcl-big suave", "aria-label": "Decirlo con la voz" }, "🎤");
    ir.addEventListener("click", function () { asistenteGuiado(inp.value); inp.value = ""; });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); asistenteGuiado(inp.value); inp.value = ""; } });
    mic.addEventListener("click", function () {
      if (!Reconocedor) { avisar("Este navegador no reconoce la voz (usa Chrome o Edge)", true); return; }
      var r = new Reconocedor(); r.lang = IDIOMA_VOZ; r.continuous = false; r.interimResults = false;
      r.onresult = function (e) { var t = e.results[0][0].transcript; inp.value = t; asistenteGuiado(t); inp.value = ""; };
      r.onerror = function () { avisar("No te oí", true); };
      try { r.start(); avisar("Te escucho…"); } catch (e) {}
    });
    fila.appendChild(inp); fila.appendChild(ir); fila.appendChild(mic); w.appendChild(fila);
    return w;
  }
  var facilEl = el("div", { "class": "wcl-facil" });
  facilEl.appendChild(cajaAsistente("-facil"));
  facilEl.appendChild(botonGrande("🔊 Leer la página", "suave", leerPagina));
  facilEl.appendChild(botonGrande("🔇 Callar", "suave", callar));
  facilEl.appendChild(botonGrande("A+ Texto más grande", "suave", function () { ajustes.texto = Math.min(200, ajustes.texto + 10); aplicarTexto(); guardar(); }));
  facilEl.appendChild(botonGrande("◐ Alto contraste", "suave", function () { ajustes.contraste = !ajustes.contraste; guardar(); aplicarTodo(); }));
  facilEl.appendChild(botonGrande("📖 Lectura limpia", "suave", lecturaLimpia));
  facilEl.appendChild(botonGrande("🔍 Lupa de pantalla", "suave", function () { ajustes.lupa_pantalla = !ajustes.lupa_pantalla; guardar(); aplicarLupaPantalla(); refrescos.forEach(function (f) { f(); }); }));
  if (opciones.camara) facilEl.appendChild(botonGrande("📷 Usar con la cara", "", function () { if (!camaraActiva) activarCamara(); else desactivarCamara(); }));
  facilEl.appendChild(botonGrande("Ver todas las opciones", "azul", function () { ajustes.facil = false; guardar(); refrescos.forEach(function (f) { f(); }); }));
  panel.appendChild(facilEl);
  refrescos.push(function () { panel.classList.toggle("facil", !!ajustes.facil); });

  // Mostrar solo los ajustes del modo elegido
  function visibilidad() {
    var modo = ajustes.modo_puntero === "ojos" ? ajustes.ojos_modo : "cabeza", clic = ajustes.modo_clic;
    var gs = panel.querySelectorAll("[data-cuando]");
    for (var i = 0; i < gs.length; i++) {
      var c = gs[i].dataset.cuando.split(" "), ver = c.indexOf("ojos") >= 0 ? ajustes.modo_puntero === "ojos" : (c.indexOf(modo) >= 0 || c.indexOf(clic) >= 0);
      gs[i].style.display = ver ? "" : "none";
    }
  }
  refrescos.push(visibilidad);

  // ------------------------------------------------------- aplicar --
  function aplicarClases() {
    raiz.classList.toggle("wcl-oscuro", ajustes.oscuro); cont.classList.toggle("wcl-osc", ajustes.oscuro);
    raiz.classList.toggle("wcl-cursorg", ajustes.cursor_grande); cont.classList.toggle("wcl-cursorg", ajustes.cursor_grande);
    raiz.classList.toggle("wcl-subs", ajustes.subtitulos); aplicarSubtitulos();
    raiz.classList.toggle("wcl-enlaces", ajustes.enlaces);
    raiz.classList.toggle("wcl-anim", ajustes.animaciones);
    raiz.classList.toggle("wcl-dislexia", ajustes.dislexia);
    aplicarColores();
    raiz.classList.toggle("wcl-letra-legible", ajustes.letra === "legible"); raiz.classList.toggle("wcl-letra-dislexia", ajustes.letra === "dislexia");
    // La @font-face de OpenDyslexic se añade solo cuando se elige: así un sitio con CSP sin font-src para winclus.com no ve ninguna violación si nadie la usa
    if (ajustes.letra === "dislexia" && !document.getElementById("wcl-fuente-dislexia")) {
      var fd = estiloCon('@font-face{font-family:"OpenDyslexic";src:url(https://winclus.com/fuentes/OpenDyslexic-Regular.woff2) format("woff2");font-weight:400;font-style:normal;font-display:swap}@font-face{font-family:"OpenDyslexic";src:url(https://winclus.com/fuentes/OpenDyslexic-Bold.woff2) format("woff2");font-weight:700;font-style:normal;font-display:swap}');
      fd.id = "wcl-fuente-dislexia"; (document.head || raiz).appendChild(fd);
    }
    raiz.classList.toggle("wcl-alinear", !!ajustes.alinear);
    raiz.classList.toggle("wcl-interlineado", ajustes.interlineado !== 100); raiz.style.setProperty("--wcl-lh", String(ajustes.interlineado / 100));
    if (document.body) document.body.style.zoom = ajustes.zoom_pagina === 100 ? "" : String(ajustes.zoom_pagina / 100);
    raiz.classList.toggle("wcl-titulos", !!ajustes.titulos); raiz.classList.toggle("wcl-foco", !!ajustes.foco);
    raiz.classList.toggle("wcl-dicc", !!ajustes.diccionario); if (!ajustes.diccionario) cerrarDicc();
    aplicarSilencio();
    raiz.classList.toggle("wcl-sinimg", ajustes.sinimg);
    guia.style.display = ajustes.guia ? "block" : "none";
    if (!FILTROS.isConnected) raiz.appendChild(FILTROS);   // por si el sitio reconstruyó el documento
    var f = [];
    if (ajustes.contraste) f.push("contrast(1.35) saturate(1.15)");
    if (ajustes.oscuro) f.push("invert(1) hue-rotate(180deg)");
    if (ajustes.calma) f.push("saturate(.7) brightness(.93)");
    var fd = ajustes.dalton && ajustes.dalton !== "no" ? "url(#wcl-f-" + ajustes.dalton + ")" : "";
    // Firefox no aplica un filtro SVG (url(#…)) sobre <html> y, si va en la lista, descarta también los demás; ahí el
    // de daltonismo va sobre <body> (el widget cuelga de <html>, así que no le afecta) y los otros se quedan en <html>
    if (fd && ES_FIREFOX && ajustes.dalton === "gris") { f.push("grayscale(1)"); fd = ""; }   // exacto y sin el problema de <body>
    if (fd && !ES_FIREFOX) f.push(fd);
    raiz.style.filter = f.join(" ");
    if (ES_FIREFOX && document.body && (fd || filtroCuerpo)) {
      // Con el filtro en <body>, lo que el sitio tenga en position:fixed pasa a moverse con la página; se avisa una vez
      if (fd && !filtroCuerpo) avisar("En Firefox la corrección de color se aplica al contenido: si algo fijo de la página se descoloca, usa Chrome o Edge", true);
      document.body.style.filter = fd; filtroCuerpo = fd;
    }
    aplicarCalma(!!ajustes.calma); aplicarLupaPantalla();
    mascaraArriba.style.display = mascaraAbajo.style.display = ajustes.mascara ? "block" : "none";
    if (ajustes.mascara) actualizarMascara(P.y);
  }
  function aplicarTexto() { raiz.style.fontSize = ajustes.texto === 100 ? "" : ajustes.texto + "%"; refrescos.forEach(function (f) { f(); }); }
  var COLORES = { amarillo_negro: ["#FFE45C", "#000000"], negro_crema: ["#101010", "#FFF6DB"], azul_blanco: ["#0B2A6F", "#FFFFFF"] };
  function aplicarColores() {
    var c = ajustes.colores, par = c === "propios" ? [ajustes.color_texto, ajustes.color_fondo] : COLORES[c];
    var ok = par && /^#[0-9a-fA-F]{6}$/.test(par[0]) && /^#[0-9a-fA-F]{6}$/.test(par[1]);
    raiz.classList.toggle("wcl-colores", !!ok);
    if (ok) { raiz.style.setProperty("--wcl-fg", par[0]); raiz.style.setProperty("--wcl-bg", par[1]); } else { raiz.style.removeProperty("--wcl-fg"); raiz.style.removeProperty("--wcl-bg"); }
  }
  function aplicarTodo() { aplicarClases(); raiz.style.fontSize = ajustes.texto === 100 ? "" : ajustes.texto + "%"; refrescos.forEach(function (f) { f(); }); }

  function abrir(si) {
    panel.classList.toggle("abierto", si);
    boton.setAttribute("aria-expanded", si ? "true" : "false");
    if (si) { refrescos.forEach(function (f) { f(); }); if (!camaraActiva) q(".wcl-cab button").focus(); bienvenida(); }
    if (ajustes.barrido) { barridoLista = []; barridoI = -1; barridoMarcar(null, null); }   // lo barrible cambia al abrir o cerrar el panel
  }
  // Primera vez que se abre el panel en este navegador: la voz dice qué hacer y los botones de situación laten.
  // Quien no lee sabe así que Inicio existe. Solo una vez; «Restablecer todo» lo vuelve a permitir.
  function bienvenida() {
    if (leerJSON("winclus.visto", null)) return;
    escribirJSON("winclus.visto", { fecha: new Date().toISOString().slice(0, 10), version: VERSION });
    elegirTab("inicio");
    situEl.classList.add("destacar"); setTimeout(function () { situEl.classList.remove("destacar"); }, 3500);
    decirVoz("Hola, soy Winclus. Toca lo que te cuesta: veo poco, no oigo bien, no puedo usar el ratón, solo puedo pulsar un botón, no puedo hablar, me cuesta leer, me cuesta escribir o la pantalla me marea. O escríbelo con tus palabras. Cada opción del panel lleva una frase que explica qué hace.", true, true);
    avisar("Toca lo que te cuesta");
  }
  boton.addEventListener("click", function () { abrir(!panel.classList.contains("abierto")); });
  q(".wcl-cab button").addEventListener("click", function () { abrir(false); if (!camaraActiva) boton.focus(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("abierto") && !calibrando) { abrir(false); boton.focus(); } });
  document.addEventListener("mousemove", function (e) { if (ajustes.guia && !camaraActiva) guia.style.top = e.clientY + "px"; });
  document.addEventListener("mousemove", function (e) { if (ajustes.puntero_externo && camaraActiva && e.isTrusted) mover(e.clientX, e.clientY); });   // el puntero del sistema manda; la cámara hace los clics
  window.addEventListener("pagehide", function () {
    if (!camaraActiva && !activando) return;
    escribirJSON("winclus.camara_seguir", true);   // también si se sale mientras aún se está encendiendo
    desactivarCamara(true);
  });
  // Quien no tiene manos no puede volver a pulsar «Activar cámara» en cada página: si la dejó encendida en este sitio,
  // la página siguiente la reanuda. Solo con las tres cosas a la vez: consentimiento de Winclus ya dado, permiso del
  // navegador ya concedido (sin preguntar de nuevo) y la cámara encendida al salir. Se dice en pantalla y en voz.
  function reanudarCamara() {
    if (!opciones.camara || !btnActivar || camaraActiva || activando || !ajustes.camara_seguir) return;
    if (!leerJSON("winclus.camara_seguir", false) || !leerJSON("winclus.consentimiento_camara", null)) return;
    if (!navigator.permissions || !navigator.permissions.query) return;   // sin forma de saber si preguntaría: no se arriesga
    navigator.permissions.query({ name: "camera" }).then(function (p) {
      if (p.state !== "granted" || camaraActiva || activando) return;
      reanudada = true;   // al terminar de encenderse, el aviso dice «otra vez» en vez de «Activado»
      activarCamara();
      decirVoz("La cámara se ha vuelto a encender sola porque la dejaste encendida. Para apagarla, pulsa «Apagar cámara» en el panel; para pararla un momento, usa Pausar.");
    }, function () {});   // Firefox no deja consultar el permiso de la cámara: no se reanuda
  }
  window.addEventListener("pageshow", function (e) { if (e.persisted) reanudarCamara(); });   // vuelta atrás desde la caché del navegador
  window.addEventListener("resize", function () { if (tecVisible) dibujarTeclado(); });

  function montar() {
    estilosSombra.forEach(function (t) { caja.appendChild(estiloCon(t)); });
    raiz.appendChild(FILTROS);   // url(#wcl-f-…) solo encuentra ids del documento (no del shadow root); colgado de <html> sobrevive a las SPA que reemplazan <body> (visto en uncorazoncontigo.com)
    caja.appendChild(mascaraArriba); caja.appendChild(mascaraAbajo);
    caja.appendChild(guia); caja.appendChild(boton); caja.appendChild(btnPausa); caja.appendChild(panel);
    caja.appendChild(tecEl); caja.appendChild(menuEl); caja.appendChild(cursor); caja.appendChild(aviso); caja.appendChild(vivo); caja.appendChild(calibEl);
    caja.appendChild(sonidoEl); caja.appendChild(subvivoEl);
    raiz.appendChild(cont);
    var t = "inicio"; try { t = sessionStorage.getItem("winclus.tab") || "inicio"; } catch (e) {}
    elegirTab(tabs[t] ? t : "ver");
    aplicarTodo();
    if (ajustes.lector) setTimeout(function () { activarLector(true); }, 800);
    reanudarCamara();
  }
  if (document.body) montar(); else document.addEventListener("DOMContentLoaded", montar);

  // ============================================= barrido con uno o dos pulsadores ==
  // Recorre en orden lo que se puede accionar y espera la señal (Espacio, Intro, cualquier tecla, clic del ratón o el
  // gesto de clic con la cara). Avanza solo cada cierto tiempo o por pasos con dos pulsadores (uno mueve el marco, otro
  // elige). Con el teclado en pantalla abierto barre por filas y luego por teclas. Familia 5: barrido por zonas (menú,
  // cabecera, contenido, pie y luego sus elementos), punto de barrido (una línea baja, otra cruza: clic en cualquier
  // sitio, para mapas y cosas sin botones), menú de acciones al elegir (clic, clic largo, arrastrar, leer, escribir) y
  // aceleración (el tiempo baja con cada acierto y sube si el marco da una vuelta entera sin que se elija nada).
  var barridoTimer = 0, barridoNivel = "pagina", barridoLista = [], barridoI = -1, barridoFila = null, barridoEl = null, barridoPausa = false;
  var barridoMs = 0, barridoZona = null, barridoVueltas = 0, barridoAcierto = false, bmenuEl = null, puntoEstado = null, arrastreBarrido = null;
  var zonaEl = el("div", { "class": "wcl-zona", "aria-hidden": "true" }, "<span></span>");
  var puntoH = el("div", { "class": "wcl-punto-h", "aria-hidden": "true" }), puntoV = el("div", { "class": "wcl-punto-v", "aria-hidden": "true" });
  var btnPunto = el("button", { "class": "wcl-punto-btn", "type": "button" }, "Cualquier punto");   // objetivo virtual del barrido: arranca el punto de barrido
  btnPunto.addEventListener("click", function () { empezarPunto(null); });
  caja.appendChild(zonaEl); caja.appendChild(puntoH); caja.appendChild(puntoV); caja.appendChild(btnPunto);
  function elementosPagina() {
    var lista = [];
    Array.prototype.forEach.call(document.querySelectorAll(SEL_CLICABLE), function (e) {
      if (lista.length < 400 && !enWidget(e) && visibleEl(e) && !e.disabled && e.tabIndex >= 0) lista.push(e);
    });
    return lista;
  }
  function barridoObjetivosPagina() {
    var lista = [boton];   // el botón del widget va siempre primero: abre y cierra el panel
    if (bmenuEl) { lista = []; bmenuEl.querySelectorAll("button").forEach(function (b) { lista.push(b); }); return lista; }
    if (elegirAbierto()) {   // con la lista abierta se barre solo ella: es una decisión
      lista = []; elegirEl.querySelectorAll("button").forEach(function (b) { lista.push(b); }); return lista;
    }
    if (pictosEl && pictosEl.style.display !== "none") {   // tablero de pictogramas abierto: se barre él
      lista = []; pictosEl.querySelectorAll("button").forEach(function (e) { if (visibleEl(e)) lista.push(e); }); return lista;
    }
    if (panel.classList.contains("abierto")) {
      panel.querySelectorAll("button,select,textarea,input,[role=switch]").forEach(function (e) { if (visibleEl(e) && !e.disabled) lista.push(e); });
    } else {
      if (ajustes.barrido_punto) lista.push(btnPunto);
      lista = lista.concat(elementosPagina());
    }
    return lista;
  }
  // Zonas: las regiones de la página (las más concretas primero, para que un menú dentro de la cabecera sea su propia
  // zona) y lo que queda fuera de todas. Una zona con más de 12 elementos se parte en trozos de 8: menos pasos.
  var ZONAS = [["nav,[role=navigation]", "menú"], ["form,[role=search],[role=dialog]", "formulario"], ["header,[role=banner]", "cabecera"], ["aside,[role=complementary]", "lateral"], ["footer,[role=contentinfo]", "pie"], ["main,[role=main]", "contenido"]];
  function barridoCalcularZonas(lista) {
    var zonas = [], usados = [];
    ZONAS.forEach(function (z) {
      Array.prototype.forEach.call(document.querySelectorAll(z[0]), function (c) {
        var els = lista.filter(function (e) { return usados.indexOf(e) < 0 && c.contains(e); });
        if (els.length) { zonas.push({ nombre: z[1], elementos: els }); els.forEach(function (e) { usados.push(e); }); }
      });
    });
    var resto = lista.filter(function (e) { return usados.indexOf(e) < 0; });
    if (resto.length) zonas.push({ nombre: zonas.length ? "resto" : "página", elementos: resto });
    var out = [];
    zonas.forEach(function (z) {
      if (z.elementos.length <= 12) { out.push(z); return; }
      for (var i = 0; i < z.elementos.length; i += 8) out.push({ nombre: z.nombre + " " + (i / 8 + 1), elementos: z.elementos.slice(i, i + 8) });
    });
    return out;
  }
  function barridoListaZonas() { return [boton].concat(ajustes.barrido_punto ? [btnPunto] : []).concat(barridoCalcularZonas(elementosPagina())); }
  function barridoMarcarZona(z) {
    barridoZona = z || null;
    if (!z) { zonaEl.style.display = "none"; return; }
    barridoMarcar(null, null);
    try { z.elementos[0].scrollIntoView({ block: "center", inline: "nearest" }); } catch (x) {}
    var l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    z.elementos.forEach(function (e) { var q = e.getBoundingClientRect(); l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); });
    zonaEl.style.display = "block"; zonaEl.style.left = (l - 6) + "px"; zonaEl.style.top = Math.max(32, t - 6) + "px"; zonaEl.style.width = (r - l + 12) + "px"; zonaEl.style.height = (b - t + 12) + "px";
    zonaEl.firstChild.textContent = T("Zona: ") + T(z.nombre) + " (" + z.elementos.length + ")";
    if (ajustes.barrido_voz) decirVoz(T("Zona") + " " + T(z.nombre) + ", " + z.elementos.length + " " + T("elementos"), true, false);
  }
  function barridoFilas() { return Array.prototype.filter.call(tecEl.querySelectorAll(".fila"), function (f) { return barridoTeclasDe(f).length > 0; }); }
  function barridoTeclasDe(f) { return Array.prototype.filter.call(f.querySelectorAll("button"), function (b) { return visibleEl(b) && !(b.classList.contains("pred") && !b.textContent); }); }
  function barridoMarcar(e, fila) {
    if (barridoEl) barridoEl.classList.remove("wcl-barrido");
    if (barridoFila && barridoFila !== fila) barridoFila.classList.remove("wcl-barrido-fila");
    barridoEl = e || null; barridoFila = fila || null;
    if (fila) fila.classList.add("wcl-barrido-fila");
    if (e) {
      e.classList.add("wcl-barrido");
      try { e.scrollIntoView({ block: "center", inline: "nearest" }); } catch (x) {}
      if (ajustes.barrido_voz) decirVoz(e === boton ? "Winclus" : nombreDe(e) + ayudaBarrido(e), true, false, enWidget(e) ? null : IDIOMA_PAGINA);
    } else if (fila && ajustes.barrido_voz) {
      var ts = barridoTeclasDe(fila); decirVoz("Fila " + ts[0].textContent + " a " + ts[ts.length - 1].textContent, true, false);
    }
  }
  // Con el barrido, un control del panel se anuncia con su ayuda si hay tiempo de oírla (2 s o más por elemento)
  function ayudaBarrido(e) {
    if (ajustes.barrido_ms < 2000 || !enWidget(e)) return "";
    var d = e.getAttribute("aria-describedby"), a = d && caja.getElementById(d.split(" ")[0]);
    return a && a.classList.contains("wcl-ayuda") ? ". " + a.textContent.trim() : "";
  }
  // --- aceleración: cada acierto baja el tiempo un 8 %, cada vuelta en vano lo sube un 15 %; entre la mitad y el ajuste
  function msBarrido() {
    var ms = +ajustes.barrido_ms; if (!isFinite(ms)) ms = 1200; ms = Math.max(300, ms);
    if (!ajustes.barrido_acelerar) return ms;
    if (!barridoMs) barridoMs = ms;
    return barridoMs;
  }
  function acelerar(factor, texto) {
    if (factor < 1) barridoAcierto = true;   // en esta vuelta se eligió algo: no cuenta como vuelta en vano
    if (!ajustes.barrido_acelerar) return;
    var base = Math.max(300, +ajustes.barrido_ms || 1200), nuevo = Math.round(msBarrido() * factor);
    nuevo = Math.min(base, Math.max(Math.round(base / 2), 300, nuevo));
    if (nuevo === barridoMs) return;
    barridoMs = nuevo; avisar(T(texto) + (nuevo / 1000).toFixed(1) + " s");
    if (ajustes.barrido_modo !== "pasos") barridoReprogramar();
  }
  function barridoPaso() {
    if (!ajustes.barrido || barridoPausa || puntoEstado) return;
    if (tecVisible && !bmenuEl) {
      var filas = barridoFilas();
      if (!filas.length) return;
      if (barridoNivel === "teclas" && barridoFila && barridoFila.isConnected) {
        var ts = barridoTeclasDe(barridoFila); barridoI = (barridoI + 1) % ts.length; barridoMarcar(ts[barridoI], barridoFila);
      } else {
        barridoNivel = "filas"; var i = filas.indexOf(barridoFila); barridoI = (i + 1) % filas.length; barridoMarcar(null, filas[barridoI]);
      }
      return;
    }
    if (barridoNivel === "filas" || barridoNivel === "teclas") { barridoNivel = "pagina"; barridoI = -1; barridoMarcar(null, null); }
    var usarZonas = ajustes.barrido_grupos && !bmenuEl && !panel.classList.contains("abierto") && !(pictosEl && pictosEl.style.display !== "none");
    if (bmenuEl) { if (barridoNivel !== "menu") { barridoNivel = "menu"; barridoLista = []; barridoI = -1; barridoMarcarZona(null); } }
    else if (usarZonas) { if (barridoNivel !== "zonas" && barridoNivel !== "zona") { barridoNivel = "zonas"; barridoLista = []; barridoI = -1; barridoMarcar(null, null); } }
    else if (barridoNivel !== "pagina") { barridoNivel = "pagina"; barridoLista = []; barridoI = -1; barridoMarcarZona(null); barridoMarcar(null, null); }
    // Se saltan los elementos que ya no están o no se ven (panel cerrado, sitio que reemplazó el DOM): nada de barrido fantasma
    var e, intentos = 0;
    do {
      if (barridoI + 1 >= barridoLista.length) {
        if (barridoLista.length) {   // una vuelta entera sin elegir
          if (barridoNivel === "zona" && ++barridoVueltas >= 2) { barridoNivel = "zonas"; barridoLista = []; barridoMarcarZona(null); avisar("Vuelvo a las zonas"); }
          else if (barridoNivel !== "zona" && !barridoAcierto) acelerar(1.15, "Más despacio: ");
          barridoAcierto = false;
        }
        if (barridoNivel === "zonas") barridoLista = barridoListaZonas(); else if (barridoNivel !== "zona") barridoLista = barridoObjetivosPagina();
        barridoI = -1; if (!barridoLista.length || ++intentos > 1) return;
      }
      e = barridoLista[++barridoI];
    } while (!(e === boton || e === btnPunto || (e && e.elementos) || (e && e.isConnected && visibleEl(e) && !e.disabled)));
    if (e && e.elementos) barridoMarcarZona(e); else { barridoMarcarZona(null); barridoMarcar(e, null); }
  }
  function barridoReprogramar() { clearInterval(barridoTimer); if (ajustes.barrido_modo === "pasos") return; barridoTimer = setInterval(barridoPaso, msBarrido()); }
  function barridoAvanzar() {   // con dos pulsadores: la primera señal mueve el marco
    if (!ajustes.barrido || puntoEstado) return;
    if (barridoPausa) { barridoPausa = false; avisar("Barrido en marcha"); }
    barridoPaso();
  }
  function barridoActivar(e) {
    contar("barrido");
    if (e === boton) { abrir(!panel.classList.contains("abierto")); barridoLista = []; barridoI = -1; return; }
    if (enWidget(e)) {
      if (e.tagName === "TEXTAREA") { enfocar(e); objetivoTexto = e; mostrarTeclado(); }
      else { try { e.click(); } catch (x) {} }
      barridoLista = []; barridoI = -1; return;
    }
    if (esEditable(e)) { enfocar(e); objetivoTexto = e; mostrarTeclado(); avisar("Escribir aquí"); return; }
    if (e.tagName === "SELECT") { if (!e.options.length) { avisar("Lista vacía", true); return; } e.selectedIndex = (Math.max(0, e.selectedIndex) + 1) % e.options.length; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); avisar(e.options[e.selectedIndex].text); return; }
    try { e.focus({ preventScroll: true }); } catch (x) {}
    despachar(e, ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]); avisar("Clic");
  }
  function barridoElegir(e) {
    if (bmenuEl) { var obj = bmenuEl.objetivo, a = e.dataset.a; cerrarBmenu(); ejecutarAccion(a, obj); return; }
    if (e === btnPunto) { empezarPunto(null); return; }
    if (ajustes.barrido_menu && !enWidget(e)) { abrirBmenu(e); return; }
    barridoActivar(e);
    if (barridoNivel === "zona") { barridoNivel = "zonas"; barridoLista = []; barridoI = -1; }
  }
  function barridoSenal() {
    if (!ajustes.barrido) return false;
    if (puntoEstado) { puntoFijar(); return true; }
    if (barridoPausa) { barridoPausa = false; avisar("Barrido en marcha"); barridoReprogramar(); return true; }
    if (tecVisible && !bmenuEl) {
      if (barridoNivel === "teclas" && barridoEl) {
        var t = teclaDe(barridoEl); if (t) pulsarTecla(t);
        barridoEl.classList.remove("wcl-barrido"); barridoEl = null; acelerar(0.92, "Más rápido: ");
        barridoNivel = "filas"; barridoI = barridoFilas().indexOf(barridoFila) - 1;   // vuelve a las filas desde la misma
        if (!tecVisible) { barridoNivel = "pagina"; barridoI = -1; barridoMarcar(null, null); }
      } else if (barridoFila) { barridoNivel = "teclas"; barridoI = -1; barridoPaso(); }
    } else if (barridoZona && barridoNivel === "zonas") {
      var z = barridoZona; barridoMarcarZona(null); barridoNivel = "zona"; barridoLista = z.elementos; barridoI = -1; barridoVueltas = 0; acelerar(0.92, "Más rápido: ");
      if (ajustes.barrido_modo !== "pasos") barridoPaso();   // el primer elemento de la zona, sin esperar
    } else if (barridoEl) {
      var e = barridoEl; barridoMarcar(null, null); acelerar(0.92, "Más rápido: "); barridoElegir(e);
    }
    barridoReprogramar();   // tras la señal, un intervalo entero antes de seguir
    return true;
  }
  // --- menú de acciones al elegir: clic, clic largo, arrastrar, leer, escribir (si es un campo), cancelar
  function centroDe(e) { var r = e.getBoundingClientRect(); return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, screenX: r.left + r.width / 2, screenY: r.top + r.height / 2 }; }
  function abrirBmenu(e) {
    cerrarBmenu();
    var acciones = [["clic", "Clic"], ["largo", "Clic largo"], ["arrastrar", "Arrastrar"], ["leer", "Leer"], ["cancelar", "Cancelar"]];
    if (esEditable(e)) acciones.unshift(["escribir", "Escribir"]);
    bmenuEl = el("div", { "class": "wcl-bmenu", "role": "menu", "aria-label": "Acciones" });
    bmenuEl.objetivo = e;
    acciones.forEach(function (a) { var b = el("button", { "type": "button", "role": "menuitem", "data-a": a[0] }, a[1]); b.addEventListener("click", function (ev) { if (!ev.isTrusted) return; cerrarBmenu(); ejecutarAccion(a[0], e); }); bmenuEl.appendChild(b); });
    caja.appendChild(bmenuEl);
    var r = e.getBoundingClientRect(), h = bmenuEl.offsetHeight || 120;
    bmenuEl.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 316)) + "px";
    bmenuEl.style.top = (r.bottom + 8 + h > window.innerHeight ? Math.max(8, r.top - 8 - h) : r.bottom + 8) + "px";
    barridoNivel = "menu"; barridoLista = []; barridoI = -1; barridoMarcarZona(null);
    avisar(T("Qué hacer con ") + nombreDe(e)); if (ajustes.barrido_voz) decirVoz(T("Qué hacer con ") + nombreDe(e), true, false);
    if (ajustes.barrido_modo !== "pasos") barridoPaso();
  }
  function cerrarBmenu() {
    if (bmenuEl) { if (barridoEl && bmenuEl.contains(barridoEl)) barridoMarcar(null, null); bmenuEl.remove(); bmenuEl = null; }
    if (barridoNivel === "menu") { barridoNivel = "pagina"; barridoLista = []; barridoI = -1; }
  }
  function ejecutarAccion(a, e) {
    if (!e || a === "cancelar") { avisar("Cancelado"); return; }
    if (a === "clic" || a === "escribir") { barridoActivar(e); return; }
    contar("barrido");
    if (a === "leer") { leerElemento(e); avisar("Leyendo"); }
    else if (a === "largo") { despachar(e, ["pointerdown", "mousedown"], centroDe(e)); avisar("Clic largo"); setTimeout(function () { var c = centroDe(e); c.buttons = 0; despachar(e, ["pointerup", "mouseup", "click"], c); }, 700); }
    else if (a === "arrastrar") {
      arrastreBarrido = e; despachar(e, ["pointerdown", "mousedown"], centroDe(e)); avisar("Arrastrando: elige dónde soltar", true);
      empezarPunto(function (x, y) {
        var d = elementoBajo(x, y) || e, c = { clientX: x, clientY: y, screenX: x, screenY: y };
        despachar(d, ["pointermove", "mousemove"], c); c.buttons = 0; despachar(d, ["pointerup", "mouseup"], c);
        if (d !== e) despachar(e, ["pointerup", "mouseup"], { buttons: 0 });
        arrastreBarrido = null; avisar("Soltado");
      });
    }
  }
  // --- punto de barrido: una línea baja por la pantalla (la señal la para), otra cruza de izquierda a derecha (la señal
  // la para) y ahí se hace clic. Sirve para mapas, lienzos y cualquier cosa sin botones. Va y vuelve hasta que se fija.
  function empezarPunto(alFijar) {
    puntoEstado = { fase: "y", pos: 0, dir: 1, x: 0, y: 0, alFijar: alFijar, t: 0 };
    barridoMarcar(null, null); barridoMarcarZona(null); clearInterval(barridoTimer);
    puntoH.style.display = "block"; puntoH.style.top = "0px"; puntoV.style.display = "none";
    avisar("Da la señal cuando la línea esté a la altura"); if (ajustes.barrido_voz) decirVoz("Punto de barrido. Da la señal cuando la línea baje hasta donde quieres; después otra vez cuando cruce.", true, false);
    requestAnimationFrame(puntoAnimar);
  }
  function puntoAnimar(t) {
    var p = puntoEstado; if (!p) return;
    if (p.t) {
      var total = Math.max(1500, msBarrido() * 2.5), largo = p.fase === "y" ? window.innerHeight : window.innerWidth;   // ms para recorrer la pantalla entera
      p.pos += p.dir * largo * Math.min(100, t - p.t) / total;
      if (p.pos >= largo) { p.pos = largo; p.dir = -1; } else if (p.pos <= 0) { p.pos = 0; p.dir = 1; }
      if (p.fase === "y") puntoH.style.top = p.pos + "px"; else puntoV.style.left = p.pos + "px";
    }
    p.t = t;
    requestAnimationFrame(puntoAnimar);
  }
  function puntoFijar() {
    var p = puntoEstado; if (!p) return;
    if (p.fase === "y") { p.y = p.pos; p.fase = "x"; p.pos = 0; p.dir = 1; puntoV.style.display = "block"; puntoV.style.left = "0px"; avisar("Ahora, cuando cruce"); return; }
    p.x = p.pos; puntoEstado = null; puntoH.style.display = puntoV.style.display = "none";
    var x = Math.round(p.x), y = Math.round(p.y);
    barridoReprogramar();
    if (p.alFijar) { p.alFijar(x, y); return; }
    var e = elementoBajo(x, y); if (!e) return;
    if (enWidget(e)) { var b = e.closest("button,a"); if (b) b.click(); return; }
    contar("barrido");
    var inter = e.closest(SEL_CLICABLE);
    if (inter && esEditable(inter)) { enfocar(inter); objetivoTexto = inter; mostrarTeclado(); avisar("Escribir aquí"); return; }
    despachar(inter || e, ["pointerdown", "mousedown", "pointerup", "mouseup", "click"], { clientX: x, clientY: y, screenX: x, screenY: y }); avisar("Clic");
  }
  function cancelarPunto() {
    if (!puntoEstado) return;
    puntoEstado = null; puntoH.style.display = puntoV.style.display = "none";
    if (arrastreBarrido) { despachar(arrastreBarrido, ["pointerup", "mouseup"], { buttons: 0 }); arrastreBarrido = null; }
    avisar("Cancelado"); barridoReprogramar();
  }
  function aplicarBarrido() {
    clearInterval(barridoTimer); cancelarPunto(); cerrarBmenu(); barridoMarcarZona(null); barridoMarcar(null, null);
    barridoNivel = "pagina"; barridoLista = []; barridoI = -1; barridoPausa = false; barridoMs = 0;
    btnPunto.classList.toggle("visible", !!(ajustes.barrido && ajustes.barrido_punto));
    if (ajustes.barrido) {
      barridoReprogramar(); avisar("Barrido activado");
      decirVoz(ajustes.barrido_modo === "pasos" ? "Barrido con dos pulsadores activado. Una señal mueve el marco azul y la otra elige." : "Barrido activado. Da la señal cuando el marco azul esté en lo que quieres. Escape lo pausa.", true, true);
    }
  }
  function esSenalTecla(e) {
    var s = ajustes.barrido_senal;
    if (s === "espacio") return e.key === " ";
    if (s === "intro") return e.key === "Enter";
    if (s === "cualquiera") return !/^(Shift|Control|Alt|Meta|Tab|CapsLock|F\d+)$/.test(e.key);
    return false;
  }
  function esSenal2Tecla(e) {
    var s = ajustes.barrido_senal2;
    if (s === "intro") return e.key === "Enter";
    if (s === "espacio") return e.key === " ";
    if (s === "flecha") return e.key === "ArrowRight" || e.key === "ArrowDown";
    return false;
  }
  document.addEventListener("keydown", function (e) {
    if (!ajustes.barrido || !e.isTrusted) return;
    if (e.key === "Escape") {
      if (puntoEstado) cancelarPunto();
      else if (bmenuEl) { cerrarBmenu(); avisar("Cancelado"); }
      else { barridoPausa = !barridoPausa; avisar(barridoPausa ? "Barrido en pausa" : "Barrido en marcha"); if (!barridoPausa) barridoReprogramar(); }
      e.preventDefault(); e.stopPropagation(); return;
    }
    var pasos = ajustes.barrido_modo === "pasos";
    if (pasos && esSenal2Tecla(e)) { e.preventDefault(); e.stopPropagation(); barridoSenal(); return; }
    if (esSenalTecla(e)) { e.preventDefault(); e.stopPropagation(); if (pasos) barridoAvanzar(); else barridoSenal(); }
  }, true);
  ["mousedown", "click"].forEach(function (tipo) {
    document.addEventListener(tipo, function (e) {
      if (!ajustes.barrido || !e.isTrusted) return;
      var pasos = ajustes.barrido_modo === "pasos", raton1 = ajustes.barrido_senal === "raton", raton2 = pasos && ajustes.barrido_senal2 === "raton";
      if (!raton1 && !raton2) return;
      if (enWidget(e.composedPath ? e.composedPath()[0] : e.target) && panel.classList.contains("abierto")) return;   // un acompañante con ratón puede seguir usando el panel
      e.preventDefault(); e.stopPropagation();
      if (tipo === "click") { if (raton2) barridoSenal(); else if (pasos) barridoAvanzar(); else barridoSenal(); }
    }, true);
  });
  function barridoEstado() { return { nivel: barridoNivel, ms: msBarrido(), menu: !!bmenuEl, zona: barridoZona ? barridoZona.nombre : null, punto: puntoEstado ? { fase: puntoEstado.fase, pos: puntoEstado.pos } : null, pausa: barridoPausa }; }
  if (ajustes.barrido) setTimeout(aplicarBarrido, 800);
  // Perfil que viene en el enlace (#winclus=…): se importa y se quita del enlace
  function perfilDesdeEnlace() {
    tableroDesdeEnlace();
    var perfilEnlace = perfilDeEnlace();
    if (perfilEnlace === null) return;
    try { if (!perfilEnlace) throw new Error("roto"); importarPerfil(perfilEnlace); decirVoz("Tu configuración de Winclus se ha cargado desde el enlace.", true, true); }
    catch (e) { setTimeout(function () { avisar("El enlace no traía un perfil válido", true); }, 100); }
    try { var hq = (location.hash || "").replace(/[#&]winclus=[A-Za-z0-9_-]+/, ""); history.replaceState(null, "", location.pathname + location.search + (hq.length > 1 ? hq : "")); } catch (e) {}
  }
  perfilDesdeEnlace();
  window.addEventListener("hashchange", perfilDesdeEnlace);   // también si el enlace con perfil se abre estando ya en la página (SPA, enlace interno)

  window.Winclus = {
    version: VERSION, ajustes: ajustes,
    abrir: function () { abrir(true); }, cerrar: function () { abrir(false); },
    vistaCompleta: function (si) { vistaCompleta(si !== false); },
    nivelAmplificado: nivelAmplificado,   // nivel de salida (0 a 1) de un medio amplificado, para las pruebas
    pedirAyuda: pedirAyuda, pararAyuda: pararAyuda,   // aviso de ayuda a quien esté cerca
    hablarPersona: hablarPersona, grabaciones: function () { return Object.keys(grabaciones).map(function (k) { return grabaciones[k].texto; }); },   // frases con la voz de la persona   // las pestañas a la vista (true) o solo «¿Qué te cuesta?» (false)
    activarCamara: function () { if (!camaraActiva) activarCamara(); }, desactivarCamara: function () { if (camaraActiva) desactivarCamara(); },
    pausar: pausar, teclado: alternarTeclado, menu: function () { if (camaraActiva) abrirMenu(); }, menuCerrar: cerrarMenu, leer: leerPagina, decir: function (t) { decirVoz(t, true, true); }, orden: ejecutarOrden,
    // Para pruebas e integraciones: llevar el puntero virtual a un punto y hacer el gesto de clic
    mover: function (x, y) { cursor.style.display = "block"; mover(x, y); }, clic: clic, puntero: P,
    cargarDetector: cargarDetector, deteccion: det, parpadeo: parpadeo, ayudaBarrido: ayudaBarrido, textoSeccion: textoSeccion,
    definir: definirPalabra, silabear: silabear,   // diccionario al toque y silabeo por reglas (familias 1 y 6)
    avanzar: barridoAvanzar, barridoEstado: barridoEstado,   // barrido por pasos y su estado (familia 5)
    pulir: pulirFrase, tableros: function () { return tableros; },   // frases bien dichas y tableros propios (familia 4)
    describir: describir, lectorActual: function () { return lectorEl; },   // lector de pantalla (familia 2)
    valorGesto: valorGesto, tipoPalabra: tipoPalabra, resumen: resumenTres,   // gestos nuevos (familia 3) y comprensión (familia 6)
    ajustarModelo: ajustarModelo, ajustarCabeza: ajustarCabeza, predecir: predecir, rejilla: rejillaCalibracion,   // calibración ocular (familia 3, para pruebas)
    tickBordes: tickBordes, bordePx: bordePx,   // bajar y subir por los bordes (para pruebas)
    tickGestos: tickGestos,   // gestos de la cara (para pruebas)
    // Elegir con los ojos (para pruebas): qué hay cerca, la lista propia y
    // simular que la cámara está en marcha (NO la enciende: solo el estado).
    candidatosCerca: candidatosCerca, elegirEnSelect: elegirEnSelect,
    estirarAlcance: estirarAlcance, tickAyudaClic: tickAyudaClic,
    elegirAbierto: elegirAbierto, cerrarElegir: cerrarElegir,
    simularCamara: function (v) { camaraActiva = !!v; reiniciarAyudaClic(); },
    caja: caja   // el shadow root con las piezas del widget (para pruebas e integraciones)
  };
})();
