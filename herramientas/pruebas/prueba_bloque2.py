"""Bloque 2 de accesibilidad, sin cámara:
1. Exportar e importar perfiles (.winclus) sin pisar ninguno; se limpian al final.
2. Aviso junto al puntero: aparece, sigue al cursor (simulado) y se oculta a tiempo.
3. Botones − y + de los deslizadores: cambian el valor de uno en uno y avisan.
"""
import os
import sys
import time
import zipfile
from pathlib import Path

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

import customtkinter  # noqa: E402

from src.config_manager import ConfigManager  # noqa: E402
from src.gui import aviso as aviso_mod  # noqa: E402
from src.gui.controles import botones_paso  # noqa: E402

fallos = 0


def comprobar(cond, texto):
    global fallos
    print(("  OK   " if cond else "  FALLO") + " " + texto)
    if not cond:
        fallos += 1


SCRATCH = Path(os.environ.get("TEMP", "."), "winclus_prueba_perfiles")
SCRATCH.mkdir(exist_ok=True)

root = customtkinter.CTk()
root.withdraw()

print("1. Exportar e importar perfiles")
cm = ConfigManager()
cm.start()
perfil = cm.curr_profile_name.get()
destino = SCRATCH / f"{perfil}.winclus"
cm.export_profile(perfil, destino)
with zipfile.ZipFile(destino) as z:
    nombres = z.namelist()
comprobar(destino.is_file() and {"cursor.json", "mouse_bindings.json", "keyboard_bindings.json"} <= set(nombres),
          f"exportado con {len(nombres)} archivos: {nombres}")
creados = []
try:
    n1 = cm.import_profile(destino, nombre="Prueba importada")
    creados.append(n1)
    carpeta = Path("configs", n1)
    comprobar(n1 == "Prueba importada" and carpeta.is_dir() and (carpeta / "cursor.json").is_file(),
              f"importado como «{n1}»")
    n2 = cm.import_profile(destino, nombre="Prueba importada")
    creados.append(n2)
    comprobar(n2 == "Prueba importada 2", f"el segundo no pisa al primero: «{n2}»")
    comprobar(n1 in cm.profiles and n2 in cm.profiles, "los dos aparecen en la lista de perfiles")
    comprobar(Path("configs", perfil, "cursor.json").read_bytes() == (carpeta / "cursor.json").read_bytes(),
              "el cursor.json importado es idéntico al original")
    malo = SCRATCH / "malo.winclus"
    with zipfile.ZipFile(malo, "w") as z:
        z.writestr("otra_cosa.json", "{}")
    try:
        cm.import_profile(malo, nombre="Malo")
        comprobar(False, "un zip que no es perfil debería fallar")
    except ValueError as e:
        comprobar(True, f"un zip que no es perfil se rechaza: {e}")
    comprobar(not Path("configs", "Malo").exists(), "y no deja carpeta")
finally:
    for n in creados:
        if n in cm.profiles:
            cm.remove_profile(n)
    comprobar(all(not Path("configs", n).exists() for n in creados), "perfiles de prueba borrados")

print("2. Aviso junto al puntero")
cursor = {"p": (500, 500)}
aviso_mod.win32api.GetCursorPos = lambda: cursor["p"]
a = aviso_mod.AvisoPuntero(root)
a.mostrar("Clic", ms=300)
root.update()
comprobar(a.visible, "se muestra")
geo = a.ventana.geometry()
comprobar(geo.endswith("+522+526"), f"colocado junto al puntero: {geo}")
cursor["p"] = (700, 300)
a.actualizar()
root.update()
comprobar(a.ventana.geometry().endswith("+722+326"), f"sigue al puntero: {a.ventana.geometry()}")
time.sleep(0.35)
a.actualizar()
comprobar(not a.visible, "se oculta pasado el tiempo")
a.mostrar("Arrastrando: clic para soltar", ms=100)
comprobar(int(a.lienzo.cget("width")) > 150, "el ancho crece con el texto")
a.destruir()

print("3. Botones − y +")
marco = customtkinter.CTkFrame(root)
slider = customtkinter.CTkSlider(marco, from_=1, to=100, number_of_steps=99)
slider.set(50)
valores = []
b = botones_paso(marco, slider, valores.append)
b.mover(1)
b.mover(1)
b.mover(-1)
comprobar(valores == [51, 52, 51] and int(slider.get()) == 51, f"de uno en uno: {valores}")
slider.set(100)
b.mover(1)
comprobar(int(slider.get()) == 100 and valores[-1] == 100, "no pasa del máximo")
slider.set(1)
b.mover(-1)
comprobar(int(slider.get()) == 1, "no baja del mínimo")
b5 = botones_paso(marco, slider, valores.append, paso=5)
slider.set(50)
b5.mover(1)
comprobar(int(slider.get()) == 55, "paso de 5")
botones = [w for w in b.winfo_children() if isinstance(w, customtkinter.CTkButton)]
comprobar(len(botones) == 2 and botones[0].cget("text") == "−" and botones[1].cget("text") == "+",
          "dos botones grandes − y +")
root.destroy()

print(f"\n{'Todo bien' if fallos == 0 else str(fallos) + ' fallos'}")
sys.exit(1 if fallos else 0)
