"""Ajustes globales de Winclus (no dependen del perfil): configs/ajustes.json.

Ahí viven el modo claro/oscuro (src/estilo.py) y los ajustes del asistente:
qué cerebro usar, la clave de Claude y el modelo de Ollama. El archivo está
ignorado en git porque contiene la clave.
"""

import threading

from src import estilo

_candado = threading.Lock()


def leer() -> dict:
    with _candado:
        return estilo._leer_ajustes()


def obtener(clave: str, defecto=None):
    return leer().get(clave, defecto)


def guardar(clave: str, valor) -> None:
    with _candado:
        datos = estilo._leer_ajustes()
        datos[clave] = valor
        estilo._guardar_ajustes(datos)
