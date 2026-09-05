"""Calibración del modo directo: de los rasgos de la mirada al punto de la pantalla.

La persona mira nueve puntos fijos y después sigue con la vista un punto que
recorre la pantalla (seguimiento suave): eso da cientos de muestras bien
repartidas, que es lo que más mejora la precisión según la literatura de
seguimiento ocular por webcam. Con todo ello se ajusta una regresión lineal
con regularización (ridge) para x y otra para y sobre los rasgos de
detectors/mirada.py (por ojo, blendshapes y términos cuadráticos).

Los rasgos se normalizan (media y desviación de las muestras) para que la
regularización trate a todos por igual. El modelo se guarda en cursor.json y
es solo números: se puede evaluar en cualquier hilo.

También se calcula el error «dejando uno fuera» sobre los nueve puntos fijos
(se ajusta sin ese punto y se comprueba en él) para decirle a la persona qué
precisión esperar.
"""

import logging

import numpy as np

logger = logging.getLogger("Calibracion")

LAMBDA = 0.5      # regularización; los rasgos están normalizados
PESO_FIJOS = 8.0  # cada punto fijo (mediana de 30 muestras) pesa como 8 de seguimiento


def _matriz(rasgos, media, desv):
    R = (np.asarray(rasgos, dtype=np.float64) - media) / desv
    return np.hstack([np.ones((R.shape[0], 1)), R])


def _ridge(X, y, lam, pesos=None):
    n = X.shape[1]
    I = np.eye(n)
    I[0, 0] = 0.0   # el término independiente no se penaliza
    if pesos is None:
        return np.linalg.solve(X.T @ X + lam * I, X.T @ y)
    W = np.asarray(pesos, dtype=np.float64)[:, None]
    return np.linalg.solve(X.T @ (W * X) + lam * I, X.T @ (W[:, 0] * y))


def ajustar(puntos_pantalla, rasgos, monitor, puntos_seguimiento=None,
            rasgos_seguimiento=None) -> dict:
    """puntos_pantalla: lista de (x, y) en píxeles de los puntos fijos;
    rasgos: un vector por punto (mediana de sus muestras). Opcionalmente las
    muestras del seguimiento suave. monitor: (x1, y1, x2, y2)."""
    P = np.asarray(puntos_pantalla, dtype=np.float64)
    R = np.asarray(rasgos, dtype=np.float64)
    if puntos_seguimiento is not None and len(puntos_seguimiento) > 0:
        Ps = np.asarray(puntos_seguimiento, dtype=np.float64)
        Rs = np.asarray(rasgos_seguimiento, dtype=np.float64)
        P_todo = np.vstack([P, Ps])
        R_todo = np.vstack([R, Rs])
        pesos = np.concatenate([np.full(len(P), PESO_FIJOS), np.ones(len(Ps))])
    else:
        P_todo, R_todo = P, R
        pesos = np.ones(len(P))

    media = R_todo.mean(axis=0)
    desv = R_todo.std(axis=0)
    desv[desv < 1e-6] = 1.0

    X_todo = _matriz(R_todo, media, desv)
    coef_x = _ridge(X_todo, P_todo[:, 0], LAMBDA, pesos)
    coef_y = _ridge(X_todo, P_todo[:, 1], LAMBDA, pesos)

    # Error dejando fuera cada punto fijo (el seguimiento se mantiene)
    errores = []
    n_fijos = len(P)
    if n_fijos >= 4:
        X_fijos = X_todo[:n_fijos]
        for i in range(n_fijos):
            mascara = np.ones(len(P_todo), dtype=bool)
            mascara[i] = False
            cx = _ridge(X_todo[mascara], P_todo[mascara, 0], LAMBDA, pesos[mascara])
            cy = _ridge(X_todo[mascara], P_todo[mascara, 1], LAMBDA, pesos[mascara])
            ex = X_fijos[i] @ cx - P[i, 0]
            ey = X_fijos[i] @ cy - P[i, 1]
            errores.append(float(np.hypot(ex, ey)))
    error_px = float(np.median(errores)) if errores else 0.0

    # Error del ajuste sobre el seguimiento (orientativo)
    error_seg = 0.0
    if len(P_todo) > n_fijos:
        Xs = X_todo[n_fijos:]
        ex = Xs @ coef_x - P_todo[n_fijos:, 0]
        ey = Xs @ coef_y - P_todo[n_fijos:, 1]
        error_seg = float(np.median(np.hypot(ex, ey)))

    modelo = {
        "media": media.tolist(),
        "desv": desv.tolist(),
        "coef_x": coef_x.tolist(),
        "coef_y": coef_y.tolist(),
        "monitor": list(monitor),
        "puntos": P.tolist(),
        "n_muestras": int(len(P_todo)),
        "error_px": round(error_px),
        "error_seguimiento_px": round(error_seg),
    }
    logger.info(f"Calibración: {n_fijos} puntos fijos + {len(P_todo) - n_fijos} de "
                f"seguimiento, error mediano {error_px:.0f} px "
                f"(seguimiento {error_seg:.0f} px)")
    return modelo


def predecir(modelo: dict, rasgos):
    """Punto de pantalla (x, y) para un vector de rasgos, recortado al monitor."""
    r = (np.asarray(rasgos, dtype=np.float64) - modelo["media"]) / modelo["desv"]
    x_ = np.concatenate([[1.0], r])
    x = float(x_ @ modelo["coef_x"])
    y = float(x_ @ modelo["coef_y"])
    x1, y1, x2, y2 = modelo["monitor"]
    return min(max(x, x1), x2 - 1), min(max(y, y1), y2 - 1)


def es_valido(modelo, n_rasgos=None) -> bool:
    if not (isinstance(modelo, dict) and "coef_x" in modelo and "coef_y" in modelo
            and "monitor" in modelo and len(modelo["monitor"]) == 4):
        return False
    if n_rasgos is not None and len(modelo["coef_x"]) != n_rasgos + 1:
        return False   # calibración de una versión anterior con otros rasgos
    return True
