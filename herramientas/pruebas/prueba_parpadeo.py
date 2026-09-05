"""Prueba del detector de parpadeo con ojos sintéticos."""
import os
import sys
from types import SimpleNamespace

sys.path.insert(0, r"C:\Users\RYZEN\Documents\puntero libre")
os.chdir(r"C:\Users\RYZEN\Documents\puntero libre")

from src.detectors.parpadeo import DetectorParpadeo, OJO_DER, OJO_IZQ


def cara(apertura_der, apertura_izq):
    """478 puntos falsos; solo importan los del ojo. Ancho de ojo 0,1; alto = apertura*ancho."""
    pts = [SimpleNamespace(x=0.5, y=0.5) for _ in range(478)]
    for (sup, inf, e1, e2), ap, cx in ((OJO_DER, apertura_der, 0.35), (OJO_IZQ, apertura_izq, 0.65)):
        pts[e1] = SimpleNamespace(x=cx - 0.05, y=0.4)
        pts[e2] = SimpleNamespace(x=cx + 0.05, y=0.4)
        pts[sup] = SimpleNamespace(x=cx, y=0.4 - ap * 0.1 / 2)
        pts[inf] = SimpleNamespace(x=cx, y=0.4 + ap * 0.1 / 2)
    return pts


def simular(cierres_ms, umbral=0.55, min_ms=200, fps=30, ap_abierto=0.43, ap_cerrado=0.12):
    d = DetectorParpadeo()
    t = 0.0
    dt = 1 / fps
    eventos = []
    # 3 s de ojos abiertos para aprender la base
    for _ in range(int(3 * fps)):
        d.procesar(cara(ap_abierto, ap_abierto), 640, 640, umbral, min_ms, ahora=t)
        t += dt
    base = d.estado["base"]
    for cierre in cierres_ms:
        n = round(cierre / 1000 * fps)
        for _ in range(n):
            d.procesar(cara(ap_cerrado, ap_cerrado), 640, 640, umbral, min_ms, ahora=t)
            t += dt
            ev = d.tomar_evento()
            if ev:
                eventos.append((cierre, ev, d.ultimo_clic_ms))
        for _ in range(fps):
            d.procesar(cara(ap_abierto, ap_abierto), 640, 640, umbral, min_ms, ahora=t)
            t += dt
            ev = d.tomar_evento()
            if ev:
                eventos.append((cierre, ev, d.ultimo_clic_ms))
    return base, eventos, d


base, eventos, d = simular([100, 167, 233, 400, 1000, 1500, 5000])
print("base aprendida:", base)
print("eventos:", eventos)
assert [e[1] for e in eventos] == ["clic", "clic", "clic", "clic", "largo", "clic", "largo"], eventos
assert all(e[2] <= 240 for e in eventos if e[1] == "clic"), "el clic debe salir al cumplirse el tiempo, no al abrir"
assert all(e[0] >= 200 for e in eventos)

# Un guiño (solo un ojo cerrado) no debe contar
d2 = DetectorParpadeo()
t = 0.0
for i in range(120):
    d2.procesar(cara(0.43, 0.43), 640, 640, 0.55, 200, ahora=t)
    t += 1 / 30
for i in range(12):
    d2.procesar(cara(0.12, 0.43), 640, 640, 0.55, 200, ahora=t)
    t += 1 / 30
for i in range(10):
    d2.procesar(cara(0.43, 0.43), 640, 640, 0.55, 200, ahora=t)
    t += 1 / 30
assert d2.tomar_evento() is None, "el guiño no debe hacer clic"

# Base relativa: ojos pequeños (apertura 0,25 abiertos, 0,08 cerrados)
base, eventos, _ = simular([300], ap_abierto=0.25, ap_cerrado=0.08)
print("ojos pequeños, base:", base, "eventos:", eventos)
assert eventos and eventos[0][1] == "clic"
print("PRUEBA PARPADEO OK")
