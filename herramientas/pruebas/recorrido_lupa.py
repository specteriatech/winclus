"""Prueba de la lupa y del recentrado con una calibración ficticia.
Los clics y movimientos reales del ratón se sustituyen por funciones que
solo registran, para no tocar el escritorio del usuario."""
import ctypes
import os
import sys
import time
import traceback

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
SALIDA = os.path.dirname(os.path.abspath(__file__))
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

import customtkinter
import win32gui
import win32ui
from PIL import Image

import run_app
import src.gui.calibracion as calib
from src.task_killer import TaskKiller

calib.VentanaRecentrado.ESPERA_MS = 300
calib.VentanaRecentrado.MEDIDA_MS = 400

registro = []


def captura(titulo, nombre):
    hwnd = win32gui.FindWindow(None, titulo)
    if not hwnd:
        print("sin ventana", titulo)
        return
    x1, y1, x2, y2 = win32gui.GetWindowRect(hwnd)
    w, h = x2 - x1, y2 - y1
    hwnd_dc = win32gui.GetWindowDC(hwnd)
    mfc_dc = win32ui.CreateDCFromHandle(hwnd_dc)
    save_dc = mfc_dc.CreateCompatibleDC()
    bmp = win32ui.CreateBitmap()
    bmp.CreateCompatibleBitmap(mfc_dc, w, h)
    save_dc.SelectObject(bmp)
    ok = ctypes.windll.user32.PrintWindow(hwnd, save_dc.GetSafeHdc(), 2)
    info = bmp.GetInfo()
    datos = bmp.GetBitmapBits(True)
    im = Image.frombuffer("RGB", (info["bmWidth"], info["bmHeight"]), datos, "raw", "BGRX", 0, 1)
    win32gui.DeleteObject(bmp.GetHandle())
    save_dc.DeleteDC()
    mfc_dc.DeleteDC()
    win32gui.ReleaseDC(hwnd, hwnd_dc)
    im.save(os.path.join(SALIDA, nombre))
    print("captura", nombre, ok, w, h)


def programar(app):
    import pyautogui
    import pydirectinput
    from src.config_manager import ConfigManager
    from src.controllers import ControladorClic, MouseController
    from src.detectors.mirada import NOMBRES_RASGOS

    # Ratón simulado
    pos = [900, 500]
    pyautogui.position = lambda: tuple(pos)
    pyautogui.moveTo = lambda x, y, *a, **k: (pos.__setitem__(0, x), pos.__setitem__(1, y), registro.append(("moveTo", x, y)))
    pyautogui.move = lambda *a, **k: None
    pydirectinput.click = lambda *a, **k: registro.append(("click", tuple(pos)))

    # Calibración ficticia: predice siempre el centro más un poco
    n = len(NOMBRES_RASGOS)
    modelo = {"media": [0.0] * n, "desv": [1.0] * n, "coef_x": [960.0] + [0.0] * n,
              "coef_y": [540.0] + [0.0] * n, "monitor": [0, 0, 1920, 1080], "puntos": [],
              "error_px": 40, "n_muestras": 9}
    cfg = ConfigManager()
    cfg.set_temp_config("ojos_calibracion", modelo)
    cfg.set_temp_config("modo_puntero", "ojos")
    cfg.set_temp_config("ojos_modo", "directo")
    cfg.set_temp_config("modo_clic", "parpadeo")
    cfg.apply_config()
    MouseController().set_active(True)

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
    cc = ControladorClic()
    paso(0, lambda: ir("page_cursor"))
    paso(800, lambda: captura("Winclus 0.1.0", "puntero_directo_opciones.png"))
    paso(200, lambda: cc.clic())                      # primer gesto: abre la lupa
    paso(600, lambda: print("lupa:", MouseController().lupa, "visible:", app.lupa.visible,
                            "foco en:", win32gui.GetWindowText(win32gui.GetForegroundWindow())))
    paso(0, lambda: captura("Winclus lupa", "lupa.png"))
    # la mirada «se mueve» dentro de la lupa: el puntero simulado va a una esquina de la lupa
    paso(100, lambda: pos.__setitem__(0, MouseController().lupa["rect"][0] + 100))
    paso(0, lambda: pos.__setitem__(1, MouseController().lupa["rect"][1] + 150))
    paso(200, lambda: cc.clic())                      # segundo gesto: clic real
    paso(500, lambda: print("registro:", registro, "lupa tras clic:", MouseController().lupa, app.lupa.visible))
    # cierre por tiempo
    paso(200, lambda: cc.clic())
    paso(300, lambda: cfg.set_temp_config("lupa_tiempo_max_s", 0.5) or cfg.apply_config())
    paso(1200, lambda: print("cerrada por tiempo:", MouseController().lupa is None, app.lupa.visible))
    # recentrado con evento largo
    paso(200, lambda: setattr(__import__("src.detectors", fromlist=["FaceMesh"]).FaceMesh().parpadeo, "evento", "largo"))
    paso(500, lambda: captura("Winclus centro", "recentrado.png"))
    paso(1500, lambda: print("sesgo:", cfg.config["ojos_calibracion"].get("sesgo"),
                             "estado:", app.pages["page_cursor"].frame_ojos.estado_calibracion.cget("text")))
    paso(200, lambda: captura("Winclus 0.1.0", "puntero_tras_recentrado.png"))
    paso(300, app.close_all)


if __name__ == "__main__":
    tk_root = customtkinter.CTk()
    TaskKiller().start()
    app = run_app.MainApp(tk_root)
    programar(app)
    app.tk_root.mainloop()
