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
- [ ] **Navegación completa dentro de la página**: regiones (d), listas (i), tablas celda a celda (Ctrl+Alt+flechas)
      con cabecera anunciada, imágenes (g), campos con modo formulario, leer por palabra y por carácter, deletrear,
      buscar (Ctrl+F propio), lectura continua con resaltado, anuncio de roles y estados (marcado, expandido,
      obligatorio, inválido), regiones vivas.
- [ ] **Verbosidad** (principiante, normal, experto) y **velocidad y tono** de la voz.
- [ ] **En el escritorio (aplicación de Windows)**: instalar y configurar NVDA (gratuito, código abierto) desde el
      instalador de Winclus, con un perfil que no choque con el puntero facial. Es más honesto y más útil que
      escribir otro lector: NVDA lleva quince años de trabajo.
- [-] **Braille** y **lector para todo el sistema propio**: no. Es el terreno de JAWS y NVDA; Winclus se integra con ellos.

## Familia 3. Control con la cara, los ojos o la voz (Tobii Dynavox, Windows Eye Control, Gameface, Dragon)

Lo que hacen: seguimiento ocular con hardware dedicado (precisión de 0,5 grados), calibración de nueve puntos,
control de todo el sistema, dictado profesional con vocabulario y corrección por voz, comandos para cualquier
aplicación.

- [x] Ya en Winclus: puntero con cabeza y con ojos (cámara normal), híbrido, calibración de 40 s, aprendizaje de
      clics, imán, lupa para afinar, clic por parpadeo, boca, cejas o quietud, menú de clics, órdenes por voz,
      dictado con confirmación, «números» para enlaces y campos.
- [ ] **Precisión ocular**: usar más puntos de calibración (9 y 16), compensar el movimiento de la cabeza con los
      dos ojos, medir y publicar el error real en píxeles (ya se calcula) y compararlo en la página de comparación.
- [ ] **Rastreadores externos**: aceptar un rastreador ocular de hardware (Tobii y compatibles) en la aplicación de
      Windows cuando el sistema lo expone como cursor (Windows Eye Control). Sin SDK propietario.
- [ ] **Voz completa**: dictado con corrección («borra eso», «mayúscula», puntuación), comandos para todo lo que se
      ve en pantalla («pulsa Enviar», «baja»), en la app de Windows con el reconocimiento del sistema.
- [ ] **Más gestos**: guiño de un ojo, lengua fuera, inclinación de cabeza, con acción asignable.
- [-] **Igualar la precisión de Tobii con una cámara normal**: no es posible físicamente; se dice así en la comparación.

## Familia 4. Comunicación aumentativa y alternativa (Grid 3, TD Snap, Proloquo2Go, Cboard)

Lo que hacen: tableros de miles de símbolos organizados por carpetas, vocabulario nuclear, predicción, conjugación,
tableros hechos por la familia o el terapeuta, voces naturales, historial, acceso por barrido y por mirada,
frases guardadas, teclado con símbolos.

- [x] Ya en Winclus: tablero con 9 categorías de pictogramas ARASAAC, predicción de siguiente palabra, frases
      guardadas, barrido dentro del tablero, voz.
- [ ] **Vocabulario nuclear** de unas 300 palabras (las que cubren el 80 % de lo que se dice) organizado por
      colores gramaticales (personas, acciones, descripciones, lugares, tiempo).
- [ ] **Buscar cualquier pictograma** de ARASAAC (más de 12 000) desde el tablero, con la API de ARASAAC.
- [ ] **Tableros propios**: crear carpetas y añadir pictogramas o fotos, guardarlos en el perfil y compartirlos por
      enlace o archivo. Para que un terapeuta o la familia adapte el tablero.
- [ ] **Conjugación y género** («yo quiero», «ella quiere») y frases completas gramaticalmente.
- [ ] **Historial** de lo dicho y frases más usadas primero.
- [ ] **Tablero por mirada y por barrido con dos pulsadores** (ver familia 5).
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
- [ ] **Colores por tipo de palabra** (nombres, verbos, adjetivos) en la lectura limpia.
- [ ] **Resumen en tres frases** y **preguntas de comprobación** en «Explicar en fácil».
- [-] **Traducción**: no sin un servicio externo; si el sitio aporta uno (como con la IA), se usará.

## Orden de trabajo

1. ~~Familia 1 completa (resaltar títulos y foco, silenciar, diccionario). Familia 6: sílabas y diccionario con
   dibujos.~~ Hecho el 18-sep-2026 (0.6.4).
2. ~~Familia 5 completa (dos pulsadores, grupos, punto de barrido, menú de acciones).~~ Hecho el 18-sep-2026 (0.6.5).
   Familia cerrada.
3. Familia 4: vocabulario nuclear, búsqueda en ARASAAC, tableros propios. Cambios grandes en el widget.
4. Familia 2: lector completo dentro de la página. Cambios grandes en el widget. En Windows, integrar NVDA.
5. Familia 3: precisión ocular, más gestos, voz completa en Windows. Investigación más desarrollo.

Cada bloque se publica como versión propia, con su prueba automática, y se marca aquí. Lo que se marque `[-]` se
dice tal cual en winclus.com/comparar, para no prometer lo que no es.
