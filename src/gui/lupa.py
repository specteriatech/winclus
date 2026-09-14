"""Lupa de dos pasos para afinar el clic con la mirada.

Una webcam no distingue con precisión dónde se mira (unos 2–3 grados, es
decir, 80–120 px). La lupa lo compensa: al hacer el gesto de clic, en vez de
pulsar se muestra la zona de alrededor del puntero agrandada. La persona
mira dentro de la zona agrandada el sitio exacto y repite el gesto: entonces
se pulsa en el punto real que corresponde. Con un aumento de 3, el error se
divide por 3.

La ventana no toma el foco (no roba el teclado a la aplicación de debajo).
"""

import logging
import tkinter

import win32con
import win32gui
from PIL import Image, ImageGrab, ImageTk

from src import estilo

logger = logging.getLogger("Lupa")

BORDE = 4


def _recortar(v, lo, hi):
    return max(lo, min(hi, v))


class Lupa:

    def __init__(self, tk_root):
        self.ventana = tkinter.Toplevel(tk_root)
        self.ventana.title("Winclus lupa")
        self.ventana.overrideredirect(True)
        self.ventana.attributes("-topmost", True)
        self.ventana.configure(bg=estilo.PRIMARIO[0])
        self.etiqueta = tkinter.Label(self.ventana, bd=0, bg=estilo.PRIMARIO[0])
        self.etiqueta.pack(padx=BORDE, pady=BORDE)
        self.foto = None
        self.visible = False
        self.ventana.withdraw()
        self.ventana.update_idletasks()
        self._sin_foco()

    def _sin_foco(self):
        try:
            hwnd = int(self.ventana.winfo_id())
            hwnd = win32gui.GetParent(hwnd) or hwnd
            estilos = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
            estilos |= win32con.WS_EX_NOACTIVATE | win32con.WS_EX_TOOLWINDOW
            win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, estilos)
        except Exception as e:
            logger.warning(f"No se pudo quitar el foco a la lupa: {e}")

    def mostrar(self, cx, cy, region: int, zoom: float, monitor) -> dict:
        """Agranda la zona region×region alrededor de (cx, cy). Devuelve la
        geometría para pasar de un punto de la ventana al punto real."""
        x1, y1, x2, y2 = monitor
        region = int(region)
        rx1 = int(_recortar(cx - region / 2, x1, x2 - region))
        ry1 = int(_recortar(cy - region / 2, y1, y2 - region))
        try:
            im = ImageGrab.grab(bbox=(rx1, ry1, rx1 + region, ry1 + region),
                                all_screens=True)
        except Exception as e:
            logger.warning(f"No se pudo capturar la pantalla: {e}")
            return None
        tam = int(region * zoom)
        im = im.resize((tam, tam), Image.BICUBIC)
        self.foto = ImageTk.PhotoImage(im)
        self.etiqueta.configure(image=self.foto)

        wx = int(_recortar(cx - tam / 2, x1, x2 - tam))
        wy = int(_recortar(cy - tam / 2, y1, y2 - tam))
        self.ventana.geometry(f"{tam + 2 * BORDE}x{tam + 2 * BORDE}+{wx - BORDE}+{wy - BORDE}")
        self.ventana.configure(bg=estilo.color_actual(estilo.PRIMARIO))
        self.etiqueta.configure(bg=estilo.color_actual(estilo.PRIMARIO))
        self.ventana.deiconify()
        self.ventana.lift()
        self.ventana.attributes("-topmost", True)
        self._sin_foco()
        self.visible = True
        return {
            "rect": (wx, wy, wx + tam, wy + tam),   # dónde está la ventana
            "region": (rx1, ry1),                   # qué trozo real muestra
            "zoom": float(zoom),
        }

    @staticmethod
    def punto_real(geometria: dict, px, py):
        """Punto real de la pantalla que corresponde a un punto de la ventana."""
        wx, wy, _, _ = geometria["rect"]
        rx1, ry1 = geometria["region"]
        z = geometria["zoom"]
        return rx1 + (px - wx) / z, ry1 + (py - wy) / z

    def ocultar(self):
        if self.visible:
            self.ventana.withdraw()
            self.visible = False

    def destruir(self):
        try:
            self.ventana.destroy()
        except Exception:
            pass
