"""Prueba de la regresión de calibración con rasgos sintéticos y ruido."""
import sys

import numpy as np

sys.path.insert(0, r"C:\Users\RYZEN\Documents\puntero libre")
from src.detectors.calibracion import ajustar, predecir, es_valido, estimar_retraso

rng = np.random.default_rng(1)
monitor = (0, 0, 1920, 1080)
xs = [154, 960, 1766]
ys = [86, 540, 994]
puntos = [(960, 540)] + [(x, y) for y in ys for x in xs if (x, y) != (960, 540)]


def rasgos_de(x, y, ruido=0.004):
    # mirada horizontal ±0,12 y vertical ±0,06 (más débil), con sesgo de reposo
    gx = (x - 960) / 960 * 0.12 + 0.02
    gy = (y - 540) / 540 * 0.05 - 0.05
    gy_p = (y - 540) / 540 * 0.09 - 0.01
    bx = (x - 960) / 960 * 0.6
    by = (y - 540) / 540 * 0.5
    r = np.array([gx, gy, gy_p, gx * 1.05, gy * 0.95, gy_p, bx, by])
    r = r + rng.normal(0, ruido, size=8) * np.array([1, 1, 1, 1, 1, 1, 8, 8])
    mx, my = (r[0] + r[3]) / 2, (r[1] + r[4]) / 2
    ap = 0.40 - (y - 540) / 540 * 0.06 + rng.normal(0, 0.004)
    return np.concatenate([r, [mx * mx, my * my, mx * my, ap, ap * 0.97, mx ** 3, my ** 3]])


rasgos = [np.median([rasgos_de(x, y) for _ in range(30)], axis=0) for x, y in puntos]
modelo = ajustar(puntos, rasgos, monitor)
assert es_valido(modelo, 15)
# con seguimiento suave: 300 muestras por un zigzag
seg = [(rng.uniform(150, 1770), rng.uniform(80, 1000)) for _ in range(300)]
modelo_seg = ajustar(puntos, rasgos, monitor, seg, [rasgos_de(x, y) for x, y in seg])
print("error LOO con seguimiento (px):", modelo_seg["error_px"], "seg:", modelo_seg["error_seguimiento_px"])
print("error LOO (px):", modelo["error_px"])

for nombre, m in (("9 puntos", modelo), ("9 puntos + seguimiento", modelo_seg)):
    errs = []
    for _ in range(200):
        x, y = rng.uniform(100, 1820), rng.uniform(60, 1020)
        px, py = predecir(m, rasgos_de(x, y))
        errs.append(np.hypot(px - x, py - y))
    print(nombre, "error medio en puntos nuevos (px):", round(np.mean(errs), 1), "máx:", round(np.max(errs), 1))
    assert np.mean(errs) < 120, np.mean(errs)

# retraso estimado: el objetivo se mueve y la mirada llega 120 ms tarde
T = np.arange(0, 20, 1 / 30)
hist = [(t, 960 + 700 * np.sin(t * 0.8), 540 + 400 * np.sin(t * 0.5)) for t in T]
muestras = [(t, rasgos_de(960 + 700 * np.sin((t - 0.12) * 0.8), 540 + 400 * np.sin((t - 0.12) * 0.5))) for t in T[10:]]
retraso, pts, rs = estimar_retraso(hist, muestras)
print("retraso estimado:", retraso, "s con", len(pts), "muestras")
assert abs(retraso - 0.12) <= 0.04, retraso
# punto fijo malo: se descarta
rasgos_malos = list(rasgos) + [rasgos_de(1700, 900)]
puntos_malos = list(puntos) + [(200, 100)]
m2 = ajustar(puntos_malos, rasgos_malos, monitor, seg, [rasgos_de(x, y) for x, y in seg])
print("descartados:", m2["descartados"], "lambda:", m2["lambda"], "error:", m2["error_px"])
assert len(m2["descartados"]) == 1 and m2["descartados"][0] == [200.0, 100.0]

# recorte al monitor
px, py = predecir(modelo, rasgos_de(4000, -900))
assert 0 <= px < 1920 and 0 <= py < 1080
print("PRUEBA CALIBRACION OK")
