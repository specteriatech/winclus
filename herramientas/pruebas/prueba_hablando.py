"""La prueba hablando: Winclus te va pidiendo órdenes y apunta si te entiende.

Winclus dice en voz alta «Di: baja», espera a oírte, y así con cada orden de
la lista. No ejecuta nada: solo apunta qué oyó y en qué acción se habría
convertido. Al final dice y escribe cuántas acertó.

Uso (desde la raíz, con el casco o los altavoces puestos):

    .venv\\Scripts\\python.exe -u herramientas\\pruebas\\prueba_hablando.py

Opciones: --espera 12 (segundos por orden), --intentos 2, --dictado (prueba
el dictado de texto libre, que necesita «Reconocimiento de voz en línea»).
"""
import argparse
import logging
import os
import queue
import sys
import time

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

import customtkinter  # noqa: E402

from src.config_manager import ConfigManager  # noqa: E402
from src.escucha import Escucha  # noqa: E402
from src.microfono import Microfono, diagnostico  # noqa: E402
from src.ordenes_voz import frases_gramatica, interpretar  # noqa: E402
from src.voz import Voz  # noqa: E402

# Qué se pide decir y qué acción tendría que salir.
GUION = [
    ("baja", "rueda"),
    ("clic", "clic"),
    ("doble clic", "doble_clic"),
    ("pulsa Aceptar", "clic_control"),
    ("abre el bloc de notas", "abrir"),
    ("lee la pantalla", "leer_pantalla"),
    ("teclado", "teclado"),
    ("qué puedo decir", "ayuda"),
]

parser = argparse.ArgumentParser(description="Prueba hablando de las órdenes por voz.")
parser.add_argument("--espera", type=float, default=12.0, help="segundos de turno por orden")
parser.add_argument("--intentos", type=int, default=2, help="veces que se pide cada orden")
parser.add_argument("--dictado", action="store_true", help="probar el dictado de texto libre")
args = parser.parse_args()

logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
root = customtkinter.CTk()
root.withdraw()
ConfigManager().start()

oidas = queue.Queue()
voz = Voz()


def decir_y_esperar(texto, maximo=12.0):
    """Dice algo y no sigue hasta que termina de sonar (si no, se pisan)."""
    voz.decir(texto, forzar=True)
    fin = time.time() + maximo
    time.sleep(0.4)
    while voz.hablando and time.time() < fin:
        root.update()
        time.sleep(0.05)
    time.sleep(0.3)


mic = Microfono()
pico_max = 0.0


def esperar_frase(segundos):
    """Espera una frase y, de paso, mide cuánto sonó el micrófono."""
    global pico_max
    fin = time.time() + segundos
    while time.time() < fin:
        pico_max = max(pico_max, mic.pico())
        try:
            return oidas.get_nowait()
        except queue.Empty:
            root.update()
            time.sleep(0.05)
    return None


modo = "dictado" if args.dictado else "ordenes"
escucha = Escucha()
print(escucha.texto_estado())
avisos = []
if not escucha.empezar(lambda f: oidas.put(f), lambda t, err=False: avisos.append((t, err)),
                       modo, frases_gramatica(["Aceptar", "Cancelar", "Guardar"])):
    for t, err in avisos:
        print("ERROR:", t)
    sys.exit(1)
time.sleep(1.2)

decir_y_esperar("Vamos a probar las órdenes por voz. Te diré qué decir y esperaré a oírte. "
                "Habla claro y sin prisa.")

resultados = []
for frase, esperado in GUION:
    acertada, oido, accion = False, None, None
    for intento in range(1, args.intentos + 1):
        decir_y_esperar(("Di: " if intento == 1 else "Otra vez: ") + frase)
        while not oidas.empty():                 # tirar lo que se oyó mientras hablaba
            oidas.get_nowait()
        print(f"  -> turno para «{frase}» (intento {intento})", flush=True)
        oido = esperar_frase(args.espera)
        if oido is None:
            continue
        accion = interpretar(oido, dictando=args.dictado)["tipo"]
        acertada = accion == esperado
        print(f"     oído: «{oido}» -> {accion}" + ("  OK" if acertada else f"  (se esperaba {esperado})"),
              flush=True)
        if acertada:
            decir_y_esperar("Bien.")
            break
    if not acertada and oido is None:
        print("     no se oyó nada", flush=True)
    resultados.append((frase, esperado, oido, accion, acertada))

escucha.parar()
time.sleep(0.5)

bien = sum(1 for r in resultados if r[4])
print()
print(f"{'lo que se pidió':<26}{'lo que se oyó':<30}{'acción':<16}")
for frase, esperado, oido, accion, ok in resultados:
    print(f"{frase:<26}{(oido or '(nada)'):<30}{(accion or '-'):<16}{'OK' if ok else 'FALLA'}")
print()
print(f"ACERTADAS: {bien} de {len(GUION)}")
print(f"pico máximo del micrófono «{mic.nombre()}»: {pico_max:.3f}"
      + (" (silenciado)" if mic.silenciado() else f", volumen {mic.volumen():.0%}"))
if bien == 0:
    # Que no se quede en «no funciona»: decir qué pasa con el micrófono.
    porque = diagnostico(pico_max, mic.silenciado(), mic.volumen(), False, mic.nombre())
    print("POR QUÉ:", porque)
    decir_y_esperar(porque)
else:
    decir_y_esperar(f"Entendí {bien} de {len(GUION)} órdenes.")
sys.exit(0 if bien == len(GUION) else 1)
