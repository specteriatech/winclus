"""Muestra el anillo en una esquina, lo captura y comprueba que el ratón lo atraviesa."""
import os
import sys

sys.path.insert(0, r"C:\Users\RYZEN\Documents\puntero libre")
os.chdir(r"C:\Users\RYZEN\Documents\puntero libre")
SALIDA = os.path.dirname(os.path.abspath(__file__))

import customtkinter
import pyautogui
import win32gui

from src import estilo
from src.gui.anillo import Anillo

root = customtkinter.CTk()
root.withdraw()
anillo = Anillo(root)
X, Y = 1500, 300   # zona de la pantalla, lejos de la ventana del usuario si es posible


def paso1():
    anillo.actualizar((X, Y, 0.65))
    root.after(400, paso2)


def paso2():
    im = pyautogui.screenshot(region=(X - 40, Y - 40, 80, 80))
    im = im.resize((240, 240))
    im.save(os.path.join(SALIDA, "anillo.png"))
    hwnd_anillo = win32gui.GetParent(int(anillo.ventana.winfo_id())) or int(anillo.ventana.winfo_id())
    bajo = win32gui.WindowFromPoint((X, Y))
    print("anillo hwnd", hwnd_anillo, "ventana bajo el puntero", bajo,
          "titulo:", win32gui.GetWindowText(bajo))
    print("ATRAVIESA" if bajo != hwnd_anillo and win32gui.GetWindowText(bajo) != "Winclus anillo" else "BLOQUEA")
    anillo.actualizar(None)
    root.after(200, root.destroy)


root.after(300, paso1)
root.mainloop()
