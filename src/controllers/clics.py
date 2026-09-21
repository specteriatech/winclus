"""Clic izquierdo sin usar gestos de la boca: parpadeo o quedarse quieto.

Las formas de hacer clic («modo_clic» en cursor.json):
- "parpadeo": cerrar los dos ojos un momento (ver detectors/parpadeo.py).
- "quieto":   dejar el puntero quieto un tiempo (clic por permanencia).
- "boca" y "cejas" no pasan por aquí: usan la asignación normal de gestos
  (mouse_bindings.json) que ejecuta Keybinder.

Con el puntero guiado por los ojos (modo directo) el clic va en dos pasos si
la lupa está activa: el primer gesto abre la zona agrandada alrededor del
puntero y el segundo pulsa en el punto real que se mira dentro de ella
(gui/lupa.py).

Con los ojos cerrados 1,2 s se abre el menú de clics (gui/menu_clics.py):
clic derecho, doble clic, arrastrar y soltar, rueda, teclado, recentrar la
mirada (gui/calibracion.py) o pausar. Mientras está abierto, el gesto de
clic elige el sector que hay bajo el puntero en vez de hacer clic; la acción
se ejecuta en el punto donde se abrió el menú. Al arrastrar, el siguiente
gesto de clic suelta.

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
from src.detectors.aprendizaje import AprendizajeClics
from src.detectors.calibracion import es_valido
from src.singleton_meta import Singleton

logger = logging.getLogger("Clics")

pydirectinput.PAUSE = 0
pydirectinput.FAILSAFE = False

MODOS = ("parpadeo", "boca", "cejas", "quieto")


def _pitido():
    """Sonido corto de clic, en un hilo para no frenar el bucle."""
    try:
        import threading
        import winsound
        threading.Thread(target=winsound.Beep, args=(1000, 40), daemon=True).start()
    except Exception:
        pass
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
        self.teclado_gui = None    # teclado en pantalla: sobre él no hace falta lupa
        self.abrir_recentrado = None
        # Botón «Pausar» de la ventana: un parpadeo normal encima no pausa
        # (evitaba apagar Winclus sin querer); los ojos cerrados 1,2 s sí.
        self.sobre_pausar = None   # (x, y) -> bool
        self.pausar = None         # pone el puntero en pausa
        self.avisar_pausa = None   # la interfaz explica cómo pausar
        # Menú de clics (gui/menu_clics.py) y lo que puede lanzar
        self.menu_gui = None
        self.alternar_teclado = None
        self.abrir_asistente = None
        self.menu_ancla = None     # dónde estaba el puntero al abrir el menú
        self.arrastrando = False   # botón izquierdo sujeto: el próximo clic suelta
        self.avisar = None         # fn(texto): etiqueta junto al puntero (gui/aviso.py)

    def _aviso(self, texto: str) -> None:
        """Aviso visual y/o sonoro de lo que acaba de pasar, según ajustes."""
        cfg = ConfigManager().config or {}
        if cfg.get("avisos_visuales", True) and self.avisar is not None:
            try:
                self.avisar(texto)
            except Exception as e:
                logger.warning(f"Aviso: {e}")
        if cfg.get("avisos_sonido", False):
            _pitido()
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
            self.cerrar_menu()
            self.soltar_arrastre()
            # Vaciar eventos para que no se disparen al reanudar.
            FaceMesh().parpadeo.tomar_evento()
            return

        evento = FaceMesh().parpadeo.tomar_evento()

        # Sobre el botón «Pausar»: solo el gesto largo pausa
        if evento == "largo" and self._sobre_boton_pausa():
            logger.info("Ojos cerrados 1,2 s sobre Pausar: puntero en pausa")
            self.cerrar_lupa()
            self.reiniciar_quieto()
            if self.pausar is not None:
                self.pausar()
            return

        # Ojos cerrados 1,2 s: menú de clics (o cerrarlo si ya estaba abierto)
        if evento == "largo":
            self.cerrar_lupa()
            self.reiniciar_quieto()
            if self.menu_gui is not None and self.menu_gui.visible:
                self.cerrar_menu()
            else:
                self.abrir_menu()
            return

        if MouseController().lupa is not None:
            self._vigilar_lupa()

        if modo == "parpadeo":
            if evento == "clic":
                self.clic()
        elif modo == "quieto":
            self.tick_quieto()

    def clic(self) -> None:
        from src.barrido import Barrido
        if Barrido().activo:
            # Con el barrido activo, el gesto de clic es la señal del pulsador: pulsa lo que marca el marco
            Barrido().senal()
            return
        if self._sobre_boton_pausa():
            # Un parpadeo o una permanencia encima de «Pausar» no apagan el
            # puntero: hace falta cerrar los ojos 1,2 s.
            logger.info("Clic sobre Pausar ignorado: cierra los ojos 1,2 s para pausar")
            if self.avisar_pausa is not None:
                self.avisar_pausa()
            return
        if self.menu_gui is not None and self.menu_gui.visible:
            x, y = pyautogui.position()
            self.elegir_opcion(self.menu_gui.opcion_en(x, y))
            return
        if self.arrastrando:
            self.soltar_arrastre()
            return
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
            # Calibración invisible: el punto real de la lupa enseña al modelo
            # con los rasgos de cuando se abrió (el primer gesto)
            AprendizajeClics().anotar_clic(rx, ry, "lupa", t=self.lupa_desde,
                                           parpadeo=self._clic_por_parpadeo())
            self._pulsar()
            return
        self._pulsar()

    def _clic_por_parpadeo(self) -> bool:
        return ConfigManager().config.get("modo_clic", "parpadeo") == "parpadeo"

    def _pulsar(self) -> None:
        self.ultimo_clic = time.time()
        self.destello_hasta = self.ultimo_clic + 0.6
        logger.info("Clic izquierdo")
        pydirectinput.click(button="left")
        self._aviso("Clic")
        AprendizajeClics().anotar_clic_puntero(parpadeo=self._clic_por_parpadeo())

    def hubo_clic_reciente(self) -> bool:
        return time.time() < self.destello_hasta

    # ------------------------------------------------------ menú de clics --
    def opciones_menu(self):
        """Sectores del anillo, en el sentido del reloj empezando arriba."""
        cfg = ConfigManager().config
        puede_recentrar = (cfg.get("modo_puntero") == "ojos"
                           and cfg.get("ojos_modo", "directo") in ("directo", "hibrido")
                           and es_valido(cfg.get("ojos_calibracion"))
                           and self.abrir_recentrado is not None)
        return [
            ("derecho", "Clic derecho"),
            ("doble", "Doble clic"),
            ("soltar", "Soltar") if self.arrastrando else ("arrastrar", "Arrastrar"),
            ("teclado", "Teclado"),
            ("asistente", "Asistente"),
            ("rueda_abajo", "Rueda abajo"),
            ("recentrar", "Recentrar") if puede_recentrar else ("pausar", "Pausar"),
            ("rueda_arriba", "Rueda arriba"),
        ]

    def abrir_menu(self) -> None:
        if self.menu_gui is None:
            return
        x, y = pyautogui.position()
        self.menu_ancla = (int(x), int(y))
        self.menu_gui.mostrar(x, y, self.opciones_menu())
        self.reiniciar_quieto()   # que la permanencia no elija nada sin moverse

    def cerrar_menu(self) -> None:
        if self.menu_gui is not None and self.menu_gui.visible:
            self.menu_gui.ocultar()
            self.reiniciar_quieto()

    def _ir_al_ancla(self) -> None:
        if self.menu_ancla is None:
            return
        MouseController().congelar(0.4)
        pyautogui.moveTo(*self.menu_ancla)

    def elegir_opcion(self, clave) -> None:
        """Ejecuta la opción del menú elegida con el gesto de clic."""
        logger.info(f"Menú de clics: {clave}")
        if clave in ("rueda_arriba", "rueda_abajo"):
            # La rueda va al punto donde se abrió el menú, con el anillo
            # escondido para que no la reciba él; luego vuelve a abrirse.
            self.menu_gui.ocultar()
            self._ir_al_ancla()
            pyautogui.scroll(5 if clave == "rueda_arriba" else -5)
            self._aviso("Rueda arriba" if clave == "rueda_arriba" else "Rueda abajo")
            self.menu_gui.mostrar(self.menu_ancla[0], self.menu_ancla[1], self.opciones_menu())
            self.reiniciar_quieto()
            return
        self.cerrar_menu()
        if clave == "derecho":
            self._ir_al_ancla()
            pydirectinput.click(button="right")
            self._aviso("Clic derecho")
        elif clave == "doble":
            self._ir_al_ancla()
            pydirectinput.click(button="left", clicks=2, interval=0.08)
            self._aviso("Doble clic")
        elif clave == "arrastrar":
            self._ir_al_ancla()
            pydirectinput.mouseDown(button="left")
            self.arrastrando = True
            logger.info("Arrastrando: el siguiente clic suelta")
            self._aviso("Arrastrando: clic para soltar")
        elif clave == "soltar":
            self._ir_al_ancla()
            self.soltar_arrastre()
        elif clave == "teclado":
            if self.alternar_teclado is not None:
                self.alternar_teclado()
        elif clave == "asistente":
            if self.abrir_asistente is not None:
                self.abrir_asistente()
        elif clave == "recentrar":
            if self.abrir_recentrado is not None:
                self.abrir_recentrado()
        elif clave == "pausar":
            if self.pausar is not None:
                self.pausar()
        # "cerrar", None y desconocidas: solo se cierra el menú

    def soltar_arrastre(self) -> None:
        if not self.arrastrando:
            return
        self.arrastrando = False
        pydirectinput.mouseUp(button="left")
        logger.info("Soltado")
        self._aviso("Soltado")

    def _sobre_boton_pausa(self) -> bool:
        if self.sobre_pausar is None:
            return False
        try:
            return bool(self.sobre_pausar(*pyautogui.position()))
        except Exception as e:
            logger.warning(f"Botón Pausar: {e}")
            return False

    # --------------------------------------------------------------- lupa --
    def _ojos_directo(self) -> bool:
        cfg = ConfigManager().config
        return (cfg.get("modo_puntero") == "ojos"
                and cfg.get("ojos_modo", "directo") == "directo"
                and es_valido(cfg.get("ojos_calibracion")))

    def _lupa_corresponde(self) -> bool:
        if self.teclado_gui is not None and self.teclado_gui.contiene(*pyautogui.position()):
            return False   # las teclas son grandes: se pulsan directamente
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
