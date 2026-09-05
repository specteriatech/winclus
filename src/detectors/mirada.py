"""Dirección de la mirada a partir del iris.

MediaPipe entrega 478 puntos: los últimos diez son el contorno del iris de
cada ojo (468–472 derecho, 473–477 izquierdo). La mirada se estima como el
desplazamiento del centro del iris respecto al centro del ojo (punto medio
entre las dos esquinas), dividido por el ancho del ojo. Así no depende de la
distancia a la cámara ni del tamaño del ojo.

Valores típicos con una webcam: ±0,10 a ±0,15 en horizontal mirando a los
extremos; en vertical algo menos. Se promedian los dos ojos.

Es una medida relativa, pensada para mover el puntero como si fuera una
palanca (mirar a un lado = el puntero va hacia ese lado), no para saber el
punto exacto de la pantalla que se mira.
"""

import logging
import math

logger = logging.getLogger("Mirada")

IRIS_DER = (468, 469, 470, 471, 472)
IRIS_IZQ = (473, 474, 475, 476, 477)
ESQUINAS_DER = (33, 133)
ESQUINAS_IZQ = (362, 263)
N_PUNTOS_NECESARIOS = 478


class DetectorMirada:

    def __init__(self):
        self.disponible = False
        self.mirada = None      # (gx, gy) promedio de los dos ojos
        self.puntos = {}        # píxeles para dibujar sobre la cámara

    def procesar(self, landmarks, ancho: int, alto: int) -> None:
        if len(landmarks) < N_PUNTOS_NECESARIOS:
            self.disponible = False
            self.mirada = None
            return

        medidas = []
        puntos = {}
        for nombre, iris, esquinas in (("der", IRIS_DER, ESQUINAS_DER),
                                       ("izq", IRIS_IZQ, ESQUINAS_IZQ)):
            ix = sum(landmarks[i].x for i in iris) / len(iris) * ancho
            iy = sum(landmarks[i].y for i in iris) / len(iris) * alto
            e1, e2 = landmarks[esquinas[0]], landmarks[esquinas[1]]
            cx = (e1.x + e2.x) / 2 * ancho
            cy = (e1.y + e2.y) / 2 * alto
            ancho_ojo = math.hypot((e1.x - e2.x) * ancho, (e1.y - e2.y) * alto)
            if ancho_ojo < 1e-6:
                continue
            medidas.append(((ix - cx) / ancho_ojo, (iy - cy) / ancho_ojo))
            puntos[nombre] = {"iris": (int(ix), int(iy)), "centro": (int(cx), int(cy))}

        if not medidas:
            self.disponible = False
            self.mirada = None
            return

        gx = sum(m[0] for m in medidas) / len(medidas)
        gy = sum(m[1] for m in medidas) / len(medidas)
        self.mirada = (gx, gy)
        self.puntos = puntos
        self.disponible = True
