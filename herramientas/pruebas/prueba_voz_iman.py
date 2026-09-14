"""Voz, frases e imán sin cámara.

1. Voz: lista las voces, elige una en español por defecto, dice una frase corta
   (suena de verdad) y respeta «voz_activa».
2. Frases: valores por defecto, guardar/cargar en un archivo temporal, límite y limpieza.
3. Teclado: la capa «frases» se construye con las frases y abc lleva «Decir» y «Frases».
4. Imán: con una ventanita WinForms (PowerShell, siempre encima) con un botón «Probar»
   en una posición conocida, buscar cerca del botón lo encuentra y lejos no.
"""
import os
import subprocess
import sys
import time
from pathlib import Path

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

import customtkinter  # noqa: E402

from src import frases as frases_mod  # noqa: E402
from src import voz as voz_mod  # noqa: E402
from src.config_manager import ConfigManager  # noqa: E402
from src.gui import teclado_pantalla  # noqa: E402
from src.iman import Iman  # noqa: E402

fallos = 0


def comprobar(cond, texto):
    global fallos
    print(("  OK   " if cond else "  FALLO") + " " + texto)
    if not cond:
        fallos += 1


root = customtkinter.CTk()
root.withdraw()
cm = ConfigManager()
cm.start()

print("1. Voz")
v = voz_mod.Voz()
voces = v.voces()
comprobar(len(voces) >= 1, f"voces instaladas: {voces}")
comprobar("spanish" in v.voz_por_defecto().lower() or "es" in v.voz_por_defecto().lower(),
          f"por defecto una en español: {v.voz_por_defecto()}")
comprobar(v.decir("Prueba de voz de Winclus"), "decir encola una frase")
time.sleep(2.5)
comprobar(not v.hablando, "terminó de hablar")
cm.config["voz_activa"] = False
comprobar(not v.decir("No debería sonar"), "con la voz desactivada no dice nada")
comprobar(v.decir("Forzado", forzar=True), "pero Probar la fuerza")
cm.config["voz_activa"] = True
time.sleep(1.2)
v.callar()

print("2. Frases")
tmp = Path(os.environ.get("TEMP", "."), "winclus_prueba_frases.json")
if tmp.exists():
    tmp.unlink()
comprobar(frases_mod.cargar(tmp) == frases_mod.POR_DEFECTO, "sin archivo: las de ejemplo")
guardadas = frases_mod.guardar(["  Hola  ", "", "Hola", "Tengo   sed", "x"] + [f"f{i}" for i in range(20)], tmp)
comprobar(guardadas[:3] == ["Hola", "Tengo sed", "x"] and len(guardadas) == frases_mod.MAX_FRASES,
          f"limpia duplicados y espacios y corta a {frases_mod.MAX_FRASES}: {guardadas[:4]}…")
comprobar(frases_mod.cargar(tmp) == guardadas, "lo guardado se vuelve a leer igual")
tmp.unlink()

print("3. Teclado")
frases_mod.cargar = lambda ruta=None: ["Sí", "No", "Tengo sed", "Necesito ayuda", "Gracias"]
filas = teclado_pantalla.TecladoPantalla._filas_capa("frases")
comprobar(len(filas) == 3 and len(filas[0]) == 4 and filas[0][0][1] == "frase" and filas[1][0][0] == "Gracias",
          "capa frases: 4 por fila más la fila de abajo")
comprobar([t[0] for t in filas[-1]] == ["abc", "Callar", "Decir", "Ocultar"], "fila de abajo: abc, Callar, Decir, Ocultar")
abajo = teclado_pantalla.CAPAS["abc"][-1]
etiquetas = [t[0] if isinstance(t, tuple) else t for t in abajo]
comprobar("Decir" in etiquetas and "Frases" in etiquetas, f"abc lleva Decir y Frases: {etiquetas}")

print("4. Imán")
ps = ("Add-Type -AssemblyName System.Windows.Forms; "
      "$f = New-Object Windows.Forms.Form; $f.Text='Prueba Winclus'; $f.StartPosition='Manual'; "
      "$f.Location = New-Object Drawing.Point(200,200); $f.Size = New-Object Drawing.Size(400,300); "
      "$f.TopMost = $true; $b = New-Object Windows.Forms.Button; $b.Text='Probar'; "
      "$b.Location = New-Object Drawing.Point(150,100); $b.Size = New-Object Drawing.Size(120,44); "
      "$f.Controls.Add($b); [void]$f.ShowDialog()")
proc = subprocess.Popen(["powershell", "-NoProfile", "-Command", ps])
time.sleep(2.5)
iman = Iman()
try:
    iman._preparar()
    comprobar(iman.uia is not None, "UI Automation preparado")
    # El botón queda alrededor de (200+8+150+60, 200+31+100+22) ≈ (418, 353); se busca 60 px más abajo
    centro = None
    for _ in range(3):
        objetivo = iman.buscar((418, 420), 90)
        if objetivo:
            break
        time.sleep(0.5)
    comprobar(objetivo is not None and objetivo[2] == "Probar" and objetivo[3] == "botón",
              f"cerca del botón lo encuentra: {objetivo}")
    if objetivo:
        centro = objetivo[:2]
        comprobar(abs(centro[0] - 418) < 30 and abs(centro[1] - 353) < 30, f"y devuelve su centro {centro}")
        comprobar(iman.buscar(centro, 90) is None, "encima del botón no hace falta mover")
    t0 = time.perf_counter()
    for _ in range(5):
        iman.buscar((418, 420), 90)
    ms = (time.perf_counter() - t0) / 5 * 1000
    comprobar(ms < 250, f"una búsqueda tarda {ms:.0f} ms")
    lejos = iman.buscar((418, 520), 60)
    comprobar(lejos is None, f"a más distancia que el radio no lo encuentra: {lejos}")
finally:
    proc.kill()

root.destroy()
print(f"\n{'Todo bien' if fallos == 0 else str(fallos) + ' fallos'}")
sys.exit(1 if fallos else 0)
