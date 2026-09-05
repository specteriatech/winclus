"""Ventana de calibración del modo directo.

Ocupa toda la pantalla donde está el puntero. Tiene dos fases:

1. Nueve puntos fijos, uno a uno: hay un momento para llegar con la vista (el
   punto se encoge) y luego se miden los rasgos de la mirada.
2. Seguimiento suave: un punto recorre la pantalla despacio en zigzag y la
   persona lo sigue con la vista. Cada fotograma da una muestra; la mirada va
   unos 100 ms por detrás del punto, y eso se compensa.

No hace falta pulsar nada; con Escape se cancela. Al terminar se ajusta el
modelo (detectors/calibracion.py), se guarda en el perfil y se avisa a quien
la abrió con el resultado.
"""

import logging
import math
import time
import tkinter

import numpy as np
import win32api

from src import estilo
from src.config_manager import ConfigManager
from src.controllers import MouseController
from src.detectors import FaceMesh
from src.detectors.calibracion import ajustar, corregir_centro, es_valido

logger = logging.getLogger("VentanaCalibracion")

MARGEN = 0.08          # fracción de la pantalla que se deja libre en los bordes
ESPERA_MS = 1200       # tiempo para llegar con la vista al punto
MEDIDA_MS = 900        # tiempo midiendo en cada punto fijo
SEGUIMIENTO_S = 22.0   # duración del recorrido en zigzag
RETRASO_MIRADA_S = 0.10   # la mirada llega este tiempo después que el punto
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

    def __init__(self, tk_root, al_terminar, con_seguimiento=True):
        self.al_terminar = al_terminar
        self.con_seguimiento = con_seguimiento
        self.cancelada = False
        self.monitor = monitor_del_puntero()
        x1, y1, x2, y2 = self.monitor
        self.w, self.h = x2 - x1, y2 - y1
        w, h = self.w, self.h

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
        self.seg_puntos = []      # posiciones del punto móvil (con retraso)
        self.seg_rasgos = []
        self.seg_historial = []   # (t, x, y) del punto móvil

        MouseController().calibrando = True
        self._mostrar_texto("Mira cada punto amarillo hasta que desaparezca.\n"
                            "No muevas la cabeza. Con Escape se cancela.")
        self.ventana.after(2500, self._siguiente)

    # ------------------------------------------------------ puntos fijos --
    def _mostrar_texto(self, texto):
        self.lienzo.itemconfigure(self.texto, text=texto, state="normal")

    def _siguiente(self):
        if self.cancelada:
            return
        self.lienzo.itemconfigure(self.texto, state="hidden")
        self.indice += 1
        if self.indice >= len(self.objetivos):
            if self.con_seguimiento:
                self._empezar_seguimiento()
            else:
                self._terminar()
            return
        self.lienzo.itemconfigure(self.contador,
                                  text=f"{self.indice + 1} de {len(self.objetivos)}")
        self.t0 = 0
        self.muestras = []
        self._animar()

    def _dibujar_punto(self, x, y, radio):
        x -= self.monitor[0]
        y -= self.monitor[1]
        self.lienzo.coords(self.punto, x - radio, y - radio, x + radio, y + radio)
        r = max(3, radio // 4)
        self.lienzo.coords(self.centro, x - r, y - r, x + r, y + r)

    def _animar(self):
        if self.cancelada:
            return
        self.t0 += TICK_MS
        x, y = self.objetivos[self.indice]
        if self.t0 <= ESPERA_MS:
            f = self.t0 / ESPERA_MS
            self._dibujar_punto(x, y, int(RADIO_GRANDE - (RADIO_GRANDE - RADIO_PEQUENO) * f))
        elif self.t0 <= ESPERA_MS + MEDIDA_MS:
            self._dibujar_punto(x, y, RADIO_PEQUENO)
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

    # ------------------------------------------------- seguimiento suave --
    def _posicion_seguimiento(self, s):
        """Zigzag suave: baja despacio mientras va y viene de lado a lado."""
        x1, y1, x2, y2 = self.monitor
        f = min(1.0, max(0.0, s / SEGUIMIENTO_S))
        # x: seno con 3 vueltas completas (la vuelta es suave, sin picos)
        x = x1 + self.w / 2 + (self.w / 2 - self.w * MARGEN) * math.sin(2 * math.pi * 3 * f)
        # y: de arriba abajo con arranque y frenada suaves
        e = (1 - math.cos(math.pi * f)) / 2
        y = y1 + self.h * MARGEN + (self.h - 2 * self.h * MARGEN) * e
        return x, y

    def _empezar_seguimiento(self):
        self._mostrar_texto("Ahora sigue el punto con la vista\nmientras se mueve.")
        self.lienzo.itemconfigure(self.contador, text="seguimiento")
        self.ventana.after(2200, self._arrancar_seguimiento)

    def _arrancar_seguimiento(self):
        if self.cancelada:
            return
        self.lienzo.itemconfigure(self.texto, state="hidden")
        self.t_seg = time.time()
        self.seg_historial = []
        self._animar_seguimiento()

    def _animar_seguimiento(self):
        if self.cancelada:
            return
        ahora = time.time()
        s = ahora - self.t_seg
        x, y = self._posicion_seguimiento(s)
        self._dibujar_punto(x, y, RADIO_PEQUENO + 4)
        self.seg_historial.append((ahora, x, y))

        # La muestra de mirada de ahora corresponde a donde estaba el punto
        # hace RETRASO_MIRADA_S. Se descarta el primer segundo (llegar al punto).
        r = FaceMesh().get_rasgos()
        if r is not None and s > 1.0:
            objetivo = ahora - RETRASO_MIRADA_S
            for t, px, py in reversed(self.seg_historial):
                if t <= objetivo:
                    self.seg_puntos.append((px, py))
                    self.seg_rasgos.append(r)
                    break

        if s >= SEGUIMIENTO_S:
            self._ajustar_y_comprobar()
            return
        self.ventana.after(TICK_MS, self._animar_seguimiento)

    # ----------------------------------------------------- comprobación --
    def _ajustar_y_comprobar(self):
        """Ajusta el modelo y pasa a la comprobación: cuatro puntos que no se
        usaron en el ajuste, para medir el error real."""
        try:
            self.modelo = ajustar(self.objetivos, self.rasgos_por_punto, self.monitor,
                                  self.seg_puntos, self.seg_rasgos)
        except Exception as e:
            logger.error(f"No se pudo calibrar: {e}")
            self.modelo = None
            self._terminar()
            return
        x1, y1, x2, y2 = self.monitor
        self.comprobacion = [(x1 + self.w * f, y1 + self.h * g)
                             for f, g in ((0.28, 0.3), (0.72, 0.3), (0.28, 0.7), (0.72, 0.7))]
        self.errores = []
        self.indice_comp = -1
        self._mostrar_texto("Ya casi. Ahora se comprueba la precisión:\nmira otra vez cada punto.")
        self.lienzo.itemconfigure(self.contador, text="comprobación")
        self.ventana.after(2200, self._siguiente_comprobacion)

    def _siguiente_comprobacion(self):
        if self.cancelada:
            return
        self.lienzo.itemconfigure(self.texto, state="hidden")
        self.indice_comp += 1
        if self.indice_comp >= len(self.comprobacion):
            self._terminar()
            return
        self.t0 = 0
        self.muestras = []
        self._animar_comprobacion()

    def _animar_comprobacion(self):
        if self.cancelada:
            return
        from src.detectors.calibracion import predecir
        self.t0 += TICK_MS
        x, y = self.comprobacion[self.indice_comp]
        if self.t0 <= ESPERA_MS:
            f = self.t0 / ESPERA_MS
            self._dibujar_punto(x, y, int(RADIO_GRANDE - (RADIO_GRANDE - RADIO_PEQUENO) * f))
        elif self.t0 <= ESPERA_MS + MEDIDA_MS:
            self._dibujar_punto(x, y, RADIO_PEQUENO)
            r = FaceMesh().get_rasgos()
            if r is not None:
                self.muestras.append(r)
        else:
            if len(self.muestras) >= 6:
                px, py = predecir(self.modelo, np.median(np.asarray(self.muestras), axis=0))
                self.errores.append(math.hypot(px - x, py - y))
            self._siguiente_comprobacion()
            return
        self.ventana.after(TICK_MS, self._animar_comprobacion)

    # ------------------------------------------------------------ final --
    def _terminar(self):
        modelo = getattr(self, "modelo", None)
        if modelo is not None and getattr(self, "errores", None):
            modelo["error_real_px"] = round(float(np.median(self.errores)))
            modelo["errores_comprobacion"] = [round(e) for e in self.errores]
            logger.info(f"Comprobación: errores {modelo['errores_comprobacion']} px, "
                        f"mediana {modelo['error_real_px']} px")
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


class VentanaRecentrado:
    """Corrección rápida del centro: un solo punto en el centro de la pantalla
    calibrada. La diferencia entre lo previsto y el centro se guarda como
    desplazamiento fijo. Se abre con los ojos cerrados 1,2 s (o desde la
    página Puntero) y dura unos 2 segundos."""

    ESPERA_MS = 900
    MEDIDA_MS = 1000

    def __init__(self, tk_root, al_terminar):
        self.al_terminar = al_terminar
        self.cancelada = False
        modelo = ConfigManager().config.get("ojos_calibracion")
        if not es_valido(modelo):
            self.cancelada = True
            al_terminar(False)
            return
        self.modelo = modelo
        x1, y1, x2, y2 = modelo["monitor"]
        w, h = x2 - x1, y2 - y1
        self.centro = (x1 + w / 2, y1 + h / 2)

        self.ventana = tkinter.Toplevel(tk_root)
        self.ventana.title("Gestik centro")
        self.ventana.overrideredirect(True)
        self.ventana.attributes("-topmost", True)
        self.ventana.geometry(f"{w}x{h}+{x1}+{y1}")
        self.ventana.configure(bg=FONDO)
        self.lienzo = tkinter.Canvas(self.ventana, width=w, height=h, bg=FONDO,
                                     bd=0, highlightthickness=0)
        self.lienzo.pack()
        self.ventana.bind("<Escape>", lambda e: self.cancelar())
        self.ventana.focus_force()
        self.lienzo.create_text(w // 2, int(h * 0.36), text="Mira el punto del centro",
                                fill=TEXTO, font=(estilo.FAMILIA_TEXTO, 26))
        r = RADIO_GRANDE
        self.punto = self.lienzo.create_oval(w / 2 - r, h / 2 - r, w / 2 + r, h / 2 + r,
                                             fill=PUNTO, outline="")
        rc = RADIO_PEQUENO // 2
        self.lienzo.create_oval(w / 2 - rc, h / 2 - rc, w / 2 + rc, h / 2 + rc,
                                fill=FONDO, outline="")
        self.muestras = []
        self.t0 = 0
        MouseController().calibrando = True
        self.ventana.after(TICK_MS, self._animar)

    def _animar(self):
        if self.cancelada:
            return
        self.t0 += TICK_MS
        if self.t0 > self.ESPERA_MS:
            r = FaceMesh().get_rasgos()
            if r is not None:
                self.muestras.append(r)
        if self.t0 > self.ESPERA_MS + self.MEDIDA_MS:
            self._terminar()
            return
        self.ventana.after(TICK_MS, self._animar)

    def _terminar(self):
        ok = False
        if len(self.muestras) >= 6:
            nuevo = corregir_centro(self.modelo, np.median(np.asarray(self.muestras), axis=0),
                                    self.centro)
            ConfigManager().set_temp_config("ojos_calibracion", nuevo)
            ConfigManager().apply_config()
            MouseController().reiniciar_mirada()
            ok = True
        else:
            logger.warning("Recentrado: no se vieron los ojos")
        self._cerrar()
        self.al_terminar(ok)

    def cancelar(self):
        if self.cancelada:
            return
        self._cerrar()
        self.al_terminar(False)

    def _cerrar(self):
        self.cancelada = True
        MouseController().calibrando = False
        try:
            self.ventana.destroy()
        except Exception:
            pass
