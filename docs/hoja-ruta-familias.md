# Hoja de ruta: Winclus frente a las seis familias de software de inclusión

Objetivo fijado el 17 de septiembre de 2026: que Winclus reúna, dentro de una página web y en la aplicación de
Windows, lo que hoy hacen seis familias de productos distintas. Para cada familia: qué hace el líder, qué tiene
Winclus, qué falta, qué se puede construir y qué no (y por qué). Se marca a medida que se cierra.

Leyenda: `[ ]` pendiente · `[x]` hecho (fecha, versión) · `[~]` parcial · `[-]` no se hará (con la razón).

## Familia 1. Overlays y widgets web (accessiBe, UserWay, EqualWeb, AudioEye)

Lo que hacen: texto, contraste, cursor, enlaces, máscara, guía, animaciones, lectura en voz, perfiles por
discapacidad, tipo de letra, alineación, interlineado, zoom de página, silenciar sonidos.

- [x] Ya en Winclus: texto al 200 %, contraste, modo oscuro, enlaces, guía, cursor, sin movimiento, máscara,
      letras separadas, atenuar imágenes, lupa, colores propios, lectura en voz, perfiles por situación (Inicio),
      volumen máximo, modo calma, corrección de daltonismo (esto último no lo tiene ningún overlay).
- [x] (17-sep-2026, 0.6.3) **Tipo de letra**: «Legible» (Verdana) y «Para dislexia» (OpenDyslexic, servida
      desde winclus.com/fuentes con licencia OFL).
- [x] (17-sep-2026, 0.6.3) **Espacio entre renglones** ajustable (100 a 250 %).
- [x] (17-sep-2026, 0.6.3) **Texto alineado a la izquierda** (quita el justificado).
- [x] (17-sep-2026, 0.6.3) **Zoom de toda la página** (100 a 200 %), no solo la letra.
- [x] (18-sep-2026, 0.6.4) **Resaltar títulos** (fondo y borde en h1 a h4) y **resaltar el foco** con un marco grueso
      en la página anfitriona.
- [x] (18-sep-2026, 0.6.4) **Silenciar la página** de un toque (además del volumen máximo): también lo que arranque
      después; al apagarlo vuelve el sonido solo a lo que silenció Winclus. Los vídeos incrustados de otros sitios
      (YouTube) no se pueden silenciar desde fuera y la ayuda lo dice.
- [x] (18-sep-2026, 0.6.4) **Diccionario al toque**: se toca una palabra (con el ratón, con el puntero facial o dentro
      de la lectura limpia) y sale qué significa, con dibujo. Por orden: el glosario del sitio (`window.WinclusGlosario`
      o `data-glosario`), el glosario de trámites del widget, ARASAAC (pictograma y significado, solo con coincidencia
      exacta) y Wikcionario. La palabra sale hacia ARASAAC y Wikcionario solo al tocarla con el diccionario encendido.

Resultado (18-sep-2026, 0.6.4): Winclus hace todo lo que hace un overlay y, además, lo de las familias 2 a 6. Familia
cerrada.

## Familia 2. Lectores de pantalla (JAWS, NVDA, VoiceOver, Narrador, TalkBack)

Lo que hacen: leer todo lo que hay en pantalla con voz o braille, navegar por encabezados, enlaces, regiones,
tablas celda a celda, formularios, leer por carácter, palabra y línea, anunciar roles y estados, buscar texto,
ajustar verbosidad, funcionar en todo el sistema operativo, no solo en el navegador.

- [x] Ya en Winclus: lector básico dentro de la página (flechas leen, h, l, b, f, Intro, F1), lectura de lo que se
      pulsa, «¿Dónde estoy?», «Léeme esta página», voz por idioma.
- [x] (18-sep-2026, 0.6.7) **Navegación completa dentro de la página**: zonas (d), listas (a), tablas celda a celda
      (t y Ctrl+Alt+flechas, con fila, columna y cabeceras), imágenes (i o g), casillas y opciones (c), encabezados por
      nivel (1 a 6), modo formulario (Escape sale), leer por palabra (Ctrl+flechas) y por carácter (flechas, con el
      nombre de los signos), deletrear (s), buscar (Ctrl+F propio), lectura continua con resaltado (r), roles y estados
      (expandido, pulsado, seleccionado, actual, obligatorio, no válido, no disponible, descripción) y regiones vivas
      (aria-live, alertas). Intro también marca casillas.
- [x] (18-sep-2026, 0.6.7) **Verbosidad** («Cuánto explica el lector»: mucho, normal, poco) y **velocidad y tono** de la voz.
- [~] (18-sep-2026) **En el escritorio (aplicación de Windows)**: el widget (0.6.9) enlaza la descarga de NVDA desde
      «Lector de pantalla» en Windows; el instalador (instalar.ps1) ofrece instalar NVDA con
      winget (o abre su descarga) y explica qué apagar en Winclus para que no hablen los dos. Queda por probar en vivo
      NVDA y el puntero facial juntos y, si hace falta, un perfil de NVDA.
- [-] **Braille** y **lector para todo el sistema propio**: no. Es el terreno de JAWS y NVDA; Winclus se integra con ellos.

## Familia 3. Control con la cara, los ojos o la voz (Tobii Dynavox, Windows Eye Control, Gameface, Dragon)

Lo que hacen: seguimiento ocular con hardware dedicado (precisión de 0,5 grados), calibración de nueve puntos,
control de todo el sistema, dictado profesional con vocabulario y corrección por voz, comandos para cualquier
aplicación.

- [x] (18-sep-2026, 0.6.11 y app) **Bajar y subir por los bordes**: el puntero en la parte de abajo de la pantalla baja la
      página y en la de arriba la sube (la forma más sencilla, además de los gestos de rueda, el menú de clics y la voz).
      La franja es el 12 % de la altura porque con los ojos el puntero llega como mucho al 92 % de la pantalla (la
      calibración mide hasta ahí): con una franja estrecha no se alcanzaba mirando. Con la cámara en marcha salen las
      señales «▼ Bajar» y «▲ Subir», y al activarla se dice cómo. En la aplicación, la rueda se manda 180 px más adentro
      para no dársela a la barra de tareas.
- [x] Ya en Winclus: puntero con cabeza y con ojos (cámara normal), híbrido, calibración de 40 s, aprendizaje de
      clics, imán, lupa para afinar, clic por parpadeo, boca, cejas o quietud, menú de clics, órdenes por voz,
      dictado con confirmación, «números» para enlaces y campos.
- [x] (18-sep-2026; widget 0.6.9 también) **Precisión ocular**: el widget calibra con 9, 13 o 25 puntos, con más tiempo
      por punto y punto grande, mide el error real con cuatro puntos aparte y tiene el paso final de compensación de cabeza
      (se guarda solo si mejora y dice cuánto). La aplicación de Windows ya calibra con 9, 13 o 25 puntos («Duración»), con los
      dos ojos o uno solo, con seguimiento de un punto móvil y con el paso de compensación de cabeza; mide el error real con
      cuatro puntos que no entran en el ajuste. Error real medido el 12-sep-2026 con cámara normal y 13 puntos: 75 px
      (unos 2 cm en un monitor corriente). Publicado en winclus.com/comparar frente a los 0,5° de Tobii.
- [x] (18-sep-2026, app y widget 0.6.9) **Rastreadores externos**: en el widget, «Otro aparato mueve el puntero» en la
      pestaña Cara (el puntero del sistema manda y la cámara hace los clics y gestos); en la aplicación, «Otro aparato mueve el puntero; Winclus solo hace los clics y los
      gestos» (puntero_externo) en la página Puntero: Winclus no toca el puntero del sistema y deja el clic por parpadeo,
      los gestos, el menú, el teclado y la voz encima de Tobii, Windows Eye Control o cualquier rastreador. Sin SDK.
- [x] (19-sep-2026, app) **Voz completa en Windows**: la aplicación escucha por el micrófono con el motor de voz del
      propio Windows (`Windows.Media.SpeechRecognition` a través de `winsdk`). Página «Escribir» → «Hablarle a Winclus».
      Órdenes para todo el ordenador («baja», «clic», «doble clic», «pulsa» y el nombre de un botón por UI Automation,
      «abre el bloc de notas», «busca…», «copia», «pega», «atrás», «lee la pantalla», «teclado», «menú», «pausa»,
      «sigue», «calla», «deja de escuchar», «¿qué puedo decir?») y dictado con puntuación hablada («coma», «punto»,
      «nueva línea», «abre interrogación», «mayúscula») y corrección («borra eso», «borra palabra», «borra todo»), con
      la opción de confirmar antes de escribir. Las órdenes se oyen con una lista cerrada que se rehace cuando cambia la
      ventana de delante: así el motor acierta más y **funciona sin internet, sin que la voz salga del equipo**. El
      dictado de texto libre lo condiciona Windows: solo arranca con «Reconocimiento de voz en línea» encendido, y
      entonces es Windows quien manda el audio a Microsoft; Winclus lo dice en la misma pantalla y abre ese ajuste.
      Probado sin micrófono con `herramientas\pruebas\prueba_voz.py` (43 comprobaciones) y `recorrido_voz.py`.
      Falta la prueba en vivo hablando.
- [x] (18-sep-2026, widget 0.6.8 y app) **Más gestos**: guiño del ojo izquierdo y del derecho (un ojo cerrado con el otro
      abierto: un parpadeo normal no cuenta) e inclinación de la cabeza a cada lado (ángulo entre los rabillos de los ojos),
      con acción asignable en los dos. Lengua fuera: no, MediaPipe no la detecta (se dice aquí).
- [-] **Igualar la precisión de Tobii con una cámara normal**: no es posible físicamente; se dice así en la comparación.

## Familia 4. Comunicación aumentativa y alternativa (Grid 3, TD Snap, Proloquo2Go, Cboard)

Lo que hacen: tableros de miles de símbolos organizados por carpetas, vocabulario nuclear, predicción, conjugación,
tableros hechos por la familia o el terapeuta, voces naturales, historial, acceso por barrido y por mirada,
frases guardadas, teclado con símbolos.

- [x] Ya en Winclus: tablero con 9 categorías de pictogramas ARASAAC, predicción de siguiente palabra, frases
      guardadas, barrido dentro del tablero, voz.
- [x] (18-sep-2026, 0.6.6) **Vocabulario nuclear**: vista «Palabras» con 338 palabras en ocho grupos con los colores de
      la clave de Fitzgerald (personas, acciones, cómo es, cosas, lugares, tiempo, preguntas y enlaces, sociales); los
      pictogramas los eligió la API de ARASAAC (herramientas/vocabulario_nuclear.js) y 19 palabras van solo con texto.
- [x] (18-sep-2026, 0.6.6) **Buscar cualquier pictograma** de ARASAAC desde la vista «Buscar»; el resultado va a la frase
      o a un tablero propio. La palabra se envía a arasaac.org solo al buscar.
- [x] (18-sep-2026, 0.6.6) **Tableros propios** («Míos»): hasta 12 tableros de 60 dibujos con pictogramas de ARASAAC,
      fotos (reducidas a 160 px y guardadas dentro) o solo palabras; quitar, borrar, compartir por archivo .tablero.json y
      por enlace (#winclus-tablero=…, sin fotos), cargar de archivo; van en el perfil .winclus.
- [x] (18-sep-2026, 0.6.6) **Conjugación y género**: «Frases bien dichas» conjuga el primer verbo según el sujeto (36
      irregulares y los regulares por terminación), «me gusta» y «me duele», y concuerda los adjetivos en género y número;
      «Cuando hablo de mí» elige masculino o femenino. La tira enseña cómo se dirá y Decir lo dice así.
- [x] (18-sep-2026, 0.6.6) **Historial**: «Lo que más dices» aparece cuando no hay frase, con las seis más dichas primero
      (hasta 40 guardadas en el navegador).
- [x] (18-sep-2026, 0.6.6) **Tablero por mirada y por barrido con dos pulsadores**: el puntero con los ojos o la cabeza
      y el clic por quietud o gesto tocan los dibujos, y el barrido de la familia 5 (uno o dos pulsadores) recorre el
      tablero; probado en prueba_pictogramas2.js.
- [-] **Igualar Grid 3 en amplitud**: no en 2026; sí un tablero que sirva para lo cotidiano y un trámite.

## Familia 5. Acceso por pulsador y barrido (Switch Control de Apple, Android, Grid 3)

Lo que hacen: barrido automático o por pasos, un pulsador o dos, grupos y filas, punto de barrido para clicar en
cualquier sitio, aceleración, sonido en cada paso, menú de acciones al seleccionar.

- [x] Ya en Winclus: barrido automático de botones, enlaces y campos, filas y teclas del teclado, señal por Espacio,
      Intro, cualquier tecla, clic o gesto, tiempo ajustable, voz, Escape para pausar.
- [x] (18-sep-2026, 0.6.5) **Dos pulsadores**: «Cómo avanza el marco: con dos pulsadores»; la señal de siempre mueve el
      marco y la «Señal para elegir» (Intro, Espacio, flecha o clic) elige; sin tiempos. El clic con la cara siempre elige.
- [x] (18-sep-2026, 0.6.5) **Barrido por zonas**: menú, formulario, cabecera, lateral, pie, contenido y «resto», por las
      regiones de la página (las zonas de más de 12 elementos se parten en trozos de 8); al elegir una se barren sus
      elementos y, tras dos vueltas sin elegir, vuelve a las zonas. Cada zona se dice con su nombre y cuántos elementos tiene.
- [x] (18-sep-2026, 0.6.5) **Punto de barrido**: «Poder tocar cualquier punto» añade el botón «Cualquier punto» al
      barrido; una línea baja (va y vuelve) y la señal la fija, otra cruza y la señal la fija; ahí se hace clic (o se
      abre el teclado si es un campo). También sirve para soltar un arrastre.
- [x] (18-sep-2026, 0.6.5) **Menú de acciones al elegir**: clic, clic largo (0,7 s), arrastrar (se suelta con el punto
      de barrido), leer, escribir (si es un campo) y cancelar; el menú se barre como lo demás y Escape lo cierra.
- [x] (18-sep-2026, 0.6.5) **Aceleración**: «Acelerar solo»: cada acierto baja el tiempo un 8 %, una vuelta entera sin
      elegir lo sube un 15 %; nunca por debajo de la mitad del ajuste ni de 0,3 s. Se avisa en pantalla cada cambio.

## Familia 6. Lectura y comprensión (Lector inmersivo de Microsoft, Read&Write, Helperbird)

Lo que hacen: lectura con resaltado, sílabas, colores por tipo de palabra, diccionario con dibujos, foco de línea,
traducción, letra para dislexia, espaciado, lectura fácil.

- [x] Ya en Winclus: lectura limpia, explicación en fácil (por reglas o con IA del sitio), lectura en voz alta con
      resaltado palabra a palabra, máscara de enfoque, letras separadas, ayuda en formularios, glosario.
- [x] (17-sep-2026, 0.6.3) Letra para dislexia, interlineado, alineación (familia 1).
- [x] (18-sep-2026, 0.6.4) **Sílabas**: botón «Sílabas» en la lectura limpia; silabeo del español por reglas de la RAE
      (`Winclus.silabear`: diptongos, hiatos, grupos inseparables, dígrafos), dos colores AAA alternos, el texto no cambia
      (los lectores de pantalla lo leen igual).
- [x] (18-sep-2026, 0.6.4) **Diccionario con dibujos**: es el diccionario al toque de la familia 1: pictograma de ARASAAC
      y su significado, leído en voz alta.
- [x] (18-sep-2026, 0.6.8) **Colores por tipo de palabra**: botón «Tipos de palabra» en la lectura limpia: nombres en
      azul, acciones en verde y cualidades en naranja, por reglas (artículo delante, listas del tablero y terminaciones),
      con leyenda y aviso de que es aproximado.
- [x] (18-sep-2026, 0.6.8) **Resumen en tres frases** (las de más palabras de peso, en su orden) y **preguntas de
      comprobación** (una frase importante con la palabra clave tapada y «Ver respuesta», que la enseña y la dice) en
      «Explicar en fácil», también con la explicación por IA.
- [-] **Traducción**: no sin un servicio externo; si el sitio aporta uno (como con la IA), se usará.

## Orden de trabajo

1. ~~Familia 1 completa (resaltar títulos y foco, silenciar, diccionario). Familia 6: sílabas y diccionario con
   dibujos.~~ Hecho el 18-sep-2026 (0.6.4).
2. ~~Familia 5 completa (dos pulsadores, grupos, punto de barrido, menú de acciones).~~ Hecho el 18-sep-2026 (0.6.5).
   Familia cerrada.
3. ~~Familia 4: vocabulario nuclear, búsqueda en ARASAAC, tableros propios.~~ Hecho el 18-sep-2026 (0.6.6). Familia
   cerrada (salvo igualar a Grid 3 en amplitud, descartado).
4. ~~Familia 2: lector completo dentro de la página.~~ Hecho el 18-sep-2026 (0.6.7). En Windows, el instalador ofrece
   NVDA; falta la prueba en vivo con el puntero facial.
5. ~~Familia 3: precisión ocular, más gestos~~ hechos el 18-sep-2026 (app y 0.6.8); ~~la voz completa en Windows~~
   hecha el 19-sep-2026 (órdenes con lista cerrada sin internet y dictado con puntuación y corrección; el dictado libre
   depende de que Windows tenga encendido «Reconocimiento de voz en línea»). La familia 6 queda cerrada el
   18-sep-2026 (0.6.8), salvo la traducción, descartada. **Las seis familias quedan cerradas en código: lo que falta es
   humano** (pruebas en vivo con micrófono y con personas usuarias).

Cada bloque se publica como versión propia, con su prueba automática, y se marca aquí. Lo que se marque `[-]` se
dice tal cual en winclus.com/comparar, para no prometer lo que no es.
