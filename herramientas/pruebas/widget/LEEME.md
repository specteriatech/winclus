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
- La foto tiene los ojos entrecerrados (relación 0,69 en reposo): para probar el clic poner `Winclus.ajustes.parpadeo_umbral = 0.45`.
