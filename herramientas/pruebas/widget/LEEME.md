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
- `node prueba_barrido2.js`: familia 5 (0.6.5): dos pulsadores (Espacio mueve, Intro elige, sin tiempos), zonas (menú, contenido, pie; dos
  vueltas sin elegir vuelven a las zonas), punto de barrido (`Winclus.barridoEstado().punto` da la fase y la posición de la línea; clic en un
  lienzo sin botones), menú de acciones (leer, clic largo de 0,7 s, escribir en campos, Escape, arrastrar y soltar con el punto) y aceleración
  (baja con cada acierto, sube con una vuelta en vano, nunca bajo la mitad). Pasa en Chromium, Firefox y WebKit.
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
- `node prueba_pictogramas2.js`: familia 4 (0.6.6): vistas Temas, Palabras, Míos y Buscar; vocabulario nuclear por colores (338 palabras);
  `Winclus.pulir` (10 frases con conjugación, «me gusta», género y número, «Cuando hablo de mí»); historial «Lo que más dices»;
  búsqueda en ARASAAC simulada con `page.route`; tableros propios (crear, palabra, dibujo desde el buscador, foto reducida con
  `setInputFiles`, quitar, archivo .tablero.json descargado, enlace #winclus-tablero=…, perfil .winclus); el tablero con dos pulsadores
  y con `Winclus.mover` + `Winclus.clic()`. Pasa en Chromium, Firefox y WebKit.
- `node prueba_lector.js`: familia 2 (0.6.7): lector completo dentro de la página: d zonas (el menú dentro del contenido es su zona), t tablas y
  Ctrl+Alt+flechas con fila, columna y cabeceras, a listas, c casillas (Intro las marca), 1-6 encabezados por nivel, estados (expandido,
  obligatorio, no válido, no disponible, descripción), modo formulario y Escape, ← → letra a letra con nombres de signos, Ctrl+← →
  palabra a palabra, s deletrea, r lectura continua con resaltado, Ctrl+F buscador, regiones vivas y alertas, tres verbosidades
  (`Winclus.describir`), tono de la voz (pitch). La voz habla por trozos: la prueba junta lo dicho. Pasa en Chromium, Firefox y WebKit.
- `node prueba_familias36.js`: familias 3 y 6 (0.6.8): guiños e inclinación de la cabeza como gestos (`Winclus.valorGesto` con `deteccion.bs` y
  `deteccion.lm` simulados; un parpadeo de los dos ojos da 0; en la pestaña Clics), «Tipos de palabra» en la lectura limpia (`Winclus.tipoPalabra`,
  leyenda, sin cambiar el texto), «En tres frases» (`Winclus.resumen`) y «Compruebo que lo entendí» con «Ver respuesta» en «Explicar en fácil».
- `node prueba_familia3_widget.js`: familia 3 en el widget (0.6.9): rejilla de 9/13/25 puntos (`Winclus.rejilla`), opciones de calibración en
  el panel, modelo ocular con rasgos sintéticos (`Winclus.ajustarModelo`, `predecir`), compensación de cabeza (`Winclus.ajustarCabeza`:
  aprende, mide la mejora, corrige con `deteccion.pose` y no se guarda si no ayuda), «Otro aparato mueve el puntero» (el ratón no toca el
  puntero virtual sin cámara; con cámara real, prueba en vivo pendiente) y el enlace a NVDA. Pasa en Chromium, Firefox y WebKit.
- `node prueba_gestos.js`: los gestos de la cara y la página que se mueve sola (0.6.14): con `Winclus.tickGestos` y los valores de la
- `node prueba_seguir_camara.js`: la cámara sigue encendida al cambiar de página (0.6.15), con cámara simulada de Chromium (`--use-fake-device-for-media-stream`): se reanuda sola en la página siguiente y al recargar, con aviso en pantalla y en voz; y NO se reanuda si se apagó a mano, con el interruptor apagado, tras «Restablecer todo», sin consentimiento o sin permiso del navegador ya concedido.
  cara puestos a mano, abrir la boca menos de 0,6 s no mueve nada (hablar, bostezar), después baja despacio y va cogiendo velocidad,
  la primera vez se explica por voz y en la etiqueta del puntero, y «Usar los gestos de la cara» los apaga todos menos el gesto con
  el que se hace clic.
- `node prueba_bordes.js`: bajar y subir por los bordes (0.6.11: franja del 12 % de la altura, que es lo que alcanza la mirada calibrada, y señales «▼ Bajar» y «▲ Subir» con la cámara en marcha): `Winclus.tickBordes` con el puntero virtual en la franja de abajo (baja tras
  0,35 s, más deprisa cuanto más pegado, banda «Bajando» y aviso de voz), en la de arriba (sube), fuera (para) y con el interruptor apagado.
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
- `node prueba_familias.js`: hoja de ruta por familias (docs/hoja-ruta-familias.md), bloque 1 (0.6.3): tipo de letra («Legible»
  Verdana y «Para dislexia» OpenDyslexic desde winclus.com/fuentes), espacio entre renglones, texto a la izquierda y zoom de toda la
  página; se aplican a la página y no al panel, se guardan, salen en «Lo que tienes activado» y se apagan con «Apagar todo».
  Bloque 1b (0.6.4): resaltar títulos y foco, silenciar la página (también lo que arranca después; al apagar vuelve solo lo que
  silenció Winclus), diccionario al toque (glosario del sitio → ARASAAC con dibujo → Wikcionario, simulados con `page.route`;
  con el ratón, con `Winclus.clic()` y dentro de la lectura limpia; Escape cierra; botones y enlaces no lo abren) y «Sílabas» en
  la lectura limpia (`Winclus.silabear` con 20 palabras, colores alternos, el texto no cambia). Pasa en Chromium, Firefox y WebKit.
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
