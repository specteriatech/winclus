# Informe de conformidad de accesibilidad (ACR) · Winclus widget 0.6.1

Formato basado en la plantilla ITI VPAT® 2.5 (edición internacional: WCAG 2.1, EN 301 549, Sección 508),
traducido y adaptado. Lo elaboran los propios colaboradores de Winclus; una auditoría de tercero puede
firmarlo después.

| | |
|---|---|
| Producto | Winclus, widget web de tecnología de apoyo (`widget-0.6.1.js`) |
| Fecha | 16 de septiembre de 2026 |
| Contacto | hola@winclus.com |
| Notas | El widget se añade a un sitio anfitrión. Este informe cubre el widget (panel, teclado en pantalla, tablero de pictogramas, menú de clics, calibración, avisos). No cubre el sitio anfitrión: Winclus no lo hace conforme. |
| Métodos | axe-core 4.13 (WCAG 2.0/2.1/2.2 A y AA) sobre cada vista del widget en Chromium; contraste calculado con la fórmula de luminancia relativa; pruebas automáticas de teclado, posición, aislamiento y CSP; revisión manual de código y capturas. Pruebas con personas usuarias: pendientes (protocolo en `docs/pruebas-con-usuarios.md`). |

Niveles: **Cumple** · **Cumple parcialmente** · **No cumple** · **No aplica**.

## Tabla 1: WCAG 2.1 nivel A

| Criterio | Nivel de conformidad | Observaciones |
|---|---|---|
| 1.1.1 Contenido no textual | Cumple | Iconos con `aria-label` o `aria-hidden`; pictogramas con etiqueta de texto visible y `aria-label`. |
| 1.2.1 Solo audio y solo vídeo (grabado) | No aplica | El widget no publica medios. |
| 1.2.2 Subtítulos (grabado) | No aplica | Además, muestra y agranda los subtítulos de los vídeos del sitio anfitrión. |
| 1.2.3 Audiodescripción o alternativa | No aplica | |
| 1.3.1 Información y relaciones | Cumple | Encabezados `h2` por sección, `label for`, `role=tablist/tab/tabpanel`, `role=switch`, `role=dialog`, grupos con `aria-labelledby`. |
| 1.3.2 Secuencia significativa | Cumple | Orden del DOM = orden visual. |
| 1.3.3 Características sensoriales | Cumple | Nada depende solo de color, forma o posición; los avisos van también a una región `aria-live`. |
| 1.4.1 Uso del color | Cumple | Pestaña activa con borde y `aria-selected`; interruptores con `aria-checked`. |
| 1.4.2 Control del audio | Cumple | Toda voz se puede parar («Callar», Escape) y no arranca sola. |
| 2.1.1 Teclado | Cumple | Todo el panel, el teclado en pantalla, las frases y el tablero son operables con teclado; el lector básico no captura teclas sobre controles del sitio. |
| 2.1.2 Sin trampas de teclado | Cumple | La calibración (modal) se cierra con Escape y devuelve el foco. |
| 2.1.4 Atajos de teclado de un carácter | Cumple | Las letras del lector básico (h, l, b, f, i) solo actúan con el lector activado por la persona y nunca sobre campos editables. |
| 2.2.1 Tiempo ajustable | Cumple | Barrido: tiempo ajustable de 0,4 a 4 s y pausa con Escape; clic por permanencia: tiempo ajustable. |
| 2.2.2 Pausar, detener, ocultar | Cumple | Nada del widget se mueve o parpadea solo; el modo calma congela lo del sitio. |
| 2.3.1 Umbral de tres destellos | Cumple | Sin destellos. |
| 2.4.1 Evitar bloques | Cumple | El panel es un componente; su botón de cierre y Escape lo saltan. |
| 2.4.2 Título de la página | No aplica | Lo pone el sitio. |
| 2.4.3 Orden del foco | Cumple | Foco atrapado en la calibración; al cerrar el panel el foco vuelve al botón. |
| 2.4.4 Propósito de los enlaces | Cumple | Enlaces con texto descriptivo. |
| 2.5.1 Gestos del puntero | Cumple | Sin gestos multipunto; arrastre como clic-clic. |
| 2.5.2 Cancelación del puntero | Cumple | Las acciones ocurren al soltar (`click`). |
| 2.5.3 Etiqueta en el nombre | Cumple | El nombre accesible incluye el texto visible. |
| 2.5.4 Actuación por movimiento | Cumple | El control por cabeza y ojos es opcional y tiene alternativa (ratón, teclado, barrido). |
| 3.1.1 Idioma de la página | Cumple | El contenedor lleva `lang` del idioma del panel (es o en). |
| 3.2.1 Al recibir el foco | Cumple | Nada cambia de contexto al enfocar. |
| 3.2.2 Al introducir datos | Cumple | Los cambios se aplican sin navegación. |
| 3.3.1 Identificación de errores | Cumple | Perfiles inválidos y enlaces rotos se avisan en texto; además explica los errores de formularios del sitio. |
| 3.3.2 Etiquetas o instrucciones | Cumple | Todos los controles tienen etiqueta; los −/+ dicen qué reducen o aumentan. |
| 4.1.1 Procesamiento | Cumple | HTML válido generado por código. |
| 4.1.2 Nombre, función, valor | Cumple | Roles y estados ARIA en pestañas, interruptores, diálogos, grupos y regiones live. |

## Tabla 2: WCAG 2.1 nivel AA

| Criterio | Nivel de conformidad | Observaciones |
|---|---|---|
| 1.2.4 Subtítulos (en directo) | No aplica | Como apoyo, ofrece subtítulos en vivo por micrófono. |
| 1.2.5 Audiodescripción (grabado) | No aplica | |
| 1.3.4 Orientación | Cumple | Funciona en vertical y horizontal. |
| 1.3.5 Identificar el propósito de los campos | No aplica | El criterio cubre campos que recogen datos de la persona (nombre, correo, dirección…). Los únicos campos del widget (frases para decir y «¿Qué quieres hacer?») no recogen ninguno de esos datos. |
| 1.4.3 Contraste mínimo | Cumple | Texto ≥ 4,5:1 en el panel (verificado a mano y con axe). |
| 1.4.4 Cambio de tamaño del texto | Cumple | El panel usa `rem`/`em`; con zoom 200 % no pierde contenido. |
| 1.4.5 Imágenes de texto | Cumple | Sin imágenes de texto. |
| 1.4.10 Reajuste | Cumple | A 390 px el panel ocupa el ancho y no hay desplazamiento horizontal. |
| 1.4.11 Contraste no textual | Cumple | Interruptores 3,1:1, bordes 3,1:1, foco 6,5:1, teclas 3,2:1. |
| 1.4.12 Espaciado del texto | Cumple | Sin alturas fijas que corten texto. |
| 1.4.13 Contenido al pasar el cursor o enfocar | Cumple | Los avisos junto al puntero no tapan controles y desaparecen solos; el glosario usa `abbr title`. |
| 2.4.5 Múltiples vías | No aplica | |
| 2.4.6 Encabezados y etiquetas | Cumple | |
| 2.4.7 Foco visible | Cumple | Anillo azul de 3 px en todos los controles. |
| 3.1.2 Idioma de las partes | Cumple | El contenido del sitio se lee con voz de su idioma. |
| 3.2.3 Navegación coherente | Cumple | Pestañas siempre en el mismo orden. |
| 3.2.4 Identificación coherente | Cumple | |
| 3.3.3 Sugerencia ante errores | Cumple | |
| 3.3.4 Prevención de errores | Cumple | «Restablecer todo» avisa de lo que borra; el dictado puede pedir confirmación. |
| 4.1.3 Mensajes de estado | Cumple | Región `role=status aria-live=polite` para avisos; `aria-live=assertive` para sonidos. |

## Tabla 3: WCAG 2.2 (criterios nuevos, nivel AA)

| Criterio | Nivel de conformidad | Observaciones |
|---|---|---|
| 2.4.11 Foco no oculto (mínimo) | Cumple | Las barras fijas del panel no tapan el control enfocado. |
| 2.5.7 Movimientos de arrastre | Cumple | Arrastrar se hace con dos clics. |
| 2.5.8 Tamaño del objetivo (mínimo) | Cumple | Todos los controles ≥ 24×24 px (la mayoría ≥ 44 px). |
| 3.2.6 Ayuda coherente | Cumple | «Acerca de» y el contacto están siempre en la pestaña Más. |
| 3.3.7 Entrada redundante | Cumple | Los ajustes se recuerdan. |
| 3.3.8 Autenticación accesible | No aplica | Sin autenticación. Además, desbloquea el pegado en los campos del sitio. |

## Tabla 4: EN 301 549 v3.2.1, capítulos que aplican a un software de apoyo

| Cláusula | Nivel de conformidad | Observaciones |
|---|---|---|
| 5.2 Activación de funciones de accesibilidad | Cumple | Todo se activa desde el panel, con teclado, cara, voz o pulsador; el modo fácil reduce el panel a ocho botones. |
| 11.5 Interoperabilidad con tecnología de apoyo | Cumple | Roles y estados ARIA; el lector básico no captura teclas de los controles del sitio y avisa de no usarlo con NVDA/JAWS/VoiceOver. |
| 11.7 Preferencias del usuario | Cumple | Respeta `prefers-reduced-motion` y `prefers-contrast` y el idioma de la página. |
| 11.8.1–11.8.4 Herramientas de autor | No aplica | |
| 12.1 Documentación del producto | Cumple | Declaración de accesibilidad, guía de integración y política de datos públicas. |
| 12.2 Servicios de apoyo | Cumple parcialmente | Correo de contacto con compromiso de respuesta; sin línea telefónica. |

## Sección 508 (EE. UU.)

Se cubre por las tablas anteriores (los criterios 508 remiten a WCAG 2.0 A y AA, subconjunto de lo evaluado).

## Notas

- «Cumple» significa que las pruebas automáticas y la revisión manual no encontraron incumplimientos; no equivale a una certificación.
- Pendiente: pruebas con personas usuarias por grupo (protocolo adjunto) y auditoría de un tercero (ICONTEC u organismo acreditado por la ONAC) con alcance «producto Winclus y sitio de referencia».
