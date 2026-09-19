"""Escuchar por el micrófono con el reconocimiento de voz de Windows.

Quien no puede usar las manos ni la cara con soltura puede hablar: aquí se
enciende el micrófono, se oye una frase y se le pasa a `src/ordenes_voz.py`,
que decide si es una orden («baja», «pulsa Aceptar») o texto que hay que
escribir (dictado).

El motor es el que trae Windows (`Windows.Media.SpeechRecognition`, el mismo
del Acceso por voz), a través del paquete `winsdk`. Winclus no manda la voz a
ningún servidor propio, pero hay una diferencia importante que se cuenta tal
cual en la interfaz:

* **Órdenes**: se escucha con una lista cerrada de frases («baja», «clic»,
  «pulsa Aceptar»…). Eso lo hace el motor del propio equipo y **funciona sin
  internet**. Además acierta mucho más, porque solo puede oír lo que está en
  la lista.
* **Dictado** (texto libre): Windows solo lo permite si la persona ha
  encendido «Reconocimiento de voz en línea» en Configuración, y entonces es
  Windows quien manda el audio a Microsoft. Sin eso, el dictado no arranca y
  Winclus lo dice con todas las letras en vez de fallar en silencio.

Todo pasa en un hilo aparte con su propio bucle asíncrono: `empezar()` y
`parar()` se pueden llamar desde la interfaz sin bloquearla, y lo que se oye
llega por la función `al_oir(frase)`.
"""

import asyncio
import datetime
import logging
import threading
import winreg

from src.singleton_meta import Singleton

logger = logging.getLogger("Escucha")

IDIOMAS_PREFERIDOS = ("es-ES", "es-MX", "es-US", "es-CO", "es-AR")

# Lo que se le dice a la persona cuando no se puede escuchar, en su idioma y
# sin jerga: cada motivo lleva qué hacer.
AYUDA_SIN_MOTOR = (
    "Windows no tiene instalado el reconocimiento de voz en español. "
    "Ve a Configuración, Hora e idioma, Idioma y región, y en el idioma "
    "español elige «Opciones de idioma» y añade «Voz».")
AYUDA_SIN_PAQUETE = (
    "Falta el paquete winsdk, que es el que habla con el reconocimiento de "
    "voz de Windows. Se instala con: pip install winsdk")
AYUDA_SIN_MICROFONO = (
    "Windows no deja usar el micrófono. Ve a Configuración, Privacidad y "
    "seguridad, Micrófono, y enciende «Permitir que las aplicaciones de "
    "escritorio accedan al micrófono».")
AYUDA_DICTADO_EN_LINEA = (
    "Para dictar texto libre, Windows pide encender «Reconocimiento de voz en "
    "línea» (Configuración, Privacidad y seguridad, Voz), y entonces manda tu "
    "voz a Microsoft. Las órdenes («baja», «clic», «pulsa Aceptar») funcionan "
    "sin eso y sin internet.")

# Windows devuelve este error cuando se pide dictado libre sin haber aceptado
# el reconocimiento de voz en línea.
ERROR_PRIVACIDAD = "0x80045509"
AJUSTES_VOZ = "ms-settings:privacy-speech"
AJUSTES_MICROFONO = "ms-settings:privacy-microphone"


def _en_linea() -> bool:
    """¿Está encendido «Reconocimiento de voz en línea» de Windows?

    Si lo está, Windows puede mandar la voz a sus servidores; si no, usa el
    motor del propio equipo. Lo contamos en la interfaz, no lo cambiamos.
    """
    try:
        clave = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                               r"Software\Microsoft\Speech_OneCore\Settings\OnlineSpeechPrivacy")
        valor, _ = winreg.QueryValueEx(clave, "HasAccepted")
        return bool(valor)
    except OSError:
        return False


class Escucha(metaclass=Singleton):

    def __init__(self):
        self.disponible = None       # None = sin comprobar
        self.motivo = ""             # por qué no se puede, en lenguaje claro
        self.idioma = ""
        self.escuchando = False
        self.modo = "ordenes"        # "ordenes" (lista cerrada) o "dictado" (texto libre)
        self.frases = []             # las órdenes que se pueden oír en modo "ordenes"
        self.al_oir = None           # fn(frase)
        self.al_estado = None        # fn(texto, error) para la interfaz
        self._bucle = None           # asyncio loop del hilo
        self._hilo = None
        self._sesion = None
        self._rec = None
        self._parando = False
        self._listo = threading.Event()

    # ------------------------------------------------------------- estado --
    def comprobar(self) -> dict:
        """¿Se puede escuchar en este equipo? Devuelve el estado sin encender nada."""
        if self.disponible is not None:
            return self.estado()
        try:
            from winsdk.windows.media.speechrecognition import SpeechRecognizer  # noqa: F401
        except Exception as e:
            logger.warning(f"Sin winsdk: {e}")
            self.disponible, self.motivo = False, AYUDA_SIN_PAQUETE
            return self.estado()
        try:
            idiomas = [l.language_tag for l in SpeechRecognizer.supported_topic_languages]
        except Exception as e:
            logger.warning(f"Sin motores de voz: {e}")
            self.disponible, self.motivo = False, AYUDA_SIN_MOTOR
            return self.estado()
        self.idioma = self._elegir_idioma(idiomas)
        if not self.idioma:
            self.disponible = False
            self.motivo = AYUDA_SIN_MOTOR + f" (instalados: {', '.join(idiomas) or 'ninguno'})"
            return self.estado()
        self.disponible, self.motivo = True, ""
        logger.info(f"Reconocimiento de voz: {self.idioma} (idiomas: {idiomas})")
        return self.estado()

    @staticmethod
    def _elegir_idioma(idiomas):
        """El español que haya: primero los de la lista, luego cualquier es-*."""
        for preferido in IDIOMAS_PREFERIDOS:
            if preferido in idiomas:
                return preferido
        for tag in idiomas:
            if tag.lower().startswith("es"):
                return tag
        return idiomas[0] if idiomas else ""

    def estado(self) -> dict:
        return {"disponible": bool(self.disponible), "motivo": self.motivo,
                "idioma": self.idioma, "en_linea": _en_linea(),
                "escuchando": self.escuchando, "modo": self.modo,
                "puede_dictar": bool(self.disponible) and _en_linea()}

    def texto_estado(self) -> str:
        """Una línea para la interfaz, sin jerga."""
        e = self.comprobar()
        if not e["disponible"]:
            return e["motivo"] or "No se puede escuchar en este equipo."
        if e["en_linea"]:
            return (f"Listo para escuchar en {e['idioma']}. Las órdenes se reconocen en este "
                    "equipo; para dictar texto, Windows manda tu voz a Microsoft porque tienes "
                    "encendido «Reconocimiento de voz en línea».")
        return (f"Listo para escuchar órdenes en {e['idioma']}, sin internet y sin que la voz "
                "salga del equipo. El dictado de texto libre está apagado: Windows lo pide con "
                "«Reconocimiento de voz en línea» encendido.")

    # ------------------------------------------------------------- encender --
    def empezar(self, al_oir, al_estado=None, modo="ordenes", frases=None) -> bool:
        """Enciende el micrófono. `al_oir(frase)` se llama por cada frase oída.

        `modo` es "ordenes" (solo se oye lo que está en `frases`, sin internet)
        o "dictado" (texto libre, que Windows solo permite en línea).
        """
        self.comprobar()
        if not self.disponible:
            if al_estado is not None:
                al_estado(self.motivo, True)
            return False
        if modo == "dictado" and not _en_linea():
            if al_estado is not None:
                al_estado(AYUDA_DICTADO_EN_LINEA, True)
            return False
        self.al_oir = al_oir
        self.al_estado = al_estado
        self.modo = modo
        if frases is not None:
            self.frases = [f for f in frases if f.strip()]
        if self.escuchando:
            return True
        self._asegurar_hilo()
        self._parando = False
        asyncio.run_coroutine_threadsafe(self._arrancar(), self._bucle)
        return True

    def cambiar_modo(self, modo, frases=None) -> bool:
        """Pasar de órdenes a dictado (o al revés) sin perder los ganchos.

        Hay que volver a montar el reconocedor porque la gramática es otra.
        """
        if modo == self.modo and self.escuchando:
            return True
        if modo == "dictado" and not _en_linea():
            self._avisar(AYUDA_DICTADO_EN_LINEA, True)
            return False
        al_oir, al_estado = self.al_oir, self.al_estado
        estaba = self.escuchando
        if estaba:
            self._parando = True
            futuro = asyncio.run_coroutine_threadsafe(self._detener(), self._bucle)
            try:
                futuro.result(3.0)
            except Exception as e:
                logger.info(f"Al cambiar de modo: {e}")
        self.modo = modo
        if frases is not None:
            self.frases = [f for f in frases if f.strip()]
        if not estaba:
            return True
        return self.empezar(al_oir, al_estado, modo, self.frases)

    def parar(self) -> None:
        if not self.escuchando or self._bucle is None:
            return
        self._parando = True
        asyncio.run_coroutine_threadsafe(self._detener(), self._bucle)

    def alternar(self, al_oir, al_estado=None) -> bool:
        if self.escuchando:
            self.parar()
            return False
        return self.empezar(al_oir, al_estado)

    # --------------------------------------------------------------- hilo --
    def _asegurar_hilo(self):
        if self._hilo is not None and self._hilo.is_alive():
            return
        self._listo.clear()

        def correr():
            self._bucle = asyncio.new_event_loop()
            asyncio.set_event_loop(self._bucle)
            self._listo.set()
            self._bucle.run_forever()

        self._hilo = threading.Thread(target=correr, name="escucha", daemon=True)
        self._hilo.start()
        self._listo.wait(3.0)

    def _avisar(self, texto, error=False):
        if self.al_estado is not None:
            try:
                self.al_estado(texto, error)
            except Exception as e:
                logger.warning(f"Aviso de escucha: {e}")

    # ------------------------------------------------------- reconocimiento --
    async def _arrancar(self):
        from winsdk.windows.globalization import Language
        from winsdk.windows.media.speechrecognition import (
            SpeechRecognizer, SpeechRecognitionTopicConstraint, SpeechRecognitionScenario,
            SpeechRecognitionListConstraint, SpeechRecognitionResultStatus)
        try:
            rec = SpeechRecognizer(Language(self.idioma))
            if self.modo == "dictado":
                rec.constraints.append(
                    SpeechRecognitionTopicConstraint(SpeechRecognitionScenario.DICTATION, "winclus"))
            else:
                # Lista cerrada: el motor solo puede oír estas frases, así que
                # acierta mucho más y no hace falta internet.
                rec.constraints.append(
                    SpeechRecognitionListConstraint(self.frases or ["ayuda"], "ordenes"))
            # Sin este margen, el motor corta en cuanto hay medio segundo de
            # silencio y se pierde la segunda mitad de la frase.
            rec.timeouts.initial_silence_timeout = datetime.timedelta(seconds=10)
            rec.timeouts.end_silence_timeout = datetime.timedelta(milliseconds=900)
            resultado = await rec.compile_constraints_async()
            if resultado.status != SpeechRecognitionResultStatus.SUCCESS:
                self._fallo_compilar(resultado.status)
                return
            sesion = rec.continuous_recognition_session
            # Cuando nadie habla durante un rato el motor se para solo; se
            # vuelve a encender en `_terminada`, así que la escucha no se cae.
            sesion.auto_stop_silence_timeout = datetime.timedelta(minutes=10)
            sesion.add_result_generated(self._oida)
            sesion.add_completed(self._terminada)
            await sesion.start_async()
            self._rec, self._sesion = rec, sesion
            self.escuchando = True
            self._avisar("Escuchando lo que dictes" if self.modo == "dictado" else "Escuchando órdenes",
                         False)
            logger.info(f"Escuchando por el micrófono (modo {self.modo})")
        except Exception as e:
            self.escuchando = False
            texto = str(e)
            logger.warning(f"No se pudo escuchar: {texto}")
            if ERROR_PRIVACIDAD in texto:
                self._avisar(AYUDA_DICTADO_EN_LINEA, True)
            elif "0x80070005" in texto or "denegado" in texto.lower() or "denied" in texto.lower():
                self._avisar(AYUDA_SIN_MICROFONO, True)
            else:
                self._avisar("No se pudo encender el micrófono: " + texto, True)

    def _fallo_compilar(self, estado):
        nombre = str(estado).rsplit(".", 1)[-1]
        mensajes = {
            "TOPIC_LANGUAGE_NOT_SUPPORTED": AYUDA_SIN_MOTOR,
            "USER_CANCELED": AYUDA_SIN_MICROFONO,
            "MICROPHONE_UNAVAILABLE": "No se encontró micrófono.",
        }
        self.escuchando = False
        self._avisar(mensajes.get(nombre, f"Windows no pudo preparar la escucha ({nombre})."), True)
        logger.warning(f"Compilar la gramática falló: {nombre}")

    async def _detener(self):
        try:
            if self._sesion is not None:
                await self._sesion.stop_async()
        except Exception as e:
            logger.info(f"Al parar la escucha: {e}")
        self._sesion, self._rec = None, None
        self.escuchando = False
        self._avisar("Ya no escucho", False)
        logger.info("Micrófono apagado")

    # Los dos siguientes los llama Windows desde sus propios hilos.
    def _oida(self, sesion, args):
        try:
            resultado = args.result
            frase = (resultado.text or "").strip()
            confianza = str(getattr(resultado, "confidence", ""))
            if not frase:
                return
            if confianza.rsplit(".", 1)[-1] == "REJECTED":
                logger.info(f"Descartado por poca confianza: {frase!r}")
                return
            logger.info(f"Oído: {frase!r} ({confianza})")
            if self.al_oir is not None:
                self.al_oir(frase)
        except Exception as e:
            logger.warning(f"Al procesar lo oído: {e}")

    def _terminada(self, sesion, args):
        """El motor se para solo (silencio largo o un tropiezo): se reanuda."""
        if self._parando or not self.escuchando:
            self.escuchando = False
            return
        logger.info("La escucha se paró sola; se vuelve a encender")
        try:
            asyncio.run_coroutine_threadsafe(self._reanudar(), self._bucle)
        except Exception as e:
            logger.warning(f"No se pudo reanudar la escucha: {e}")

    async def _reanudar(self):
        try:
            if self._sesion is not None:
                await self._sesion.start_async()
                return
        except Exception as e:
            logger.info(f"Reanudar falló, se empieza de cero: {e}")
        self._sesion, self._rec = None, None
        self.escuchando = False
        await self._arrancar()
