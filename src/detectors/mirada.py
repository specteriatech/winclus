"""Dirección de la mirada a partir del iris.

MediaPipe entrega 478 puntos: los últimos diez son el contorno del iris de
cada ojo (468–472 derecho, 473–477 izquierdo). Se miden varias cosas y se
promedian los dos ojos:

- gx: centro del iris respecto al punto medio de las esquinas del ojo, en
  anchos de ojo (mirar a los lados).
- gy: lo mismo en vertical, respecto a las esquinas.
- gy_parpados: iris respecto al punto medio de los párpados. Los párpados
  acompañan a la mirada (al mirar arriba sube el párpado superior), así que
  esta medida refuerza el eje vertical, que es el más débil con una webcam.
- bx, by: las «blendshapes» de mirada de MediaPipe (eyeLookIn/Out/Up/Down),
  otra estimación independiente que sirve de apoyo.

`mirada` es (gx, gy), la palanca sencilla. `rasgos` es el vector completo que
usa la calibración del modo directo (ver detectors/calibracion.py).
"""

import logging
import math

logger = logging.getLogger("Mirada")

IRIS_DER = (468, 469, 470, 471, 472)
IRIS_IZQ = (473, 474, 475, 476, 477)
ESQUINAS_DER = (33, 133)
ESQUINAS_IZQ = (362, 263)
PARPADOS_DER = (159, 145)
PARPADOS_IZQ = (386, 374)
N_PUNTOS_NECESARIOS = 478

# Índices de las blendshapes de mirada en el orden original de MediaPipe
BS_LOOK_DOWN_L, BS_LOOK_DOWN_R = 11, 12
BS_LOOK_IN_L, BS_LOOK_IN_R = 13, 14
BS_LOOK_OUT_L, BS_LOOK_OUT_R = 15, 16
BS_LOOK_UP_L, BS_LOOK_UP_R = 17, 18

NOMBRES_RASGOS = ("gx", "gy", "gy_parpados", "bx", "by")


class DetectorMirada:

    def __init__(self):
        self.disponible = False
        self.mirada = None      # (gx, gy) promedio de los dos ojos
        self.rasgos = None      # tupla con NOMBRES_RASGOS
        self.puntos = {}        # píxeles para dibujar sobre la cámara

    def procesar(self, landmarks, ancho: int, alto: int, blendshapes=None) -> None:
        if len(landmarks) < N_PUNTOS_NECESARIOS:
            self._sin_datos()
            return

        medidas = []
        puntos = {}
        for nombre, iris, esquinas, parpados in (
                ("der", IRIS_DER, ESQUINAS_DER, PARPADOS_DER),
                ("izq", IRIS_IZQ, ESQUINAS_IZQ, PARPADOS_IZQ)):
            ix = sum(landmarks[i].x for i in iris) / len(iris) * ancho
            iy = sum(landmarks[i].y for i in iris) / len(iris) * alto
            e1, e2 = landmarks[esquinas[0]], landmarks[esquinas[1]]
            cx = (e1.x + e2.x) / 2 * ancho
            cy = (e1.y + e2.y) / 2 * alto
            ancho_ojo = math.hypot((e1.x - e2.x) * ancho, (e1.y - e2.y) * alto)
            if ancho_ojo < 1e-6:
                continue
            p1, p2 = landmarks[parpados[0]], landmarks[parpados[1]]
            py = (p1.y + p2.y) / 2 * alto
            medidas.append(((ix - cx) / ancho_ojo, (iy - cy) / ancho_ojo,
                            (iy - py) / ancho_ojo))
            puntos[nombre] = {"iris": (int(ix), int(iy)), "centro": (int(cx), int(cy))}

        if not medidas:
            self._sin_datos()
            return

        gx = sum(m[0] for m in medidas) / len(medidas)
        gy = sum(m[1] for m in medidas) / len(medidas)
        gy_p = sum(m[2] for m in medidas) / len(medidas)

        bx = by = 0.0
        if blendshapes is not None and len(blendshapes) > BS_LOOK_UP_R:
            b = blendshapes
            bx = ((b[BS_LOOK_IN_L] - b[BS_LOOK_OUT_L]) +
                  (b[BS_LOOK_OUT_R] - b[BS_LOOK_IN_R])) / 2
            by = ((b[BS_LOOK_DOWN_L] - b[BS_LOOK_UP_L]) +
                  (b[BS_LOOK_DOWN_R] - b[BS_LOOK_UP_R])) / 2

        self.mirada = (gx, gy)
        self.rasgos = (gx, gy, gy_p, float(bx), float(by))
        self.puntos = puntos
        self.disponible = True

    def _sin_datos(self):
        self.disponible = False
        self.mirada = None
        self.rasgos = None
