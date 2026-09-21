"""Marco del barrido: un rectángulo grueso alrededor del control que el barrido tiene marcado (src/barrido.py).

Como el anillo del clic por permanencia, es una ventana sin bordes, siempre encima, transparente por dentro y
transparente al ratón (WS_EX_TRANSPARENT), para no robar clics ni el foco al programa de delante. La mueve el hilo
de tkinter unas 30 veces por segundo según `Barrido().rect_actual()`.
"""

import logging
import tkinter

import win32con
import win32gui

logger = logging.getLogger("MarcoBarrido")

COLOR_CLAVE = "#010203"      # se vuelve transparente en Windows
GROSOR = 6
MARGEN = 4                   # el marco va un poco por fuera del control para no taparlo
COLOR = "#FFD400"            # amarillo: se ve sobre claro y sobre oscuro
BORDE = "#101F3D"            # y una línea oscura por fuera, por si el fondo es amarillo


class MarcoBarrido:

    def __init__(self, tk_root):
        self.ventana = tkinter.Toplevel(tk_root)
        self.ventana.title("Winclus marco del barrido")
        self.ventana.overrideredirect(True)
        self.ventana.attributes("-topmost", True)
        self.ventana.attributes("-transparentcolor", COLOR_CLAVE)
        self.ventana.configure(bg=COLOR_CLAVE)
        self.lienzo = tkinter.Canvas(self.ventana, bg=COLOR_CLAVE, bd=0, highlightthickness=0)
        self.lienzo.pack(fill="both", expand=True)
        self.visible = False
        self.rect = None
        self.ventana.withdraw()
        self.ventana.update_idletasks()
        try:
            hwnd = win32gui.GetParent(int(self.ventana.winfo_id())) or int(self.ventana.winfo_id())
            estilos = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
            estilos |= (win32con.WS_EX_LAYERED | win32con.WS_EX_TRANSPARENT
                        | win32con.WS_EX_NOACTIVATE | win32con.WS_EX_TOOLWINDOW)
            win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, estilos)
        except Exception as e:
            logger.warning(f"No se pudo hacer el marco transparente al ratón: {e}")

    def actualizar(self, rect) -> None:
        """rect = (x1, y1, x2, y2) en píxeles de pantalla, o None para ocultarlo."""
        if rect is None:
            if self.visible:
                self.ventana.withdraw()
                self.visible = False
            return
        if rect != self.rect:
            self.rect = rect
            x1, y1, x2, y2 = rect
            m = MARGEN + GROSOR
            w, h = (x2 - x1) + 2 * m, (y2 - y1) + 2 * m
            self.ventana.geometry(f"{w}x{h}+{x1 - m}+{y1 - m}")
            self.lienzo.delete("all")
            self.lienzo.create_rectangle(1, 1, w - 2, h - 2, outline=BORDE, width=2)
            self.lienzo.create_rectangle(GROSOR // 2 + 2, GROSOR // 2 + 2, w - GROSOR // 2 - 3, h - GROSOR // 2 - 3,
                                         outline=COLOR, width=GROSOR)
        if not self.visible:
            self.ventana.deiconify()
            self.ventana.attributes("-topmost", True)
            self.visible = True

    def destruir(self):
        try:
            self.ventana.destroy()
        except Exception:
            pass
