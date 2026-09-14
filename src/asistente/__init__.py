"""Asistente de Winclus: «dile lo que quieres» y Winclus lo hace.

- contexto.py: lee la ventana activa por UI Automation (título, controles,
  texto) para que el cerebro sepa qué hay en pantalla.
- acciones.py: ejecuta acciones (abrir programas, escribir, pulsar teclas,
  hacer clic en un control por su nombre, buscar en la web, leer, decir).
- cerebro.py: decide la siguiente acción con Claude (API), con un modelo
  local de Ollama, o con reglas sencillas si no hay ninguno de los dos.
- nucleo.py: el bucle observar → decidir → actuar, en un hilo aparte.
"""

from src.asistente.nucleo import Asistente  # noqa: F401
