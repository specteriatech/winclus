"""Abre Winclus, captura la página Asistente y el menú de clics con el sector
«Asistente». No mueve el ratón ni hace clics ni pide nada al cerebro."""
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
from recorrido import captura
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

    ir = lambda p: app.root_function_callback("change_page", {"target": p})

    paso(0, lambda: ir("page_asistente"))
    paso(1500, lambda: captura("asistente_pagina.png"))
    paso(200, lambda: app.pages["page_asistente"].lienzo._parent_canvas.yview_moveto(1.0))
    paso(800, lambda: captura("asistente_pagina_abajo.png"))
    paso(200, lambda: ir("page_home"))
    paso(800, lambda: captura("asistente_inicio.png"))

    def abrir_menu():
        x = app.tk_root.winfo_rootx() + 700
        y = app.tk_root.winfo_rooty() + 420
        estado["c"] = (x, y)
        estado["cerrar"] = ControladorClic().cerrar_menu
        ControladorClic().cerrar_menu = lambda: None
        ControladorClic().menu_ancla = (x, y)
        ControladorClic().menu_gui.mostrar(x, y, ControladorClic().opciones_menu())
    paso(300, abrir_menu)
    paso(900, lambda: captura_zona("asistente_menu.png", *estado["c"]))

    def cerrar():
        ControladorClic().cerrar_menu = estado["cerrar"]
        ControladorClic().cerrar_menu()
    paso(200, cerrar)
    paso(300, app.close_all)


if __name__ == "__main__":
    tk_root = customtkinter.CTk()
    TaskKiller().start()
    app = run_app.MainApp(tk_root)
    programar(app)
    app.tk_root.mainloop()
