"""Detector de parpadeo voluntario.

Mide la apertura de cada ojo (distancia entre párpados dividida por el ancho
del ojo) con los puntos de MediaPipe y la compara con la apertura NORMAL de
esa persona, que se aprende sola: es el percentil 60 de las últimas 400
muestras CON LOS OJOS ABIERTOS (los fotogramas de un cierre no entran: si
no, quien hace muchos clics seguidos baja su propia referencia y los cierres
dejan de contar, medido el 12-sep-2026). Así funciona igual con ojos grandes
o pequeños, con gafas o sin ellas. Con un umbral fijo nunca se detectaba
bien (medido en el proyecto hermano: ojo cerrado ≈ 0,04–0,2, abierto ≈ 0,43).

Un parpadeo cuenta como clic cuando los ojos llevan cerrados `min_ms`
(los parpadeos involuntarios duran 150–185 ms; los voluntarios, 200 ms o
más). «Cerrados» se decide con el ojo que MEJOR se cierra por debajo del
umbral, y el otro solo tiene que estar más cerrado que abierto (menos de
umbral + TOLERANCIA_OJO): así un ojo que la cámara ve en ángulo y estima
medio abierto (medido el 12-sep-2026: el izquierdo se quedaba en 0,56–0,70
con el derecho en 0,04–0,45) no impide el clic, y un guiño, con el otro ojo
abierto del todo, sigue sin contar. El clic se hace en ese mismo instante,
con los ojos todavía cerrados: no hace falta abrirlos. Si los ojos siguen
cerrados hasta LARGO_MS se emite además un gesto largo (menú de clics).

El detector se alimenta desde el hilo de MediaPipe (un frame cada vez) y el
controlador de clics recoge los eventos desde el hilo principal.
"""

import logging
import math
import threading
import time

import numpy as np

logger = logging.getLogger("Parpadeo")

# Además de la geometría, MediaPipe estima el cierre de cada párpado con
# sus «blendshapes» eyeBlinkRight (10) y eyeBlinkLeft (9), 0 abierto – 1
# cerrado. Es una señal aprendida, más robusta cuando la cámara ve un ojo en
# ángulo (medido el 12-sep-2026: la geometría del ojo izquierdo del usuario
# se quedaba en 0,6–0,7 con el ojo cerrado). Se usa la que diga que el ojo
# está MÁS cerrado: relación efectiva = min(geométrica, 1 − blendshape).
BS_BLINK_DER = 10
BS_BLINK_IZQ = 9

# Puntos de MediaPipe: párpado superior, párpado inferior, esquina, esquina.
# «Derecho» e «izquierdo» según la imagen, que se ve en espejo.
OJO_DER = (159, 145, 33, 133)
OJO_IZQ = (386, 374, 362, 263)

N_MUESTRAS = 400          # ≈ 13 s a 30 fps
PERCENTIL_BASE = 60
MIN_MUESTRAS_BASE = 45    # antes de esto se usa el respaldo fijo
RESPALDO_FIJO = 0.2       # apertura/ancho por debajo de la cual el ojo está cerrado
UMBRAL_DEFECTO = 0.55     # fracción de la apertura normal (el ojo que mejor se cierra)
TOLERANCIA_OJO = 0.30     # el otro ojo no puede superar umbral + esto (un guiño no cuenta)
# Con los ojos cerrados la medida tiembla alrededor del umbral (medido el
# 12-sep-2026: un cierre de 540 ms se partía en trozos de 129 ms). Una vez
# cerrados, se admite hasta umbral + HISTERESIS; y si los ojos se vuelven a
# cerrar menos de HUECO_S después de «abrirse», se reanuda el mismo cierre
# (un parpadeo corto seguido de ojos abiertos nunca se alarga).
HISTERESIS = 0.12
HUECO_S = 0.09
# El tiempo del clic se mide desde que el ojo EMPIEZA a cerrarse (mejor ojo
# por debajo de umbral + INICIO_CIERRE) hasta que se abre, siempre que en
# medio llegue a cerrarse de verdad (por debajo del umbral). Medido el
# 12-sep-2026: los parpadeos voluntarios rápidos del usuario duran 200–290
# ms de párpado a párpado pero solo 35–165 ms cerrados del todo; los
# involuntarios duran 60–190 ms y casi nunca bajan de 0,6.
INICIO_CIERRE = 0.15
FIN_CIERRE = 0.20
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
        self.t_anterior = None      # instante del fotograma anterior
        self.cierre_inicio = None   # cierre recién terminado, por si se reanuda
        self.cierre_fin = 0.0
        self.cierre_flags = (False, False)
        self.candado = threading.Lock()
        # Diagnóstico: cada «episodio» (algún ojo cerrado) se anota al
        # terminar con su duración y lo más que se cerró cada ojo
        self.episodio_desde = None
        self.episodio_min = [9.0, 9.0]
        self.episodio_ambos_ms = 0
        self.episodio_profundo = False   # en este episodio se llegó a cerrar de verdad
        self.episodio_serie = []      # (r_der, r_izq) por fotograma, para el log
        self.ultimo_episodio = None   # dict para la interfaz

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
                 min_ms: int, ahora: float = None, blendshapes=None) -> None:
        """Se llama una vez por frame con los 478 puntos de la cara y, si
        se tienen, las 52 blendshapes de MediaPipe."""
        if ahora is None:
            ahora = time.time()

        a_der = apertura_ojo(landmarks, OJO_DER, ancho, alto)
        a_izq = apertura_ojo(landmarks, OJO_IZQ, ancho, alto)
        bs_der = bs_izq = None
        if blendshapes is not None and len(blendshapes) > BS_BLINK_DER:
            bs_der = float(blendshapes[BS_BLINK_DER])
            bs_izq = float(blendshapes[BS_BLINK_IZQ])

        with self.candado:
            t_anterior = self.t_anterior
            self.t_anterior = ahora
            listo = self.n >= MIN_MUESTRAS_BASE
            en_cierre = self.cerrados_desde is not None
            umbral_ef = umbral + (HISTERESIS if en_cierre else 0.0)
            if listo:
                if self.base is None:
                    self.base = np.percentile(self.buffer[-self.n:], PERCENTIL_BASE, axis=0)
                b_der, b_izq = float(self.base[0]), float(self.base[1])
                r_der = a_der / b_der if b_der > 1e-6 else 1.0
                r_izq = a_izq / b_izq if b_izq > 1e-6 else 1.0
                if bs_der is not None:
                    # La señal que vea el ojo más cerrado manda
                    r_der = min(r_der, 1.0 - bs_der)
                    r_izq = min(r_izq, 1.0 - bs_izq)
                cerrado_der = r_der < umbral_ef + TOLERANCIA_OJO
                cerrado_izq = r_izq < umbral_ef + TOLERANCIA_OJO
            else:
                b_der = b_izq = 0.0
                r_der = a_der / RESPALDO_FIJO
                r_izq = a_izq / RESPALDO_FIJO
                cerrado_der = a_der < RESPALDO_FIJO
                cerrado_izq = a_izq < RESPALDO_FIJO

            r_mejor = min(r_der, r_izq)
            cerrados = cerrado_der and cerrado_izq and r_mejor < umbral_ef

            # Aprender la apertura normal solo con los ojos abiertos (o si el
            # «cierre» dura tanto que ya no es un cierre: la persona cambió)
            cierre_eterno = (en_cierre and (ahora - self.cerrados_desde) * 1000 > MAX_MS)
            if not listo or not cerrados or cierre_eterno:
                self.buffer = np.roll(self.buffer, shift=-1, axis=0)
                self.buffer[-1] = (a_der, a_izq)
                self.n = min(self.n + 1, N_MUESTRAS)
                if self.n >= MIN_MUESTRAS_BASE:
                    self.base = np.percentile(self.buffer[-self.n:], PERCENTIL_BASE, axis=0)
                    listo = True

            # Episodio de diagnóstico: desde que algún ojo se cierra hasta
            # que los dos vuelven a estar abiertos
            # Episodio = desde que el mejor ojo empieza a cerrarse hasta que
            # vuelve a abrirse (con un poco de histéresis)
            r_mejor_bruto = min(r_der, r_izq)
            en_episodio = self.episodio_desde is not None
            if r_mejor_bruto < umbral + (FIN_CIERRE if en_episodio else INICIO_CIERRE):
                if self.episodio_desde is None:
                    if t_anterior is not None and 0 < ahora - t_anterior < 0.2:
                        self.episodio_desde = (t_anterior + ahora) / 2
                    else:
                        self.episodio_desde = ahora
                    self.episodio_min = [r_der, r_izq]
                    self.episodio_ambos_ms = 0
                    self.episodio_profundo = False
                    self.episodio_serie = []
                    self.clic_emitido = False
                self.episodio_min[0] = min(self.episodio_min[0], r_der)
                self.episodio_min[1] = min(self.episodio_min[1], r_izq)
                if len(self.episodio_serie) < 150:
                    self.episodio_serie.append((r_der, r_izq, bs_der, bs_izq))
                # Clic por duración del episodio, si en algún momento se cerró
                # de verdad y el otro ojo no está abierto del todo (guiño)
                if r_mejor_bruto < umbral_ef:
                    self.episodio_profundo = True
                episodio_ms = int(round((ahora - self.episodio_desde) * 1000))
                if (self.episodio_profundo and not self.clic_emitido and episodio_ms >= min_ms
                        and max(r_der, r_izq) < umbral + TOLERANCIA_OJO):
                    self.clic_emitido = True
                    self.ultimo_clic_ms = episodio_ms
                    self.evento = "clic"
                    self.episodio_ambos_ms = max(self.episodio_ambos_ms, min_ms)
                    logger.info(f"Ojos cerrados {episodio_ms} ms de párpado a párpado "
                                f"(mín {self.episodio_min[0]:.2f}/{self.episodio_min[1]:.2f}): clic")
            elif self.episodio_desde is not None:
                total_ms = int((ahora - self.episodio_desde) * 1000)
                m_der, m_izq = self.episodio_min
                if self.episodio_ambos_ms >= min_ms:
                    resultado = "clic"
                elif self.episodio_ambos_ms > 0:
                    resultado = f"corto: los dos ojos solo {self.episodio_ambos_ms} ms (hacen falta {min_ms})"
                elif m_der >= umbral + TOLERANCIA_OJO:
                    resultado = f"guiño: el derecho se quedó abierto ({m_der:.2f})"
                elif m_izq >= umbral + TOLERANCIA_OJO:
                    resultado = f"guiño: el izquierdo se quedó abierto ({m_izq:.2f})"
                else:
                    resultado = (f"no se cerraron bastante: el mejor ojo llegó a {min(m_der, m_izq):.2f} "
                                 f"(hace falta menos de {umbral:.2f})")
                self.ultimo_episodio = {"ms": total_ms, "ambos_ms": self.episodio_ambos_ms,
                                        "min": (m_der, m_izq), "resultado": resultado, "t": ahora}
                if total_ms >= 60 and total_ms <= MAX_MS:
                    logger.info(f"Cierre {total_ms} ms (mín {m_der:.2f}/{m_izq:.2f}): {resultado}")
                    if total_ms >= 300:
                        serie = " ".join(
                            f"{a:.2f}/{b:.2f}" + (f"(b{c:.2f}/{d:.2f})" if c is not None else "")
                            for a, b, c, d in self.episodio_serie)
                        logger.info(f"  serie der/izq por fotograma (base {b_der:.3f}/{b_izq:.3f}, "
                                    f"umbral {umbral:.2f}): {serie}")
                self.episodio_desde = None

            if cerrados:
                if self.cerrados_desde is None:
                    if (self.cierre_inicio is not None
                            and ahora - self.cierre_fin < HUECO_S):
                        # Reapertura brevísima: es el mismo cierre, partido
                        self.cerrados_desde = self.cierre_inicio
                        self.clic_emitido, self.largo_emitido = self.cierre_flags
                    else:
                        # El cierre empezó entre el fotograma anterior y este:
                        # se toma el punto medio (a 22 fps son 20 ms que cuentan).
                        # clic_emitido NO se reinicia aquí: lo gobierna el episodio
                        if t_anterior is not None and 0 < ahora - t_anterior < 0.2:
                            self.cerrados_desde = (t_anterior + ahora) / 2
                        else:
                            self.cerrados_desde = ahora
                        self.largo_emitido = False
                    self.cierre_inicio = None
                cerrados_ms = int(round((ahora - self.cerrados_desde) * 1000))
                self.episodio_ambos_ms = max(self.episodio_ambos_ms, cerrados_ms)
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
                    self.cierre_inicio = self.cerrados_desde
                    self.cierre_fin = ahora
                    self.cierre_flags = (self.clic_emitido, self.largo_emitido)
                    self.cerrados_desde = None
                    if duracion < min_ms:
                        logger.debug(f"Parpadeo {duracion} ms: involuntario, se ignora")

            self.estado = {
                "apertura": (a_der, a_izq),
                "base": (b_der, b_izq),
                "blink": (bs_der, bs_izq),
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
