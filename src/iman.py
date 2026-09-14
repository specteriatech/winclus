"""Imán a los controles: cuando el puntero se queda cerca de un botón, un
enlace o una casilla, se pega a su centro.

Windows expone cada control por UI Automation. Cuando el puntero descansa
(la mirada se fija, o la cabeza se para), se pregunta qué control hay en
ese punto y en un anillo de puntos alrededor, dentro de «iman_radio_px».
Si el más cercano es clicable y el puntero no está ya encima, se mueve el
puntero a su centro y se avisa con el nombre del control. Así el error de
un centímetro de la mirada deja de importar: basta con llegar cerca.

Corre en un hilo propio (UI Automation es COM) a unas 8 consultas por
segundo como máximo y solo cuando el punto de reposo cambia.
"""

import ctypes
import ctypes.wintypes
import logging
import math
import threading
import time

from src.config_manager import ConfigManager
from src.singleton_meta import Singleton

logger = logging.getLogger("Iman")

# Tipos de control de UI Automation que se pueden pulsar
TIPOS_CLICABLES = {
    50000: "botón", 50002: "casilla", 50003: "lista desplegable", 50004: "campo de texto",
    50005: "enlace", 50007: "elemento", 50011: "opción de menú", 50013: "opción",
    50016: "selector", 50019: "pestaña", 50024: "elemento", 50031: "botón",
}
TAMANO_MAX = (520, 320)      # más grande que esto no es un botón: es un panel
REPOSO_S = 0.30              # con la cabeza: quieto este tiempo = reposo
INTERVALO_S = 0.12


def _rect_valido(r):
    return r is not None and r.right > r.left and r.bottom > r.top


class Iman(metaclass=Singleton):

    def __init__(self):
        self.hilo = None
        self.parar = threading.Event()
        self.procesado = None          # último punto de reposo ya consultado
        self.ultimo_objetivo = None
        self.avisar = None             # fn(texto) para la etiqueta junto al puntero
        self._pos_anterior = None
        self._pos_desde = 0.0
        self.uia = None
        self.mover = None              # fn(x, y): mueve el puntero y fija (lo pone main_gui)

    # ------------------------------------------------------------ hilo --
    def start(self):
        if self.hilo is None:
            self.hilo = threading.Thread(target=self._bucle, name="iman", daemon=True)
            self.hilo.start()

    def detener(self):
        self.parar.set()

    def _preparar(self):
        import comtypes
        import comtypes.client
        comtypes.CoInitialize()
        comtypes.client.GetModule("UIAutomationCore.dll")
        from comtypes.gen import UIAutomationClient as UIA
        self.uia = comtypes.client.CreateObject(UIA.CUIAutomation, interface=UIA.IUIAutomation)

    def _bucle(self):
        try:
            self._preparar()
        except Exception as e:
            logger.warning(f"Imán sin UI Automation: {e}")
            return
        logger.info("Imán listo")
        while not self.parar.is_set():
            time.sleep(INTERVALO_S)
            try:
                self._paso()
            except Exception as e:
                logger.warning(f"Imán: {e}")

    # --------------------------------------------------------- decisión --
    def activo(self) -> bool:
        cfg = ConfigManager().config or {}
        return bool(cfg.get("iman_activo", True)) and cfg.get("modo_puntero") == "ojos"

    def _punto_reposo(self):
        """Dónde descansa el puntero ahora, o None si se está moviendo."""
        from src.controllers.mouse_controller import MouseController
        mc = MouseController()
        if mc.is_active is None or not mc.is_active.get() or mc.calibrando or mc.lupa is not None:
            return None
        import pyautogui
        x, y = pyautogui.position()
        ahora = time.time()
        if (x, y) != self._pos_anterior:
            self._pos_anterior = (x, y)
            self._pos_desde = ahora
            return None
        if ahora - self._pos_desde < REPOSO_S:
            return None
        return (int(x), int(y))

    def _paso(self):
        if not self.activo():
            return
        punto = self._punto_reposo()
        if punto is None or punto == self.procesado:
            return
        self.procesado = punto
        radio = float((ConfigManager().config or {}).get("iman_radio_px", 90))
        objetivo = self.buscar(punto, radio)
        if objetivo is None:
            return
        cx, cy, nombre, tipo = objetivo
        if abs(cx - punto[0]) < 2 and abs(cy - punto[1]) < 2:
            return
        logger.info(f"Imán: {punto} → ({cx}, {cy}) {tipo} {nombre!r}")
        self.ultimo_objetivo = objetivo
        self.procesado = (cx, cy)      # el nuevo reposo ya está resuelto
        self._pos_anterior = (cx, cy)
        self._pos_desde = time.time()
        if self.mover is not None:
            self.mover(cx, cy)
        if self.avisar is not None and nombre and (ConfigManager().config or {}).get("avisos_visuales", True):
            try:
                self.avisar(f"{tipo}: {nombre[:28]}")
            except Exception as e:
                logger.warning(f"Aviso del imán: {e}")

    # ---------------------------------------------------------- búsqueda --
    def _elemento_en(self, x, y):
        try:
            el = self.uia.ElementFromPoint(ctypes.wintypes.POINT(int(x), int(y)))
        except Exception:
            return None
        if el is None:
            return None
        try:
            tipo = int(el.CurrentControlType)
            if tipo not in TIPOS_CLICABLES:
                return None
            r = el.CurrentBoundingRectangle
            if not _rect_valido(r):
                return None
            if r.right - r.left > TAMANO_MAX[0] or r.bottom - r.top > TAMANO_MAX[1]:
                return None
            nombre = el.CurrentName or ""
        except Exception:
            return None
        return (int(r.left), int(r.top), int(r.right), int(r.bottom), nombre, TIPOS_CLICABLES[tipo])

    def buscar(self, punto, radio):
        """Control clicable más cercano al punto (a `radio` px como mucho):
        (cx, cy, nombre, tipo) o None. Si el punto ya está sobre uno, None."""
        if self.uia is None:
            return None
        x, y = punto
        propio = self._elemento_en(x, y)
        if propio is not None:
            return None
        # Rayos en 12 direcciones con 4 radios: un botón de 40 px no se cuela
        # entre dos muestras (UI Automation responde en un milisegundo o dos)
        # Se recorren los anillos de dentro afuera y se para en el primero
        # que encuentra algo: lo más cercano está en el anillo más pequeño.
        vistos = {}
        for f in (0.3, 0.55, 0.8, 1.0):
            r = radio * f
            for k in range(12):
                a = k * math.pi / 6
                e = self._elemento_en(x + r * math.cos(a), y + r * math.sin(a))
                if e is None:
                    continue
                clave = e[:4]
                if clave in vistos:
                    continue
                x1, y1, x2, y2, nombre, tipo = e
                dx = max(x1 - x, 0, x - x2)
                dy = max(y1 - y, 0, y - y2)
                vistos[clave] = (math.hypot(dx, dy), (x1 + x2) // 2, (y1 + y2) // 2, nombre, tipo)
            if vistos:
                break
        if not vistos:
            return None
        d, cx, cy, nombre, tipo = min(vistos.values(), key=lambda v: v[0])
        if d > radio:
            return None
        return (cx, cy, nombre, tipo)
