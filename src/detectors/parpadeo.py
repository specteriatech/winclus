"""Detector de parpadeo voluntario.

Mide la apertura de cada ojo (distancia entre párpados dividida por el ancho
del ojo) con los puntos de MediaPipe y la compara con la apertura NORMAL de
esa persona, que se aprende sola: es el percentil 60 de las últimas 400
muestras. Así funciona igual con ojos grandes o pequeños, con gafas o sin
ellas. Con un umbral fijo nunca se detectaba bien (medido en el proyecto
hermano: ojo cerrado ≈ 0,04–0,2, abierto ≈ 0,43).

Un parpadeo cuenta como clic cuando LOS DOS ojos llevan cerrados `min_ms`
(los parpadeos involuntarios duran 150–185 ms; los voluntarios, 200 ms o
más). El clic se hace en ese mismo instante, con los ojos todavía cerrados:
no hace falta abrirlos. Un guiño no cuenta. Si los ojos siguen cerrados hasta
LARGO_MS se emite además un gesto largo (para pausar más adelante).

El detector se alimenta desde el hilo de MediaPipe (un frame cada vez) y el
controlador de clics recoge los eventos desde el hilo principal.
"""

import logging
import math
import threading
import time

import numpy as np

logger = logging.getLogger("Parpadeo")

# Puntos de MediaPipe: párpado superior, párpado inferior, esquina, esquina.
# «Derecho» e «izquierdo» según la imagen, que se ve en espejo.
OJO_DER = (159, 145, 33, 133)
OJO_IZQ = (386, 374, 362, 263)

N_MUESTRAS = 400          # ≈ 13 s a 30 fps
PERCENTIL_BASE = 60
MIN_MUESTRAS_BASE = 45    # antes de esto se usa el respaldo fijo
RESPALDO_FIJO = 0.2       # apertura/ancho por debajo de la cual el ojo está cerrado
UMBRAL_DEFECTO = 0.55     # fracción de la apertura normal
LARGO_MS = 1200           # ojos cerrados tanto tiempo = gesto largo, no clic
MAX_MS = 4000             # más que esto se ignora (se durmió, se fue…)


def _distancia(a, b, ancho, alto):
    return math.hypot((a.x - b.x) * ancho, (a.y - b.y) * alto)


def apertura_ojo(landmarks, puntos, ancho, alto) -> float:
    """Alto del ojo dividido por su ancho (0 = cerrado, ≈0,4 = abierto)."""
    sup, inf, e1, e2 = puntos
    ancho_ojo = _distancia(landmarks[e1], landmarks[e2], ancho, alto)
    if ancho_ojo < 1e-6:
        return 0.0
    return _distancia(landmarks[sup], landmarks[inf], ancho, alto) / ancho_ojo


class DetectorParpadeo:

    def __init__(self):
        self.buffer = np.zeros((N_MUESTRAS, 2), dtype=np.float32)
        self.n = 0
        self.base = None            # apertura normal de cada ojo
        self.cerrados_desde = None  # instante en que se cerraron los dos ojos
        self.clic_emitido = False   # ya se hizo el clic de este cierre
        self.largo_emitido = False
        self.evento = None          # "clic" o "largo", pendiente de recoger
        self.ultimo_clic_ms = 0     # duración del último parpadeo válido
        self.candado = threading.Lock()

        # Medidas en vivo para la interfaz y el diagnóstico.
        self.estado = {
            "apertura": (0.0, 0.0),   # (derecho, izquierdo)
            "base": (0.0, 0.0),
            "relacion": 1.0,          # apertura / base, la menor de los dos ojos
            "cerrados": False,
            "cerrados_ms": 0,
            "listo": False,           # ya se aprendió la apertura normal
        }

    def reiniciar(self):
        with self.candado:
            self.n = 0
            self.base = None
            self.cerrados_desde = None
            self.evento = None

    def procesar(self, landmarks, ancho: int, alto: int, umbral: float,
                 min_ms: int, ahora: float = None) -> None:
        """Se llama una vez por frame con los 478 puntos de la cara."""
        if ahora is None:
            ahora = time.time()

        a_der = apertura_ojo(landmarks, OJO_DER, ancho, alto)
        a_izq = apertura_ojo(landmarks, OJO_IZQ, ancho, alto)

        with self.candado:
            # Aprender la apertura normal (percentil 60 de la ventana).
            self.buffer = np.roll(self.buffer, shift=-1, axis=0)
            self.buffer[-1] = (a_der, a_izq)
            self.n = min(self.n + 1, N_MUESTRAS)
            listo = self.n >= MIN_MUESTRAS_BASE
            if listo:
                self.base = np.percentile(self.buffer[-self.n:],
                                          PERCENTIL_BASE,
                                          axis=0)
                b_der, b_izq = float(self.base[0]), float(self.base[1])
                r_der = a_der / b_der if b_der > 1e-6 else 1.0
                r_izq = a_izq / b_izq if b_izq > 1e-6 else 1.0
                cerrado_der = r_der < umbral
                cerrado_izq = r_izq < umbral
            else:
                b_der = b_izq = 0.0
                r_der = a_der / RESPALDO_FIJO
                r_izq = a_izq / RESPALDO_FIJO
                cerrado_der = a_der < RESPALDO_FIJO
                cerrado_izq = a_izq < RESPALDO_FIJO

            cerrados = cerrado_der and cerrado_izq

            if cerrados:
                if self.cerrados_desde is None:
                    self.cerrados_desde = ahora
                    self.clic_emitido = False
                    self.largo_emitido = False
                cerrados_ms = int(round((ahora - self.cerrados_desde) * 1000))
                # El clic se hace EN CUANTO se cumple el tiempo, con los ojos
                # aún cerrados; no hace falta abrirlos.
                if not self.clic_emitido and cerrados_ms >= min_ms:
                    self.clic_emitido = True
                    self.ultimo_clic_ms = cerrados_ms
                    self.evento = "clic"
                    logger.info(f"Ojos cerrados {cerrados_ms} ms "
                                f"(rel {r_der:.2f}/{r_izq:.2f}): clic")
                if not self.largo_emitido and cerrados_ms >= LARGO_MS:
                    self.largo_emitido = True
                    self.evento = "largo"
                    logger.info(f"Ojos cerrados {cerrados_ms} ms: gesto largo")
            else:
                cerrados_ms = 0
                if self.cerrados_desde is not None:
                    duracion = int((ahora - self.cerrados_desde) * 1000)
                    self.cerrados_desde = None
                    if duracion < min_ms:
                        logger.debug(f"Parpadeo {duracion} ms: involuntario, se ignora")

            self.estado = {
                "apertura": (a_der, a_izq),
                "base": (b_der, b_izq),
                "relacion": min(r_der, r_izq),
                "cerrados": cerrados,
                "cerrados_ms": cerrados_ms,
                "listo": listo,
            }

    def tomar_evento(self):
        """Devuelve y borra el evento pendiente ("clic", "largo" o None)."""
        with self.candado:
            ev = self.evento
            self.evento = None
            return ev

    def ojos_abiertos(self, margen: float = 0.7) -> bool:
        """True si los dos ojos están claramente abiertos (para fiarse del iris)."""
        return self.estado["relacion"] >= margen
