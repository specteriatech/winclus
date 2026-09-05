"""Ventana de calibración del modo directo.

Ocupa toda la pantalla donde está el puntero y muestra, uno a uno, nueve
puntos grandes. En cada uno hay un momento para llegar con la vista (el
punto se encoge) y luego se miden los rasgos de la mirada durante un segundo.
No hace falta pulsar nada; con Escape se cancela.

Al terminar se ajusta el modelo (detectors/calibracion.py), se guarda en el
perfil y se avisa a quien la abrió con el resultado.
"""

import logging
import tkinter

import customtkinter
import numpy as np
import win32api

from src import estilo
from src.config_manager import ConfigManager
from src.controllers import MouseController
from src.detectors import FaceMesh
from src.detectors.calibracion import ajustar

logger = logging.getLogger("VentanaCalibracion")

MARGEN = 0.08          # fracción de la pantalla que se deja libre en los bordes
ESPERA_MS = 1400       # tiempo para llegar con la vista al punto
MEDIDA_MS = 1000       # tiempo midiendo
TICK_MS = 33
RADIO_GRANDE = 34
RADIO_PEQUENO = 12
FONDO = "#1B2422"
PUNTO = "#F0B455"
TEXTO = "#F1ECE2"


def monitor_del_puntero():
    x, y = win32api.GetCursorPos()
    for handle, _, (x1, y1, x2, y2) in win32api.EnumDisplayMonitors():
        if x1 <= x < x2 and y1 <= y < y2:
            return x1, y1, x2, y2
    x1, y1, x2, y2 = win32api.EnumDisplayMonitors()[0][2]
    return x1, y1, x2, y2


class VentanaCalibracion:

    def __init__(self, tk_root, al_terminar):
        self.al_terminar = al_terminar
        self.cancelada = False
        self.monitor = monitor_del_puntero()
        x1, y1, x2, y2 = self.monitor
        w, h = x2 - x1, y2 - y1

        self.ventana = tkinter.Toplevel(tk_root)
        self.ventana.title("Gestik calibración")
        self.ventana.overrideredirect(True)
        self.ventana.attributes("-topmost", True)
        self.ventana.geometry(f"{w}x{h}+{x1}+{y1}")
        self.ventana.configure(bg=FONDO)
        self.lienzo = tkinter.Canvas(self.ventana, width=w, height=h, bg=FONDO,
                                     bd=0, highlightthickness=0)
        self.lienzo.pack()
        self.ventana.bind("<Escape>", lambda e: self.cancelar())
        self.ventana.focus_force()

        self.texto = self.lienzo.create_text(
            w // 2, int(h * 0.5), text="", fill=TEXTO, justify="center",
            font=(estilo.FAMILIA_TEXTO, 26))
        self.punto = self.lienzo.create_oval(0, 0, 0, 0, fill=PUNTO, outline="")
        self.centro = self.lienzo.create_oval(0, 0, 0, 0, fill=FONDO, outline="")
        self.contador = self.lienzo.create_text(
            w - 40, h - 30, text="", fill=TEXTO, anchor="e",
            font=(estilo.FAMILIA_TEXTO, 14))

        # Nueve puntos: el centro primero, luego el resto
        xs = [x1 + w * MARGEN, x1 + w / 2, x2 - w * MARGEN]
        ys = [y1 + h * MARGEN, y1 + h / 2, y2 - h * MARGEN]
        self.objetivos = [(xs[1], ys[1])]
        for yy in ys:
            for xx in xs:
                if (xx, yy) != (xs[1], ys[1]):
                    self.objetivos.append((xx, yy))
        self.indice = -1
        self.muestras = []
        self.rasgos_por_punto = []

        MouseController().calibrando = True
        self._mostrar_texto("Mira cada punto amarillo hasta que desaparezca.\n"
                            "No muevas la cabeza. Con Escape se cancela.")
        self.ventana.after(2500, self._siguiente)

    # ------------------------------------------------------------ pasos --
    def _mostrar_texto(self, texto):
        self.lienzo.itemconfigure(self.texto, text=texto, state="normal")

    def _siguiente(self):
        if self.cancelada:
            return
        self.lienzo.itemconfigure(self.texto, state="hidden")
        self.indice += 1
        if self.indice >= len(self.objetivos):
            self._terminar()
            return
        self.lienzo.itemconfigure(self.contador,
                                  text=f"{self.indice + 1} de {len(self.objetivos)}")
        self.t0 = 0
        self.muestras = []
        self._animar()

    def _dibujar_punto(self, radio):
        x, y = self.objetivos[self.indice]
        x -= self.monitor[0]
        y -= self.monitor[1]
        self.lienzo.coords(self.punto, x - radio, y - radio, x + radio, y + radio)
        r = max(3, radio // 4)
        self.lienzo.coords(self.centro, x - r, y - r, x + r, y + r)

    def _animar(self):
        if self.cancelada:
            return
        self.t0 += TICK_MS
        if self.t0 <= ESPERA_MS:
            f = self.t0 / ESPERA_MS
            self._dibujar_punto(int(RADIO_GRANDE - (RADIO_GRANDE - RADIO_PEQUENO) * f))
        elif self.t0 <= ESPERA_MS + MEDIDA_MS:
            self._dibujar_punto(RADIO_PEQUENO)
            r = FaceMesh().get_rasgos()
            if r is not None:
                self.muestras.append(r)
        else:
            if len(self.muestras) < 6:
                # No se vieron los ojos: se repite este punto
                self.lienzo.itemconfigure(self.texto, state="normal",
                                          text="No veo bien tus ojos. Otra vez…")
                self.t0 = 0
                self.muestras = []
                self.ventana.after(800, self._animar)
                return
            self.rasgos_por_punto.append(np.median(np.asarray(self.muestras), axis=0))
            self._siguiente()
            return
        self.ventana.after(TICK_MS, self._animar)

    def _terminar(self):
        try:
            modelo = ajustar(self.objetivos, self.rasgos_por_punto, self.monitor)
        except Exception as e:
            logger.error(f"No se pudo calibrar: {e}")
            modelo = None
        self._cerrar()
        if modelo is not None:
            ConfigManager().set_temp_config("ojos_calibracion", modelo)
            ConfigManager().apply_config()
            MouseController().reiniciar_mirada()
        self.al_terminar(modelo)

    def cancelar(self):
        if self.cancelada:
            return
        self._cerrar()
        self.al_terminar(None)

    def _cerrar(self):
        self.cancelada = True
        MouseController().calibrando = False
        try:
            self.ventana.destroy()
        except Exception:
            pass
