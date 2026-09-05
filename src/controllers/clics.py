"""Clic izquierdo sin usar gestos de la boca: parpadeo o quedarse quieto.

Las formas de hacer clic («modo_clic» en cursor.json):
- "parpadeo": cerrar los dos ojos un momento (ver detectors/parpadeo.py).
- "quieto":   dejar el puntero quieto un tiempo (clic por permanencia).
- "boca" y "cejas" no pasan por aquí: usan la asignación normal de gestos
  (mouse_bindings.json) que ejecuta Keybinder.

El controlador se llama una vez por vuelta del bucle principal (hilo de
tkinter). Con «quieto» además expone el progreso para dibujar el anillo que
se llena junto al puntero (gui/anillo.py).
"""

import logging
import math
import time

import pyautogui
import pydirectinput

from src.config_manager import ConfigManager
from src.controllers.mouse_controller import MouseController
from src.detectors import FaceMesh
from src.singleton_meta import Singleton

logger = logging.getLogger("Clics")

pydirectinput.PAUSE = 0
pydirectinput.FAILSAFE = False

MODOS = ("parpadeo", "boca", "cejas", "quieto")


class ControladorClic(metaclass=Singleton):

    def __init__(self):
        logger.info("Inicializar ControladorClic")
        self.ancla = None          # posición donde el puntero se quedó quieto
        self.ancla_desde = 0.0
        self.ya_clic = False       # ya se hizo clic en este ancla
        self.armado = False        # el puntero se movió desde que se activó
        self.progreso = 0.0        # 0..1 para el anillo
        self.ultimo_clic = 0.0
        self.modo_anterior = None
        self.destello_hasta = 0.0  # para que la interfaz muestre «¡Clic!»

    # ------------------------------------------------------------ general --
    def tick(self) -> None:
        modo = ConfigManager().config.get("modo_clic", "parpadeo")
        if modo != self.modo_anterior:
            self.modo_anterior = modo
            self.reiniciar_quieto()

        activo = MouseController().is_active is not None and MouseController(
        ).is_active.get()
        if not activo:
            self.reiniciar_quieto()
            # Vaciar eventos para que no se disparen al reanudar.
            FaceMesh().parpadeo.tomar_evento()
            return

        if modo == "parpadeo":
            evento = FaceMesh().parpadeo.tomar_evento()
            if evento == "clic":
                self.clic()
        elif modo == "quieto":
            self.tick_quieto()
        else:
            FaceMesh().parpadeo.tomar_evento()

    def clic(self) -> None:
        self.ultimo_clic = time.time()
        self.destello_hasta = self.ultimo_clic + 0.6
        logger.info("Clic izquierdo")
        pydirectinput.click(button="left")

    def hubo_clic_reciente(self) -> bool:
        return time.time() < self.destello_hasta

    # ------------------------------------------------- clic por permanencia --
    def reiniciar_quieto(self) -> None:
        self.ancla = None
        self.ya_clic = False
        self.armado = False
        self.progreso = 0.0

    def tick_quieto(self) -> None:
        cfg = ConfigManager().config
        espera_s = cfg.get("quieto_ms", 1100) / 1000
        radio = cfg.get("quieto_radio_px", 40)
        ahora = time.time()
        x, y = pyautogui.position()

        if self.ancla is None:
            self.ancla = (x, y)
            self.ancla_desde = ahora
            self.ya_clic = True   # no hacer clic donde estaba al activar
            self.progreso = 0.0
            return

        if math.hypot(x - self.ancla[0], y - self.ancla[1]) > radio:
            # El puntero se movió: nuevo ancla y cuenta desde cero.
            self.ancla = (x, y)
            self.ancla_desde = ahora
            self.ya_clic = False
            self.armado = True
            self.progreso = 0.0
            return

        if self.ya_clic or not self.armado:
            self.progreso = 0.0
            return

        self.progreso = min(1.0, (ahora - self.ancla_desde) / espera_s)
        if self.progreso >= 1.0:
            self.ya_clic = True
            self.clic()

    def estado_anillo(self):
        """(x, y, progreso, visible) para dibujar el anillo junto al puntero."""
        cfg = ConfigManager().config
        visible = (cfg.get("modo_clic") == "quieto" and cfg.get("quieto_anillo", True)
                   and self.ancla is not None and not self.ya_clic
                   and self.armado and self.progreso > 0.05)
        if not visible:
            return None
        return self.ancla[0], self.ancla[1], self.progreso
