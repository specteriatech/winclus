"""Afinado del centro del iris sobre la imagen a resolución completa.

MediaPipe da cinco puntos por iris, pero los calcula sobre un recorte
pequeño del ojo, así que su precisión es de un píxel o más en la imagen
grande. Para mover un puntero con la mirada hace falta más: el iris solo se
desplaza unos 12 píxeles (a 1080p) entre mirar a un extremo y al otro de la
pantalla.

Aquí se parte del centro y el radio que da MediaPipe y se busca el borde
real del iris (el limbo, el paso de la parte oscura a la esclerótica clara)
lanzando rayos desde el centro hacia los lados. Solo se usan los sectores
laterales (±55° respecto a la horizontal), porque arriba y abajo los
párpados tapan el iris. Con los puntos de borde se ajusta un círculo por
mínimos cuadrados, descartando los que se alejan (pestañas, reflejos).

Si el ajuste no es fiable (pocos puntos, radio raro, centro lejos del
inicial) se devuelve el centro de MediaPipe. Todo va con numpy y OpenCV y
tarda alrededor de un milisegundo por ojo.
"""

import logging
import math

import cv2
import numpy as np

logger = logging.getLogger("IrisFino")

ANGULOS = np.deg2rad(np.concatenate([np.arange(-45, 46, 4), np.arange(135, 226, 4)]))
N_RADIOS = 40           # muestras por rayo
R_MIN, R_MAX = 0.55, 1.6   # rango de búsqueda en radios del iris inicial
MIN_PUNTOS = 10
UMBRAL_GRADIENTE = 0.45    # fracción de la mediana del gradiente para aceptar un rayo
MAX_DESVIO_CENTRO = 0.6    # en radios: si el centro se va más lejos, se descarta
RADIO_RANGO = (0.7, 1.35)  # radio aceptable respecto al inicial
RESIDUO_MAX = 1.2          # px: puntos más lejos del círculo se descartan


def _ajustar_circulo(xs, ys):
    """Ajuste algebraico (Kåsa): (x-a)²+(y-b)²=r². Devuelve a, b, r."""
    A = np.column_stack([2 * xs, 2 * ys, np.ones_like(xs)])
    b = xs * xs + ys * ys
    sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    a, bb, c = sol
    r2 = c + a * a + bb * bb
    if r2 <= 0:
        return None
    return float(a), float(bb), float(math.sqrt(r2))


def afinar_iris(gris: np.ndarray, cx: float, cy: float, r0: float):
    """gris: imagen completa, en gris (uint8) o en color RGB (solo se convierte
    el recorte). (cx, cy, r0): centro y radio inicial del iris en píxeles.
    Devuelve un dict con centro, radio, número de puntos usados y si el
    afinado se aceptó."""
    resultado = {"x": cx, "y": cy, "r": r0, "n": 0, "ok": False}
    if r0 < 4:
        return resultado
    alto, ancho = gris.shape[:2]

    # Recorte con margen, suavizado ligero para que el gradiente sea limpio
    m = int(R_MAX * r0) + 3
    x1, y1 = int(cx - m), int(cy - m)
    x2, y2 = int(cx + m) + 1, int(cy + m) + 1
    if x1 < 0 or y1 < 0 or x2 > ancho or y2 > alto:
        return resultado
    roi = gris[y1:y2, x1:x2]
    if roi.ndim == 3:
        roi = cv2.cvtColor(roi, cv2.COLOR_RGB2GRAY)
    roi = cv2.GaussianBlur(roi, (0, 0), 1.0).astype(np.float32)

    # Rayos: matriz (n_angulos, N_RADIOS) de coordenadas
    radios = np.linspace(R_MIN * r0, R_MAX * r0, N_RADIOS, dtype=np.float32)
    cos = np.cos(ANGULOS).astype(np.float32)[:, None]
    sen = np.sin(ANGULOS).astype(np.float32)[:, None]
    map_x = (cx - x1) + radios[None, :] * cos
    map_y = (cy - y1) + radios[None, :] * sen
    perfil = cv2.remap(roi, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

    # Borde = mayor subida de intensidad (oscuro → claro) a lo largo del rayo
    grad = np.diff(perfil, axis=1)
    idx = np.argmax(grad, axis=1)
    fuerza = grad[np.arange(len(ANGULOS)), idx]
    umbral = UMBRAL_GRADIENTE * max(float(np.median(fuerza)), 1e-6)
    validos = fuerza > umbral
    if validos.sum() < MIN_PUNTOS:
        return resultado

    # Posición sub-píxel del borde: parábola por el máximo y sus vecinos
    i = np.clip(idx, 1, N_RADIOS - 3)
    g0, g1, g2 = (grad[np.arange(len(ANGULOS)), i - 1],
                  grad[np.arange(len(ANGULOS)), i],
                  grad[np.arange(len(ANGULOS)), i + 1])
    denom = g0 - 2 * g1 + g2
    desplaz = np.where(np.abs(denom) > 1e-6, 0.5 * (g0 - g2) / np.where(denom == 0, 1, denom), 0.0)
    desplaz = np.clip(desplaz, -1, 1)
    paso = radios[1] - radios[0]
    r_borde = radios[i] + (0.5 + desplaz) * paso   # el gradiente i está entre i e i+1

    xs = cx + r_borde * cos[:, 0]
    ys = cy + r_borde * sen[:, 0]
    xs, ys = xs[validos], ys[validos]

    # Ajuste con descarte de puntos lejanos (dos pasadas)
    for _ in range(3):
        c = _ajustar_circulo(xs, ys)
        if c is None:
            return resultado
        a, b, r = c
        res = np.abs(np.hypot(xs - a, ys - b) - r)
        keep = res < RESIDUO_MAX
        if keep.sum() < MIN_PUNTOS:
            return resultado
        if keep.all():
            break
        xs, ys = xs[keep], ys[keep]

    if not (RADIO_RANGO[0] * r0 <= r <= RADIO_RANGO[1] * r0):
        return resultado
    if math.hypot(a - cx, b - cy) > MAX_DESVIO_CENTRO * r0:
        return resultado

    resultado.update({"x": a, "y": b, "r": r, "n": int(len(xs)), "ok": True})
    return resultado
