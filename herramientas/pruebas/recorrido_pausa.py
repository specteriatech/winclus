"""Comprueba el aviso de pausa y que un parpadeo sobre «Pausar» no apaga el puntero.

Sin cámara real no hay parpadeos: se inyecta el evento en el detector y se
mueve el puntero real sobre el botón (solo dentro de la ventana de Winclus).
"""
import os
import sys
import traceback

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
SALIDA = os.path.dirname(os.path.abspath(__file__))
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

import customtkinter
import pyautogui

import run_app
from recorrido import captura
from src.controllers import ControladorClic, MouseController
from src.detectors import FaceMesh
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

    def sobre_boton():
        b = app.frame_preview.boton
        x = b.winfo_rootx() + b.winfo_width() // 2
        y = b.winfo_rooty() + b.winfo_height() // 2
        pyautogui.moveTo(x, y)
        resultados.append(("contiene_boton", app.frame_preview.contiene_boton(x, y)))

    def inyectar(evento):
        with FaceMesh().parpadeo.candado:
            FaceMesh().parpadeo.evento = evento
        ControladorClic().tick()

    def anotar(nombre):
        resultados.append((nombre, MouseController().is_active.get()))

    paso(0, lambda: captura("pausa_aviso.png"))
    paso(300, lambda: anotar("inicio_en_pausa"))
    paso(300, lambda: app.set_mediapipe_mouse_enable(True))
    paso(800, lambda: captura("pausa_activo.png"))
    paso(300, sobre_boton)
    paso(300, lambda: inyectar("clic"))
    paso(300, lambda: anotar("tras_parpadeo_sobre_pausar"))
    paso(500, lambda: captura("pausa_aviso_boton.png"))
    paso(300, lambda: inyectar("largo"))
    paso(300, lambda: anotar("tras_gesto_largo_sobre_pausar"))
    paso(800, lambda: captura("pausa_tras_largo.png"))
    paso(300, lambda: pyautogui.moveTo(app.tk_root.winfo_rootx() + 700,
                                       app.tk_root.winfo_rooty() + 400))
    paso(300, app.close_all)


if __name__ == "__main__":
    tk_root = customtkinter.CTk()
    TaskKiller().start()
    app = run_app.MainApp(tk_root)
    programar(app)
    app.tk_root.mainloop()
    for nombre, valor in resultados:
        print(f"{nombre}: {valor}")
