"""Abre Winclus, muestra la tarjeta «Calibración invisible» y simula clics
aprendidos (sin hacer clics reales): inyecta rasgos sintéticos en el
historial y anota la posición actual del ratón. Al final borra las muestras
de prueba del perfil para no ensuciar los clics reales del usuario.
"""
import os
import sys
import time
import traceback

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
SALIDA = os.path.dirname(os.path.abspath(__file__))
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

import customtkinter

import run_app
from recorrido import captura
from src.config_manager import ConfigManager
from src.detectors.aprendizaje import AprendizajeClics
from src.task_killer import TaskKiller

resultados = []


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
    a = AprendizajeClics()
    n_inicial = [0]

    def anotar_sintetico():
        # Rasgos «fijos» durante el segundo previo al clic
        ahora = time.time()
        for dt in (0.9, 0.8, 0.7, 0.6, 0.5, 0.4):
            a.historial.append((ahora - dt, tuple([0.01 * i for i in range(15)]), (0.0,) * 6))
        ok = a.anotar_clic_puntero(parpadeo=True)
        resultados.append(("anotado", ok, a.n_muestras()))

    paso(0, lambda: n_inicial.__setitem__(0, a.n_muestras()))
    paso(0, lambda: ir("page_cursor"))
    paso(1200, lambda: captura("aprendizaje_tarjeta.png"))
    paso(300, anotar_sintetico)
    paso(300, anotar_sintetico)
    def bajar():
        try:
            app.pages["page_cursor"].lienzo._parent_canvas.yview_moveto(1.0)
        except Exception as e:
            print("scroll:", e)
    paso(300, bajar)
    paso(1000, lambda: captura("aprendizaje_con_clics.png"))
    paso(300, lambda: resultados.append(("estado", a.estado_texto())))
    paso(300, lambda: resultados.append(("archivo", a.ruta and a.ruta.is_file())))
    # Limpieza: quitar solo las muestras sintéticas añadidas
    def limpiar():
        with a.candado:
            del a.muestras[n_inicial[0]:]
        a._guardar()
        resultados.append(("limpio", a.n_muestras() == n_inicial[0]))
    paso(300, limpiar)
    paso(300, lambda: print("\n".join(f"{k}: {v}" for k, *v in resultados), flush=True))
    paso(300, app.close_all)


if __name__ == "__main__":
    tk_root = customtkinter.CTk()
    TaskKiller().start()
    app = run_app.MainApp(tk_root)
    programar(app)
    app.tk_root.mainloop()
