"""Prueba en vivo del micrófono: di órdenes y mira qué entiende Winclus.

Por defecto **no hace nada**: solo escribe en la consola lo que oye y en qué
acción se convertiría, así se puede probar sin miedo. Con `--ejecutar` sí
mueve, pulsa y escribe de verdad.

Uso (desde la raíz, con Winclus cerrado o abierto, da igual):

    .venv\\Scripts\\python.exe -u herramientas\\pruebas\\escuchar_en_vivo.py
    .venv\\Scripts\\python.exe -u herramientas\\pruebas\\escuchar_en_vivo.py --segundos 90
    .venv\\Scripts\\python.exe -u herramientas\\pruebas\\escuchar_en_vivo.py --dictado
    .venv\\Scripts\\python.exe -u herramientas\\pruebas\\escuchar_en_vivo.py --ejecutar

Cosas que decir: «baja», «sube», «clic», «doble clic», «pulsa Aceptar»,
«abre el bloc de notas», «copia», «atrás», «lee la pantalla», «teclado»,
«pausa», «sigue», «¿qué puedo decir?», «deja de escuchar».
"""
import argparse
import logging
import os
import sys
import time

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

import customtkinter  # noqa: E402

from src.config_manager import ConfigManager  # noqa: E402
from src.escucha import Escucha  # noqa: E402
from src.ordenes_voz import frases_gramatica, interpretar  # noqa: E402

parser = argparse.ArgumentParser(description="Escuchar por el micrófono y decir qué se entiende.")
parser.add_argument("--segundos", type=int, default=60, help="cuánto rato escuchar (60 por defecto)")
parser.add_argument("--dictado", action="store_true", help="probar el dictado de texto libre")
parser.add_argument("--ejecutar", action="store_true", help="hacer de verdad lo que se diga")
args = parser.parse_args()

logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
root = customtkinter.CTk()
root.withdraw()
ConfigManager().start()

modo = "dictado" if args.dictado else "ordenes"
oidas = []

if args.ejecutar:
    from src.control_voz import ControlVoz
    control = ControlVoz()
    control.al_oir = lambda frase, resumen: (oidas.append(frase),
                                             print(f"  oído: «{frase}»  ->  {resumen}"))
    control.al_estado = lambda texto, err=False: print(("  ERROR: " if err else "  ") + texto)
    print(control.texto_estado())
    print(f"\nHABLA AHORA ({args.segundos} s). Winclus HARÁ lo que digas.\n")
    control.empezar(modo)
else:
    def oir(frase):
        accion = interpretar(frase, dictando=args.dictado)
        oidas.append(frase)
        extra = accion.get("nombre") or accion.get("texto") or accion.get("consulta") or accion.get("combo") or ""
        print(f"  oído: «{frase}»  ->  {accion['tipo']}" + (f" ({extra})" if extra else ""))

    escucha = Escucha()
    print(escucha.texto_estado())
    print(f"\nHABLA AHORA ({args.segundos} s). Nada se ejecuta: solo se apunta lo que se entiende.\n")
    if not escucha.empezar(oir, lambda t, err=False: print(("  ERROR: " if err else "  ") + t),
                           modo, frases_gramatica()):
        sys.exit(1)

fin = time.time() + args.segundos
while time.time() < fin:
    root.update()
    time.sleep(0.05)

if args.ejecutar:
    from src.control_voz import ControlVoz
    ControlVoz().parar()
else:
    Escucha().parar()
time.sleep(0.6)
print(f"\nFrases oídas: {len(oidas)}")
for f in oidas:
    print("  -", f)
if not oidas:
    print("  (ninguna: mira que el micrófono de Windows sea el que estás usando y que suba de volumen)")
