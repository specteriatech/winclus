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
- [ ] **Resaltar títulos** (borde y fondo en h1 a h3) y **resaltar el foco** con un marco grueso en la página anfitriona.
- [ ] **Silenciar la página** de un toque (además del volumen máximo).
- [ ] **Diccionario al toque**: definición de una palabra de la página (con el glosario del sitio si lo aporta, o con
      Wikcionario si hay red).

Resultado cuando esté todo: Winclus hace todo lo que hace un overlay y, además, lo de las familias 2 a 6.

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
- [ ] **Dos pulsadores**: uno avanza, otro selecciona (barrido por pasos, sin tiempo).
- [ ] **Barrido por grupos** en la página (cabecera, contenido, pie, luego elementos), no solo lineal.
- [ ] **Punto de barrido**: barrer una línea horizontal y luego vertical para clicar en cualquier punto (para mapas y
      cosas sin botones).
- [ ] **Menú de acciones al seleccionar**: clic, clic largo, arrastrar, leer, escribir.
- [ ] **Aceleración**: el tiempo baja solo según los aciertos.

## Familia 6. Lectura y comprensión (Lector inmersivo de Microsoft, Read&Write, Helperbird)

Lo que hacen: lectura con resaltado, sílabas, colores por tipo de palabra, diccionario con dibujos, foco de línea,
traducción, letra para dislexia, espaciado, lectura fácil.

- [x] Ya en Winclus: lectura limpia, explicación en fácil (por reglas o con IA del sitio), lectura en voz alta con
      resaltado palabra a palabra, máscara de enfoque, letras separadas, ayuda en formularios, glosario.
- [x] (17-sep-2026, 0.6.3) Letra para dislexia, interlineado, alineación (familia 1).
- [ ] **Sílabas**: separar y colorear las sílabas del texto (silabeo del español por reglas).
- [ ] **Diccionario con dibujos**: al tocar una palabra, su pictograma de ARASAAC y su definición sencilla.
- [ ] **Colores por tipo de palabra** (nombres, verbos, adjetivos) en la lectura limpia.
- [ ] **Resumen en tres frases** y **preguntas de comprobación** en «Explicar en fácil».
- [-] **Traducción**: no sin un servicio externo; si el sitio aporta uno (como con la IA), se usará.

## Orden de trabajo

1. Familia 1 completa (queda: resaltar títulos y foco, silenciar, diccionario). Familia 6: sílabas y diccionario con
   dibujos. Son cambios pequeños en el widget.
2. Familia 5 completa (dos pulsadores, grupos, punto de barrido, menú de acciones). Cambios medianos en el widget.
3. Familia 4: vocabulario nuclear, búsqueda en ARASAAC, tableros propios. Cambios grandes en el widget.
4. Familia 2: lector completo dentro de la página. Cambios grandes en el widget. En Windows, integrar NVDA.
5. Familia 3: precisión ocular, más gestos, voz completa en Windows. Investigación más desarrollo.

Cada bloque se publica como versión propia, con su prueba automática, y se marca aquí. Lo que se marque `[-]` se
dice tal cual en winclus.com/comparar, para no prometer lo que no es.
