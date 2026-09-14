"""Abre Winclus y captura: Puntero (deslizadores con − y +), Clics abajo
(tarjeta Avisos), el editor de perfiles (Agregar / Exportar / Importar) y un
aviso junto a un punto fijo. No mueve el ratón ni hace clics."""
import ctypes
import os
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
from recorrido import captura
from src.gui import aviso as aviso_mod
from src.task_killer import TaskKiller


def captura_hwnd(hwnd, nombre):
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
    im = Image.frombuffer("RGB", (info["bmWidth"], info["bmHeight"]), bmp.GetBitmapBits(True), "raw", "BGRX", 0, 1)
    win32gui.DeleteObject(bmp.GetHandle())
    save_dc.DeleteDC()
    mfc_dc.DeleteDC()
    win32gui.ReleaseDC(hwnd, hwnd_dc)
    im.save(os.path.join(SALIDA, nombre))
    print("captura", nombre, "PrintWindow", ok, flush=True)


def hwnd_de(ventana):
    h = int(ventana.winfo_id())
    return win32gui.GetParent(h) or h


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

    paso(0, lambda: ir("page_cursor"))
    paso(1200, lambda: captura("bloque2_puntero.png"))
    paso(200, lambda: ir("page_gestures"))
    paso(500, lambda: app.pages["page_gestures"].lienzo._parent_canvas.yview_moveto(1.0))
    paso(900, lambda: captura("bloque2_clics_avisos.png"))
    paso(200, lambda: app.root_function_callback("show_profile_editor"))
    paso(900, lambda: captura_hwnd(hwnd_de(app.frame_profile_editor.float_window), "bloque2_perfiles.png"))
    paso(200, lambda: app.frame_profile_editor.hide_window())
    # Aviso en un punto fijo de la ventana (cursor simulado, sin mover el ratón)
    def aviso_fijo():
        x = app.tk_root.winfo_rootx() + 600
        y = app.tk_root.winfo_rooty() + 400
        aviso_mod.win32api.GetCursorPos = lambda: (x, y)
        app.aviso.mostrar("Clic derecho", ms=3000)
    paso(300, aviso_fijo)
    paso(600, lambda: captura_hwnd(hwnd_de(app.aviso.ventana), "bloque2_aviso.png"))
    paso(300, app.close_all)


if __name__ == "__main__":
    tk_root = customtkinter.CTk()
    TaskKiller().start()
    app = run_app.MainApp(tk_root)
    programar(app)
    app.tk_root.mainloop()
