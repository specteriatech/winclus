"""Menú de clics sin cámara: geometría del anillo (qué sector hay bajo cada
punto) y el flujo de ControladorClic con el menú abierto, con pydirectinput y
pyautogui sustituidos por registros (no se hace ningún clic real).
"""
import os
import sys

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

import customtkinter  # noqa: E402

from src.gui import menu_clics  # noqa: E402
from src.controllers import clics  # noqa: E402

fallos = 0


def comprobar(cond, texto):
    global fallos
    print(("  OK   " if cond else "  FALLO") + " " + texto)
    if not cond:
        fallos += 1


root = customtkinter.CTk()
root.withdraw()
menu = menu_clics.MenuClics(root)
opciones = [("derecho", "Clic derecho"), ("doble", "Doble clic"), ("arrastrar", "Arrastrar"),
            ("teclado", "Teclado"), ("asistente", "Asistente"), ("rueda_abajo", "Rueda abajo"),
            ("pausar", "Pausar"), ("rueda_arriba", "Rueda arriba")]

print("1. Geometría del anillo")
menu.mostrar(960, 540, opciones)
root.update()
cx, cy = menu.centro
comprobar((cx, cy) == (960, 540), "centrado donde se pidió")
R = (menu_clics.RADIO_EXTERIOR + menu_clics.RADIO_INTERIOR) // 2
comprobar(menu.opcion_en(cx, cy) == "cerrar", "centro: cerrar")
comprobar(menu.opcion_en(cx, cy - R) == "derecho", "arriba: clic derecho")
comprobar(menu.opcion_en(cx + R, cy) == "arrastrar", "derecha: arrastrar")
comprobar(menu.opcion_en(cx, cy + R) == "asistente", "abajo: asistente")
comprobar(menu.opcion_en(cx - R, cy) == "pausar", "izquierda: pausar")
comprobar(menu.opcion_en(cx + R * 0.7, cy - R * 0.7) == "doble", "arriba-derecha: doble clic")
comprobar(menu.opcion_en(cx - R * 0.7, cy - R * 0.7) == "rueda_arriba", "arriba-izquierda: rueda arriba")
comprobar(menu.opcion_en(cx - R * 0.7, cy + R * 0.7) == "rueda_abajo", "abajo-izquierda: rueda abajo")
comprobar(menu.opcion_en(cx + 400, cy) is None, "fuera del anillo: nada")
comprobar(menu.contiene(cx + 100, cy) and not menu.contiene(cx + 300, cy), "contiene")

print("1b. Resaltado según la posición del cursor (simulada)")
cursor = {"p": (cx, cy - R)}
menu_clics.win32api.GetCursorPos = lambda: cursor["p"]
from src import estilo
menu._hover()
comprobar(menu.hover is not None and menu.hover != "centro" and menu.hover["clave"] == "derecho",
          "cursor arriba: se resalta Clic derecho")
comprobar(menu.lienzo.itemcget(menu.hover["arco"], "fill") == estilo.color_actual(estilo.PRIMARIO),
          "el sector resaltado se pinta con el color principal")
sector_derecho = menu.hover
cursor["p"] = (cx, cy)
menu._hover()
comprobar(menu.hover == "centro", "cursor en el centro: se resalta el centro")
comprobar(menu.lienzo.itemcget(sector_derecho["arco"], "fill") == estilo.color_actual(estilo.TARJETA),
          "el sector anterior vuelve a su color")
cursor["p"] = (cx + 600, cy)
menu._hover()
comprobar(menu.hover is None, "cursor fuera: nada resaltado")
menu.abierto_desde -= menu_clics.TIEMPO_MAX_S + 1
menu._bucle()
comprobar(not menu.visible, "sin elegir nada, se cierra solo pasado el tiempo")

menu.ocultar()
menu.mostrar(10, 10, opciones)
root.update()
comprobar(menu.centro[0] >= menu.lado // 2 and menu.centro[1] >= menu.lado // 2,
          f"cerca del borde se recoloca dentro del monitor {menu.centro}")
menu.ocultar()

print("2. Flujo del controlador con el menú abierto")
registro = []


class Falso:
    PAUSE = 0
    FAILSAFE = False
    pos = [960, 540]

    @staticmethod
    def click(button="left", clicks=1, interval=0.0):
        registro.append(("click", button, clicks))

    @staticmethod
    def mouseDown(button="left"):
        registro.append(("down", button))

    @staticmethod
    def mouseUp(button="left"):
        registro.append(("up", button))

    @staticmethod
    def position():
        return tuple(Falso.pos)

    @staticmethod
    def moveTo(x, y):
        registro.append(("moveTo", x, y))
        Falso.pos = [x, y]

    @staticmethod
    def scroll(n):
        registro.append(("scroll", n))


clics.pydirectinput = Falso
clics.pyautogui = Falso


class CfgFalsa:
    config = {"modo_clic": "parpadeo", "modo_puntero": "cabeza", "ojos_modo": "directo",
              "ojos_calibracion": None, "calib_invisible": False}


clics.ConfigManager = lambda: CfgFalsa


class MCFalso:
    def congelar(self, s):
        registro.append(("congelar", s))


clics.MouseController = lambda: MCFalso()
ctrl = clics.ControladorClic()
ctrl.menu_gui = menu
ctrl.teclado_gui = None
teclado = []
ctrl.alternar_teclado = lambda: teclado.append(1)
pausas = []
ctrl.pausar = lambda: pausas.append(1)

ctrl.abrir_menu()
root.update()
comprobar(menu.visible and ctrl.menu_ancla == (960, 540), "abrir_menu abre el anillo en el puntero")
comprobar([c for c, _ in ctrl.opciones_menu()][6] == "pausar", "sin calibración, el sector izquierdo es Pausar")

# Clic derecho: el puntero en el sector de arriba
Falso.pos = [960, 540 - R]
registro.clear()
ctrl.clic()
comprobar(not menu.visible, "elegir cierra el menú")
comprobar(("moveTo", 960, 540) in registro and ("click", "right", 1) in registro,
          f"clic derecho en el ancla: {registro}")

# Arrastrar y soltar
Falso.pos = [960, 540]; ctrl.abrir_menu(); root.update()
Falso.pos = [960 + R, 540]
registro.clear()
ctrl.clic()
comprobar(ctrl.arrastrando and ("down", "left") in registro, "arrastrar sujeta el botón")
Falso.pos = [1200, 700]
registro.clear()
ctrl.clic()
comprobar(not ctrl.arrastrando and registro == [("up", "left")], f"el siguiente clic suelta: {registro}")

# Rueda: el menú se queda abierto
Falso.pos = [960, 540]; ctrl.abrir_menu(); root.update()
Falso.pos = [960 - R * 0.7, 540 + R * 0.7]
registro.clear()
ctrl.clic()
root.update()
comprobar(menu.visible and ("scroll", -5) in registro, f"rueda abajo desplaza y deja el menú abierto: {registro}")

# Centro: cerrar sin hacer nada
Falso.pos = [960, 540]
registro.clear()
ctrl.clic()
comprobar(not menu.visible and registro == [], "centro: cierra sin clic")

# Teclado
Falso.pos = [960, 540]; ctrl.abrir_menu(); root.update()
Falso.pos = [960 + R * 0.7, 540 + R * 0.7]
ctrl.clic()
comprobar(teclado == [1] and not menu.visible, "teclado: alterna el teclado en pantalla")

# Clic fuera del anillo: cierra sin clic
Falso.pos = [960, 540]; ctrl.abrir_menu(); root.update()
Falso.pos = [100, 100]
registro.clear()
ctrl.clic()
comprobar(not menu.visible and registro == [], "clic fuera del anillo: solo cierra")

menu.destruir()
root.destroy()
print(f"\n{'Todo bien' if fallos == 0 else str(fallos) + ' fallos'}")
sys.exit(1 if fallos else 0)
