"""Envío de teclas a la aplicación que tiene el foco (para el teclado en pantalla).

Las letras se mandan como texto Unicode con SendInput, así no dependen de la
distribución del teclado de Windows: «ñ» o «á» llegan bien aunque el sistema
esté en inglés. Las teclas especiales (Intro, flechas, Ctrl…) van por sus
códigos virtuales.

Los modificadores Ctrl, Alt, Mayús y Win se «enganchan»: se pulsan una vez y
se aplican a la siguiente tecla (como las teclas especiales de accesibilidad
de Windows). Pulsados dos veces se quedan fijos hasta que se vuelven a pulsar.
"""

import ctypes
import logging
import time
from ctypes import wintypes

logger = logging.getLogger("Escritura")

INPUT_KEYBOARD = 1
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004
KEYEVENTF_EXTENDEDKEY = 0x0001

# Códigos virtuales de Windows
VK = {
    "backspace": 0x08, "tab": 0x09, "enter": 0x0D, "shift": 0x10, "ctrl": 0x11,
    "alt": 0x12, "pause": 0x13, "capslock": 0x14, "esc": 0x1B, "space": 0x20,
    "pageup": 0x21, "pagedown": 0x22, "end": 0x23, "home": 0x24, "left": 0x25,
    "up": 0x26, "right": 0x27, "down": 0x28, "printscreen": 0x2C, "insert": 0x2D,
    "delete": 0x2E, "win": 0x5B, "apps": 0x5D,
    "f1": 0x70, "f2": 0x71, "f3": 0x72, "f4": 0x73, "f5": 0x74, "f6": 0x75,
    "f7": 0x76, "f8": 0x77, "f9": 0x78, "f10": 0x79, "f11": 0x7A, "f12": 0x7B,
    "volumemute": 0xAD, "volumedown": 0xAE, "volumeup": 0xAF,
}
for _i in range(26):
    VK[chr(ord("a") + _i)] = 0x41 + _i
for _i in range(10):
    VK[str(_i)] = 0x30 + _i

EXTENDIDAS = {"left", "up", "right", "down", "home", "end", "pageup", "pagedown",
              "insert", "delete", "win", "apps"}
MODIFICADORES = ("ctrl", "alt", "shift", "win")

ULONG_PTR = ctypes.c_size_t


class _KEYBDINPUT(ctypes.Structure):
    _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD),
                ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD),
                ("dwExtraInfo", ULONG_PTR)]


class _INPUTUNION(ctypes.Union):
    _fields_ = [("ki", _KEYBDINPUT), ("relleno", ctypes.c_ubyte * 40)]


class _INPUT(ctypes.Structure):
    _fields_ = [("type", wintypes.DWORD), ("u", _INPUTUNION)]


# Instancia propia de user32: ctypes.windll.user32 se comparte con pydirectinput
# y pyautogui, y fijar ahí los argtypes de SendInput rompe sus llamadas.
_user32 = ctypes.WinDLL("user32", use_last_error=True)
_SendInput = _user32.SendInput
_SendInput.argtypes = (wintypes.UINT, ctypes.POINTER(_INPUT), ctypes.c_int)
_SendInput.restype = wintypes.UINT


def _enviar(entradas) -> None:
    n = len(entradas)
    arr = (_INPUT * n)(*entradas)
    enviadas = _SendInput(n, arr, ctypes.sizeof(_INPUT))
    if enviadas != n:
        # Suele ser UIPI: la ventana activa es de un programa «como
        # administrador» y Windows no deja inyectar teclas desde Winclus
        codigo = ctypes.get_last_error()
        logger.warning(f"SendInput envió {enviadas} de {n} (error {codigo}); "
                       "¿la ventana activa se ejecuta como administrador?")


def _entrada_vk(vk: int, soltar: bool, extendida: bool = False) -> _INPUT:
    flags = KEYEVENTF_KEYUP if soltar else 0
    if extendida:
        flags |= KEYEVENTF_EXTENDEDKEY
    e = _INPUT(type=INPUT_KEYBOARD)
    e.u.ki = _KEYBDINPUT(vk, 0, flags, 0, 0)
    return e


def _entrada_unicode(codigo: int, soltar: bool) -> _INPUT:
    flags = KEYEVENTF_UNICODE | (KEYEVENTF_KEYUP if soltar else 0)
    e = _INPUT(type=INPUT_KEYBOARD)
    e.u.ki = _KEYBDINPUT(0, codigo, flags, 0, 0)
    return e


def escribir_texto(texto: str) -> None:
    """Escribe el texto tal cual, letra a letra, en la aplicación con el foco."""
    entradas = []
    for ch in texto:
        for codigo in _utf16(ch):
            entradas.append(_entrada_unicode(codigo, False))
            entradas.append(_entrada_unicode(codigo, True))
    if entradas:
        _enviar(entradas)


def _utf16(ch: str):
    datos = ch.encode("utf-16-le")
    return [int.from_bytes(datos[i:i + 2], "little") for i in range(0, len(datos), 2)]


def pulsar_tecla(nombre: str, modificadores=()) -> None:
    """Pulsa una tecla especial (o una letra por su código) con modificadores."""
    vk = VK.get(nombre)
    if vk is None:
        logger.warning(f"Tecla desconocida: {nombre}")
        return
    entradas = []
    for m in modificadores:
        entradas.append(_entrada_vk(VK[m], False, m == "win"))
    entradas.append(_entrada_vk(vk, False, nombre in EXTENDIDAS))
    entradas.append(_entrada_vk(vk, True, nombre in EXTENDIDAS))
    for m in reversed(modificadores):
        entradas.append(_entrada_vk(VK[m], True, m == "win"))
    _enviar(entradas)


def atajo(*teclas) -> None:
    """Atajo tipo Ctrl+C: todas menos la última son modificadores."""
    pulsar_tecla(teclas[-1], teclas[:-1])


class Modificadores:
    """Estado de Ctrl, Alt, Mayús y Win: sueltos, enganchados o fijos."""

    SUELTO, ENGANCHADO, FIJO = 0, 1, 2

    def __init__(self):
        self.estado = {m: self.SUELTO for m in MODIFICADORES}

    def pulsar(self, nombre: str) -> int:
        """Ciclo suelto → enganchado → fijo → suelto. Devuelve el estado nuevo."""
        actual = self.estado[nombre]
        nuevo = (actual + 1) % 3
        self.estado[nombre] = nuevo
        return nuevo

    def activos(self) -> tuple:
        return tuple(m for m in MODIFICADORES if self.estado[m] != self.SUELTO)

    def consumir(self) -> None:
        """Tras una tecla, los enganchados se sueltan; los fijos siguen."""
        for m in MODIFICADORES:
            if self.estado[m] == self.ENGANCHADO:
                self.estado[m] = self.SUELTO

    def soltar_todos(self) -> None:
        for m in MODIFICADORES:
            self.estado[m] = self.SUELTO


def escribir_con_modificadores(texto: str, mods: Modificadores) -> None:
    """Un carácter con Ctrl o Alt enganchado se manda como atajo (Ctrl+S);
    sin ellos, como texto. Mayús con texto solo cambia a mayúscula."""
    activos = mods.activos()
    duros = tuple(m for m in activos if m in ("ctrl", "alt", "win"))
    if duros and len(texto) == 1 and texto.lower() in VK:
        pulsar_tecla(texto.lower(), activos)
    else:
        if "shift" in activos and texto.islower():
            texto = texto.upper()
        escribir_texto(texto)
    mods.consumir()


def pulsar_con_modificadores(nombre: str, mods: Modificadores) -> None:
    pulsar_tecla(nombre, mods.activos())
    mods.consumir()
    time.sleep(0)   # cede el turno; algunas apps procesan el atajo despacio
