# Hoja de ruta hacia WCAG AAA · Winclus

Medido el 17 de septiembre de 2026 (widget 0.6.1) con las reglas AAA de axe-core, cálculo de contraste 7:1 y
tamaños de objetivo 44×44 sobre el panel y siete páginas del sitio. Se va marcando a medida que se cierra.
Ninguna norma colombiana exige AAA (la Resolución 1519 pide AA); el objetivo es declarar «AA completo y AAA
alcanzado» como ventaja frente a otros proveedores.

Leyenda: `[ ]` pendiente · `[x]` hecho (con fecha y versión) · `[~]` parcial.

## Ya cumple (verificado 17-sep-2026)

- [x] 2.1.3 Teclado sin excepciones (pruebas de teclado físico y barrido).
- [x] 2.2.3 Sin límites de tiempo no esenciales (el barrido y el clic por quietud son esenciales y ajustables).
- [x] 2.2.4 Interrupciones: los avisos se pueden apagar.
- [x] 2.3.2 Sin destellos; 2.3.3 animaciones desactivables (modo calma y prefers-reduced-motion).
- [x] 2.4.10 Encabezados por sección en el panel y el sitio.
- [x] 2.5.6 Entrada simultánea: ratón, teclado, tacto, cara y voz a la vez.
- [x] 3.2.5 Cambios de contexto solo a petición.
- [x] 3.3.5 Ayuda en cada control (0.6.0) y asistente «¿Qué quieres hacer?».
- [x] 1.4.9 Sin imágenes de texto (el logotipo está exento).
- [x] Reglas AAA automáticas de axe sobre el panel: 0 violaciones.

## Pendiente que cierra el código (un día de trabajo)

- [ ] **1.4.6 Contraste 7:1.** Panel: pestañas inactivas #5A6784 sobre #E8ECF3 (4,8:1), títulos de sección y pie #5A6784 sobre blanco (5,7:1), azul #2F4FD8 de botones y enlaces sobre blanco (6,5:1). Sitio: mismo azul y gris secundario (entre 3 y 53 elementos por página). Acción: oscurecer esos colores en widget.js y paginas.css y subir el umbral de la prueba de contraste a 7:1.
- [ ] **2.5.5 Objetivos 44×44.** Panel: pestañas 51×42, botón cerrar 40×40, «Léemelo» 88×32 (12 controles). Sitio: enlaces de menú y de pie (10 a 19 por página). Acción: min-height 44 en esos controles y padding en los enlaces; añadir la medida a prueba_axe.js.
- [ ] **3.3.6 Prevención de errores (roza el AA).** «Restablecer todo», «Olvidar la calibración», «Olvidar los clics» y «Olvidar las palabras aprendidas» borran sin confirmar. Acción: confirmación en dos pasos dentro del panel (no window.confirm), con prueba.
- [ ] **1.4.8 Presentación visual.** Sitio: espacio entre párrafos ≥ 1,5 veces el interlineado. Widget: elegir colores propios de texto y fondo (además de contraste y modo oscuro), ancho de línea ≤ 80 caracteres en lectura limpia.
- [ ] **3.1.4 Abreviaturas.** WCAG, CSP, SRI, ARIA, LSC, PDF, NVDA, JAWS, INSOR, MinTIC… sin expansión en el sitio. Acción: `<abbr>` en la primera aparición de cada página y una página de glosario enlazada desde el pie.
- [ ] **3.1.5 Nivel de lectura.** integrar, manual y cumplimiento exigen más que secundaria. Acción: bloque «En pocas palabras» en lectura fácil al principio de cada una (o página paralela).
- [ ] **2.4.8 Ubicación.** El sitio no marca dónde estás. Acción: migas de pan bajo la cabecera y enlace resaltado en el menú.
- [ ] **1.2.8 Alternativa textual de los vídeos.** Transcripción completa en texto de los tres vídeos de la demostración (a partir de sus VTT de subtítulos y descripciones), publicada bajo cada vídeo.

## Pendiente que cierra una persona

- [ ] **1.2.6 Lengua de Señas (grabado).** Interpretación en Lengua de Señas Colombiana de los tres vídeos de la demostración (unos cinco minutos en total) por intérprete certificado; se incrusta como ventana en el vídeo o como vídeo alternativo. Hasta entonces la declaración dirá «AAA salvo 1.2.6».

## Al cerrar cada punto

1. Marcarlo aquí con fecha y versión.
2. Actualizar docs/ACR-winclus.md (añadir tabla AAA) y winclus.com/accesibilidad y winclus.com/cumplimiento.
3. Cuando solo quede 1.2.6, declarar «AA completo · AAA alcanzado salvo Lengua de Señas». Con los vídeos interpretados, «AAA completo».
