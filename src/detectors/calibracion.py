"""Calibración del modo directo: de los rasgos de la mirada al punto de la pantalla.

La persona mira nueve puntos repartidos por la pantalla; de cada uno se
guarda la mediana de los rasgos (ver detectors/mirada.py). Con eso se ajusta
una regresión lineal con regularización (ridge) para x y otra para y:

    x = a0 + a1·gx + a2·gy + a3·gy_parpados + a4·bx + a5·by

Los rasgos se normalizan (media y desviación de los puntos de calibración)
para que la regularización trate a todos por igual. El modelo se guarda en
cursor.json y es solo números: se puede evaluar en cualquier hilo.

También se calcula el error «dejando uno fuera» (se ajusta con ocho puntos y
se comprueba el noveno) para decirle a la persona qué precisión esperar.
"""

import logging

import numpy as np

logger = logging.getLogger("Calibracion")

LAMBDA = 0.05     # regularización; los rasgos están normalizados


def _matriz(rasgos, media, desv):
    R = (np.asarray(rasgos, dtype=np.float64) - media) / desv
    return np.hstack([np.ones((R.shape[0], 1)), R])


def _ridge(X, y, lam):
    n = X.shape[1]
    I = np.eye(n)
    I[0, 0] = 0.0   # el término independiente no se penaliza
    return np.linalg.solve(X.T @ X + lam * I, X.T @ y)


def ajustar(puntos_pantalla, rasgos, monitor) -> dict:
    """puntos_pantalla: lista de (x, y) en píxeles; rasgos: lista de vectores
    (uno por punto, ya promediados). monitor: (x1, y1, x2, y2)."""
    P = np.asarray(puntos_pantalla, dtype=np.float64)
    R = np.asarray(rasgos, dtype=np.float64)
    media = R.mean(axis=0)
    desv = R.std(axis=0)
    desv[desv < 1e-6] = 1.0

    X = _matriz(R, media, desv)
    coef_x = _ridge(X, P[:, 0], LAMBDA)
    coef_y = _ridge(X, P[:, 1], LAMBDA)

    # Error dejando uno fuera
    errores = []
    if len(P) >= 4:
        for i in range(len(P)):
            mascara = np.arange(len(P)) != i
            cx = _ridge(X[mascara], P[mascara, 0], LAMBDA)
            cy = _ridge(X[mascara], P[mascara, 1], LAMBDA)
            ex = X[i] @ cx - P[i, 0]
            ey = X[i] @ cy - P[i, 1]
            errores.append(float(np.hypot(ex, ey)))
    error_px = float(np.median(errores)) if errores else 0.0

    modelo = {
        "media": media.tolist(),
        "desv": desv.tolist(),
        "coef_x": coef_x.tolist(),
        "coef_y": coef_y.tolist(),
        "monitor": list(monitor),
        "puntos": P.tolist(),
        "error_px": round(error_px),
    }
    logger.info(f"Calibración: {len(P)} puntos, error mediano {error_px:.0f} px")
    return modelo


def predecir(modelo: dict, rasgos):
    """Punto de pantalla (x, y) para un vector de rasgos, recortado al monitor."""
    r = (np.asarray(rasgos, dtype=np.float64) - modelo["media"]) / modelo["desv"]
    x_ = np.concatenate([[1.0], r])
    x = float(x_ @ modelo["coef_x"])
    y = float(x_ @ modelo["coef_y"])
    x1, y1, x2, y2 = modelo["monitor"]
    return min(max(x, x1), x2 - 1), min(max(y, y1), y2 - 1)


def es_valido(modelo) -> bool:
    return (isinstance(modelo, dict) and "coef_x" in modelo and "coef_y" in modelo
            and "monitor" in modelo and len(modelo["monitor"]) == 4)
