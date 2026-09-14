"""Modo híbrido sin cámara: la regla de salto (decidir_salto) y una simulación
del bucle con mirada y cabeza sintéticas usando MouseController con pyautogui
sustituido por un registro (no mueve el ratón real).
"""
import os
import sys
import time

import numpy as np

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

from src.controllers import mouse_controller as mc  # noqa: E402

fallos = 0


def comprobar(cond, texto):
    global fallos
    print(("  OK   " if cond else "  FALLO") + " " + texto)
    if not cond:
        fallos += 1


print("1. Regla de salto")
comprobar(mc.decidir_salto((500, 400), None, 150, False, True), "primera fijación: salta")
comprobar(not mc.decidir_salto(None, None, 150, False, True), "sin fijación: no salta")
comprobar(not mc.decidir_salto((500, 400), None, 150, True, True), "mirada deslizándose: no salta")
comprobar(not mc.decidir_salto((900, 400), (500, 400), 150, False, False), "cabeza en marcha: no salta")
comprobar(not mc.decidir_salto((600, 400), (500, 400), 150, False, True), "a 100 px del último salto: no")
comprobar(mc.decidir_salto((700, 400), (500, 400), 150, False, True), "a 200 px del último salto: salta")

print("2. Simulación del bucle híbrido")


class RatonFalso:
    def __init__(self):
        self.pos = [960.0, 540.0]
        self.saltos = []

    def moveTo(self, x, y):
        self.pos = [float(x), float(y)]
        self.saltos.append((x, y))

    def move(self, xOffset=0, yOffset=0):
        self.pos[0] += xOffset
        self.pos[1] += yOffset

    def position(self):
        return int(self.pos[0]), int(self.pos[1])

    def size(self):
        return 1920, 1080


raton = RatonFalso()
mc.pyautogui = raton

# Configuración mínima sin cargar perfiles
class CfgFalsa:
    config = {
        "ojos_calibracion": None, "ojos_fijacion_px": 60, "ojos_persistencia_ms": 150,
        "hibrido_cabeza": 40, "hibrido_salto_px": 150, "hibrido_pausa_ms": 250,
        "ojos_suavizado": 6, "spd_up": 21, "spd_down": 21, "spd_left": 21, "spd_right": 21,
        "mouse_acceleration": False, "pointer_smooth": 8, "tick_interval_ms": 16,
    }


mc.ConfigManager = lambda: CfgFalsa
ctrl = mc.MouseController()
ctrl.buffer = np.zeros([mc.N_BUFFER, 2])
ctrl.calc_smooth_kernel()
ctrl.accel = lambda v: 1.0
ctrl.delay_count = 0
ctrl.reiniciar_mirada()

# La mirada se inyecta saltándose el modelo: _mirada_filtrada devuelve lo que digamos
mirada = {"punto": (400.0, 300.0)}
ctrl._mirada_filtrada = lambda: mirada["punto"]

cabeza = [320.0, 240.0]
ctrl.curr_track_loc = np.array(cabeza, np.float32)
for _ in range(mc.N_BUFFER + 5):        # llenar el búfer con la cabeza quieta
    ctrl.mover_hibrido()
comprobar(len(raton.saltos) == 1 and raton.saltos[0] == (400, 300), "primera fijación: el puntero salta a (400, 300)")

# Afinar con la cabeza: la cabeza se mueve despacio hacia la derecha
time.sleep(0.3)   # pasa la pausa tras el salto
antes = raton.pos[0]
for i in range(40):
    cabeza[0] += 0.5
    ctrl.curr_track_loc = np.array(cabeza, np.float32)
    ctrl.mover_hibrido()
comprobar(raton.pos[0] > antes + 20 and len(raton.saltos) == 1,
          f"la cabeza mueve el puntero fino ({raton.pos[0] - antes:.0f} px) sin saltos")
comprobar(ctrl.afinado_con_cabeza(), "queda registrado que la cabeza afinó (vale para aprender)")

# Mientras la cabeza se mueve, una mirada lejana no provoca salto
mirada["punto"] = (1500.0, 800.0)
for i in range(6):
    cabeza[0] += 0.5
    ctrl.curr_track_loc = np.array(cabeza, np.float32)
    ctrl.mover_hibrido()
comprobar(len(raton.saltos) == 1, "mirada lejana con la cabeza en marcha: no salta")

# Con la cabeza quieta, la mirada fijada lejos sí salta
for i in range(mc.N_BUFFER + 15):
    ctrl.mover_hibrido()
comprobar(len(raton.saltos) == 2 and raton.saltos[-1] == (1500, 800), "cabeza quieta y mirada fijada lejos: salta")
comprobar(not ctrl.afinado_con_cabeza(), "tras el salto se reinicia lo afinado")

# La mirada tiembla cerca (menos de 150 px): no salta
mirada["punto"] = (1580.0, 850.0)
for i in range(20):
    ctrl.mover_hibrido()
comprobar(len(raton.saltos) == 2, "la mirada se mueve 90 px: no salta")

print(f"\n{'Todo bien' if fallos == 0 else str(fallos) + ' fallos'}")
sys.exit(1 if fallos else 0)
