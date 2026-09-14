"""Anillo que se llena junto al puntero mientras se espera el clic por permanencia.

Es una ventanita sin bordes, siempre encima y transparente al ratón (los clics
la atraviesan gracias a WS_EX_TRANSPARENT), que sigue al puntero. Se dibuja
desde el hilo de tkinter unas 30 veces por segundo.
"""

import logging
import tkinter

import win32con
import win32gui

from src import estilo

logger = logging.getLogger("Anillo")

TAMANO = 56
GROSOR = 6
COLOR_CLAVE = "#010203"   # este color se vuelve transparente en Windows


class Anillo:

    def __init__(self, tk_root):
        self.ventana = tkinter.Toplevel(tk_root)
        self.ventana.title("Winclus anillo")
        self.ventana.overrideredirect(True)
        self.ventana.attributes("-topmost", True)
        self.ventana.attributes("-transparentcolor", COLOR_CLAVE)
        self.ventana.configure(bg=COLOR_CLAVE)
        self.ventana.geometry(f"{TAMANO}x{TAMANO}+0+0")

        self.lienzo = tkinter.Canvas(self.ventana,
                                     width=TAMANO,
                                     height=TAMANO,
                                     bg=COLOR_CLAVE,
                                     bd=0,
                                     highlightthickness=0)
        self.lienzo.pack()
        m = GROSOR // 2 + 1
        caja = (m, m, TAMANO - m, TAMANO - m)
        self.fondo = self.lienzo.create_oval(*caja, outline="#FFFFFF", width=GROSOR)
        self.arco = self.lienzo.create_arc(*caja,
                                           start=90,
                                           extent=0,
                                           style=tkinter.ARC,
                                           outline=estilo.PRIMARIO[0],
                                           width=GROSOR)
        self.visible = False
        self.ventana.withdraw()
        self.ventana.update_idletasks()
        self._hacer_transparente_al_raton()

    def _hacer_transparente_al_raton(self):
        try:
            hwnd = int(self.ventana.winfo_id())
            hwnd = win32gui.GetParent(hwnd) or hwnd
            estilos = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
            estilos |= (win32con.WS_EX_LAYERED | win32con.WS_EX_TRANSPARENT
                        | win32con.WS_EX_NOACTIVATE | win32con.WS_EX_TOOLWINDOW)
            win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, estilos)
        except Exception as e:   # sin esto el anillo se llevaría el clic
            logger.warning(f"No se pudo hacer el anillo transparente al ratón: {e}")

    def actualizar(self, estado) -> None:
        """estado = (x, y, progreso) o None para ocultarlo."""
        if estado is None:
            if self.visible:
                self.ventana.withdraw()
                self.visible = False
            return
        x, y, progreso = estado
        self.lienzo.itemconfigure(self.arco,
                                  extent=-360 * max(0.0, min(1.0, progreso)),
                                  outline=estilo.color_actual(estilo.PRIMARIO))
        self.ventana.geometry(f"+{int(x) - TAMANO // 2}+{int(y) - TAMANO // 2}")
        if not self.visible:
            self.ventana.deiconify()
            self.ventana.attributes("-topmost", True)
            self._hacer_transparente_al_raton()
            self.visible = True
        # Por encima de la lupa, que también está «siempre encima»
        self.ventana.lift()

    def destruir(self):
        try:
            self.ventana.destroy()
        except Exception:
            pass
