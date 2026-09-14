"""Abre Winclus y muestra el menú de clics en un punto fijo de la ventana de
Winclus (sin mover el ratón real ni hacer clics), captura la zona y lo cierra."""
import os
import sys
import traceback

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
SALIDA = os.path.dirname(os.path.abspath(__file__))
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

import customtkinter
from PIL import ImageGrab

import run_app
from src.controllers import ControladorClic
from src.task_killer import TaskKiller


def captura_zona(nombre, cx, cy, r=230):
    im = ImageGrab.grab(bbox=(cx - r, cy - r, cx + r, cy + r), all_screens=True)
    im.save(os.path.join(SALIDA, nombre))
    print("captura", nombre, flush=True)


def programar(app):
    t = 5000
    estado = {}

    def paso(ms, fn):
        nonlocal t
        t += ms
        app.tk_root.after(t, lambda: _seguro(fn))

    def _seguro(fn):
        try:
            fn()
        except Exception:
            traceback.print_exc()

    def abrir():
        x = app.tk_root.winfo_rootx() + 700
        y = app.tk_root.winfo_rooty() + 420
        estado["c"] = (x, y)
        ControladorClic().menu_ancla = (x, y)
        # En pausa el controlador cierra el menú en cada vuelta: se desactiva
        # ese cierre solo durante la captura
        estado["cerrar"] = ControladorClic().cerrar_menu
        ControladorClic().cerrar_menu = lambda: None
        ControladorClic().menu_gui.mostrar(x, y, ControladorClic().opciones_menu())

    def cerrar():
        ControladorClic().cerrar_menu = estado["cerrar"]
        ControladorClic().cerrar_menu()

    paso(0, abrir)
    paso(900, lambda: captura_zona("menu_clics.png", *estado["c"]))
    paso(200, lambda: print("visible:", ControladorClic().menu_gui.visible,
                            "opciones:", [c for c, _ in ControladorClic().opciones_menu()], flush=True))
    paso(200, cerrar)
    paso(300, app.close_all)


if __name__ == "__main__":
    tk_root = customtkinter.CTk()
    TaskKiller().start()
    app = run_app.MainApp(tk_root)
    programar(app)
    app.tk_root.mainloop()
