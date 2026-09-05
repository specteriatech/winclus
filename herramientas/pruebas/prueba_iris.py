"""Mide el temblor del centro del iris (MediaPipe frente al afinado sobre la
imagen grande) mientras la persona mira un punto fijo en pantalla.
Guarda un recorte de los ojos con los dos círculos dibujados."""
import os
import sys
import time

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

DURACION = float(sys.argv[1]) if len(sys.argv) > 1 else 6.0
CUENTA = 4

root = tkinter.Tk()
root.title("Gestik prueba iris")
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

series = {"der": {"mp": [], "fino": [], "ok": [], "r": []}, "izq": {"mp": [], "fino": [], "ok": [], "r": []}}
estado = {"fase": "espera", "t0": time.time(), "ultimo": -1, "ultimo_n": -1, "imagen": None, "fino": {}}


def bucle():
    ahora = time.time()
    fid = cam.get_frame_id()
    if fid != estado["ultimo"] and fid > 0:
        estado["ultimo"] = fid
        fm.detect_frame(cam.get_raw_frame())
    if estado["fase"] == "espera":
        if fid == 0:
            lienzo.itemconfigure(texto, text="Abriendo la cámara…")
        else:
            estado["fase"] = "cuenta"
            estado["t0"] = ahora
    elif estado["fase"] == "cuenta":
        rest = CUENTA - (ahora - estado["t0"])
        lienzo.itemconfigure(texto, text=f"Mira el punto amarillo sin mover la cabeza\n{int(rest) + 1}")
        if rest <= 0:
            estado["fase"] = "medida"
            estado["t0"] = ahora
            lienzo.itemconfigure(texto, text="Sigue mirando el punto…")
    elif estado["fase"] == "medida":
        if fm.n_frames != estado["ultimo_n"] and fm.mirada.fino:
            estado["ultimo_n"] = fm.n_frames
            for ojo in ("der", "izq"):
                d = fm.mirada.fino.get(ojo)
                if d is None:
                    continue
                series[ojo]["mp"].append(d["mp"])
                series[ojo]["fino"].append((d["x"], d["y"]))
                series[ojo]["ok"].append(d["ok"])
                series[ojo]["r"].append(d["r"])
            estado["imagen"] = cam.get_raw_frame()
            estado["fino"] = dict(fm.mirada.fino)
        if ahora - estado["t0"] >= DURACION:
            lienzo.itemconfigure(texto, text="Gracias")
            root.after(300, terminar)
            return
    root.after(5, bucle)


def terminar():
    root.destroy()
    for ojo in ("der", "izq"):
        mp_ = np.array(series[ojo]["mp"])
        fi = np.array(series[ojo]["fino"])
        ok = np.array(series[ojo]["ok"])
        if len(mp_) < 5:
            print(ojo, "sin datos")
            continue
        j_mp = np.std(np.diff(mp_, axis=0), axis=0)
        j_fi = np.std(np.diff(fi, axis=0), axis=0)
        s_mp = np.std(mp_, axis=0)
        s_fi = np.std(fi, axis=0)
        print(f"ojo {ojo}: {len(mp_)} fotogramas en {DURACION:.0f} s, radio iris {np.mean(series[ojo]['r']):.1f} px, afinado aceptado {ok.mean()*100:.0f}%")
        print(f"   salto entre fotogramas  MediaPipe x {j_mp[0]:.3f} y {j_mp[1]:.3f} | afinado x {j_fi[0]:.3f} y {j_fi[1]:.3f} px")
        print(f"   dispersión total        MediaPipe x {s_mp[0]:.3f} y {s_mp[1]:.3f} | afinado x {s_fi[0]:.3f} y {s_fi[1]:.3f} px")
        print(f"   diferencia media afinado-MediaPipe: {np.mean(fi - mp_, axis=0).round(2)} px")

    im0 = estado["imagen"]
    fino = estado["fino"]
    if im0 is not None and fino:
        im = cv2.cvtColor(im0, cv2.COLOR_RGB2BGR)
        xs = [d["mp"][0] for d in fino.values()]
        ys = [d["mp"][1] for d in fino.values()]
        for d in fino.values():
            cv2.circle(im, (int(round(d["mp"][0])), int(round(d["mp"][1]))), int(round(d["r"])), (255, 120, 0), 1)
            cv2.drawMarker(im, (int(round(d["mp"][0])), int(round(d["mp"][1]))), (255, 120, 0), cv2.MARKER_CROSS, 6, 1)
            if d["ok"]:
                cv2.circle(im, (int(round(d["x"])), int(round(d["y"]))), int(round(d["r"])), (0, 220, 0), 1)
                cv2.drawMarker(im, (int(round(d["x"])), int(round(d["y"]))), (0, 220, 0), cv2.MARKER_CROSS, 6, 1)
        x1, x2 = int(min(xs) - 90), int(max(xs) + 90)
        y1, y2 = int(min(ys) - 50), int(max(ys) + 50)
        rec = im[max(0, y1):y2, max(0, x1):x2]
        rec = cv2.resize(rec, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
        cv2.imwrite(os.path.join(SALIDA, "ojos_iris.png"), rec)
        print("guardado ojos_iris.png", rec.shape)
    sys.stdout.flush()
    TaskKiller().exit()


root.after(50, bucle)
root.mainloop()
