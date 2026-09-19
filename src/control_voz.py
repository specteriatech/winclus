"""Control por voz: enciende el micrófono y hace lo que se le dice.

Junta las tres piezas: `src/escucha.py` (oír con el motor de Windows),
`src/ordenes_voz.py` (entender la frase) y lo que ya sabe hacer Winclus
(escribir con SendInput, pulsar botones por UI Automation, mover la rueda,
hablar). La interfaz solo llama a `alternar()`, `dictar()` y `estado()`.

Las órdenes se oyen con una lista cerrada de frases, así que el motor acierta
más y trabaja sin internet. La lista se rehace sola cuando cambia la ventana
de delante, para que «pulsa Aceptar» conozca los botones que hay ahora.
"""

import logging
import queue
import threading
import time

import pyautogui
import pydirectinput

from src import ordenes_voz
from src.asistente.acciones import Ejecutor
from src.asistente.contexto import LectorPantalla
from src.config_manager import ConfigManager
from src.controllers import escritura
from src.escucha import Escucha
from src.ordenes_voz import EjecutorVoz
from src.singleton_meta import Singleton
from src.voz import Voz

logger = logging.getLogger("ControlVoz")

MAX_LEER = 700          # lo que se lee en voz alta de una pantalla, como mucho
REVISAR_VENTANA_S = 4   # cada cuánto se mira si cambió la ventana de delante


def _ventana_de_delante():
    try:
        import win32gui
        return win32gui.GetForegroundWindow()
    except Exception:
        return 0


class ControlVoz(metaclass=Singleton):

    def __init__(self):
        # UI Automation es COM y COM es de un solo hilo: lo que se oye llega
        # por el hilo de Windows y la lista de órdenes se rehace en otro, así
        # que cada hilo tiene su propio lector (lo dice src/asistente/contexto.py).
        self._locales = threading.local()
        self.acciones = Ejecutor(lector=LectorPantalla(), decir=self._decir)
        self.ejecutor = EjecutorVoz(self._ganchos())
        # Ganchos que pone main_gui.py (lo que vive en la interfaz)
        self.avisar = None            # fn(texto, ms, color)
        self.pausar = None            # fn()
        self.seguir = None            # fn()
        self.alternar_teclado = None  # fn()
        self.abrir_menu = None        # fn()
        self.abrir_asistente = None   # fn()
        self.abrir_recentrado = None  # fn()
        self.al_estado = None         # fn(texto, error) para la página «Escribir»
        self.al_oir = None            # fn(frase, resumen) para la página «Escribir»
        self._ultima_ventana = 0
        self._vigilante = None
        self._ultimo_oido = 0.0
        self._trabajo = queue.Queue()
        self._obrero_hilo = threading.Thread(target=self._obrero, name="voz_obrero", daemon=True)
        self._obrero_hilo.start()

    @property
    def lector(self) -> LectorPantalla:
        """El lector de pantalla de este hilo (uno por hilo, por COM)."""
        propio = getattr(self._locales, "lector", None)
        if propio is None:
            propio = LectorPantalla()
            self._locales.lector = propio
        return propio

    # ------------------------------------------------------------ estado --
    def estado(self) -> dict:
        e = Escucha().comprobar()
        e["dictando"] = self.ejecutor.dictando
        return e

    def texto_estado(self) -> str:
        return Escucha().texto_estado()

    @property
    def escuchando(self) -> bool:
        return Escucha().escuchando

    # ---------------------------------------------------------- encender --
    def alternar(self) -> bool:
        if Escucha().escuchando:
            self.parar()
            return False
        return self.empezar()

    def empezar(self, modo="ordenes") -> bool:
        self.ejecutor.confirmar = bool(ConfigManager().config.get("voz_dictado_confirmar", False))
        if modo == "ordenes":
            self.ejecutor.dictando = False
        ok = Escucha().empezar(self._oida, self._estado, modo, self._frases())
        if ok:
            self._arrancar_vigilante()
        return ok

    def parar(self) -> None:
        Escucha().parar()
        self.ejecutor.dictando = False
        self.ejecutor.pendiente = None

    def dictar(self, encender: bool = True) -> bool:
        """Cambia entre órdenes y dictado (texto libre)."""
        if encender:
            if not Escucha().cambiar_modo("dictado"):
                return False
            self.ejecutor.dictando = True
            self.ejecutor.dictado.reiniciar()
            self.ejecutor.confirmar = bool(ConfigManager().config.get("voz_dictado_confirmar", False))
            return True
        self.ejecutor.dictando = False
        self.ejecutor.pendiente = None
        return Escucha().cambiar_modo("ordenes", self._frases())

    # ----------------------------------------------------------- gramática --
    def _frases(self):
        """Las órdenes fijas más los botones de la ventana que hay delante."""
        nombres = []
        try:
            nombres = [c["nombre"] for c in self.lector.controles(max_n=40) if c.get("clicable")]
        except Exception as e:
            logger.info(f"Sin controles para la gramática: {e}")
        return ordenes_voz.frases_gramatica(nombres)

    def refrescar_ordenes(self) -> None:
        """Rehace la lista de frases (la ventana de delante ha cambiado)."""
        if not Escucha().escuchando or self.ejecutor.dictando:
            return
        if time.time() - self._ultimo_oido < 2.0:
            return                                   # no cortar a media orden
        Escucha().cambiar_modo("ordenes", self._frases())

    def _arrancar_vigilante(self):
        if self._vigilante is not None and self._vigilante.is_alive():
            return

        def vigilar():
            while Escucha().escuchando:
                time.sleep(REVISAR_VENTANA_S)
                try:
                    actual = _ventana_de_delante()
                    if actual and actual != self._ultima_ventana:
                        self._ultima_ventana = actual
                        self.refrescar_ordenes()
                except Exception as e:
                    logger.info(f"Vigilante de ventana: {e}")
                    return

        self._ultima_ventana = _ventana_de_delante()
        self._vigilante = threading.Thread(target=vigilar, name="voz_ventana", daemon=True)
        self._vigilante.start()

    # -------------------------------------------------------------- oír --
    def _oida(self, frase: str):
        """Lo llama Windows en cuanto entiende algo: aquí no se puede tardar.

        Abrir un programa o buscar un botón lleva su tiempo, y mientras tanto
        el motor no podría avisar de la frase siguiente, así que el trabajo se
        hace en un hilo aparte y de uno en uno.
        """
        self._ultimo_oido = time.time()
        self._trabajo.put(frase)

    def _obrero(self):
        while True:
            frase = self._trabajo.get()
            if frase is None:
                return
            self._hacer(frase)

    def _hacer(self, frase: str):
        try:
            accion = self.ejecutor.oir(frase)
        except Exception as e:
            logger.warning(f"Al ejecutar «{frase}»: {e}")
            return
        # El dictado y las órdenes usan gramáticas distintas: si la orden fue
        # «dicta», hay que montar el otro reconocedor.
        if accion.get("tipo") == "dictado_on":
            self.dictar(True)
        elif accion.get("tipo") == "dictado_off":
            self.dictar(False)
        elif accion.get("tipo") == "parar_escucha":
            self.parar()
        if self.al_oir is not None:
            try:
                self.al_oir(frase, self.ejecutor.ultimo_resumen)
            except Exception as e:
                logger.info(f"Aviso a la página: {e}")

    def _estado(self, texto, error=False):
        logger.info(f"Escucha: {texto}")
        if self.al_estado is not None:
            try:
                self.al_estado(texto, error)
            except Exception as e:
                logger.info(f"Aviso de estado: {e}")
        if error:
            self._decir(texto)

    # ---------------------------------------------------------- ganchos --
    def _decir(self, texto):
        Voz().decir(texto, forzar=True)

    def _aviso(self, texto, error=False):
        if self.avisar is not None:
            try:
                self.avisar(texto)
            except Exception as e:
                logger.info(f"Aviso junto al puntero: {e}")
        if error:
            self._decir(texto)

    def _clic_control(self, nombre):
        encontrado = self.lector.buscar_control(nombre)
        if encontrado is None:
            return False
        x, y, real = encontrado
        pydirectinput.moveTo(int(x), int(y))
        time.sleep(0.12)
        pydirectinput.click(button="left")
        self._aviso(f"Clic en «{real}»")
        return True

    def _rueda(self, delta):
        pyautogui.scroll(int(delta) * 100)

    def _borrar(self, n):
        for _ in range(max(1, min(int(n), ordenes_voz.MAX_BORRADO))):
            escritura.pulsar_tecla("backspace")

    def _leer_pantalla(self):
        texto = self.lector.texto(MAX_LEER)
        self._decir(texto or "No hay texto que leer en esta ventana.")

    def _arrastrar(self):
        pydirectinput.mouseDown(button="left")

    def _soltar(self):
        pydirectinput.mouseUp(button="left")

    def _gui(self, nombre):
        """Llama a un gancho de la interfaz si main_gui lo ha puesto."""
        f = getattr(self, nombre, None)
        if f is None:
            self._aviso("Eso solo funciona con Winclus abierto", True)
            return
        f()

    def _ganchos(self) -> dict:
        return {
            "escribir": lambda t: escritura.escribir_texto(t),
            "borrar": self._borrar,
            "pulsar": lambda combo: self.acciones.pulsar(combo),
            "clic": lambda: pydirectinput.click(button="left"),
            "clic_derecho": lambda: pydirectinput.click(button="right"),
            "doble_clic": lambda: pydirectinput.click(button="left", clicks=2, interval=0.08),
            "arrastrar": self._arrastrar,
            "soltar": self._soltar,
            "rueda": self._rueda,
            "clic_control": self._clic_control,
            "abrir_programa": lambda n: self.acciones.abrir_programa(n),
            "buscar_web": lambda c: self.acciones.buscar_web(c),
            "buscar_youtube": lambda c: self.acciones.buscar_youtube(c),
            "leer_pantalla": self._leer_pantalla,
            "decir": self._decir,
            "callar": lambda: Voz().callar(),
            "pausar": lambda: self._gui("pausar"),
            "seguir": lambda: self._gui("seguir"),
            "recentrar": lambda: self._gui("abrir_recentrado"),
            "teclado": lambda: self._gui("alternar_teclado"),
            "menu": lambda: self._gui("abrir_menu"),
            "asistente": lambda: self._gui("abrir_asistente"),
            "parar_escucha": self.parar,
            "avisar": self._aviso,
        }
