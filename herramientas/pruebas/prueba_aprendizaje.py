"""Calibración invisible sin cámara: rasgos sintéticos y datos reales guardados.

1. Calibrar de cero solo con clics repartidos por la pantalla.
2. Mejorar un modelo desviado (la cabeza se movió) con clics nuevos.
3. Elegir bien la ventana de rasgos antes del clic (parpadeo / ojos abiertos).
4. Con los datos reales de configs/<perfil>/calibracion_datos.json: usar
   muestras del seguimiento como si fueran clics y medir en los puntos de
   comprobación.
"""
import json
import os
import sys
import time

import numpy as np

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

from src.detectors import aprendizaje, calibracion  # noqa: E402
from src.detectors.mirada import NOMBRES_RASGOS  # noqa: E402

MONITOR = [0, 0, 1920, 1080]
rng = np.random.default_rng(7)


def rasgos_de(x, y, ruido=0.006, desplazamiento=(0.0, 0.0), cabeza=None):
    """Rasgos sintéticos coherentes con NOMBRES_RASGOS para un punto mirado.
    cabeza: (guiñada, cabeceo, balanceo, x, y, z); girar la cabeza desplaza
    el iris respecto a las esquinas del ojo aunque se mire al mismo sitio."""
    u = (x - 960) / 1920 + desplazamiento[0]
    v = (y - 540) / 1080 + desplazamiento[1]
    if cabeza is not None:
        u -= 0.012 * cabeza[0] + 0.004 * cabeza[3]
        v -= 0.010 * cabeza[1] + 0.004 * cabeza[4]
    n = lambda: rng.normal(0, ruido)
    gxd, gyd = 0.5 * u + n(), 0.3 * v + n()
    gxi, gyi = 0.48 * u + n(), 0.31 * v + n()
    gx, gy = (gxd + gxi) / 2, (gyd + gyi) / 2
    return [gxd, gyd, 0.35 * v + n(), gxi, gyi, 0.34 * v + n(),
            0.8 * u + n(), 0.6 * v + n(), gx * gx, gy * gy, gx * gy,
            0.30 - 0.08 * v + n(), 0.31 - 0.08 * v + n(), gx ** 3, gy ** 3]


def clics(n, desplazamiento=(0.0, 0.0), margen=60, cabeza_sd=4.0):
    """Clics repartidos por la pantalla. cabeza_sd: cuánto se mueve la cabeza
    entre clic y clic (grados y cm), como al llevar el puntero con ella."""
    out = []
    for _ in range(n):
        x = float(rng.uniform(margen, 1920 - margen))
        y = float(rng.uniform(margen, 1080 - margen))
        cabeza = [float(rng.normal(0, cabeza_sd)) for _ in range(6)]
        out.append({"x": x, "y": y, "cabeza": cabeza, "fuente": "cabeza", "monitor": MONITOR,
                    "rasgos": rasgos_de(x, y, desplazamiento=desplazamiento, cabeza=cabeza)})
    return out


def error_en(modelo, muestras):
    return float(np.median([np.hypot(*(np.subtract(
        calibracion.predecir(modelo, m["rasgos"], cabeza=m.get("cabeza")), (m["x"], m["y"]))))
        for m in muestras]))


fallos = 0


def comprobar(cond, texto):
    global fallos
    print(("  OK   " if cond else "  FALLO") + " " + texto)
    if not cond:
        fallos += 1


# 1. Calibrar de cero ----------------------------------------------------------
print("1. Calibrar de cero con 40 clics")
r = aprendizaje.ajustar_con_clics(clics(40), None, None, MONITOR, [])
print("   ", r["mensaje"])
comprobar(r["ok"] and r["modelo"] is not None, "se obtiene un modelo")
prueba = clics(50)
err = error_en(r["modelo"], prueba) if r["modelo"] else 9999
print(f"    error en 50 puntos nuevos: {err:.0f} px")
comprobar(err < 60, "error por debajo de 60 px")
comprobar(r["modelo"]["aprendido"]["origen"] == "clics", "origen «clics»")

print("1b. Con pocos clics o poca extensión no se calibra")
r2 = aprendizaje.ajustar_con_clics(clics(20), None, None, MONITOR, [])
comprobar(not r2["ok"], f"20 clics: {r2['mensaje']}")
apretados = [dict(m, x=900 + (m["x"] - 960) * 0.1, y=500 + (m["y"] - 540) * 0.1) for m in clics(40)]
for m in apretados:
    m["rasgos"] = rasgos_de(m["x"], m["y"])
r3 = aprendizaje.ajustar_con_clics(apretados, None, None, MONITOR, [])
comprobar(not r3["ok"], f"clics en el centro: {r3['mensaje']}")

# 2. Mejorar un modelo desviado ------------------------------------------------
print("2. La persona se recoloca: el modelo viejo se desvía y 40 clics nuevos lo corrigen")
viejos = clics(60, desplazamiento=(0.06, 0.04))
viejo = aprendizaje.ajustar_con_clics(viejos, None, None, MONITOR, [])["modelo"]
nuevos = clics(40)
print(f"    error del modelo viejo en los clics nuevos: {error_en(viejo, nuevos):.0f} px")
r = aprendizaje.ajustar_con_clics(viejos + nuevos, viejo, None, MONITOR, [])
print("   ", r["mensaje"])
comprobar(r["ok"], "se acepta el modelo nuevo")
if r["ok"]:
    comprobar(r["error_despues"] < r["error_antes"], f"error {r['error_antes']} → {r['error_despues']} px")
    comprobar(r["modelo"]["sesgo"] == [0.0, 0.0], "el sesgo se pone a cero")
    e = error_en(r["modelo"], prueba)
    comprobar(e < 80, f"y acierta en puntos nuevos ({e:.0f} px; el viejo daba {error_en(viejo, prueba):.0f})")

print("2a. Con solo 16 clics nuevos se conserva la compensación de cabeza del modelo actual")
r = aprendizaje.ajustar_con_clics(nuevos[:16], viejo, None, MONITOR, [])
print("   ", r["mensaje"])
comprobar(r["ok"] and r["modelo"].get("cabeza_coef") == viejo.get("cabeza_coef"), "cabeza_coef conservado")

print("2b. Un modelo bueno no se sustituye por uno ajustado con clics que no cuadran")
bueno = aprendizaje.ajustar_con_clics(clics(200), None, None, MONITOR, [])["modelo"]
ruidosos = clics(16)
for m in ruidosos:   # la persona hacía clic sin mirar ahí
    m["x"] += float(rng.normal(0, 250))
    m["y"] += float(rng.normal(0, 250))
r = aprendizaje.ajustar_con_clics(ruidosos, bueno, None, MONITOR, [])
print("   ", r["mensaje"])
comprobar(not r["ok"], "se rechaza")

print("2c. Sin mover la cabeza también funciona (no hay compensación que aprender)")
r = aprendizaje.ajustar_con_clics(clics(40, cabeza_sd=0.2), None, None, MONITOR, [])
print("   ", r["mensaje"])
comprobar(r["ok"] and error_en(r["modelo"], clics(50, cabeza_sd=0.2)) < 60, "error < 60 px sin cabeza")

# 3. Ventana de rasgos antes del clic -----------------------------------------
print("3. Rasgos de justo antes del clic")
a = aprendizaje.AprendizajeClics()
a.historial.clear()
t = time.time()
fijo = rasgos_de(300, 300, ruido=0.0)
for dt in np.arange(1.2, 0.34, -0.033):          # fijación en (300, 300)
    a.historial.append((t - dt, tuple(fijo), (0,) * 6))
for i, dt in enumerate(np.arange(0.33, 0.0, -0.033)):   # la mirada se va moviendo
    a.historial.append((t - dt, tuple(rasgos_de(300 + i * 150, 300, ruido=0.0)), (0,) * 6))
rasgos, cabeza = a._rasgos_antes(t, aprendizaje.VENTANA_PARPADEO)
comprobar(rasgos is not None and abs(rasgos[0] - fijo[0]) < 1e-6, "ventana de parpadeo: rasgos de la fijación")
rasgos2, _ = a._rasgos_antes(t, aprendizaje.VENTANA_ABIERTOS)
comprobar(rasgos2 is None, "ventana de ojos abiertos: se descarta porque la mirada se movía")
a.historial.clear()
comprobar(a._rasgos_antes(t, aprendizaje.VENTANA_PARPADEO)[0] is None, "sin historial no hay rasgos")

# 4. Datos reales --------------------------------------------------------------
print("4. Datos reales del perfil")
perfil = json.load(open("configs/default.json"))["default"]
ruta = os.path.join("configs", perfil, "calibracion_datos.json")
if os.path.isfile(ruta):
    datos = json.load(open(ruta, encoding="utf-8"))
    if datos.get("rasgos_fijos") and len(datos["rasgos_fijos"][0]) == len(NOMBRES_RASGOS):
        seg = list(zip(datos["seguimiento_puntos"], datos["seguimiento_rasgos"]))
        idx = rng.choice(len(seg), size=min(80, len(seg)), replace=False)
        reales = [{"x": seg[i][0][0], "y": seg[i][0][1], "rasgos": seg[i][1], "cabeza": None,
                   "fuente": "cabeza", "monitor": list(datos["monitor"])} for i in idx]
        comp = [{"x": c["x"], "y": c["y"], "rasgos": c["rasgos"]} for c in datos["comprobacion"]]
        actual = json.load(open(os.path.join("configs", perfil, "cursor.json"), encoding="utf-8")).get("ojos_calibracion")
        r = aprendizaje.ajustar_con_clics(reales, None, None, datos["monitor"], [])
        print("    solo con muestras del seguimiento como clics:", r["mensaje"])
        if r["modelo"]:
            print(f"    error en los {len(comp)} puntos de comprobación reales: {error_en(r['modelo'], comp):.0f} px "
                  f"(la calibración guardada da {error_en(actual, comp):.0f} px sin compensar la cabeza). "
                  "Las muestras de seguimiento persiguen un punto móvil: son peores que un clic.")
        r = aprendizaje.ajustar_con_clics(reales, actual, datos, datos["monitor"], actual.get("inactivos") or [])
        print("    con el modelo actual y los datos base:", r["mensaje"])
    else:
        print("    datos de otra versión: se omite")
else:
    print("    no hay calibracion_datos.json: se omite")

print(f"\n{'Todo bien' if fallos == 0 else str(fallos) + ' fallos'}")
sys.exit(1 if fallos else 0)
