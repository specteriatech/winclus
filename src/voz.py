"""Voz de Winclus: lee texto en voz alta con las voces de Windows (SAPI).

Para quien no puede hablar, el teclado en pantalla tiene la tecla «Decir»
(lee lo que se lleva escrito) y una capa de frases guardadas («Tengo sed»,
«Necesito ayuda»…) que suenan con un solo clic. Para quien ve poco, puede
leer cada palabra al terminarla.

SAPI es COM y hay que usarlo desde un solo hilo: aquí un hilo propio con
una cola. `decir()` puede llamarse desde cualquier hilo y no bloquea.
"""

import logging
import queue
import threading
import time

from src.config_manager import ConfigManager
from src.singleton_meta import Singleton

logger = logging.getLogger("Voz")

SVSFlagsAsync = 1
SVSFPurgeBeforeSpeak = 2
PISTAS_ESPANOL = ("spanish", "español", "espanol", "es-", "sabina", "helena", "laura", "pablo", "raul")


class Voz(metaclass=Singleton):

    def __init__(self):
        self.cola = queue.Queue()
        self.hilo = None
        self.listo = threading.Event()
        self.disponible = None       # None hasta que el hilo arranca
        self.callar_flag = threading.Event()
        self._voces = []             # descripciones
        self.hablando = False

    # ------------------------------------------------------------- hilo --
    def _asegurar_hilo(self):
        if self.hilo is None:
            self.hilo = threading.Thread(target=self._bucle, name="voz", daemon=True)
            self.hilo.start()

    def _bucle(self):
        try:
            import pythoncom
            import win32com.client
            pythoncom.CoInitialize()
            sapi = win32com.client.Dispatch("SAPI.SpVoice")
            tokens = list(sapi.GetVoices())
            self._voces = [t.GetDescription() for t in tokens]
            self.disponible = bool(tokens)
            logger.info(f"Voces: {self._voces}")
        except Exception as e:
            logger.warning(f"Sin voz (SAPI): {e}")
            self.disponible = False
            self.listo.set()
            return
        self.listo.set()
        while True:
            texto = self.cola.get()
            if texto is None:
                break
            try:
                self.callar_flag.clear()
                cfg = ConfigManager().config or {}
                nombre = cfg.get("voz_nombre") or ""
                indice = self._indice_voz(nombre)
                if indice is not None:
                    sapi.Voice = tokens[indice]
                sapi.Rate = int(max(-10, min(10, cfg.get("voz_velocidad", 0))))
                self.hablando = True
                sapi.Speak(texto, SVSFlagsAsync | SVSFPurgeBeforeSpeak)
                while not sapi.WaitUntilDone(60):
                    if self.callar_flag.is_set():
                        sapi.Speak("", SVSFlagsAsync | SVSFPurgeBeforeSpeak)
                        break
            except Exception as e:
                logger.warning(f"Voz: {e}")
            finally:
                self.hablando = False

    def _indice_voz(self, nombre: str):
        if not self._voces:
            return None
        if nombre:
            for i, d in enumerate(self._voces):
                if d == nombre:
                    return i
        for i, d in enumerate(self._voces):
            if any(p in d.lower() for p in PISTAS_ESPANOL):
                return i
        return 0

    # ---------------------------------------------------------- público --
    def voces(self, espera_s: float = 2.0) -> list:
        """Descripciones de las voces instaladas (la primera en español se
        usa si no se elige otra)."""
        self._asegurar_hilo()
        self.listo.wait(espera_s)
        return list(self._voces)

    def voz_por_defecto(self) -> str:
        i = self._indice_voz("")
        return self._voces[i] if i is not None else ""

    def decir(self, texto: str, interrumpir: bool = True, forzar: bool = False) -> bool:
        """Lee el texto. interrumpir: corta lo que se estuviera diciendo.
        forzar: aunque la voz esté desactivada en los ajustes (botón Probar)."""
        texto = (texto or "").strip()
        if not texto:
            return False
        cfg = ConfigManager().config or {}
        if not forzar and not cfg.get("voz_activa", True):
            return False
        self._asegurar_hilo()
        if interrumpir:
            self.callar()
        self.cola.put(texto)
        logger.info(f"Decir: {texto[:60]!r}")
        return True

    def callar(self) -> None:
        while True:
            try:
                self.cola.get_nowait()
            except queue.Empty:
                break
        self.callar_flag.set()

    def destruir(self) -> None:
        if self.hilo is not None:
            self.callar()
            self.cola.put(None)
            self.hilo.join(timeout=1.0)
            self.hilo = None
