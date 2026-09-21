# Guion de presentación (10 minutos + demo) y objeciones

Material: winclus.com/presentacion (diapositivas, avanza con ↓), winclus.com/demo (demostración), winclus.com/una-pagina (impresa, una por persona), winclus.com/comparar y winclus.com/evidencia abiertos en pestañas.

## Antes de entrar (15 minutos)

- Portátil con **Chrome o Edge** actualizado, cámara y micrófono funcionando, **luz de frente** (no una ventana a la espalda). Probar en la sala: abrir winclus.com/demo, activar la cámara, mover la cabeza, cerrar los ojos sobre un enlace. Si no va, la demo se hace con los vídeos de la misma página: no perder tiempo peleando.
- Dar permiso de cámara y micrófono al sitio antes, para que no salte el aviso en medio.
- Volumen alto: la voz del widget es parte de la demo.
- Cerrar todo lo demás; poner el navegador a pantalla completa (F11) y el zoom al 125 % para que se vea desde el fondo.
- Tener a mano el resumen de una página impreso.

## Guion (lo que se dice, diapositiva a diapositiva)

1. **Portada (20 s).** «Winclus mete dentro de cualquier página web lo que hasta hoy solo hacía un aparato de mil dólares: que una persona que no puede usar ratón, teclado ni voz use el sitio. Gratis, de código abierto y sin que sus datos salgan de su navegador.»
2. **Problema (60 s).** Contar una persona, no una estadística: «Una persona con ELA quiere pedir su subsidio en la sede electrónica. Con cualquier widget de accesibilidad de los que se venden, no puede: mueven el texto, no el puntero. El aparato que sí le serviría cuesta tres millones de pesos y nadie se lo subsidia. Y la entidad, que pagó por el widget, sigue sin cumplir la Resolución 1519 y con el riesgo de que le pase lo que a accessiBe con la FTC.»
3. **Qué es (60 s).** Recorrer las seis cajas en una frase cada una. Terminar: «Todo esto en una línea de código.»
4. **Demo (4 min).** Ir a winclus.com/demo. En este orden, porque va de más impactante a más cotidiano:
   - Barrido: activar, soltar el ratón, enviar el formulario solo con Espacio. Decir en voz alta «no he tocado el ratón».
   - Cara: activar cámara, mover la cabeza, clic con los ojos en «Ver requisitos». Abrir la pestaña Red (F12) y decir «esto es lo que sale de mi navegador: nada».
   - Pictogramas: «yo», «necesito», «ayuda», Decir.
   - Explicar en fácil sobre el texto del trámite.
   Si algo falla: «esto es la vida real; el vídeo de al lado lo grabó la prueba automática esta mañana» y reproducirlo.
5. **Comparación (60 s).** No leer la tabla; señalar tres filas: cara, pulsador, pictogramas: «ningún overlay, ninguna». Y la última: «22 pruebas públicas; ellos, ninguna». Remitir a winclus.com/comparar «con fuentes y con lo que ellos hacen mejor que nosotros».
6. **Evidencia (45 s).** Abrir winclus.com/evidencia: «esto se genera solo con cada cambio de código; la fecha y el commit están ahí; cualquiera puede repetirlo.»
7. **Lo que decimos y no decimos (45 s).** Es la diapositiva que da confianza. Leerla casi literal. La frase clave: «No decimos que hace conforme su sitio. Decimos que su sitio se puede usar con la cara, la voz y un pulsador, y se lo demostramos.»
8. **Integración (30 s).** «Una línea en el pie de GOV.CO. Si su equipo tarda más de una hora, invitamos el café.»
9. **Modelo (30 s).** «Gratis siempre para las personas y para el sitio. Cobramos soporte, auditoría, capacitación y pruebas con personas usuarias.»
10. **Piloto (45 s).** Pedir algo concreto: «Sesenta días, coste cero, una sede electrónica suya y permiso para publicar el informe. Salimos con cifras de gestiones completadas por personas con discapacidad que hoy no tiene nadie en Colombia.»
11. **Hoja de ruta (20 s).** Solo lo de tres meses: pruebas con personas, auditoría de tercero, SECOP.
12. **Cierre (10 s).** «Compruébenlo, no nos crean.» Dejar la hoja de una página.

## Objeciones que van a salir, y la respuesta corta

- **«Ya tenemos un widget de accesibilidad.»** «Perfecto: no compite con él. Su widget agranda el texto; el nuestro deja usar el sitio a quien no puede tocar el ratón. Pueden convivir, y si algún día quieren uno solo, el nuestro también agranda el texto.»
- **«¿Esto nos hace cumplir la 1519?»** «No, y desconfíen de quien les diga que sí: por eso sancionaron a accessiBe. Lo que sí hacemos es decirles exactamente qué les falta, criterio por criterio, con Winclus Audit, y darles el borrador de la declaración.»
- **«¿Y la privacidad? ¿La cámara?»** «La imagen no sale del navegador; se lo enseñamos en la pestaña Red. El código es público. Pedimos consentimiento explícito antes de activarla. Lo único que sale es la voz del dictado, porque el reconocimiento lo hace Chrome, y se lo decimos a la persona en el mismo botón.»
- **«¿Quién los ha certificado?»** «Nadie todavía, y lo decimos en la declaración. Lo que hay son 22 pruebas públicas que cualquiera repite y un informe de conformidad en formato VPAT. La auditoría de tercero es el siguiente paso, y el piloto con ustedes puede ser el sitio de referencia.»
- **«¿Cuántas personas lo usan?»** «Estamos empezando; por eso el piloto es gratis y por eso publicamos el informe. Quien nos elija primero tendrá las primeras cifras reales del país.»
- **«¿Y si se rompe nuestro sitio?»** «Vive aislado (shadow root): ni sus estilos entran ni los nuestros salen. Está probado con una página hostil y con CSP estricta. Y las mejoras les llegan solas con widget.js; si su política de seguridad lo exige, usan una versión fija con hash que no cambia hasta que ustedes decidan.»
- **«¿Funciona con JAWS o NVDA?»** «No interfiere: no captura teclas de la página y avisa a la persona de que no active nuestro lector básico si ya usa uno. Está probado.»
- **«¿Es un dispositivo médico?»** «No. Es una herramienta para usar el ordenador, como un teclado.»
- **«¿Por qué gratis? ¿Cómo viven?»** «Porque una persona con discapacidad no debería pagar por entrar a una sede pública. Cobramos a las entidades y empresas el soporte, la auditoría, la capacitación y las pruebas con personas usuarias.»
- **«¿Y en otros idiomas / lenguas nativas?»** «Español e inglés hoy; cualquier sitio puede añadir un idioma con un diccionario. Las lenguas nativas las haremos con hablantes que las validen, no con un traductor automático.»

## Lo que no hay que decir

- «Cumple», «certificado», «100 % accesible», «hace su sitio accesible».
- Cifras de usuarios que no tenemos.
- Nada sobre la competencia que no esté en winclus.com/comparar con fuente.

## Después

- Enviar el mismo día: enlace a la demo, a la evidencia, a la comparación y el PDF de la hoja (imprimir winclus.com/una-pagina como PDF), con una propuesta de fecha para empezar el piloto.
