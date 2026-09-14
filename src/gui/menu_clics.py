"""Menú de clics: un anillo de opciones grandes alrededor del puntero.

Se abre con los ojos cerrados 1,2 s (o desde el teclado en pantalla) y
ofrece lo que un parpadeo solo no puede hacer: clic derecho, doble clic,
arrastrar y soltar, rueda arriba y abajo, teclado, recentrar la mirada o
pausar. La persona lleva el puntero al sector (con la cabeza o la mirada) y
hace su gesto de clic normal; ControladorClic (controllers/clics.py) es
quien decide qué se ejecuta. El centro del anillo cierra el menú.

Misma receta que el teclado en pantalla: ventana sin bordes, siempre encima
y sin foco (WS_EX_NOACTIVATE), todo dibujado en un Canvas. El fondo usa un
color de transparencia para que solo se vea el anillo.
"""

import logging
import math
import time
import tkinter

import win32api
import win32con
import win32gui

from src import estilo

logger = logging.getLogger("MenuClics")

RADIO_EXTERIOR = 170
RADIO_INTERIOR = 58
MARGEN = 6
TIEMPO_MAX_S = 10.0        # se cierra solo si no se elige nada
COLOR_TRANSPARENTE = "#010203"


class MenuClics:

    def __init__(self, tk_root):
        self.tk_root = tk_root
        self.ventana = tkinter.Toplevel(tk_root)
        self.ventana.title("Winclus menú")
        self.ventana.overrideredirect(True)
        self.ventana.attributes("-topmost", True)
        try:
            self.ventana.attributes("-transparentcolor", COLOR_TRANSPARENTE)
        except tkinter.TclError:
            pass
        self.ventana.configure(bg=COLOR_TRANSPARENTE)
        lado = 2 * (RADIO_EXTERIOR + MARGEN)
        self.lado = lado
        self.lienzo = tkinter.Canvas(self.ventana, width=lado, height=lado, bd=0,
                                     highlightthickness=0, bg=COLOR_TRANSPARENTE)
        self.lienzo.pack()

        self.visible = False
        self.centro = (0, 0)          # centro del anillo en pantalla
        self.rect = (0, 0, 0, 0)
        self.sectores = []            # dicts: clave, texto, arco, etiqueta
        self.centro_ids = ()
        self.hover = None
        self.abierto_desde = 0.0
        self.al_cerrar_solo = None    # aviso si se cierra por tiempo

        self.ventana.withdraw()
        self.ventana.update_idletasks()
        self._sin_foco()
        self.tk_root.after(40, self._bucle)

    # ---------------------------------------------------------- ventana --
    def _sin_foco(self):
        try:
            hwnd = int(self.ventana.winfo_id())
            hwnd = win32gui.GetParent(hwnd) or hwnd
            estilos = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
            estilos |= win32con.WS_EX_NOACTIVATE | win32con.WS_EX_TOOLWINDOW
            win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, estilos)
        except Exception as e:
            logger.warning(f"No se pudo quitar el foco al menú: {e}")

    @staticmethod
    def _monitor_de(x, y):
        try:
            h = win32api.MonitorFromPoint((int(x), int(y)), win32con.MONITOR_DEFAULTTONEAREST)
            return win32api.GetMonitorInfo(h)["Monitor"]
        except Exception:
            return (0, 0, win32api.GetSystemMetrics(0), win32api.GetSystemMetrics(1))

    def mostrar(self, x, y, opciones) -> None:
        """Abre el anillo centrado en (x, y), dentro del monitor. opciones:
        lista de (clave, texto) en el sentido de las agujas del reloj,
        empezando arriba."""
        x1, y1, x2, y2 = self._monitor_de(x, y)
        cx = min(max(int(x), x1 + self.lado // 2), x2 - self.lado // 2)
        cy = min(max(int(y), y1 + self.lado // 2), y2 - self.lado // 2)
        self.centro = (cx, cy)
        ox, oy = cx - self.lado // 2, cy - self.lado // 2
        self.rect = (ox, oy, ox + self.lado, oy + self.lado)
        self.ventana.geometry(f"{self.lado}x{self.lado}+{ox}+{oy}")
        self._dibujar(list(opciones))
        self.ventana.deiconify()
        self.ventana.lift()
        self.ventana.attributes("-topmost", True)
        self._sin_foco()
        self.visible = True
        self.hover = None
        self.abierto_desde = time.time()
        logger.info(f"Menú de clics abierto en ({cx}, {cy}): {[c for c, _ in opciones]}")

    def ocultar(self) -> None:
        if not self.visible:
            return
        self.ventana.withdraw()
        self.visible = False
        self.hover = None

    def destruir(self) -> None:
        try:
            self.ventana.destroy()
        except Exception:
            pass

    # ------------------------------------------------------------ dibujo --
    def _dibujar(self, opciones) -> None:
        self.lienzo.delete("all")
        self.sectores = []
        c = estilo.color_actual
        n = max(1, len(opciones))
        paso = 360.0 / n
        m = self.lado // 2
        re, ri = RADIO_EXTERIOR, RADIO_INTERIOR
        fuente = (estilo.FAMILIA_TEXTO, 13, "bold")
        for i, (clave, texto) in enumerate(opciones):
            inicio = 90.0 - (i + 0.5) * paso     # tk: grados en sentido antihorario desde las 3
            arco = self.lienzo.create_arc(m - re, m - re, m + re, m + re, start=inicio, extent=paso,
                                          style=tkinter.PIESLICE, fill=c(estilo.TARJETA),
                                          outline=c(estilo.BORDE), width=2)
            ang = math.radians(inicio + paso / 2)
            r = (re + ri) / 2 + 6
            etiqueta = self.lienzo.create_text(m + r * math.cos(ang), m - r * math.sin(ang),
                                               text=texto, fill=c(estilo.TEXTO), font=fuente,
                                               justify=tkinter.CENTER, width=int(re * 0.75))
            self.sectores.append({"clave": clave, "texto": texto, "arco": arco, "etiqueta": etiqueta})
        circulo = self.lienzo.create_oval(m - ri, m - ri, m + ri, m + ri, fill=c(estilo.PANEL),
                                          outline=c(estilo.BORDE), width=2)
        texto_c = self.lienzo.create_text(m, m, text="Cerrar", fill=c(estilo.TEXTO_SUAVE),
                                          font=(estilo.FAMILIA_TEXTO, 12))
        self.centro_ids = (circulo, texto_c)

    def _pintar(self, sector, hover: bool) -> None:
        c = estilo.color_actual
        if sector == "centro":
            self.lienzo.itemconfigure(self.centro_ids[0],
                                      fill=c(estilo.PRIMARIO_SUAVE if hover else estilo.PANEL))
            return
        self.lienzo.itemconfigure(sector["arco"],
                                  fill=c(estilo.PRIMARIO if hover else estilo.TARJETA))
        self.lienzo.itemconfigure(sector["etiqueta"],
                                  fill=c(estilo.TEXTO_SOBRE_PRIMARIO if hover else estilo.TEXTO))

    # --------------------------------------------------------- geometría --
    def contiene(self, x, y) -> bool:
        if not self.visible:
            return False
        cx, cy = self.centro
        return math.hypot(x - cx, y - cy) <= RADIO_EXTERIOR

    def opcion_en(self, x, y):
        """Clave del sector bajo el punto de pantalla, «cerrar» en el centro,
        None fuera del anillo."""
        if not self.sectores:
            return None
        cx, cy = self.centro
        d = math.hypot(x - cx, y - cy)
        if d > RADIO_EXTERIOR:
            return None
        if d < RADIO_INTERIOR:
            return "cerrar"
        ang = math.degrees(math.atan2(-(y - cy), x - cx)) % 360.0
        paso = 360.0 / len(self.sectores)
        k = int(((90.0 + paso / 2 - ang) % 360.0) // paso)
        return self.sectores[min(k, len(self.sectores) - 1)]["clave"]

    def _sector_en(self, x, y):
        clave = self.opcion_en(x, y)
        if clave is None:
            return None
        if clave == "cerrar" and math.hypot(x - self.centro[0], y - self.centro[1]) < RADIO_INTERIOR:
            return "centro"
        return next((s for s in self.sectores if s["clave"] == clave), None)

    # ------------------------------------------------------------ bucle --
    def _bucle(self):
        try:
            if self.visible:
                self._hover()
                if time.time() - self.abierto_desde > TIEMPO_MAX_S:
                    logger.info("Menú de clics cerrado por tiempo")
                    self.ocultar()
                    if self.al_cerrar_solo is not None:
                        self.al_cerrar_solo()
        except Exception as e:
            logger.warning(f"Menú de clics: {e}")
        self.tk_root.after(40, self._bucle)

    def _hover(self):
        try:
            px, py = win32api.GetCursorPos()
        except Exception:
            return
        s = self._sector_en(px, py)
        if s is self.hover:
            return
        if self.hover is not None:
            self._pintar(self.hover, False)
        self.hover = s
        if s is not None:
            self._pintar(s, True)
            self.abierto_desde = time.time()   # mientras se elige, no se cierra
