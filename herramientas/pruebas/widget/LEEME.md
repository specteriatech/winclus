# Pruebas del widget web sin cámara

- `node prueba_parpadeo.js`: extrae el detector de parpadeo de web/widget.js y lo pasa por las series reales de cierres del usuario (series.json, sacadas del log de la app) y por cierres sintéticos. Antes hay que generar `parpadeo_extraido.js` con las líneas del objeto `parpadeo` (desde `var OJO_DER` hasta antes de `// --- mirada por iris`): `sed -n '/var OJO_DER/,/--- mirada por iris/p' ../../../web/widget.js | head -n -1 > parpadeo_extraido.js`.
- `node servidor.js` y abrir http://127.0.0.1:8765/pruebas/camara-falsa.html: la página entrega un lienzo con una foto (web/img/quien_1.jpg) como si fuera la webcam. Desde la consola: `sim.dx`/`sim.dy` mueven la cabeza, `sim.parpadeo = true` tapa los ojos (hay que poner antes `sim.ojos` con las elipses sobre los ojos, ver el historial de la sesión del 15-sep-2026), `sim.zoom = 0.05` hace desaparecer la cara. El primer «Activar cámara» necesita un clic real (política de autoplay); después vale `Winclus.activarCamara()`.
- `node prueba_posicion.js`: abre `pagina-prueba.html` (sitio con cabecera fija y el widget) en Chromium
  sin ventana con cada ajuste guardado en localStorage (oscuro, contraste, calma, daltonismo, texto 200 %,
  lupa de pantalla, todo a la vez…) y comprueba que el botón y el panel siguen dentro de la pantalla, que la
  cabecera fija del sitio no se mueve y que no hay scroll horizontal; también pulsa el interruptor de modo
  oscuro y recarga. Necesita una vez `npm i` y `npx playwright install chromium` en esta carpeta.
  Nació del fallo crítico de la auditoría del 16-sep-2026: un `filter` sobre `.wcl-root` (0×0) sacaba el
  widget de la pantalla en modo oscuro y el ajuste quedaba guardado.
- `node prueba_axe.js`: pasa axe-core (WCAG 2.1/2.2 AA y buenas prácticas) sobre el propio widget: cada
  pestaña del panel, el teclado, la capa Frases y el modo fácil; y calcula a mano el contraste de lo que axe
  no mira (interruptores, bordes, foco, botón Pausar, teclas). Sale 1 si hay algo incumplido.
- `node prueba_teclado_fisico.js`: con Tab se llega a las teclas y a las frases, Intro y Espacio las pulsan y
  el foco se queda en la tecla (también tras Mayús, que redibuja el teclado); con el lector básico activo,
  Espacio e Intro siguen activando botones y casillas reales, las flechas siguen siendo del desplegable
  enfocado, y sin control enfocado mueven el lector.
- `node prueba_aria.js`: pestañas con el patrón Tabs (flechas, una tabulable, aria-controls), −/+ con etiqueta y
  valor descrito, región live oculta para los avisos, estado de cámara sin repeticiones, calibración modal.
- `node prueba_privacidad.js`: consentimiento antes de la primera cámara (sin tocarla hasta aceptar), avisos de
  que la voz va a Google/Microsoft, «Acerca de» honesto, «Restablecer todo» borra el consentimiento.
- `node prueba_rendimiento.js`: con servidor.js y la cámara simulada, la inferencia va a la tasa de la cámara
  (no del refresco de pantalla) y en modo ahorro a ~15/s. Tarda medio minuto: carga MediaPipe de web/mediapipe.
- `node prueba_landing.js`: axe sobre la portada, privacidad y accesibilidad a 1280 y 390 px; cargan el widget.
- `node prueba_aislamiento.js`: `pagina-hostil.html` (button{all:unset}, fuentes gigantes, CSP estricta con nonce):
  el widget conserva su aspecto en el shadow root, sus <style> llevan el nonce y no hay violaciones de CSP.
- `node prueba_daltonismo.js`: los filtros son SVGFilterElement de verdad y cada uno cambia los píxeles (antes del
  16-sep-2026 el <svg> nacía con createElement y nunca habían filtrado nada).
- `node prueba_sistema.js`: prefers-reduced-motion y prefers-contrast activan calma, sin animaciones y contraste
  (salvo que la persona los haya cambiado), la página en inglés se lee con voz en inglés, cursor grande.
- `node prueba_barrido.js`: barrido con un solo pulsador: recorre botón del widget, enlace, botón y campo; Espacio
  activa lo marcado; un campo abre el teclado; filas y luego teclas; Escape pausa; Winclus.clic() hace de señal.
- `node prueba_auditiva.js`: `pagina-medios.html`: aviso visual cuando suena un audio (también `new Audio`), pista de
  subtítulos del idioma de la página mostrada y regla ::cue, subtítulos en vivo con reconocedor simulado, botones
  al Centro de Relevo y al diccionario LSC del INSOR.
- `node prueba_voz.js`: «números» numera enlaces, botones y campos; «clic 2», «escribe en cinco»; dictado con
  confirmación («sí», «no», botón) con reconocedor simulado (`window.__reconocer`).
- `node prueba_formularios.js`: `pagina-formulario.html`: «Campo 2 de 4: Correo, obligatorio», errores de envío y
  aria-invalid en lenguaje claro, pegar aunque el sitio lo bloquee.
- `node prueba_perfil_enlace.js`: «Copiar enlace con mi perfil» (#winclus=…), importación en un navegador limpio,
  enlace roto sin romper nada.
- `node prueba_pictogramas.js`: tablero ARASAAC: categorías, frase con voz, predicción por defecto y aprendida,
  guardar frase (pasa a las frases del teclado), barrido dentro del tablero. Las imágenes vienen de
  static.arasaac.org (no se comprueba que carguen).
- `node prueba_facil.js`: `pagina-tramite.html`: «Explicar en fácil» por reglas (jerga → palabras corrientes con glosario,
  frases cortas, lo importante primero), con servicio de IA simulado y su caída, resaltado palabra a palabra, «¿Dónde estoy?».
- `node prueba_auditar.js`: Winclus Audit sobre la portada local y una página mala: informe, declaración y JSON.
- `node prueba_sdk.js`: `<winclus-widget>` (pagina-sdk.html), guía integrar.html, plugin WordPress y módulo Drupal.
- `node prueba_idiomas.js`: panel en inglés en página en inglés, `data-ui`, idioma añadido con `WinclusIdiomas`, sin diccionario → español.
- `node auditar.js https://sitio [--salida carpeta] [--entidad "Nombre"]`: el escáner (no es una prueba).
- `node prueba_maximo.js`: limitador de volumen, voz neuronal preferida, asistente «¿Qué quieres hacer?» (texto y orden por voz), transcribir un medio.
- `node prueba_evidencia.js`: demo.html pasa axe; cifras de uso locales, resumen sin datos personales, envío solo con data-metricas y el interruptor activado, una vez por semana.
- `node evidencia.js`: corre todas las pruebas y genera web/evidencia.html y web/evidencia.json (lo hace GitHub Actions en cada push).
- `node prueba_navegadores.js`: recorrido básico en Chromium, Firefox y WebKit (`npx playwright install firefox webkit`) con entornos hostiles: sin voz, sin localStorage, sin portapapeles, SPA, script doble, móvil.
- `node prueba_aaa.js`: nivel AAA (docs/hoja-ruta-aaa.md, 17-sep-2026): reglas AAA de axe sobre cada pestaña del panel (ajustes
  finos abiertos, todos los grupos a la vista) y sobre todas las páginas del sitio; contraste 7:1 de todo texto del panel;
  objetivos de 44×44 en el panel (salvo las teclas del teclado en pantalla) y en enlaces y botones del sitio que no van en
  línea; «Restablecer todo» y los tres «Olvidar…» preguntan en dos pasos con el foco en «No»; colores propios (preajustes y
  libres) y modo dislexia (interlineado, párrafos, sin justificar, ≤ 80 caracteres); glosario en todos los pies; migas de
  pan con aria-current; «En pocas palabras» en las páginas técnicas; transcripciones de los cuatro vídeos.
- `node prueba_entender.js`: el panel se entiende sin manual (17-sep-2026): Inicio con «¿Qué te cuesta?» (ocho situaciones que
  encienden lo adecuado y explican qué han hecho), «Lo que tienes activado» y «Apagar todo lo activado», ayuda en palabras
  corrientes bajo cada interruptor y cada −/+ (aria-describedby), «Ajustes finos» plegados y cerrados, sin jerga en los nombres
  visibles, y en inglés no se cuela español (también los −/+, que antes no se traducían). Además: bienvenida de la
  primera vez (voz + botones que laten, `winclus.visto`), pictogramas ARASAAC en las situaciones, «Explícame esta página
  en fácil» desde Inicio, «Léemelo» por sección (`Winclus.textoSeccion`), ayuda en el barrido a ≥ 2 s (`Winclus.ayudaBarrido`)
  y cifras de qué se toca del panel (`uso.panel`, sin datos personales).
- `node prueba_robustez.js`: regresión de los fallos de la revisión del 16-sep-2026 (ver el comentario del archivo).
- Cualquier prueba corre en otro motor con `NAVEGADOR=firefox node prueba_x.js` (o `webkit`). El WebKit de Playwright en Windows no trae síntesis de voz ni portapapeles: `voz-simulada.js` se inyecta como sustituto y las comprobaciones de portapapeles se saltan en ese motor.
- Todas las pruebas del widget usan `Winclus.caja` (el shadow root) para llegar a sus piezas; los selectores de
  Playwright (`page.click("#wcl-tab-ver")`) atraviesan el shadow root solos.
- La foto tiene los ojos entrecerrados (relación 0,69 en reposo): para probar el clic poner `Winclus.ajustes.parpadeo_umbral = 0.45`.
