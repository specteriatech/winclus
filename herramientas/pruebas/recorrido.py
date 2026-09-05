"""Abre Gestik, recorre las páginas nuevas y guarda capturas (sin clics)."""
import logging
import os
import sys
import traceback

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
SALIDA = os.path.dirname(os.path.abspath(__file__))
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

import customtkinter
import pyautogui
import win32con
import win32gui
import win32process
import win32api

import run_app
from src.task_killer import TaskKiller

TITULO = "Gestik 0.1.0"


def traer_al_frente():
    hwnd = win32gui.FindWindow(None, TITULO)
    if not hwnd:
        return None
    try:
        hilo_frente = win32process.GetWindowThreadProcessId(win32gui.GetForegroundWindow())[0]
        hilo_mio = win32api.GetCurrentThreadId()
        win32process.AttachThreadInput(hilo_frente, hilo_mio, True)
        win32gui.SetForegroundWindow(hwnd)
        win32process.AttachThreadInput(hilo_frente, hilo_mio, False)
    except Exception as e:
        print("foreground:", e)
    return hwnd


def captura(nombre):
    """Copia el contenido de la ventana aunque esté tapada (PrintWindow)."""
    import win32ui
    from PIL import Image
    hwnd = win32gui.FindWindow(None, TITULO)
    if not hwnd:
        print("sin ventana")
        return
    x1, y1, x2, y2 = win32gui.GetWindowRect(hwnd)
    w, h = x2 - x1, y2 - y1
    hwnd_dc = win32gui.GetWindowDC(hwnd)
    mfc_dc = win32ui.CreateDCFromHandle(hwnd_dc)
    save_dc = mfc_dc.CreateCompatibleDC()
    bmp = win32ui.CreateBitmap()
    bmp.CreateCompatibleBitmap(mfc_dc, w, h)
    save_dc.SelectObject(bmp)
    import ctypes
    ok = ctypes.windll.user32.PrintWindow(hwnd, save_dc.GetSafeHdc(), 2)
    info = bmp.GetInfo()
    datos = bmp.GetBitmapBits(True)
    im = Image.frombuffer("RGB", (info["bmWidth"], info["bmHeight"]), datos, "raw", "BGRX", 0, 1)
    win32gui.DeleteObject(bmp.GetHandle())
    save_dc.DeleteDC()
    mfc_dc.DeleteDC()
    win32gui.ReleaseDC(hwnd, hwnd_dc)
    im.save(os.path.join(SALIDA, nombre))
    print("captura", nombre, "PrintWindow", ok)


pasos = []


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
    paso(0, lambda: ir("page_gestures"))
    paso(1200, lambda: captura("clics_parpadeo.png"))
    paso(300, lambda: app.pages["page_gestures"].selector.elegir("boca"))
    paso(800, lambda: captura("clics_boca.png"))
    paso(300, lambda: app.pages["page_gestures"].selector.elegir("quieto"))
    paso(800, lambda: captura("clics_quieto.png"))
    paso(300, lambda: app.pages["page_gestures"].selector.elegir("parpadeo"))
    paso(300, lambda: ir("page_cursor"))
    paso(1000, lambda: captura("puntero_cabeza.png"))
    paso(300, lambda: app.pages["page_cursor"].selector.elegir("ojos"))
    paso(1200, lambda: captura("puntero_ojos.png"))
    paso(300, lambda: app.pages["page_cursor"].selector.elegir("cabeza"))
    paso(300, lambda: ir("page_home"))
    paso(800, lambda: captura("inicio.png"))
    paso(500, app.close_all)


if __name__ == "__main__":
    tk_root = customtkinter.CTk()
    TaskKiller().start()
    app = run_app.MainApp(tk_root)
    programar(app)
    app.tk_root.mainloop()
