"""Analiza y reajusta una calibración de ojos a partir de sus datos crudos.

Cada calibración guarda sus muestras en configs/<perfil>/calibracion_datos.json.
Con este guion se puede, sin volver a calibrar:
- ver el error por punto fijo y en los puntos de comprobación,
- probar otras regularizaciones o quitar grupos de rasgos,
- reajustar y escribir el modelo nuevo en cursor.json (--aplicar).

Uso (desde la raíz del proyecto):
    .venv\\Scripts\\python.exe herramientas\\reajustar_calibracion.py [perfil] [--aplicar]
"""
import json
import sys
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from src.detectors import calibracion as cal  # noqa: E402
from src.detectors.mirada import NOMBRES_RASGOS  # noqa: E402

GRUPOS = {
    "sin blendshapes": ("bx", "by"),
    "sin cuadráticos": ("gx2", "gy2", "gxgy"),
    "sin cúbicos": ("gx3", "gy3"),
    "sin apertura": ("ap_der", "ap_izq"),
    "sin párpados": ("gyp_der", "gyp_izq"),
    "solo ojo derecho": ("gx_izq", "gy_izq", "gyp_izq", "ap_izq"),
    "solo ojo izquierdo": ("gx_der", "gy_der", "gyp_der", "ap_der"),
}


def cargar(perfil):
    ruta = RAIZ / "configs" / perfil / "calibracion_datos.json"
    with open(ruta, encoding="utf-8") as f:
        return json.load(f), ruta


def evaluar(datos, quitar=(), lambdas=None):
    idx = [i for i, n in enumerate(NOMBRES_RASGOS) if n not in quitar]
    sel = lambda filas: [[r[i] for i in idx] for r in filas]
    if lambdas is not None:
        cal.LAMBDAS = lambdas
    modelo = cal.ajustar(datos["puntos_fijos"], sel(datos["rasgos_fijos"]), datos["monitor"],
                         datos["seguimiento_puntos"], sel(datos["seguimiento_rasgos"]))
    errores = []
    for c in datos["comprobacion"]:
        px, py = cal.predecir(modelo, sel([c["rasgos"]])[0])
        errores.append(float(np.hypot(px - c["x"], py - c["y"])))
    return modelo, errores, idx


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    perfil = args[0] if args else json.load(open(RAIZ / "configs" / "default.json"))["default"]
    aplicar = "--aplicar" in sys.argv
    datos, ruta = cargar(perfil)
    print(f"Datos de {ruta} ({datos['fecha']}): {len(datos['puntos_fijos'])} puntos fijos, "
          f"{len(datos['seguimiento_puntos'])} de seguimiento, {len(datos['comprobacion'])} de comprobación, "
          f"retraso {datos.get('retraso_ms')} ms")

    lambdas_base = cal.LAMBDAS
    modelo, errores, _ = evaluar(datos)
    print(f"\nModelo completo: lambda {modelo['lambda']}, error LOO {modelo['error_px']} px, "
          f"comprobación {np.round(errores).astype(int).tolist()} → mediana {np.median(errores):.0f} px")
    print("Error por punto fijo (LOO):")
    for (x, y), e in zip(modelo["puntos"], modelo["errores_fijos"]):
        print(f"   ({x:6.0f}, {y:5.0f}) → {e:4d} px")

    print("\nVariantes (mediana en comprobación / error LOO):")
    for nombre, quitar in GRUPOS.items():
        cal.LAMBDAS = lambdas_base
        m, e, _ = evaluar(datos, quitar)
        print(f"   {nombre:22} {np.median(e):5.0f} px / {m['error_px']:4d} px  (lambda {m['lambda']})")
    for lam in (0.02, 0.1, 0.5, 2.0, 8.0, 30.0):
        m, e, _ = evaluar(datos, (), lambdas=(lam,))
        print(f"   lambda fijo {lam:<10} {np.median(e):5.0f} px / {m['error_px']:4d} px")
    cal.LAMBDAS = lambdas_base

    if datos.get("cabeza_muestras") and datos.get("cabezas_fijos"):
        ref = np.median(np.asarray(datos["cabezas_fijos"]), axis=0)
        m2 = cal.ajustar_cabeza(modelo, ref, [m["cabeza"] for m in datos["cabeza_muestras"]],
                                [m["rasgos"] for m in datos["cabeza_muestras"]], datos["objetivo_cabeza"])
        print(f"\nCabeza: movimiento {m2.get('cabeza_movimiento')}, coef {np.round(m2.get('cabeza_coef'), 1).tolist()}, "
              f"mejora {m2.get('cabeza_mejora_px')}")

    if aplicar:
        cfg = RAIZ / "configs" / perfil / "cursor.json"
        c = json.load(open(cfg, encoding="utf-8"))
        viejo = c.get("ojos_calibracion") or {}
        for k in ("sesgo", "cabeza_ref", "cabeza_coef", "retraso_ms", "error_real_px", "errores_comprobacion"):
            if k in viejo:
                modelo[k] = viejo[k]
        modelo["error_real_px"] = round(float(np.median(errores)))
        c["ojos_calibracion"] = modelo
        with open(cfg, "w", encoding="utf-8") as f:
            json.dump(c, f, indent=4, separators=(", ", ": "))
        print(f"\nModelo reajustado escrito en {cfg}")


if __name__ == "__main__":
    main()
