"""Estabilidad de los rasgos de la mirada mientras se mira un punto fijo.
Compara varias formas de calcular la posición relativa del iris:
  A) iris MediaPipe respecto a las esquinas del ojo (lo actual)
  B) iris MediaPipe respecto a la media de los 16 puntos del contorno del ojo
  C) iris afinado respecto a las esquinas
  D) blendshapes de mirada (bx, by)
  E) iris respecto a un marco rígido de la cara (puente de la nariz y sienes)
Imprime el temblor entre fotogramas y la dispersión total en «píxeles de
pantalla equivalentes» (suponiendo ±0,12 de gx para ±960 px)."""
import os
import sys
import time
import math

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
SALIDA = os.path.dirname(os.path.abspath(__file__))
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)
os.environ.setdefault("OPENCV_VIDEOIO_MSMF_ENABLE_HW_TRANSFORMS", "0")

import logging
logging.basicConfig(level=logging.WARNING)

import cv2
import numpy as np
import tkinter

from src.task_killer import TaskKiller
from src.camera_manager import CameraManager
from src.detectors import FaceMesh
from src.detectors.mirada import (IRIS_DER, IRIS_IZQ, ESQUINAS_DER, ESQUINAS_IZQ,
                                  BS_LOOK_IN_L, BS_LOOK_OUT_L, BS_LOOK_IN_R, BS_LOOK_OUT_R,
                                  BS_LOOK_DOWN_L, BS_LOOK_UP_L, BS_LOOK_DOWN_R, BS_LOOK_UP_R)

CONTORNO_DER = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
CONTORNO_IZQ = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
MARCO = [6, 197, 195, 5, 168, 234, 454, 127, 356]   # puente de la nariz y sienes
PX_POR_UNIDAD_X = 960 / 0.12
PX_POR_UNIDAD_Y = 540 / 0.06

DURACION = float(sys.argv[1]) if len(sys.argv) > 1 else 6.0
CUENTA = 6

root = tkinter.Tk()
root.title("Gestik prueba rasgos")
root.overrideredirect(True)
root.attributes("-topmost", True)
W, H = root.winfo_screenwidth(), root.winfo_screenheight()
root.geometry(f"{W}x{H}+0+0")
lienzo = tkinter.Canvas(root, width=W, height=H, bg="#1B2422", bd=0, highlightthickness=0)
lienzo.pack()
texto = lienzo.create_text(W // 2, int(H * 0.38), text="", fill="#F1ECE2",
                           font=("Segoe UI", 28), justify="center")
r = 22
lienzo.create_oval(W / 2 - r, H / 2 - r, W / 2 + r, H / 2 + r, fill="#F0B455", outline="")
lienzo.create_oval(W / 2 - 4, H / 2 - 4, W / 2 + 4, H / 2 + 4, fill="#1B2422", outline="")

TaskKiller().start()
cam = CameraManager()
fm = FaceMesh()

filas = []
brillo = []
estado = {"fase": "espera", "t0": time.time(), "ultimo": -1, "ultimo_n": -1}


def medir(lm, fino, bs, imagen):
    ancho, alto = imagen.shape[1], imagen.shape[0]
    P = lambda i: (lm[i].x * ancho, lm[i].y * alto)
    fila = {}
    for ojo, iris, esq, cont in (("der", IRIS_DER, ESQUINAS_DER, CONTORNO_DER),
                                 ("izq", IRIS_IZQ, ESQUINAS_IZQ, CONTORNO_IZQ)):
        ix = np.mean([P(i)[0] for i in iris]); iy = np.mean([P(i)[1] for i in iris])
        e1, e2 = P(esq[0]), P(esq[1])
        w = math.hypot(e1[0] - e2[0], e1[1] - e2[1])
        cx, cy = (e1[0] + e2[0]) / 2, (e1[1] + e2[1]) / 2
        kx = np.mean([P(i)[0] for i in cont]); ky = np.mean([P(i)[1] for i in cont])
        f = fino.get(ojo)
        fx, fy = (f["x"], f["y"]) if f and f["ok"] else (ix, iy)
        fila[f"A_{ojo}"] = ((ix - cx) / w, (iy - cy) / w)
        fila[f"B_{ojo}"] = ((ix - kx) / w, (iy - ky) / w)
        fila[f"C_{ojo}"] = ((fx - cx) / w, (fy - cy) / w)
        fila[f"w_{ojo}"] = w
        fila[f"r_{ojo}"] = f["r"] if f else 0
    # marco rígido: centro de la cara y su escala (distancia entre sienes)
    mx = np.mean([P(i)[0] for i in MARCO]); my = np.mean([P(i)[1] for i in MARCO])
    s = math.hypot(P(234)[0] - P(454)[0], P(234)[1] - P(454)[1])
    for ojo, iris in (("der", IRIS_DER), ("izq", IRIS_IZQ)):
        ix = np.mean([P(i)[0] for i in iris]); iy = np.mean([P(i)[1] for i in iris])
        fila[f"E_{ojo}"] = ((ix - mx) / s * 4, (iy - my) / s * 4)   # ×4 ≈ escala de ojo
    bx = ((bs[BS_LOOK_IN_L] - bs[BS_LOOK_OUT_L]) + (bs[BS_LOOK_OUT_R] - bs[BS_LOOK_IN_R])) / 2
    by = ((bs[BS_LOOK_DOWN_L] - bs[BS_LOOK_UP_L]) + (bs[BS_LOOK_DOWN_R] - bs[BS_LOOK_UP_R])) / 2
    fila["D"] = (bx * 0.2, by * 0.12)   # escala aproximada a unidades de gx/gy
    # brillo de la zona de los ojos
    x1 = int(min(P(33)[0], P(263)[0]) - 20); x2 = int(max(P(33)[0], P(263)[0]) + 20)
    y1 = int(min(P(159)[1], P(386)[1]) - 25); y2 = int(max(P(145)[1], P(374)[1]) + 25)
    roi = imagen[max(0, y1):y2, max(0, x1):x2]
    brillo.append(float(np.mean(cv2.cvtColor(roi, cv2.COLOR_RGB2GRAY))) if roi.size else 0)
    return fila


def bucle():
    ahora = time.time()
    fid = cam.get_frame_id()
    if fid != estado["ultimo"] and fid > 0:
        estado["ultimo"] = fid
        fm.detect_frame(cam.get_raw_frame())
    if estado["fase"] == "espera":
        if fid > 0:
            estado["fase"] = "cuenta"; estado["t0"] = ahora
    elif estado["fase"] == "cuenta":
        rest = CUENTA - (ahora - estado["t0"])
        lienzo.itemconfigure(texto, text=f"Mira el punto amarillo sin mover la cabeza\n{int(rest) + 1}")
        if rest <= 0:
            estado["fase"] = "medida"; estado["t0"] = ahora
            lienzo.itemconfigure(texto, text="Sigue mirando el punto…")
    elif estado["fase"] == "medida":
        if fm.n_frames != estado["ultimo_n"] and fm.mp_landmarks is not None:
            estado["ultimo_n"] = fm.n_frames
            try:
                filas.append(medir(fm.mp_landmarks, dict(fm.mirada.fino), fm.blendshapes_buffer[-1],
                                   cam.get_raw_frame()))
            except Exception as e:
                print("error medir", e)
        if ahora - estado["t0"] >= DURACION:
            lienzo.itemconfigure(texto, text="Gracias")
            root.after(300, terminar)
            return
    root.after(5, bucle)


def terminar():
    root.destroy()
    print(f"{len(filas)} fotogramas; caras detectadas {fm.n_frames}; fotogramas de cámara {cam.get_frame_id()}")
    if not filas:
        sys.stdout.flush(); TaskKiller().exit(); return
    print(f"brillo medio de la zona de los ojos: {np.mean(brillo):.0f}/255")
    claves = ["A_der", "A_izq", "B_der", "B_izq", "C_der", "C_izq", "E_der", "E_izq", "D"]
    print(f"{'rasgo':8} {'temblor x':>10} {'temblor y':>10} {'drift x':>9} {'drift y':>9}   (px de pantalla equivalentes)")
    for k in claves:
        v = np.array([f[k] for f in filas])
        j = np.std(np.diff(v, axis=0), axis=0)
        d = np.std(v, axis=0)
        print(f"{k:8} {j[0]*PX_POR_UNIDAD_X:10.1f} {j[1]*PX_POR_UNIDAD_Y:10.1f} {d[0]*PX_POR_UNIDAD_X:9.1f} {d[1]*PX_POR_UNIDAD_Y:9.1f}")
    # media de los dos ojos para A y B
    for k in ("A", "B", "C", "E"):
        v = (np.array([f[k + "_der"] for f in filas]) + np.array([f[k + "_izq"] for f in filas])) / 2
        j = np.std(np.diff(v, axis=0), axis=0); d = np.std(v, axis=0)
        print(f"{k+'_media':8} {j[0]*PX_POR_UNIDAD_X:10.1f} {j[1]*PX_POR_UNIDAD_Y:10.1f} {d[0]*PX_POR_UNIDAD_X:9.1f} {d[1]*PX_POR_UNIDAD_Y:9.1f}")
    w = np.array([f["w_der"] for f in filas])
    print(f"ancho del ojo derecho: {w.mean():.1f} px (±{w.std():.2f}); radio del iris: {np.mean([f['r_der'] for f in filas]):.1f} px")
    im0 = cam.get_raw_frame(); fino = dict(fm.mirada.fino)
    if fino:
        im = cv2.cvtColor(im0, cv2.COLOR_RGB2BGR)
        xs = [d["mp"][0] for d in fino.values()]; ys = [d["mp"][1] for d in fino.values()]
        for d in fino.values():
            cv2.circle(im, (int(round(d["mp"][0])), int(round(d["mp"][1]))), int(round(d["r"])), (255, 120, 0), 1)
            if d["ok"]:
                cv2.circle(im, (int(round(d["x"])), int(round(d["y"]))), int(round(d["r"])), (0, 220, 0), 1)
        x1, x2 = int(min(xs) - 90), int(max(xs) + 90); y1, y2 = int(min(ys) - 50), int(max(ys) + 50)
        rec = cv2.resize(im[max(0, y1):y2, max(0, x1):x2], None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
        cv2.imwrite(os.path.join(SALIDA, "ojos_iris.png"), rec)
    sys.stdout.flush()
    TaskKiller().exit()


root.after(50, bucle)
root.mainloop()
