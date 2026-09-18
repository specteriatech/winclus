# Guiones de prueba de Winclus

Se ejecutan desde la raíz con `.venv\Scripts\python.exe -u herramientas\pruebas\<guion>.py`.
Antes de los que abren la aplicación hay que cerrar Winclus (usa la cámara).
Los que escriben en `configs/Inicial/cursor.json` hacen copia de seguridad en la
carpeta del guion y la restauran al terminar: NUNCA restaurar desde git, se
perdería la calibración de ojos del usuario.

- `prueba_parpadeo.py`: detector de parpadeo con ojos sintéticos (sin cámara).
- `prueba_calibracion.py`: regresión de la calibración con rasgos sintéticos (sin cámara).
- `prueba_bordes.py`: bajar y subir llevando el puntero al borde (sin cámara): en qué franja está el puntero,
  que el centro no desplaza, que una pantalla muy baja no los usa y que la rueda se manda lejos de la barra de tareas.
- `prueba_anillo.py`: anillo del clic por permanencia; comprueba que el ratón lo atraviesa.
- `recorrido.py`: abre la app, recorre las páginas y captura con PrintWindow.
- `recorrido_ojos.py`: calibración completa de punta a punta con mirada y cabeza
  sintéticas (parchea FaceMesh.get_rasgos / get_cabeza), más «Comprobar» y «Mejorar».
- `recorrido_lupa.py`: lupa y recentrado con ratón simulado.
- `prueba_iris.py`: temblor del iris (MediaPipe frente a afinado) mirando un punto fijo.
- `prueba_rasgos.py`: estabilidad de las distintas referencias del iris mirando un punto.
- `recorrido_teclado.py`: teclado en pantalla; muestra cada capa, pulsa teclas simuladas
  (SendInput sustituido por un registro, no escribe nada real) y captura. No toca cursor.json.
- `recorrido_pausa.py`: aviso grande de «puntero en pausa» y botón Pausar protegido: inyecta
  un parpadeo sobre el botón (se ignora) y un gesto largo (pausa). Mueve el ratón real, pero
  solo dentro de la ventana de Winclus.
- `prueba_aprendizaje.py`: calibración invisible sin cámara: calibrar de cero con clics
  sintéticos (con la cabeza moviéndose), corregir un modelo desviado, rechazar clics que no
  cuadran, ventana de rasgos antes del clic, y datos reales del perfil.
- `recorrido_aprendizaje.py`: tarjeta «Calibración invisible» en la página Puntero; anota dos
  clics sintéticos (sin clics reales) y los borra al terminar.
- `prueba_hibrido.py`: modo híbrido sin cámara: regla de salto y simulación del bucle con
  ratón falso (la mirada salta, la cabeza afina, no salta mientras la cabeza se mueve).
- `recorrido_hibrido.py`: panel «Híbrido» de la página Puntero; deja el modo como estaba.
- `prueba_menu.py`: menú de clics sin cámara: geometría del anillo, resaltado con cursor simulado,
  cierre por tiempo y flujo del controlador (derecho, arrastrar/soltar, rueda, teclado) con clics falsos.
- `recorrido_menu.py`: abre el anillo en un punto fijo de la ventana de Winclus y lo captura. NO mueve
  el ratón real ni hace clics.

- `prueba_bloque2.py`: exportar e importar perfiles (.winclus, sin pisar ninguno; borra los de prueba),
  aviso junto al puntero con cursor simulado, y botones − / + de los deslizadores.
- `recorrido_bloque2.py`: capturas de Puntero (− / +), Clics (tarjeta Avisos), editor de perfiles
  (Agregar / Exportar / Importar) y el aviso «Clic derecho». No mueve el ratón.

- `prueba_voz_iman.py`: voz SAPI (habla de verdad un momento), frases guardadas, capa «Frases» del
  teclado e imán a los controles con una ventanita WinForms de prueba (aparece 3 s y se cierra).
- `recorrido_voz_iman.py`: capturas de Escribir (Voz y Frases), teclado abc y capa Frases, e Imán en Puntero.

- `prueba_parpadeo_real.py`: cierres de ojos medidos al usuario (un ojo se queda más abierto) con la
  regla de la media: cuentan como clic; guiño y parpadeo involuntario no.

- `prueba_asistente.py`: asistente sin cámara: lectura de pantalla por UI Automation sobre una ventana
  WinForms de prueba, ejecutor con acciones simuladas, cerebro de reglas, y si Ollama responde, un
  plan real con el modelo local (no ejecuta nada real: el ejecutor está sustituido).
- `recorrido_asistente.py`: captura de la página Asistente y del menú con el sector nuevo.

- `recorrido_oscuro.py`: captura las siete páginas en modo claro y en modo oscuro (cambia el modo con el
  mismo botón del menú), abre el teclado en oscuro y comprueba que se reconstruye al volver a claro; deja el
  modo guardado como estaba. Capturas cap_claro_*.png y cap_oscuro_*.png. No mueve el ratón.
  (16-sep-2026: todo correcto; el fallo de modo oscuro de la auditoría era solo del widget web, ver widget/LEEME.md.)

Regla: los recorridos no deben mover el ratón real (el usuario suele estar usándolo) ni hacer clics.

Los guiones tienen la ruta del proyecto y de salida escritas a mano (RAIZ y SALIDA):
cámbialas si se mueve la carpeta.
