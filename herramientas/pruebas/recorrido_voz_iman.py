"""Abre Winclus y captura la página Escribir (Voz y Frases), la capa «Frases»
del teclado en pantalla y la tarjeta «Imán a los botones» de Puntero. No
mueve el ratón, no hace clics ni habla."""
import os
import sys
import traceback

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
SALIDA = os.path.dirname(os.path.abspath(__file__))
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

import customtkinter

import run_app
from recorrido import captura
from recorrido_bloque2 import captura_hwnd, hwnd_de
from src.task_killer import TaskKiller


def programar(app):
    t = 5000

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

    paso(0, lambda: ir("page_escribir"))
    paso(1500, lambda: captura("voz_escribir.png"))
    paso(200, lambda: app.pages["page_escribir"].lienzo._parent_canvas.yview_moveto(1.0))
    paso(800, lambda: captura("voz_escribir_abajo.png"))
    paso(200, lambda: app.teclado.mostrar())
    paso(600, lambda: captura_hwnd(hwnd_de(app.teclado.ventana), "voz_teclado_abc.png"))
    def capa_frases():
        app.teclado.capa = "frases"
        app.teclado._redibujar()
    paso(200, capa_frases)
    paso(600, lambda: captura_hwnd(hwnd_de(app.teclado.ventana), "voz_teclado_frases.png"))
    def volver():
        app.teclado.capa = "abc"
        app.teclado.ocultar()
    paso(200, volver)
    paso(200, lambda: ir("page_cursor"))
    paso(500, lambda: app.pages["page_cursor"].lienzo._parent_canvas.yview_moveto(1.0))
    paso(900, lambda: captura("iman_puntero.png"))
    paso(300, app.close_all)


if __name__ == "__main__":
    tk_root = customtkinter.CTk()
    TaskKiller().start()
    app = run_app.MainApp(tk_root)
    programar(app)
    app.tk_root.mainloop()
