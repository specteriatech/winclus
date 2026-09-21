"""Barrido con un pulsador en la aplicación de Windows (src/barrido.py), sin tocar el ratón real.

Se abre una ventana nativa de Windows Forms en otro proceso (ventana_barrido.ps1: dos botones, una casilla y un
campo, con nombres accesibles como los de cualquier programa). El barrido la recorre por UI Automation
(ventana_fija, para no depender de qué ventana está delante) y se comprueba:
1. Encuentra los cuatro controles con su nombre, en orden de lectura (y también los de la barra de título).
2. El marco pasa de uno a otro con el tiempo configurado.
3. La señal pulsa el marcado: «Guardar» y no «Salir»; la casilla se marca; el campo recibe el foco.
4. Nada de eso mueve el puntero del ratón (pulsa por UI Automation, no con clics).
5. Al desactivar, deja de marcar.
"""
import os
import subprocess
import sys
import tempfile
import time

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)
sys.stdout.reconfigure(encoding="utf-8")

import pyautogui  # noqa: E402
import win32gui  # noqa: E402

import logging  # noqa: E402
logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(name)s %(message)s")
from src.barrido import Barrido  # noqa: E402

fallos = 0


def comprobar(cond, texto):
    global fallos
    print(("  OK   " if cond else "  FALLO") + " " + texto)
    if not cond:
        fallos += 1


registro = os.path.join(tempfile.gettempdir(), "winclus-barrido-%d.txt" % os.getpid())
if os.path.exists(registro):
    os.remove(registro)
proceso = subprocess.Popen(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
                            os.path.join(RAIZ, "herramientas", "pruebas", "ventana_barrido.ps1"), registro])


def anotado():
    try:
        with open(registro, encoding="utf-8-sig") as f:
            return [l.strip() for l in f if l.strip()]
    except OSError:
        return []


hwnd = 0
fin = time.time() + 20
while time.time() < fin and not hwnd:
    hwnd = win32gui.FindWindow(None, "Prueba del barrido Winclus")
    time.sleep(0.2)
comprobar(bool(hwnd), "se abre la ventana nativa de prueba")
time.sleep(0.8)

b = Barrido()
b.ventana_fija = hwnd
b.decir = None


def esperar_a(prueba, maximo=8.0):
    fin = time.time() + maximo
    while time.time() < fin:
        c = b.actual()
        if c is not None and prueba(c):
            return True
        time.sleep(0.02)
    return False


raton_antes = pyautogui.position()
try:
    b.activar()
    b.ms = 300
    time.sleep(1.0)
    nombres = [c.nombre for c in b.lista]
    print("   controles:", [(c.nombre, c.tipo) for c in b.lista])
    i = {n: nombres.index(n) for n in ("Guardar", "Salir", "Recordarme", "Tu nombre") if n in nombres}
    comprobar(len(i) == 4 and i["Guardar"] < i["Salir"] < i["Recordarme"] < i["Tu nombre"],
              "encuentra los cuatro controles con su nombre, en orden de lectura")

    vistos = set()
    fin = time.time() + 0.3 * len(b.lista) + 1
    while time.time() < fin:
        c = b.actual()
        if c is not None:
            vistos.add(c.nombre)
        time.sleep(0.02)
    comprobar({"Guardar", "Salir", "Recordarme", "Tu nombre"} <= vistos, "el marco pasa por cada control con el tiempo configurado")
    comprobar(b.rect_actual() is not None, "el marco sabe dónde dibujarse (rect_actual)")

    comprobar(esperar_a(lambda c: c.nombre == "Guardar"), "el marco llega a «Guardar»")
    b.senal()
    time.sleep(0.8)
    a = anotado()
    comprobar("guardar" in a and "salir" not in a, f"la señal pulsa «Guardar» y solo «Guardar» ({a}; {b.ultimo and b.ultimo[1]})")

    comprobar(esperar_a(lambda c: c.nombre == "Recordarme"), "el marco llega a la casilla «Recordarme»")
    b.senal()
    time.sleep(0.8)
    comprobar("marcada=True" in anotado(), f"la señal marca la casilla ({b.ultimo and b.ultimo[1]})")

    comprobar(esperar_a(lambda c: c.nombre == "Tu nombre"), "el marco llega al campo «Tu nombre»")
    b.senal()
    time.sleep(0.8)
    comprobar("foco" in anotado(), f"la señal sobre el campo le da el foco para escribir ({b.ultimo and b.ultimo[1]})")

    raton_despues = pyautogui.position()
    comprobar(raton_antes == raton_despues, f"nada de esto ha movido el ratón real ({tuple(raton_antes)} -> {tuple(raton_despues)})")

    b.desactivar()
    time.sleep(0.5)
    comprobar(b.rect_actual() is None and not b.activo, "al desactivar, deja de marcar")
finally:
    b.desactivar()
    proceso.terminate()
    try:
        os.remove(registro)
    except OSError:
        pass

print()
print("todo bien" if not fallos else f"{fallos} comprobación(es) MAL")
sys.exit(1 if fallos else 0)
