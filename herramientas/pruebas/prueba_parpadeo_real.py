"""Reproduce los cierres de ojos medidos al usuario el 12-sep-2026 (el ojo
izquierdo se queda más abierto que el derecho) con la regla de la media y
comprueba que cuentan como clic, que un guiño no, y que un cierre a medias
tampoco."""
import os
import sys

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

from src.detectors import parpadeo as P  # noqa: E402


class L:
    def __init__(self, x, y):
        self.x, self.y = x, y


def cara(ap_der, ap_izq):
    lm = {}
    for (sup, inf, e1, e2), ap in ((P.OJO_DER, ap_der), (P.OJO_IZQ, ap_izq)):
        lm[e1] = L(0.0, 0.0)
        lm[e2] = L(0.1, 0.0)
        lm[sup] = L(0.05, 0.0)
        lm[inf] = L(0.05, 0.1 * ap)
    return lm


fallos = 0


def comprobar(cond, texto):
    global fallos
    print(("  OK   " if cond else "  FALLO") + " " + texto)
    if not cond:
        fallos += 1


d = P.DetectorParpadeo()
t = 0.0
for i in range(100):   # apertura normal 0,40 en los dos ojos
    d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t)
    t += 0.033

# (nombre, relación derecho, relación izquierdo, fotogramas, ¿clic esperado?)
casos = [
    ("cierre real 0,31/0,49 (300 ms)", 0.31, 0.49, 10, True),
    ("cierre real 0,44/0,56", 0.44, 0.56, 10, True),
    ("cierre real 0,41/0,66", 0.41, 0.66, 10, True),
    ("cierre real 0,25/0,70 (el izquierdo visto en ángulo)", 0.25, 0.70, 10, True),
    ("cierre a medias 0,53/0,66", 0.53, 0.66, 10, True),
    ("cierre flojo 0,60/0,60 (mirar abajo)", 0.60, 0.60, 10, False),
    ("guiño 0,10/1,00", 0.10, 1.00, 10, False),
    ("guiño con el otro entornado 0,10/0,88", 0.10, 0.88, 10, False),
    ("los dos 0,45/0,45", 0.45, 0.45, 10, True),
    ("parpadeo involuntario 0,30/0,30 (130 ms)", 0.30, 0.30, 4, False),
]
for nombre, rd, ri, n, esperado in casos:
    for i in range(n):
        d.procesar(cara(0.40 * rd, 0.40 * ri), 100, 100, 0.55, 200, ahora=t)
        t += 0.033
    ev = d.tomar_evento()
    for i in range(20):
        d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t)
        t += 0.033
    hubo = ev == "clic"
    comprobar(hubo == esperado, f"{nombre}: {'clic' if hubo else 'nada'} ({d.ultimo_episodio['resultado']})")

# Cierre mantenido 400 ms cuya medida tiembla alrededor del umbral
for i in range(12):
    r = 0.30 if i % 2 == 0 else 0.62
    d.procesar(cara(0.40 * r, 0.40 * r), 100, 100, 0.55, 200, ahora=t)
    t += 0.033
ev = d.tomar_evento()
for i in range(20):
    d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t)
    t += 0.033
comprobar(ev == "clic", f"cierre de 400 ms con medida temblorosa 0,30/0,62: {'clic' if ev == 'clic' else 'nada'} ({d.ultimo_episodio['resultado']})")

# Pero un guiño largo con el otro ojo abierto sigue sin contar
for i in range(12):
    d.procesar(cara(0.40 * 0.2, 0.40 * 0.95), 100, 100, 0.55, 200, ahora=t)
    t += 0.033
ev = d.tomar_evento()
for i in range(20):
    d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t)
    t += 0.033
comprobar(ev is None, f"guiño largo 0,20/0,95: {'clic' if ev == 'clic' else 'nada'} ({d.ultimo_episodio['resultado']})")

# Muchos clics seguidos durante 20 s (40 % del tiempo cerrados) no deben
# bajar la apertura «normal» aprendida
base_antes = tuple(float(v) for v in d.base)
for ciclo in range(20):
    for i in range(12):            # 400 ms cerrados a 0,20
        d.procesar(cara(0.40 * 0.2, 0.40 * 0.2), 100, 100, 0.55, 200, ahora=t)
        t += 0.033
    d.tomar_evento()
    for i in range(18):            # 600 ms abiertos
        d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t)
        t += 0.033
base_despues = tuple(float(v) for v in d.base)
comprobar(abs(base_despues[0] - base_antes[0]) < 0.02,
          f"la apertura normal no baja con muchos clics: {base_antes[0]:.3f} → {base_despues[0]:.3f}")
for i in range(9):                 # cierre de 300 ms a 0,45: debe seguir contando
    d.procesar(cara(0.40 * 0.45, 0.40 * 0.45), 100, 100, 0.55, 200, ahora=t)
    t += 0.033
ev = d.tomar_evento()
for i in range(20):
    d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t)
    t += 0.033
comprobar(ev == "clic", f"tras muchos clics, un cierre a 0,45 sigue contando: {'clic' if ev == 'clic' else 'nada'}")

# A 22 fps (45 ms por fotograma), un cierre de 240 ms reales debe llegar a 200
for i in range(10):                # la cámara ya iba a 22 fps antes del cierre
    d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t)
    t += 0.045
for i in range(5):                 # 5 fotogramas cerrados = 225 ms medidos entre el primero y el último
    d.procesar(cara(0.40 * 0.2, 0.40 * 0.2), 100, 100, 0.55, 200, ahora=t)
    t += 0.045
ev = d.tomar_evento()
for i in range(20):
    d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t)
    t += 0.045
comprobar(ev == "clic", f"a 22 fps, 5 fotogramas cerrados (≈240 ms reales) dan clic: {'clic' if ev == 'clic' else 'nada'} ({d.ultimo_episodio['resultado']})")

# La geometría dice 0,75 (ojo visto en ángulo) pero MediaPipe dice cerrado (0,9): cuenta
bs = [0.0] * 52
bs[P.BS_BLINK_DER] = 0.9
bs[P.BS_BLINK_IZQ] = 0.85
for i in range(12):
    d.procesar(cara(0.40 * 0.75, 0.40 * 0.75), 100, 100, 0.55, 200, ahora=t, blendshapes=bs)
    t += 0.045
ev = d.tomar_evento()
bs0 = [0.0] * 52
for i in range(20):
    d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t, blendshapes=bs0)
    t += 0.045
comprobar(ev == "clic", f"geometría 0,75 pero blendshape de cierre 0,9: {'clic' if ev == 'clic' else 'nada'} ({d.ultimo_episodio['resultado']})")

# Y al revés: blendshape dormida (0,1) pero geometría cerrada 0,2: también cuenta
bs[P.BS_BLINK_DER] = 0.1
bs[P.BS_BLINK_IZQ] = 0.1
for i in range(12):
    d.procesar(cara(0.40 * 0.2, 0.40 * 0.2), 100, 100, 0.55, 200, ahora=t, blendshapes=bs)
    t += 0.045
ev = d.tomar_evento()
for i in range(20):
    d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t, blendshapes=bs0)
    t += 0.045
comprobar(ev == "clic", f"blendshape 0,1 pero geometría 0,2: {'clic' if ev == 'clic' else 'nada'}")

# Parpadeo voluntario rápido del usuario: 0,62 0,50 0,45 0,50 0,62 a 22 fps
# (≈ 200 ms de párpado a párpado, solo 90 ms cerrados del todo): cuenta
for i in range(10):
    d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t, blendshapes=bs0)
    t += 0.045
for r in (0.62, 0.50, 0.45, 0.50, 0.62):
    d.procesar(cara(0.40 * r, 0.40 * r), 100, 100, 0.55, 200, ahora=t, blendshapes=bs0)
    t += 0.045
ev = d.tomar_evento()
for i in range(20):
    d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t, blendshapes=bs0)
    t += 0.045
comprobar(ev == "clic", f"parpadeo voluntario rápido (5 fotogramas, mín 0,45): {'clic' if ev == 'clic' else 'nada'} ({d.ultimo_episodio['resultado']})")

# Parpadeo involuntario: 0,65 0,40 0,65 (3 fotogramas ≈ 110 ms): no cuenta
for r in (0.65, 0.40, 0.65):
    d.procesar(cara(0.40 * r, 0.40 * r), 100, 100, 0.55, 200, ahora=t, blendshapes=bs0)
    t += 0.045
ev = d.tomar_evento()
for i in range(20):
    d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t, blendshapes=bs0)
    t += 0.045
comprobar(ev is None, f"parpadeo involuntario (3 fotogramas): {'clic' if ev == 'clic' else 'nada'} ({d.ultimo_episodio['resultado']})")

# Entornar los ojos 1 s a 0,62 sin llegar a cerrarlos: no cuenta
for i in range(22):
    d.procesar(cara(0.40 * 0.62, 0.40 * 0.62), 100, 100, 0.55, 200, ahora=t, blendshapes=bs0)
    t += 0.045
ev = d.tomar_evento()
for i in range(20):
    d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t, blendshapes=bs0)
    t += 0.045
comprobar(ev is None, f"entornar 1 s a 0,62: {'clic' if ev == 'clic' else 'nada'} ({d.ultimo_episodio['resultado']})")

# Un cierre largo da UN solo clic (y el gesto largo), no dos
for i in range(30):
    d.procesar(cara(0.40 * 0.2, 0.40 * 0.2), 100, 100, 0.55, 200, ahora=t, blendshapes=bs0)
    t += 0.045
    ev = d.tomar_evento()
    if ev:
        eventos_largo = eventos_largo + [ev] if 'eventos_largo' in dir() else [ev]
for i in range(20):
    d.procesar(cara(0.40, 0.40), 100, 100, 0.55, 200, ahora=t, blendshapes=bs0)
    t += 0.045
comprobar(eventos_largo == ["clic", "largo"], f"cierre de 1,35 s: {eventos_largo}")

print(f"\n{'Todo bien' if fallos == 0 else str(fallos) + ' fallos'}")
sys.exit(1 if fallos else 0)
