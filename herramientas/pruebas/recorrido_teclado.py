"""Recorrido del teclado en pantalla: abre la página «Escribir», muestra el
teclado, pulsa teclas simuladas y captura cada capa. No manda teclas reales
(se sustituye SendInput por un registro) ni toca cursor.json."""
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
from src.controllers import escritura
from src.task_killer import TaskKiller

registro = []
escritura._enviar = lambda entradas: registro.append(
    [(e.u.ki.wVk, chr(e.u.ki.wScan) if e.u.ki.wScan else "", e.u.ki.dwFlags) for e in entradas])


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
    datos = bmp.GetBitmapBits(True)
    im = Image.frombuffer("RGB", (info["bmWidth"], info["bmHeight"]), datos, "raw", "BGRX", 0, 1)
    win32gui.DeleteObject(bmp.GetHandle())
    save_dc.DeleteDC()
    mfc_dc.DeleteDC()
    win32gui.ReleaseDC(hwnd, hwnd_dc)
    im.save(os.path.join(SALIDA, nombre))
    print("captura", nombre, ok, w, h)


def captura(titulo, nombre):
    hwnd = win32gui.FindWindow(None, titulo)
    if not hwnd:
        print("sin ventana", titulo)
        return
    captura_hwnd(hwnd, nombre)


def hwnd_de(ventana):
    h = int(ventana.winfo_id())
    return win32gui.GetParent(h) or h


def tecla(t, etiqueta):
    for k in t.teclas:
        if k["etiqueta"] == etiqueta:
            return k
    raise KeyError(etiqueta)


def programar(app):
    t = app.teclado
    pasos = []

    def paso(ms, fn):
        pasos.append((ms, fn))

    paso(300, lambda: app.root_function_callback("change_page", {"target": "page_escribir"}))
    paso(600, lambda: captura("Winclus 0.1.0", "cap_escribir_pagina.png"))
    paso(700, lambda: app.pages["page_escribir"].alternar())
    paso(1200, lambda: captura_hwnd(hwnd_de(t.ventana), "cap_teclado_abc.png"))
    paso(1300, lambda: t._pulsar(tecla(t, "Mayús")))
    paso(1400, lambda: t._pulsar(tecla(t, "H")))
    paso(1500, lambda: t._pulsar(tecla(t, "o")))
    paso(1900, lambda: captura_hwnd(hwnd_de(t.ventana), "cap_teclado_sugerencias.png"))
    paso(2000, lambda: print("sugerencias:", t.sugerencias, "palabra:", t.palabra))
    paso(2100, lambda: t._pulsar(t.teclas[0]))     # primera sugerencia
    paso(2200, lambda: print("tras completar:", t.palabra, registro[-1][:6]))
    paso(2300, lambda: t._pulsar(tecla(t, "123")))
    paso(2700, lambda: captura_hwnd(hwnd_de(t.ventana), "cap_teclado_123.png"))
    paso(2800, lambda: t._pulsar(tecla(t, "áé")))
    paso(3200, lambda: captura_hwnd(hwnd_de(t.ventana), "cap_teclado_acentos.png"))
    paso(3300, lambda: t._pulsar(tecla(t, "Más")))
    paso(3400, lambda: t._pulsar(tecla(t, "Ctrl")))
    paso(3800, lambda: captura_hwnd(hwnd_de(t.ventana), "cap_teclado_mas.png"))
    paso(3900, lambda: t._pulsar(tecla(t, "Copiar")))
    paso(4000, lambda: print("copiar:", registro[-1]))
    paso(4100, lambda: captura("Winclus 0.1.0", "cap_escribir_pagina_visible.png"))
    paso(4200, lambda: print("registro total:", len(registro), "eventos"))
    paso(4300, lambda: app.close_all())

    def envolver(fn):
        def f():
            try:
                fn()
            except Exception:
                traceback.print_exc()
        return f

    for ms, fn in pasos:
        app.tk_root.after(ms, envolver(fn))


if __name__ == "__main__":
    tk_root = customtkinter.CTk()
    TaskKiller().start()
    app = run_app.MainApp(tk_root)
    app.tk_root.after(1500, lambda: programar(app))
    app.tk_root.mainloop()
