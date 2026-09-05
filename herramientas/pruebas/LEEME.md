# Guiones de prueba de Gestik

Se ejecutan desde la raíz con `.venv\Scripts\python.exe -u herramientas\pruebas\<guion>.py`.
Antes de los que abren la aplicación hay que cerrar Gestik (usa la cámara).
Los que escriben en `configs/Inicial/cursor.json` hacen copia de seguridad en la
carpeta del guion y la restauran al terminar: NUNCA restaurar desde git, se
perdería la calibración de ojos del usuario.

- `prueba_parpadeo.py`: detector de parpadeo con ojos sintéticos (sin cámara).
- `prueba_calibracion.py`: regresión de la calibración con rasgos sintéticos (sin cámara).
- `prueba_anillo.py`: anillo del clic por permanencia; comprueba que el ratón lo atraviesa.
- `recorrido.py`: abre la app, recorre las páginas y captura con PrintWindow.
- `recorrido_ojos.py`: calibración completa de punta a punta con mirada y cabeza
  sintéticas (parchea FaceMesh.get_rasgos / get_cabeza), más «Comprobar» y «Mejorar».
- `recorrido_lupa.py`: lupa y recentrado con ratón simulado.
- `prueba_iris.py`: temblor del iris (MediaPipe frente a afinado) mirando un punto fijo.
- `prueba_rasgos.py`: estabilidad de las distintas referencias del iris mirando un punto.

Los guiones tienen la ruta del proyecto y de salida escritas a mano (RAIZ y SALIDA):
cámbialas si se mueve la carpeta.
