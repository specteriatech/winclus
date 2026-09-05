"""Clic izquierdo sin usar gestos de la boca: parpadeo o quedarse quieto.

Las formas de hacer clic («modo_clic» en cursor.json):
- "parpadeo": cerrar los dos ojos un momento (ver detectors/parpadeo.py).
- "quieto":   dejar el puntero quieto un tiempo (clic por permanencia).
- "boca" y "cejas" no pasan por aquí: usan la asignación normal de gestos
  (mouse_bindings.json) que ejecuta Keybinder.

Con el puntero guiado por los ojos (modo directo) el clic va en dos pasos si
la lupa está activa: el primer gesto abre la zona agrandada alrededor del
puntero y el segundo pulsa en el punto real que se mira dentro de ella
(gui/lupa.py). Y con los ojos cerrados 1,2 s se abre la corrección rápida
del centro (gui/calibracion.py).

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
from src.detectors.calibracion import es_valido
from src.singleton_meta import Singleton

logger = logging.getLogger("Clics")

pydirectinput.PAUSE = 0
pydirectinput.FAILSAFE = False

MODOS = ("parpadeo", "boca", "cejas", "quieto")
LUPA_FUERA_S = 1.0     # mirada fuera de la lupa este tiempo = se cierra


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
        # Los pone la interfaz (main_gui.py): ventana de la lupa y cómo abrir
        # la corrección del centro
        self.lupa_gui = None
        self.abrir_recentrado = None
        self.lupa_desde = 0.0

    # ------------------------------------------------------------ general --
    def tick(self) -> None:
        cfg = ConfigManager().config
        modo = cfg.get("modo_clic", "parpadeo")
        if modo != self.modo_anterior:
            self.modo_anterior = modo
            self.reiniciar_quieto()

        activo = MouseController().is_active is not None and MouseController(
        ).is_active.get()
        if not activo or MouseController().calibrando:
            self.reiniciar_quieto()
            self.cerrar_lupa()
            # Vaciar eventos para que no se disparen al reanudar.
            FaceMesh().parpadeo.tomar_evento()
            return

        evento = FaceMesh().parpadeo.tomar_evento()

        # Ojos cerrados 1,2 s con el puntero por los ojos: corregir el centro
        if (evento == "largo" and self._ojos_directo() and cfg.get("ojos_recentrar_largo", True)
                and self.abrir_recentrado is not None):
            self.cerrar_lupa()
            self.reiniciar_quieto()
            self.abrir_recentrado()
            return

        if MouseController().lupa is not None:
            self._vigilar_lupa()

        if modo == "parpadeo":
            if evento == "clic":
                self.clic()
        elif modo == "quieto":
            self.tick_quieto()

    def clic(self) -> None:
        if self._lupa_corresponde():
            if MouseController().lupa is None:
                self.abrir_lupa()
                return
            # Segundo gesto: pulsar en el punto real que se mira en la lupa
            x, y = pyautogui.position()
            rx, ry = self.lupa_gui.punto_real(MouseController().lupa, x, y)
            self.cerrar_lupa()
            MouseController().congelar(0.35)
            pyautogui.moveTo(int(rx), int(ry))
            self._pulsar()
            return
        self._pulsar()

    def _pulsar(self) -> None:
        self.ultimo_clic = time.time()
        self.destello_hasta = self.ultimo_clic + 0.6
        logger.info("Clic izquierdo")
        pydirectinput.click(button="left")

    def hubo_clic_reciente(self) -> bool:
        return time.time() < self.destello_hasta

    # --------------------------------------------------------------- lupa --
    def _ojos_directo(self) -> bool:
        cfg = ConfigManager().config
        return (cfg.get("modo_puntero") == "ojos"
                and cfg.get("ojos_modo", "directo") == "directo"
                and es_valido(cfg.get("ojos_calibracion")))

    def _lupa_corresponde(self) -> bool:
        return (self.lupa_gui is not None and self._ojos_directo()
                and bool(ConfigManager().config.get("lupa_activa", True)))

    def abrir_lupa(self) -> None:
        cfg = ConfigManager().config
        x, y = pyautogui.position()
        geometria = self.lupa_gui.mostrar(x, y,
                                          cfg.get("lupa_region_px", 220),
                                          cfg.get("lupa_zoom", 3),
                                          cfg["ojos_calibracion"]["monitor"])
        if geometria is None:
            self._pulsar()
            return
        logger.info(f"Lupa abierta en ({x}, {y})")
        MouseController().lupa_fuera_desde = None
        MouseController().lupa = geometria
        self.lupa_desde = time.time()
        # Para «quieto»: la cuenta empieza ya, sin exigir que el puntero se
        # mueva; si se mira el mismo sitio, se pulsa ahí pasado el tiempo.
        self.reiniciar_quieto()
        self.ancla = (x, y)
        self.ancla_desde = self.lupa_desde
        self.armado = True
        self.ya_clic = False

    def _vigilar_lupa(self) -> None:
        ahora = time.time()
        fuera = MouseController().lupa_fuera_desde
        if ahora - self.lupa_desde > ConfigManager().config.get("lupa_tiempo_max_s", 8):
            logger.info("Lupa cerrada por tiempo")
            self.cerrar_lupa()
        elif fuera is not None and ahora - fuera > LUPA_FUERA_S:
            logger.info("Lupa cerrada: la mirada se fue")
            self.cerrar_lupa()

    def cerrar_lupa(self) -> None:
        if MouseController().lupa is None:
            return
        MouseController().lupa = None
        MouseController().lupa_fuera_desde = None
        if self.lupa_gui is not None:
            self.lupa_gui.ocultar()

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
        """(x, y, progreso) para dibujar el anillo junto al puntero, o None."""
        cfg = ConfigManager().config
        visible = (cfg.get("modo_clic") == "quieto" and cfg.get("quieto_anillo", True)
                   and self.ancla is not None and not self.ya_clic
                   and self.armado and self.progreso > 0.05)
        if not visible:
            return None
        return self.ancla[0], self.ancla[1], self.progreso
