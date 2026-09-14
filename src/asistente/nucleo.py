"""El asistente: recibe una petición, y en un hilo aparte observa la
pantalla, pide al cerebro la siguiente acción y la ejecuta, hasta terminar.

La interfaz (gui/pages/page_asistente.py) le da la petición con `pedir()`,
recibe los mensajes por `al_mensaje(texto, tipo)` (tipo: tu, asistente,
accion, error) y puede pararlo con `parar()`. `leer_pantalla()` lee en voz
alta lo que hay en la ventana activa.
"""

import base64
import io
import logging
import threading
import time

from src.asistente import cerebro as cerebro_mod
from src.asistente.acciones import Ejecutor
from src.asistente.contexto import LectorPantalla
from src.singleton_meta import Singleton

logger = logging.getLogger("Asistente")


class Asistente(metaclass=Singleton):

    def __init__(self):
        self.hilo = None
        self.ocupado = False
        self.parar_flag = threading.Event()
        self.al_mensaje = None       # fn(texto, tipo) → interfaz
        self.decir = None            # fn(texto) → voz
        self.lector = None           # se crea en el hilo del asistente (COM)
        self.ejecutor = None
        self.ultimo_cerebro = ""

    # ---------------------------------------------------------- mensajes --
    def _msg(self, texto: str, tipo: str = "asistente") -> None:
        logger.info(f"[{tipo}] {texto}")
        if self.al_mensaje is not None:
            try:
                self.al_mensaje(texto, tipo)
            except Exception as e:
                logger.warning(f"al_mensaje: {e}")

    def _voz(self, texto: str) -> None:
        if self.decir is not None and texto:
            try:
                self.decir(texto)
            except Exception as e:
                logger.warning(f"Voz del asistente: {e}")

    # ------------------------------------------------------------ público --
    def nombre_cerebro(self) -> str:
        """Qué cerebro se usaría ahora mismo (sin crear conversación)."""
        try:
            return cerebro_mod.crear_cerebro().nombre
        except Exception as e:
            return f"ninguno ({e})"

    def pedir(self, peticion: str) -> bool:
        peticion = (peticion or "").strip()
        if not peticion:
            return False
        if self.ocupado:
            self._msg("Espera, todavía estoy con lo anterior. Pulsa Parar si quieres cancelarlo.", "error")
            return False
        self.ocupado = True
        self.parar_flag.clear()
        self.hilo = threading.Thread(target=self._ejecutar, args=(peticion,), name="asistente", daemon=True)
        self.hilo.start()
        return True

    def leer_pantalla(self) -> bool:
        if self.ocupado:
            return False
        self.ocupado = True
        self.parar_flag.clear()
        self.hilo = threading.Thread(target=self._leer, name="asistente-leer", daemon=True)
        self.hilo.start()
        return True

    def parar(self) -> None:
        self.parar_flag.set()
        if self.ejecutor is not None:
            self.ejecutor.parar = True
        self._msg("Parando…", "asistente")

    # -------------------------------------------------------------- hilo --
    def _preparar(self):
        if self.lector is None:
            self.lector = LectorPantalla()
            self.ejecutor = Ejecutor(self.lector, decir=self._voz)
        self.ejecutor.parar = False

    def _ejecutar(self, peticion: str) -> None:
        try:
            self._preparar()
            cerebro = cerebro_mod.crear_cerebro()
            self.ultimo_cerebro = cerebro.nombre
            self._msg(peticion, "tu")
            self._msg(f"Cerebro: {cerebro.nombre}", "info")
            pantalla = self.lector.resumen()
            cerebro.iniciar(peticion, pantalla)
            for paso in range(cerebro_mod.MAX_PASOS):
                if self.parar_flag.is_set():
                    self._msg("Cancelado.", "error")
                    return
                accion, decir = cerebro.siguiente()
                if decir:
                    self._msg(decir, "asistente")
                    self._voz(decir)
                if accion is None:
                    if not decir:
                        self._msg("No sé qué hacer con eso.", "error")
                        self._voz("No sé qué hacer con eso.")
                    return
                tipo = accion.get("tipo")
                if tipo == "terminado":
                    resumen = str(accion.get("resumen") or "Hecho.")
                    self._msg(resumen, "asistente")
                    if not decir:
                        self._voz(resumen)
                    return
                if tipo == "decir":
                    self.ejecutor.ejecutar(accion)
                    self._msg(str(accion.get("texto", "")), "asistente")
                    cerebro.informar("Dicho.", "(sin cambios)")
                    continue
                descripcion = ", ".join(f"{k}={v}" for k, v in accion.items() if k != "tipo")
                self._msg(f"{tipo} {descripcion}".strip(), "accion")
                t0 = time.time()
                resultado = self.ejecutor.ejecutar(accion)
                logger.info(f"Acción {accion} → {resultado[:120]} ({(time.time() - t0) * 1000:.0f} ms)")
                pantalla = self.lector.resumen(con_texto=(tipo == "leer_pantalla" or paso % 2 == 0))
                cerebro.informar(resultado, pantalla)
            self._msg("He hecho todos los pasos que podía; si falta algo, pídemelo de otra forma.", "asistente")
        except Exception as e:
            logger.warning(f"Asistente: {e}", exc_info=e)
            self._msg(f"Algo falló: {e}", "error")
        finally:
            self.ocupado = False

    def _leer(self) -> None:
        try:
            self._preparar()
            v = self.lector.ventana_activa()
            texto = self.lector.texto(1500)
            cerebro = cerebro_mod.crear_cerebro()
            self._msg(f"Leyendo «{v['titulo']}» con {cerebro.nombre}…", "info")
            imagen = None
            if isinstance(cerebro, cerebro_mod.CerebroClaude):
                imagen = self._captura_b64()
            try:
                resumen = cerebro.resumir_pantalla(texto, imagen)
            except Exception as e:
                logger.warning(f"Resumen de pantalla: {e}")
                resumen = texto[:400] or "No hay texto legible en la ventana activa."
            if not resumen:
                resumen = "No veo texto en esta ventana."
            self._msg(resumen, "asistente")
            self._voz(resumen)
        except Exception as e:
            logger.warning(f"Leer pantalla: {e}", exc_info=e)
            self._msg(f"No pude leer la pantalla: {e}", "error")
        finally:
            self.ocupado = False

    @staticmethod
    def _captura_b64():
        try:
            from PIL import ImageGrab
            im = ImageGrab.grab()
            im.thumbnail((1280, 1280))
            buf = io.BytesIO()
            im.save(buf, format="PNG")
            return base64.standard_b64encode(buf.getvalue()).decode("ascii")
        except Exception as e:
            logger.warning(f"Captura: {e}")
            return None
