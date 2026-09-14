"""Abre Winclus, entra en Puntero → Con los ojos → Híbrido y captura el panel.
Deja el sub-modo como estaba. No hace clics."""
import os
import sys
import traceback

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

import customtkinter

import run_app
from recorrido import captura
from src.config_manager import ConfigManager
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
    pagina = lambda: app.pages["page_cursor"]
    modo_previo = ConfigManager().config.get("modo_puntero")
    submodo_previo = ConfigManager().config.get("ojos_modo", "directo")

    paso(0, lambda: ir("page_cursor"))
    paso(500, lambda: pagina().selector.elegir("ojos"))
    paso(500, lambda: pagina().frame_ojos.cambiar_submodo("Híbrido"))
    paso(1200, lambda: captura("hibrido_panel.png"))
    paso(300, lambda: pagina().lienzo._parent_canvas.yview_moveto(0.5))
    paso(800, lambda: captura("hibrido_panel_abajo.png"))
    paso(300, lambda: print("submodo en config:", ConfigManager().config.get("ojos_modo"), flush=True))
    # Dejar todo como estaba
    paso(300, lambda: pagina().frame_ojos.cambiar_submodo(
        {"directo": "Directo", "hibrido": "Híbrido", "palanca": "Palanca"}[submodo_previo]))
    paso(300, lambda: pagina().selector.elegir(modo_previo))
    paso(500, app.close_all)


if __name__ == "__main__":
    tk_root = customtkinter.CTk()
    TaskKiller().start()
    app = run_app.MainApp(tk_root)
    programar(app)
    app.tk_root.mainloop()
