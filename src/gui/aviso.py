"""Aviso visual junto al puntero: «Clic», «Clic derecho», «Arrastrando»,
«En pausa»… para quien no oye o no puede fiarse del sonido.

Es una etiqueta pequeña, siempre encima y transparente al ratón (los clics
la atraviesan), que sigue al puntero durante menos de un segundo y
desaparece. Se refresca desde el hilo de tkinter (main_gui.anillo_loop).
"""

import logging
import time
import tkinter
import tkinter.font

import win32api
import win32con
import win32gui

from src import estilo

logger = logging.getLogger("Aviso")

COLOR_CLAVE = "#010203"
DESPLAZAMIENTO = (22, 26)   # respecto al puntero
ALTO = 30


class AvisoPuntero:

    def __init__(self, tk_root):
        self.tk_root = tk_root
        self.ventana = tkinter.Toplevel(tk_root)
        self.ventana.title("Winclus aviso")
        self.ventana.overrideredirect(True)
        self.ventana.attributes("-topmost", True)
        try:
            self.ventana.attributes("-transparentcolor", COLOR_CLAVE)
        except tkinter.TclError:
            pass
        self.ventana.configure(bg=COLOR_CLAVE)
        self.lienzo = tkinter.Canvas(self.ventana, width=10, height=ALTO, bg=COLOR_CLAVE,
                                     bd=0, highlightthickness=0)
        self.lienzo.pack()
        self.fuente = tkinter.font.Font(family=estilo.FAMILIA_TEXTO, size=12, weight="bold")
        self.fondo = self.lienzo.create_rectangle(0, 0, 10, ALTO, outline="")
        self.texto = self.lienzo.create_text(0, 0, text="", font=self.fuente)
        self.visible = False
        self.hasta = 0.0
        self.ventana.withdraw()
        self.ventana.update_idletasks()
        self._transparente_al_raton()

    def _transparente_al_raton(self):
        try:
            hwnd = int(self.ventana.winfo_id())
            hwnd = win32gui.GetParent(hwnd) or hwnd
            estilos = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
            estilos |= (win32con.WS_EX_LAYERED | win32con.WS_EX_TRANSPARENT
                        | win32con.WS_EX_NOACTIVATE | win32con.WS_EX_TOOLWINDOW)
            win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, estilos)
        except Exception as e:
            logger.warning(f"No se pudo hacer el aviso transparente al ratón: {e}")

    def mostrar(self, texto: str, ms: int = 900, color=None) -> None:
        ancho = self.fuente.measure(texto) + 24
        self.lienzo.configure(width=ancho)
        self.lienzo.coords(self.fondo, 0, 0, ancho, ALTO)
        self.lienzo.itemconfigure(self.fondo, fill=estilo.color_actual(color or estilo.PRIMARIO))
        self.lienzo.coords(self.texto, ancho // 2, ALTO // 2)
        self.lienzo.itemconfigure(self.texto, text=texto,
                                  fill=estilo.color_actual(estilo.TEXTO_SOBRE_PRIMARIO))
        self.hasta = time.time() + ms / 1000
        self._colocar()
        if not self.visible:
            self.ventana.deiconify()
            self.ventana.attributes("-topmost", True)
            self._transparente_al_raton()
            self.visible = True
        self.ventana.lift()

    def _colocar(self):
        try:
            px, py = win32api.GetCursorPos()
        except Exception:
            return
        x = px + DESPLAZAMIENTO[0]
        y = py + DESPLAZAMIENTO[1]
        ancho = int(self.lienzo.cget("width"))
        try:
            h = win32api.MonitorFromPoint((px, py), win32con.MONITOR_DEFAULTTONEAREST)
            x1, y1, x2, y2 = win32api.GetMonitorInfo(h)["Monitor"]
            if x + ancho > x2:
                x = px - ancho - 8
            if y + ALTO > y2:
                y = py - ALTO - 8
        except Exception:
            pass
        self.ventana.geometry(f"+{int(x)}+{int(y)}")

    def actualizar(self) -> None:
        """Llamar unas 30 veces por segundo: sigue al puntero y se oculta a tiempo."""
        if not self.visible:
            return
        if time.time() >= self.hasta:
            self.ventana.withdraw()
            self.visible = False
            return
        self._colocar()

    def destruir(self):
        try:
            self.ventana.destroy()
        except Exception:
            pass
