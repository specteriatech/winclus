"""Acciones que el asistente puede ejecutar en Windows.

Cada acción es un dict {"tipo": ..., ...}. `Ejecutor.ejecutar(accion)`
devuelve un texto con el resultado, que se le devuelve al cerebro para que
decida el siguiente paso. Todo pasa por lo que ya tiene Winclus: escritura
(SendInput), pydirectinput para el clic, UI Automation para encontrar
controles por su nombre, y la voz.
"""

import logging
import os
import time
import urllib.parse

import pydirectinput

from src.asistente.contexto import LectorPantalla
from src.controllers import escritura

logger = logging.getLogger("Acciones")

# Programas por nombre en español. Los «:» son URIs de Windows.
PROGRAMAS = {
    "chrome": "chrome", "google chrome": "chrome", "navegador": "chrome",
    "edge": "msedge", "microsoft edge": "msedge",
    "bloc de notas": "notepad", "notepad": "notepad", "notas": "notepad",
    "calculadora": "calc",
    "explorador": "explorer", "explorador de archivos": "explorer", "archivos": "explorer",
    "whatsapp": "whatsapp:", "correo": "outlookmail:", "mail": "outlookmail:",
    "configuracion": "ms-settings:", "configuración": "ms-settings:", "ajustes": "ms-settings:",
    "word": "winword", "excel": "excel", "powerpoint": "powerpnt",
    "paint": "mspaint", "camara": "microsoft.windows.camera:", "cámara": "microsoft.windows.camera:",
    "tienda": "ms-windows-store:", "spotify": "spotify:", "calendario": "outlookcal:",
    "youtube": "https://www.youtube.com", "gmail": "https://mail.google.com",
    "google": "https://www.google.com", "facebook": "https://www.facebook.com",
    "netflix": "https://www.netflix.com", "wikipedia": "https://es.wikipedia.org",
}

TECLAS_ALIAS = {
    "intro": "enter", "entrar": "enter", "return": "enter", "escape": "esc",
    "borrar": "backspace", "retroceso": "backspace", "suprimir": "delete", "supr": "delete",
    "espacio": "space", "tabulador": "tab", "arriba": "up", "abajo": "down",
    "izquierda": "left", "derecha": "right", "inicio": "home", "fin": "end",
    "control": "ctrl", "mayus": "shift", "mayús": "shift", "windows": "win",
    "avpag": "pagedown", "repag": "pageup",
}

ACCIONES = ("abrir_programa", "abrir_web", "buscar_web", "buscar_youtube", "escribir",
            "pulsar", "clic", "esperar", "leer_pantalla", "decir", "terminado")


class Ejecutor:

    def __init__(self, lector: LectorPantalla = None, decir=None):
        self.lector = lector or LectorPantalla()
        self.decir_fn = decir          # fn(texto): voz
        self.parar = False

    # ------------------------------------------------------------- entrada --
    def ejecutar(self, accion: dict) -> str:
        tipo = str(accion.get("tipo", "")).strip().lower()
        try:
            if tipo == "abrir_programa":
                return self.abrir_programa(str(accion.get("nombre", "")))
            if tipo == "abrir_web":
                return self.abrir_web(str(accion.get("url", "")))
            if tipo == "buscar_web":
                return self.buscar_web(str(accion.get("consulta", "")))
            if tipo == "buscar_youtube":
                return self.buscar_youtube(str(accion.get("consulta", "")))
            if tipo == "escribir":
                return self.escribir(str(accion.get("texto", "")))
            if tipo == "pulsar":
                return self.pulsar(str(accion.get("combo", accion.get("tecla", ""))))
            if tipo == "clic":
                return self.clic(str(accion.get("control", accion.get("nombre", ""))))
            if tipo == "esperar":
                return self.esperar(accion.get("ms", 800))
            if tipo == "leer_pantalla":
                return self.leer_pantalla()
            if tipo == "decir":
                return self.decir(str(accion.get("texto", "")))
            if tipo == "terminado":
                return "Terminado."
            return f"Acción desconocida: {tipo!r}. Las posibles son: {', '.join(ACCIONES)}."
        except Exception as e:
            logger.warning(f"Acción {accion} falló: {e}")
            return f"La acción {tipo} falló: {e}"

    # ------------------------------------------------------------ acciones --
    def abrir_programa(self, nombre: str) -> str:
        clave = nombre.strip().lower()
        objetivo = PROGRAMAS.get(clave)
        if objetivo is None:
            # Cualquier otra cosa: buscarla en el menú Inicio y abrirla
            escritura.atajo("win")
            time.sleep(0.6)
            escritura.escribir_texto(nombre.strip())
            time.sleep(1.2)
            escritura.pulsar_tecla("enter")
            time.sleep(1.5)
            return f"Busqué «{nombre}» en el menú Inicio y pulsé Intro."
        try:
            if objetivo.startswith("http"):
                os.startfile(objetivo)
            else:
                os.startfile(objetivo)
        except OSError:
            if not objetivo.startswith("http") and not objetivo.endswith(":"):
                os.system(f'start "" "{objetivo}"')
            else:
                raise
        time.sleep(1.8)
        v = self.lector.ventana_activa()
        return f"Abrí {nombre}. Ventana activa ahora: «{v['titulo']}»."

    def abrir_web(self, url: str) -> str:
        url = url.strip()
        if not url:
            return "Falta la dirección web."
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        os.startfile(url)
        time.sleep(2.0)
        return f"Abrí {url} en el navegador."

    def buscar_web(self, consulta: str) -> str:
        consulta = consulta.strip()
        if not consulta:
            return "Falta qué buscar."
        os.startfile("https://www.google.com/search?q=" + urllib.parse.quote_plus(consulta))
        time.sleep(2.0)
        return f"Busqué «{consulta}» en Google; la página de resultados está abierta."

    def buscar_youtube(self, consulta: str) -> str:
        consulta = consulta.strip()
        if not consulta:
            return "Falta qué buscar."
        os.startfile("https://www.youtube.com/results?search_query=" + urllib.parse.quote_plus(consulta))
        time.sleep(2.5)
        return f"Busqué «{consulta}» en YouTube; los resultados están en pantalla."

    def escribir(self, texto: str) -> str:
        if not texto:
            return "No hay texto que escribir."
        escritura.escribir_texto(texto)
        return f"Escribí: {texto[:80]}"

    def pulsar(self, combo: str) -> str:
        partes = [TECLAS_ALIAS.get(p.strip().lower(), p.strip().lower())
                  for p in combo.replace(" ", "").split("+") if p.strip()]
        if not partes:
            return "Falta la tecla."
        if len(partes) == 1:
            escritura.pulsar_tecla(partes[0])
        else:
            escritura.atajo(*partes)
        time.sleep(0.4)
        return f"Pulsé {'+'.join(partes)}."

    def clic(self, control: str) -> str:
        if not control.strip():
            return "Falta el nombre del control."
        encontrado = self.lector.buscar_control(control)
        if encontrado is None:
            nombres = [c["nombre"] for c in self.lector.controles(max_n=25) if c["clicable"]]
            return (f"No encuentro ningún control llamado «{control}». Los que veo: "
                    + "; ".join(nombres[:20]))
        x, y, nombre = encontrado
        pydirectinput.moveTo(int(x), int(y))
        time.sleep(0.15)
        pydirectinput.click(button="left")
        time.sleep(0.8)
        return f"Hice clic en «{nombre}»."

    def esperar(self, ms) -> str:
        try:
            s = min(5.0, max(0.1, float(ms) / 1000))
        except (TypeError, ValueError):
            s = 0.8
        time.sleep(s)
        return f"Esperé {s:.1f} s."

    def leer_pantalla(self) -> str:
        t = self.lector.texto(1500)
        if not t:
            return "No hay texto legible en la ventana activa."
        return "Texto en pantalla: " + t

    def decir(self, texto: str) -> str:
        if not texto.strip():
            return "Nada que decir."
        if self.decir_fn is not None:
            try:
                self.decir_fn(texto)
            except Exception as e:
                logger.warning(f"Decir: {e}")
        return f"Dije: {texto}"
