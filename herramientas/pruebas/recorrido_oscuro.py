"""Abre Winclus, captura cada página en modo claro y en modo oscuro y deja el modo
como estaba. No mueve el ratón ni hace clics. Las capturas quedan como
cap_claro_<página>.png y cap_oscuro_<página>.png (ignoradas por git)."""
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
from recorrido_teclado import captura_hwnd, hwnd_de   # también sustituye SendInput por un registro: no escribe nada real
from src import estilo
from src.gui.frames.frame_menu import PESTANAS
from src.task_killer import TaskKiller


def programar(app):
    t = 5000
    modo_original = estilo.modo_guardado()

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

    def recorrer(modo):
        for clave in PESTANAS:
            paso(300, lambda c=clave: ir(c))
            paso(1200, lambda c=clave, m=modo: captura(f"cap_{m}_{c[5:]}.png"))

    paso(0, lambda: estilo.aplicar_modo("claro", guardar=False))
    paso(500, lambda: app.frame_menu.refrescar_boton_modo())
    recorrer("claro")
    paso(300, lambda: app.frame_menu.cambiar_modo())      # el mismo camino que la persona: el botón del menú
    paso(800, lambda: print("modo ahora:", estilo.modo_actual(), flush=True))
    recorrer("oscuro")
    # Teclado en pantalla: abierto en oscuro, y se queda abierto al volver a claro (debe reconstruirse solo)
    paso(300, lambda: app.pages["page_escribir"].alternar())
    paso(1500, lambda: captura_hwnd(hwnd_de(app.teclado.ventana), "cap_oscuro_teclado.png"))
    paso(300, lambda: estilo.aplicar_modo(modo_original))  # dejarlo como estaba (y guardado así)
    paso(300, lambda: app.frame_menu.refrescar_boton_modo())
    paso(1200, lambda: captura_hwnd(hwnd_de(app.teclado.ventana), f"cap_{modo_original}_teclado.png"))
    paso(300, lambda: app.pages["page_escribir"].alternar())
    paso(500, app.close_all)


if __name__ == "__main__":
    tk_root = customtkinter.CTk()
    TaskKiller().start()
    app = run_app.MainApp(tk_root)
    programar(app)
    app.tk_root.mainloop()
