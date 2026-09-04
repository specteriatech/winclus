"""Estilo visual de Puntero Libre: colores, tipografías y modo claro u oscuro.

Todos los colores son pares (claro, oscuro): customtkinter elige el que toca
según el modo. Las demás partes del programa deben tomar de aquí sus colores y
fuentes en lugar de escribirlos a mano, para que el aspecto sea coherente.

Estilo «Cálido y claro»: fondo crema, verde profundo como color principal y
ámbar para la acción más importante. Pensado para manejarse con la cara:
controles grandes y mucho espacio.
"""

import json
import logging
from pathlib import Path

import customtkinter

logger = logging.getLogger("Estilo")

AJUSTES = Path("configs/ajustes.json")

# ---------------------------------------------------------------- Colores --
FONDO = ("#FAF6EF", "#1B2422")            # fondo de la ventana
PANEL = ("#F1EADF", "#152019")            # barra lateral
TARJETA = ("#FFFFFF", "#24302D")          # tarjetas y cajas
BORDE = ("#E3DACB", "#35433F")
PRIMARIO = ("#1F6F5C", "#58B69A")         # verde profundo
PRIMARIO_HOVER = ("#185A4A", "#6CC4A9")
PRIMARIO_SUAVE = ("#DCEDE6", "#2B4B42")   # fondo de lo seleccionado
AMBAR = ("#E9A23B", "#F0B455")            # botón principal Activar
AMBAR_HOVER = ("#D18E2C", "#E0A23F")
TEXTO = ("#2B2A28", "#F1ECE2")
TEXTO_SUAVE = ("#6B675F", "#B5AE9F")
TEXTO_SOBRE_PRIMARIO = ("#FFFFFF", "#10201B")
TEXTO_SOBRE_AMBAR = ("#2B2A28", "#2B2A28")
OK = ("#2E9E60", "#4CC07E")
ALERTA = ("#E9A23B", "#F0B455")
ERROR = ("#D9534F", "#E57373")
ENTRADA_ERROR = ("#F6D5D3", "#5A2E2C")
SOMBRA = ("#2B2A28", "#000000")

# ------------------------------------------------------------- Tipografía --
FAMILIA_TITULO = "Bahnschrift"   # viene con Windows 10 y 11
FAMILIA_TEXTO = "Segoe UI"

_DEF_FUENTES = {
    "marca": (FAMILIA_TITULO, 22, "bold"),
    "titulo": (FAMILIA_TITULO, 30, "bold"),
    "subtitulo": (FAMILIA_TITULO, 20, "normal"),
    "cuerpo": (FAMILIA_TEXTO, 15, "normal"),
    "pequena": (FAMILIA_TEXTO, 13, "normal"),
    "etiqueta": (FAMILIA_TEXTO, 15, "bold"),
    "boton": (FAMILIA_TEXTO, 16, "bold"),
    "boton_normal": (FAMILIA_TEXTO, 16, "normal"),
    "boton_grande": (FAMILIA_TEXTO, 20, "bold"),
}
_fuentes = {}


def fuente(nombre: str) -> customtkinter.CTkFont:
    """Devuelve una fuente compartida por nombre: titulo, cuerpo, boton, etc."""
    if nombre not in _fuentes:
        familia, tamano, peso = _DEF_FUENTES[nombre]
        _fuentes[nombre] = customtkinter.CTkFont(family=familia,
                                                 size=tamano,
                                                 weight=peso)
    return _fuentes[nombre]


# ------------------------------------------------------------------ Modo --
_lienzos = []   # (canvas de tkinter, par de colores) para actualizar el fondo


def es_oscuro() -> bool:
    return customtkinter.get_appearance_mode() == "Dark"


def color_actual(par) -> str:
    """Color concreto según el modo (para widgets de tkinter puro, como Canvas)."""
    return par[1] if es_oscuro() else par[0]


def registrar_lienzo(canvas, par=TARJETA) -> None:
    """Un Canvas no entiende pares de colores: se le pone el color y se recuerda
    para cambiarlo al alternar el modo."""
    _lienzos.append((canvas, par))
    canvas.configure(bg=color_actual(par))


def _leer_ajustes() -> dict:
    try:
        with open(AJUSTES, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _guardar_ajustes(datos: dict) -> None:
    try:
        AJUSTES.parent.mkdir(parents=True, exist_ok=True)
        with open(AJUSTES, "w", encoding="utf-8") as f:
            json.dump(datos, f, indent=4, ensure_ascii=False)
    except OSError as e:
        logger.warning(f"No se pudo guardar {AJUSTES}: {e}")


def modo_guardado() -> str:
    """'claro' u 'oscuro', según lo que la persona eligió la última vez."""
    modo = _leer_ajustes().get("modo", "claro")
    return "oscuro" if modo == "oscuro" else "claro"


def modo_actual() -> str:
    return "oscuro" if es_oscuro() else "claro"


def aplicar_modo(modo: str, guardar: bool = True) -> None:
    logger.info(f"Modo {modo}")
    customtkinter.set_appearance_mode("dark" if modo == "oscuro" else "light")
    for canvas, par in _lienzos:
        try:
            canvas.configure(bg=color_actual(par))
        except Exception:   # el canvas pudo haberse destruido
            pass
    if guardar:
        datos = _leer_ajustes()
        datos["modo"] = modo
        _guardar_ajustes(datos)


def alternar_modo() -> str:
    nuevo = "claro" if es_oscuro() else "oscuro"
    aplicar_modo(nuevo)
    return nuevo


def imagen_doble(nombre_base: str, tamano) -> customtkinter.CTkImage:
    """Imagen con versión clara y oscura: assets/images/<base>_claro.png y _oscuro.png."""
    from PIL import Image
    claro = Image.open(f"assets/images/{nombre_base}_claro.png")
    oscuro = Image.open(f"assets/images/{nombre_base}_oscuro.png")
    return customtkinter.CTkImage(light_image=claro, dark_image=oscuro, size=tamano)
