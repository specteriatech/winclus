"""Calibración del modo directo: de los rasgos de la mirada al punto de la pantalla.

La persona mira trece puntos fijos y después sigue con la vista un punto que
recorre la pantalla (seguimiento suave): eso da cientos de muestras bien
repartidas, que es lo que más mejora la precisión según la literatura de
seguimiento ocular por webcam. Con todo ello se ajusta una regresión lineal
con regularización (ridge) para x y otra para y sobre los rasgos de
detectors/mirada.py (por ojo, párpados, blendshapes y términos no lineales).

Cosas que se hacen solas para que el ajuste sea lo mejor posible:
- La regularización se elige por validación cruzada «dejando un punto
  fuera» sobre los puntos fijos (se prueban varios valores y gana el que
  menos error da en puntos no usados para ajustar).
- Los puntos fijos que se apartan mucho del resto (la persona parpadeó,
  miró a otro sitio) se descartan y se vuelve a ajustar.
- Las muestras del seguimiento con residuo muy grande (sacadas para alcanzar
  el punto) también se descartan.
- El retraso entre el punto móvil y la mirada se estima de los propios
  datos (estimar_retraso).

Los rasgos se normalizan (media y desviación de las muestras) para que la
regularización trate a todos por igual. El modelo se guarda en cursor.json y
es solo números: se puede evaluar en cualquier hilo.
"""

import logging

import numpy as np

logger = logging.getLogger("Calibracion")

LAMBDAS = (0.05, 0.15, 0.5, 1.5, 5.0)   # candidatos de regularización
PESO_FIJOS = 8.0     # cada punto fijo (mediana de 30 muestras) pesa como 8 de seguimiento
MAX_DESCARTES_FIJOS = 3


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


def _error_loo(X, P, pesos, n_fijos, lam):
    """Error dejando fuera cada punto fijo (el seguimiento se mantiene)."""
    errores = []
    for i in range(n_fijos):
        mascara = np.ones(len(P), dtype=bool)
        mascara[i] = False
        cx = _ridge(X[mascara], P[mascara, 0], lam, pesos[mascara])
        cy = _ridge(X[mascara], P[mascara, 1], lam, pesos[mascara])
        errores.append(float(np.hypot(X[i] @ cx - P[i, 0], X[i] @ cy - P[i, 1])))
    return np.asarray(errores)


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
    else:
        Ps = np.zeros((0, 2))
        Rs = np.zeros((0, R.shape[1]))

    descartados = []
    for _ in range(MAX_DESCARTES_FIJOS + 1):
        P_todo = np.vstack([P, Ps])
        R_todo = np.vstack([R, Rs])
        pesos = np.concatenate([np.full(len(P), PESO_FIJOS), np.ones(len(Ps))])
        media = R_todo.mean(axis=0)
        desv = R_todo.std(axis=0)
        desv[desv < 1e-9] = 1.0
        X = _matriz(R_todo, media, desv)
        n_fijos = len(P)

        # Elegir la regularización por validación cruzada
        mejor = None
        for lam in LAMBDAS:
            e = _error_loo(X, P_todo, pesos, n_fijos, lam) if n_fijos >= 4 else np.array([0.0])
            med = float(np.median(e))
            if mejor is None or med < mejor[0]:
                mejor = (med, lam, e)
        error_med, lam, errores = mejor

        # Descartar un punto fijo claramente malo y repetir
        if n_fijos > 6 and len(descartados) < MAX_DESCARTES_FIJOS:
            peor = int(np.argmax(errores))
            if errores[peor] > max(2.5 * error_med, 150.0):
                descartados.append(P[peor].tolist())
                logger.info(f"Punto fijo descartado {P[peor]} con error {errores[peor]:.0f} px")
                P = np.delete(P, peor, axis=0)
                R = np.delete(R, peor, axis=0)
                continue
        break

    coef_x = _ridge(X, P_todo[:, 0], lam, pesos)
    coef_y = _ridge(X, P_todo[:, 1], lam, pesos)

    # Descartar muestras de seguimiento con residuo muy grande y reajustar
    error_seg = 0.0
    n_seg_descartadas = 0
    if len(Ps) > 20:
        Xs = X[n_fijos:]
        res = np.hypot(Xs @ coef_x - Ps[:, 0], Xs @ coef_y - Ps[:, 1])
        limite = max(3.0 * float(np.median(res)), 80.0)
        keep = res <= limite
        n_seg_descartadas = int((~keep).sum())
        if n_seg_descartadas > 0:
            mascara = np.concatenate([np.ones(n_fijos, dtype=bool), keep])
            coef_x = _ridge(X[mascara], P_todo[mascara, 0], lam, pesos[mascara])
            coef_y = _ridge(X[mascara], P_todo[mascara, 1], lam, pesos[mascara])
            errores = _error_loo(X[mascara], P_todo[mascara], pesos[mascara], n_fijos, lam)
            error_med = float(np.median(errores))
            Xs, Ps_k = Xs[keep], Ps[keep]
        else:
            Ps_k = Ps
        error_seg = float(np.median(np.hypot(Xs @ coef_x - Ps_k[:, 0], Xs @ coef_y - Ps_k[:, 1])))

    modelo = {
        "media": media.tolist(),
        "desv": desv.tolist(),
        "coef_x": coef_x.tolist(),
        "coef_y": coef_y.tolist(),
        "monitor": list(monitor),
        "puntos": P.tolist(),
        "lambda": lam,
        "n_muestras": int(len(P) + len(Ps) - n_seg_descartadas),
        "descartados": descartados,
        "error_px": round(error_med),
        "errores_fijos": [round(float(e)) for e in errores],
        "error_seguimiento_px": round(error_seg),
    }
    logger.info(f"Calibración: {len(P)} puntos fijos ({len(descartados)} descartados) + "
                f"{len(Ps) - n_seg_descartadas} de seguimiento ({n_seg_descartadas} descartadas), "
                f"lambda {lam}, error LOO mediano {error_med:.0f} px, seguimiento {error_seg:.0f} px")
    return modelo


def estimar_retraso(historial, muestras, retrasos_s=(0.04, 0.08, 0.12, 0.16, 0.20, 0.25)):
    """Retraso de la mirada respecto al punto móvil que mejor explica los
    datos. historial: lista de (t, x, y) del punto; muestras: lista de
    (t, rasgos). Devuelve (retraso, puntos, rasgos) ya emparejados."""
    if len(historial) < 10 or len(muestras) < 20:
        return 0.10, [], []
    H = np.asarray(historial, dtype=np.float64)
    T = np.asarray([m[0] for m in muestras], dtype=np.float64)
    R = np.asarray([m[1] for m in muestras], dtype=np.float64)
    media = R.mean(axis=0)
    desv = R.std(axis=0)
    desv[desv < 1e-9] = 1.0
    X = _matriz(R, media, desv)
    mejor = None
    for retraso in retrasos_s:
        tt = T - retraso
        dentro = (tt >= H[0, 0]) & (tt <= H[-1, 0])
        if dentro.sum() < 20:
            continue
        px = np.interp(tt[dentro], H[:, 0], H[:, 1])
        py = np.interp(tt[dentro], H[:, 0], H[:, 2])
        Xd = X[dentro]
        cx = _ridge(Xd, px, 1.0)
        cy = _ridge(Xd, py, 1.0)
        err = float(np.median(np.hypot(Xd @ cx - px, Xd @ cy - py)))
        if mejor is None or err < mejor[0]:
            mejor = (err, retraso, list(zip(px, py)), R[dentro].tolist())
    if mejor is None:
        return 0.10, [], []
    logger.info(f"Retraso de la mirada estimado: {mejor[1] * 1000:.0f} ms (error {mejor[0]:.0f} px)")
    return mejor[1], mejor[2], mejor[3]


def predecir(modelo: dict, rasgos, con_sesgo: bool = True, cabeza=None):
    """Punto de pantalla (x, y) para un vector de rasgos, recortado al monitor.
    `sesgo` es la corrección rápida del centro (ver gui/calibracion.py).
    `cabeza` es la postura actual (ver FaceMesh.calc_cabeza); si el modelo
    tiene compensación de cabeza, se aplica."""
    r = (np.asarray(rasgos, dtype=np.float64) - modelo["media"]) / modelo["desv"]
    x_ = np.concatenate([[1.0], r])
    x = float(x_ @ modelo["coef_x"])
    y = float(x_ @ modelo["coef_y"])
    if con_sesgo:
        sx, sy = modelo.get("sesgo", (0.0, 0.0))
        x += sx
        y += sy
    if cabeza is not None and modelo.get("cabeza_coef") and modelo.get("cabeza_ref"):
        dx, dy = correccion_cabeza(modelo, cabeza)
        x += dx
        y += dy
    x1, y1, x2, y2 = modelo["monitor"]
    return min(max(x, x1), x2 - 1), min(max(y, y1), y2 - 1)


# ------------------------------------------------ compensación de cabeza --
# Se usan la guiñada y el cabeceo (grados) y la posición x, y (cm).
CABEZA_IDX = (0, 1, 3, 4)
CABEZA_MAX_PX = 400          # tope de la corrección por seguridad
CABEZA_MOV_MIN = (0.8, 0.8, 0.4, 0.4)   # movimiento mínimo (desv. típica) para aprender


def _delta_cabeza(modelo, cabeza):
    ref = modelo["cabeza_ref"]
    return np.array([cabeza[i] - ref[i] for i in CABEZA_IDX], dtype=np.float64)


def correccion_cabeza(modelo, cabeza):
    d = _delta_cabeza(modelo, cabeza)
    C = np.asarray(modelo["cabeza_coef"], dtype=np.float64)   # 2 x 4
    dx, dy = C @ d
    return (float(np.clip(dx, -CABEZA_MAX_PX, CABEZA_MAX_PX)),
            float(np.clip(dy, -CABEZA_MAX_PX, CABEZA_MAX_PX)))


def ajustar_cabeza(modelo, cabeza_ref, muestras_cabeza, muestras_rasgos, objetivo) -> dict:
    """Aprende cuánto se desplaza el punto previsto cuando la cabeza gira o
    se mueve, mirando un objetivo fijo. muestras_cabeza: posturas; muestras_
    rasgos: rasgos simultáneos; objetivo: (x, y) que se miraba. Si la cabeza
    apenas se movió, no se aprende nada (coeficientes cero)."""
    nuevo = dict(modelo)
    nuevo["cabeza_ref"] = [float(v) for v in cabeza_ref]
    nuevo["cabeza_coef"] = [[0.0] * 4, [0.0] * 4]
    if len(muestras_cabeza) < 30:
        return nuevo
    D = np.asarray([[c[i] - cabeza_ref[i] for i in CABEZA_IDX] for c in muestras_cabeza],
                   dtype=np.float64)
    movimiento = D.std(axis=0)
    activos = movimiento >= np.asarray(CABEZA_MOV_MIN)
    if not activos.any():
        logger.info("Compensación de cabeza: sin movimiento suficiente, no se aprende")
        return nuevo
    # Residuo del modelo de ojos mientras se miraba el objetivo
    res = []
    for r in muestras_rasgos:
        px, py = predecir(modelo, r, con_sesgo=False)
        res.append((objetivo[0] - px, objetivo[1] - py))
    res = np.asarray(res)
    Da = D[:, activos]
    # ridge sin término independiente (la referencia ya está centrada)
    lam = 0.02 * len(Da)
    A = Da.T @ Da + lam * np.eye(Da.shape[1]) * np.mean(Da.var(axis=0))
    cx = np.linalg.solve(A, Da.T @ res[:, 0])
    cy = np.linalg.solve(A, Da.T @ res[:, 1])
    coef = np.zeros((2, 4))
    coef[0, activos] = cx
    coef[1, activos] = cy
    # topes plausibles: 150 px por grado, 150 px por cm
    tope = np.array([150.0, 150.0, 150.0, 150.0])
    coef = np.clip(coef, -tope, tope)
    nuevo["cabeza_coef"] = coef.tolist()
    nuevo["cabeza_movimiento"] = movimiento.round(2).tolist()
    antes = float(np.median(np.hypot(res[:, 0], res[:, 1])))
    despues = float(np.median(np.hypot(res[:, 0] - D @ coef[0], res[:, 1] - D @ coef[1])))
    nuevo["cabeza_mejora_px"] = [round(antes), round(despues)]
    logger.info(f"Compensación de cabeza: movimiento {movimiento.round(2)}, "
                f"coef {coef.round(1).tolist()}, error con cabeza movida {antes:.0f} -> {despues:.0f} px")
    return nuevo


SESGO_MAX_PX = 350


def corregir_centro(modelo: dict, rasgos_centro, centro) -> dict:
    """Corrección de un punto: la persona mira el centro; la diferencia entre
    el punto previsto y el centro real se guarda como sesgo (desplazamiento
    fijo). Sirve para cuando la cabeza se movió un poco tras calibrar."""
    px, py = predecir(modelo, rasgos_centro, con_sesgo=False)
    sx = float(np.clip(centro[0] - px, -SESGO_MAX_PX, SESGO_MAX_PX))
    sy = float(np.clip(centro[1] - py, -SESGO_MAX_PX, SESGO_MAX_PX))
    nuevo = dict(modelo)
    nuevo["sesgo"] = [sx, sy]
    logger.info(f"Centro corregido: sesgo ({sx:.0f}, {sy:.0f}) px")
    return nuevo


def es_valido(modelo, n_rasgos=None) -> bool:
    if not (isinstance(modelo, dict) and "coef_x" in modelo and "coef_y" in modelo
            and "monitor" in modelo and len(modelo["monitor"]) == 4):
        return False
    if n_rasgos is not None and len(modelo["coef_x"]) != n_rasgos + 1:
        return False   # calibración de una versión anterior con otros rasgos
    return True
