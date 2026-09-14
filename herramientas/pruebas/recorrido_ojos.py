"""Abre Winclus, muestra la página Puntero en modo ojos (directo), lanza una
calibración acortada y guarda capturas. Al final se restaura cursor.json."""
import ctypes
import os
import subprocess
import sys
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

calib.ESPERA_MS = 350
calib.MEDIDA_MS = 250
calib.SEGUIMIENTO_S = 4.0
calib.PREVIA_OK_S = 2.0
calib.PREVIA_MAX_S = 5.0
calib.VentanaCalibracion.CABEZA_S = 3.0
import time
from src.detectors import FaceMesh
from src.camera_manager import CameraManager
T0 = time.time()

# --- mirada sintética: los rasgos se derivan del punto que la ventana muestra ---
import numpy as np
rng = np.random.default_rng(3)

def rasgos_de(x, y):
    gx = (x - 960) / 960 * 0.12 + 0.02
    gy = (y - 540) / 540 * 0.05 - 0.05
    gy_p = (y - 540) / 540 * 0.09 - 0.01
    bx = (x - 960) / 960 * 0.6
    by = (y - 540) / 540 * 0.5
    r = np.array([gx, gy, gy_p, gx * 1.05, gy * 0.95, gy_p, bx, by])
    r = r + rng.normal(0, 0.004, size=8) * np.array([1, 1, 1, 1, 1, 1, 8, 8])
    mx, my = (r[0] + r[3]) / 2, (r[1] + r[4]) / 2
    ap = 0.40 - (y - 540) / 540 * 0.06 + rng.normal(0, 0.004)
    return tuple(np.concatenate([r, [mx * mx, my * my, mx * my, ap, ap * 0.97, mx ** 3, my ** 3]]))

VENTANA = {"v": None}

CABEZA = {"yaw": 0.0, "pitch": 0.0}

def get_cabeza_falso(self):
    return (CABEZA["yaw"], CABEZA["pitch"], 0.0, 0.0, 0.0, -45.0)

def get_rasgos_falso(self):
    v = VENTANA["v"]
    if v is None or v.cancelada:
        return None
    if getattr(v, "t_cabeza", None) is not None:
        t = time.time() - v.t_cabeza
        CABEZA["yaw"] = 3 * np.sin(4 * t); CABEZA["pitch"] = 2 * np.sin(5 * t)
        x, y = v.objetivo_cabeza
        return rasgos_de(x - 40 * CABEZA["yaw"], y - 30 * CABEZA["pitch"])
    if getattr(v, "comprobacion", None) is not None and getattr(v, "indice_comp", -1) >= 0 and v.indice_comp < len(v.comprobacion):
        x, y = v.comprobacion[v.indice_comp]
    elif getattr(v, "t_seg", None) is not None and getattr(v, "modelo", None) is None and v.indice >= len(v.objetivos):
        x, y = v._posicion_seguimiento(time.time() - v.t_seg - 0.12)
    elif 0 <= v.indice < len(v.objetivos):
        x, y = v.objetivos[v.indice]
    else:
        return None
    return rasgos_de(x, y)

FaceMesh.get_rasgos = get_rasgos_falso
FaceMesh.get_cabeza = get_cabeza_falso


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
    pc = lambda: app.pages["page_cursor"]
    paso(0, lambda: ir("page_cursor"))
    paso(300, lambda: pc().selector.elegir("ojos"))
    paso(1000, lambda: captura("Winclus 0.1.0", "ojos_directo_sin_calibrar.png"))
    paso(200, lambda: pc().frame_ojos.calibrar())
    paso(100, lambda: VENTANA.__setitem__("v", pc().ventana_calibracion))
    paso(2500, lambda: captura("Winclus calibración", "calibracion_previa.png"))
    paso(8000, lambda: captura("Winclus calibración", "calibracion.png"))
    paso(9000, lambda: captura("Winclus calibración", "calibracion_seguimiento.png"))
    paso(24000, lambda: print("modelo:", app.pages["page_cursor"].frame_ojos.estado_calibracion.cget("text")))
    paso(0, lambda: print("detalle:", {k: v for k, v in (app.pages["page_cursor"].frame_ojos and __import__("src.config_manager", fromlist=["ConfigManager"]).ConfigManager().config.get("ojos_calibracion") or {}).items() if k in ("error_px", "error_real_px", "errores_comprobacion", "lambda", "retraso_ms", "n_muestras", "descartados", "cabeza_coef", "cabeza_mejora_px", "cabeza_movimiento")}))
    paso(200, lambda: captura("Winclus 0.1.0", "ojos_directo_calibrado.png"))
    # solo comprobar (4 puntos) con el modelo recién hecho
    paso(200, lambda: pc().frame_ojos.comprobar())
    paso(100, lambda: VENTANA.__setitem__("v", pc().ventana_calibracion))
    paso(2500, lambda: captura("Winclus calibración", "solo_comprobar.png"))
    paso(5000, lambda: print("tras comprobar:", pc().frame_ojos.estado_calibracion.cget("text")))
    # mejorar con los datos guardados
    paso(300, lambda: pc().frame_ojos.mejorar())
    paso(3000, lambda: print("mejorar:", pc().frame_ojos.aviso_mejora.cget("text")))
    paso(300, lambda: captura("Winclus 0.1.0", "ojos_opciones.png"))
    paso(200, lambda: pc().selector.elegir("cabeza"))
    paso(0, lambda: print("fps detector:", round(FaceMesh().n_frames / (time.time() - T0), 1), "fotogramas cámara:", CameraManager().get_frame_id(), "tamaño raw:", CameraManager().get_raw_frame().shape))
    paso(300, app.close_all)


if __name__ == "__main__":
    tk_root = customtkinter.CTk()
    TaskKiller().start()
    app = run_app.MainApp(tk_root)
    programar(app)
    try:
        app.tk_root.mainloop()
    finally:
        import shutil; shutil.copy(os.path.join(SALIDA, "cursor_respaldo.json"), os.path.join(RAIZ, "configs/Inicial/cursor.json"))
        print("cursor.json restaurado")
