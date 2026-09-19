"""Tarjeta «Hablarle a Winclus» de la página Escribir: abre la app y la captura.

No enciende el micrófono ni escribe nada: solo mira que la tarjeta se dibuje,
que diga lo que este equipo puede hacer (órdenes sí, dictado según Windows) y
que los botones queden como toca. La ayuda «¿Qué puedo decir?» sí suena.
"""
import logging
import os
import sys
import traceback

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
SALIDA = os.path.dirname(os.path.abspath(__file__))
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

import customtkinter  # noqa: E402

import run_app  # noqa: E402
from herramientas.pruebas.recorrido import captura  # noqa: E402
from src.task_killer import TaskKiller  # noqa: E402


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

    pagina = app.pages["page_escribir"]
    ir = lambda p: app.root_function_callback("change_page", {"target": p})

    def contar():
        estado = pagina.escucha_estado.cget("text")
        print("ESTADO EN PANTALLA:", estado)
        print("BOTONES:", pagina.boton_escuchar.cget("text"), "/", pagina.boton_dictar.cget("text"))

    paso(0, lambda: ir("page_escribir"))
    paso(1500, lambda: pagina.lienzo._parent_canvas.yview_moveto(0.52))
    paso(900, lambda: captura("voz_hablar.png"))
    paso(300, contar)
    paso(300, pagina._que_puedo_decir)
    paso(1500, lambda: captura("voz_ayuda.png"))
    paso(2500, app.close_all)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    tk_root = customtkinter.CTk()
    TaskKiller().start()
    app = run_app.MainApp(tk_root)
    programar(app)
    app.tk_root.mainloop()
