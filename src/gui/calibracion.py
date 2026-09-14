"""Ventana de calibración del modo directo.

Ocupa toda la pantalla donde está el puntero. Fases:

0. Comprobación previa: los ojos agrandados, con aviso de luz y distancia.
1. Puntos fijos, uno a uno (9, 13 o 25 según «calib_modo»): hay un momento
   para llegar con la vista (el punto se encoge) y luego se miden los rasgos.
2. Seguimiento suave (no en el modo rápido): un punto recorre la pantalla en
   zigzag; el retraso de la mirada se estima de los propios datos.
3. Comprobación: cuatro puntos que no entran en el ajuste dan el error real.
4. Cabeza (opcional, «calib_cabeza»): mirar el centro moviendo un poco la
   cabeza para aprender a compensar sus giros.

Con «solo_comprobar» solo se hace la fase 3 sobre el modelo ya guardado.
Otras opciones: «calib_lento» (más tiempo por punto), «calib_punto_grande»
y «ojos_usar» (los dos ojos, solo el derecho o solo el izquierdo).

No hace falta pulsar nada; con Escape se cancela. Al terminar se ajusta el
modelo (detectors/calibracion.py), se guarda en el perfil junto con las
muestras crudas (calibracion_datos.json) y se avisa a quien la abrió.
"""

import logging
import math
import time
import tkinter

import numpy as np
import win32api

from src import estilo
from src.config_manager import ConfigManager
from src.controllers import MouseController
from src.detectors import FaceMesh
from src.detectors.calibracion import ajustar, corregir_centro, es_valido, estimar_retraso

logger = logging.getLogger("VentanaCalibracion")

MARGEN = 0.08          # fracción de la pantalla que se deja libre en los bordes
ESPERA_MS = 1200       # tiempo para llegar con la vista al punto
MEDIDA_MS = 900        # tiempo midiendo en cada punto fijo
SEGUIMIENTO_S = 22.0   # duración del recorrido en zigzag
PREVIA_OK_S = 3.0      # con luz y distancia bien, la comprobación previa dura esto
PREVIA_MAX_S = 12.0    # si no, se sigue igualmente pasado este tiempo
TICK_MS = 33
RADIO_GRANDE = 34
RADIO_PEQUENO = 12
FONDO = "#1B2422"
PUNTO = "#F0B455"
TEXTO = "#F1ECE2"


def monitor_del_puntero():
    x, y = win32api.GetCursorPos()
    for handle, _, (x1, y1, x2, y2) in win32api.EnumDisplayMonitors():
        if x1 <= x < x2 and y1 <= y < y2:
            return x1, y1, x2, y2
    x1, y1, x2, y2 = win32api.EnumDisplayMonitors()[0][2]
    return x1, y1, x2, y2


class VentanaCalibracion:

    def __init__(self, tk_root, al_terminar, con_seguimiento=True, solo_comprobar=False):
        self.al_terminar = al_terminar
        self.cancelada = False
        self.solo_comprobar = solo_comprobar
        cfg = ConfigManager().config
        modo = cfg.get("calib_modo", "normal")
        if modo not in ("rapida", "normal", "completa"):
            modo = "normal"
        self.modo = modo
        factor = 1.6 if cfg.get("calib_lento", False) else 1.0
        self.espera = int(ESPERA_MS * factor)
        self.medida = int(MEDIDA_MS * factor)
        grande = 1.6 if cfg.get("calib_punto_grande", False) else 1.0
        self.r_grande = int(RADIO_GRANDE * grande)
        self.r_pequeno = int(RADIO_PEQUENO * grande)
        self.seguimiento_s = {"rapida": 0.0, "normal": SEGUIMIENTO_S, "completa": SEGUIMIENTO_S * 1.8}[modo]
        self.con_seguimiento = con_seguimiento and self.seguimiento_s > 0
        self.con_cabeza = bool(cfg.get("calib_cabeza", True))
        from src.detectors.mirada import NOMBRES_RASGOS
        from src.detectors.calibracion import inactivos_por_ojos
        self.inactivos = inactivos_por_ojos(NOMBRES_RASGOS, cfg.get("ojos_usar", "ambos"))
        self.modelo = None
        self.monitor = monitor_del_puntero()
        x1, y1, x2, y2 = self.monitor
        self.w, self.h = x2 - x1, y2 - y1
        w, h = self.w, self.h

        self.ventana = tkinter.Toplevel(tk_root)
        self.ventana.title("Winclus calibración")
        self.ventana.overrideredirect(True)
        self.ventana.attributes("-topmost", True)
        self.ventana.geometry(f"{w}x{h}+{x1}+{y1}")
        self.ventana.configure(bg=FONDO)
        self.lienzo = tkinter.Canvas(self.ventana, width=w, height=h, bg=FONDO,
                                     bd=0, highlightthickness=0)
        self.lienzo.pack()
        self.ventana.bind("<Escape>", lambda e: self.cancelar())
        self.ventana.focus_force()

        self.texto = self.lienzo.create_text(
            w // 2, int(h * 0.3), text="", fill=TEXTO, justify="center",
            font=(estilo.FAMILIA_TEXTO, 26))
        self.punto = self.lienzo.create_oval(0, 0, 0, 0, fill=PUNTO, outline="")
        self.centro = self.lienzo.create_oval(0, 0, 0, 0, fill=FONDO, outline="")
        self.contador = self.lienzo.create_text(
            w - 40, h - 30, text="", fill=TEXTO, anchor="e",
            font=(estilo.FAMILIA_TEXTO, 14))

        # Rejilla de puntos fijos según el modo, con el centro primero
        if modo == "rapida":
            fx, fy = (MARGEN, 0.5, 1 - MARGEN), (MARGEN, 0.5, 1 - MARGEN)
        elif modo == "completa":
            fx = fy = (MARGEN, 0.29, 0.5, 0.71, 1 - MARGEN)
        else:
            fx, fy = (MARGEN, 0.36, 0.64, 1 - MARGEN), (MARGEN, 0.5, 1 - MARGEN)
        centro = (x1 + w / 2, y1 + h / 2)
        self.objetivos = [centro]
        for g in fy:
            for f in fx:
                pt = (x1 + w * f, y1 + h * g)
                if abs(pt[0] - centro[0]) > 1 or abs(pt[1] - centro[1]) > 1:
                    self.objetivos.append(pt)
        self.indice = -1
        self.muestras = []
        self.rasgos_por_punto = []
        self.seg_puntos = []      # posiciones del punto móvil (con retraso)
        self.seg_rasgos = []
        self.seg_historial = []   # (t, x, y) del punto móvil
        self.seg_muestras = []    # (t, rasgos) de la mirada durante el seguimiento
        self.cabezas_fijos = []   # postura de la cabeza durante los puntos fijos
        self.cabeza_muestras = [] # (postura, rasgos) en la fase de cabeza
        self.comp_rasgos = []     # rasgos medianos de cada punto de comprobación

        # Comprobación previa: cómo se ven los ojos (tamaño y luz)
        self.foto = None
        self.imagen_previa = self.lienzo.create_image(w // 2, int(h * 0.55), image=None)
        self.texto_previa = self.lienzo.create_text(
            w // 2, int(h * 0.82), text="", fill=TEXTO, justify="center",
            font=(estilo.FAMILIA_TEXTO, 20))
        self.t_previa = time.time()
        self.previa_ok_desde = None

        MouseController().calibrando = True
        if self.solo_comprobar:
            self.modelo = dict(cfg.get("ojos_calibracion") or {})
            if not es_valido(self.modelo):
                self.ventana.after(50, self.cancelar)
                return
            self.retraso_estimado = self.modelo.get("retraso_ms", 100) / 1000
            self._mostrar_texto("Comprobación de la precisión:\nmira cada punto hasta que desaparezca.")
            self.ventana.after(2200, self._empezar_comprobacion)
            return
        self._mostrar_texto("Primero, comprobemos cómo se ven tus ojos.")
        self.ventana.after(300, self._previa)

    # ------------------------------------------------ comprobación previa --
    def _previa(self):
        """Muestra los ojos agrandados y avisa si falta luz o distancia."""
        if self.cancelada:
            return
        from PIL import Image, ImageTk
        from src.camera_manager import CameraManager
        ahora = time.time()
        lm = FaceMesh().mp_landmarks
        frame = CameraManager().get_raw_frame()
        ok = False
        if lm is not None and len(lm) >= 478 and frame is not None and frame.ndim == 3:
            H, W = frame.shape[:2]
            P = lambda i: (lm[i].x * W, lm[i].y * H)
            ancho_ojo = math.hypot(P(33)[0] - P(133)[0], P(33)[1] - P(133)[1])
            xs = [P(33)[0], P(133)[0], P(362)[0], P(263)[0]]
            ys = [P(159)[1], P(386)[1], P(145)[1], P(374)[1]]
            mx, my = 60, 40
            x1, x2 = int(max(0, min(xs) - mx)), int(min(W, max(xs) + mx))
            y1, y2 = int(max(0, min(ys) - my)), int(min(H, max(ys) + my))
            rec = frame[y1:y2, x1:x2]
            if rec.size:
                brillo = float(np.mean(rec))
                escala = min(3.0, 900 / max(1, rec.shape[1]))
                im = Image.fromarray(rec).resize((int(rec.shape[1] * escala), int(rec.shape[0] * escala)),
                                                 Image.BICUBIC)
                self.foto = ImageTk.PhotoImage(im)
                self.lienzo.itemconfigure(self.imagen_previa, image=self.foto)
                if ancho_ojo >= 110:
                    t_dist, ok_dist = f"Distancia: bien (ojo de {ancho_ojo:.0f} px)", True
                elif ancho_ojo >= 80:
                    t_dist, ok_dist = f"Distancia: aceptable (ojo de {ancho_ojo:.0f} px). Si puedes, acércate un poco.", True
                else:
                    t_dist, ok_dist = f"Acércate a la cámara: el ojo mide solo {ancho_ojo:.0f} px.", False
                if brillo >= 105:
                    t_luz, ok_luz = "Luz: bien", True
                elif brillo >= 75:
                    t_luz, ok_luz = "Luz: justa. Una lámpara de frente ayudaría.", True
                else:
                    t_luz, ok_luz = "Poca luz: pon una lámpara que te dé en la cara.", False
                ok = ok_dist and ok_luz
                self.lienzo.itemconfigure(self.texto_previa, text=f"{t_dist}\n{t_luz}")
        else:
            self.lienzo.itemconfigure(self.texto_previa, text="No veo tu cara. Ponte frente a la cámara.")

        if ok:
            if self.previa_ok_desde is None:
                self.previa_ok_desde = ahora
        else:
            self.previa_ok_desde = None
        transcurrido = ahora - self.t_previa
        listo = (ok and ahora - self.previa_ok_desde >= PREVIA_OK_S) or transcurrido >= PREVIA_MAX_S
        if listo:
            self.lienzo.itemconfigure(self.imagen_previa, state="hidden")
            self.lienzo.itemconfigure(self.texto_previa, state="hidden")
            self._mostrar_texto("Mira cada punto amarillo hasta que desaparezca.\n"
                                "No muevas la cabeza. Con Escape se cancela.")
            self.ventana.after(2500, self._siguiente)
            return
        self.ventana.after(100, self._previa)

    # ------------------------------------------------------ puntos fijos --
    def _mostrar_texto(self, texto):
        self.lienzo.itemconfigure(self.texto, text=texto, state="normal")

    def _siguiente(self):
        if self.cancelada:
            return
        self.lienzo.itemconfigure(self.texto, state="hidden")
        self.indice += 1
        if self.indice >= len(self.objetivos):
            if self.con_seguimiento:
                self._empezar_seguimiento()
            else:
                self.retraso_estimado = 0.0
                self._ajustar_y_comprobar()
            return
        self.lienzo.itemconfigure(self.contador,
                                  text=f"{self.indice + 1} de {len(self.objetivos)}")
        self.t0 = 0
        self.muestras = []
        self._animar()

    def _dibujar_punto(self, x, y, radio):
        x -= self.monitor[0]
        y -= self.monitor[1]
        self.lienzo.coords(self.punto, x - radio, y - radio, x + radio, y + radio)
        r = max(3, radio // 4)
        self.lienzo.coords(self.centro, x - r, y - r, x + r, y + r)

    def _animar(self):
        if self.cancelada:
            return
        self.t0 += TICK_MS
        x, y = self.objetivos[self.indice]
        if self.t0 <= self.espera:
            f = self.t0 / self.espera
            self._dibujar_punto(x, y, int(self.r_grande - (self.r_grande - self.r_pequeno) * f))
        elif self.t0 <= self.espera + self.medida:
            self._dibujar_punto(x, y, self.r_pequeno)
            r = FaceMesh().get_rasgos()
            if r is not None:
                self.muestras.append(r)
                c = FaceMesh().get_cabeza()
                if c is not None:
                    self.cabezas_fijos.append(c)
        else:
            if len(self.muestras) < 6:
                # No se vieron los ojos: se repite este punto (hasta 3 veces;
                # después se salta, el ajuste descarta lo que falte)
                self.reintentos = getattr(self, "reintentos", 0) + 1
                if self.reintentos <= 3:
                    self.lienzo.itemconfigure(self.texto, state="normal",
                                              text="No veo bien tus ojos. Otra vez…")
                    self.t0 = 0
                    self.muestras = []
                    self.ventana.after(800, self._animar)
                    return
                logger.warning(f"Punto {self.indice + 1} sin muestras: se salta")
                self.objetivos_perdidos = getattr(self, "objetivos_perdidos", []) + [self.indice]
            else:
                self.rasgos_por_punto.append(np.median(np.asarray(self.muestras), axis=0))
            self.reintentos = 0
            self._siguiente()
            return
        self.ventana.after(TICK_MS, self._animar)

    # ------------------------------------------------- seguimiento suave --
    def _posicion_seguimiento(self, s):
        """Zigzag suave: baja despacio mientras va y viene de lado a lado."""
        x1, y1, x2, y2 = self.monitor
        f = min(1.0, max(0.0, s / self.seguimiento_s))
        # x: seno con 3 vueltas completas (la vuelta es suave, sin picos)
        x = x1 + self.w / 2 + (self.w / 2 - self.w * MARGEN) * math.sin(2 * math.pi * 3 * f)
        # y: de arriba abajo con arranque y frenada suaves
        e = (1 - math.cos(math.pi * f)) / 2
        y = y1 + self.h * MARGEN + (self.h - 2 * self.h * MARGEN) * e
        return x, y

    def _empezar_seguimiento(self):
        self._mostrar_texto("Ahora sigue el punto con la vista\nmientras se mueve.")
        self.lienzo.itemconfigure(self.contador, text="seguimiento")
        self.ventana.after(2200, self._arrancar_seguimiento)

    def _arrancar_seguimiento(self):
        if self.cancelada:
            return
        self.lienzo.itemconfigure(self.texto, state="hidden")
        self.t_seg = time.time()
        self.seg_historial = []
        self._animar_seguimiento()

    def _animar_seguimiento(self):
        if self.cancelada:
            return
        ahora = time.time()
        s = ahora - self.t_seg
        x, y = self._posicion_seguimiento(s)
        self._dibujar_punto(x, y, self.r_pequeno + 4)
        self.seg_historial.append((ahora, x, y))

        # Se guarda la mirada con su instante; el retraso respecto al punto
        # se estima al final con los propios datos. Se descarta el primer
        # segundo (llegar al punto) y las muestras repetidas del mismo frame.
        r = FaceMesh().get_rasgos()
        if r is not None and s > 1.0 and (not self.seg_muestras or self.seg_muestras[-1][1] is not r):
            self.seg_muestras.append((ahora, r))

        if s >= self.seguimiento_s:
            retraso, self.seg_puntos, self.seg_rasgos = estimar_retraso(
                self.seg_historial, self.seg_muestras)
            self.retraso_estimado = retraso
            self._ajustar_y_comprobar()
            return
        self.ventana.after(TICK_MS, self._animar_seguimiento)

    # ----------------------------------------------------- comprobación --
    def _ajustar_y_comprobar(self):
        """Ajusta el modelo y pasa a la comprobación: cuatro puntos que no se
        usaron en el ajuste, para medir el error real."""
        try:
            perdidos = set(getattr(self, "objetivos_perdidos", []))
            objetivos = [o for i, o in enumerate(self.objetivos) if i not in perdidos]
            self.modelo = ajustar(objetivos, self.rasgos_por_punto, self.monitor,
                                  self.seg_puntos, self.seg_rasgos, inactivos=self.inactivos)
        except Exception as e:
            logger.error(f"No se pudo calibrar: {e}")
            self.modelo = None
            self._terminar()
            return
        self._empezar_comprobacion()

    def _empezar_comprobacion(self):
        x1, y1, x2, y2 = self.monitor
        self.comprobacion = [(x1 + self.w * f, y1 + self.h * g)
                             for f, g in ((0.28, 0.3), (0.72, 0.3), (0.28, 0.7), (0.72, 0.7))]
        self.errores = []
        self.indice_comp = -1
        if not self.solo_comprobar:
            self._mostrar_texto("Ya casi. Ahora se comprueba la precisión:\nmira otra vez cada punto.")
        self.lienzo.itemconfigure(self.contador, text="comprobación")
        self.ventana.after(2200, self._siguiente_comprobacion)

    def _siguiente_comprobacion(self):
        if self.cancelada:
            return
        self.lienzo.itemconfigure(self.texto, state="hidden")
        self.indice_comp += 1
        if self.indice_comp >= len(self.comprobacion):
            self._empezar_cabeza()
            return
        self.t0 = 0
        self.muestras = []
        self._animar_comprobacion()

    # ------------------------------------------- compensación de cabeza --
    CABEZA_S = 8.0

    def _empezar_cabeza(self):
        """Fase opcional: mirar el centro moviendo un poco la cabeza. Quien no
        pueda moverla solo espera; entonces no se aprende nada."""
        if self.modelo is None or self.solo_comprobar or not self.con_cabeza:
            self._terminar()
            return
        self._mostrar_texto("Último paso, opcional. Mira el punto del centro y, si puedes,\n"
                            "mueve un poco la cabeza a los lados y arriba y abajo\n"
                            "sin dejar de mirarlo. Si no puedes moverla, solo espera.")
        self.lienzo.itemconfigure(self.contador, text="cabeza")
        x1, y1, x2, y2 = self.monitor
        self.objetivo_cabeza = (x1 + self.w / 2, y1 + self.h / 2)
        self.cabeza_muestras = []
        self.ventana.after(2500, self._arrancar_cabeza)

    def _arrancar_cabeza(self):
        if self.cancelada:
            return
        self.t_cabeza = time.time()
        self._animar_cabeza()

    def _animar_cabeza(self):
        if self.cancelada:
            return
        from src.detectors.calibracion import ajustar_cabeza
        s = time.time() - self.t_cabeza
        self._dibujar_punto(self.objetivo_cabeza[0], self.objetivo_cabeza[1], self.r_pequeno + 2)
        r = FaceMesh().get_rasgos()
        c = FaceMesh().get_cabeza()
        if r is not None and c is not None and s > 0.5:
            if not self.cabeza_muestras or self.cabeza_muestras[-1][1] is not r:
                self.cabeza_muestras.append((c, r))
        if s >= self.CABEZA_S:
            self.lienzo.itemconfigure(self.texto, state="hidden")
            if self.cabezas_fijos:
                ref = np.median(np.asarray(self.cabezas_fijos), axis=0)
                try:
                    self.modelo = ajustar_cabeza(self.modelo, ref,
                                                 [m[0] for m in self.cabeza_muestras],
                                                 [m[1] for m in self.cabeza_muestras],
                                                 self.objetivo_cabeza)
                except Exception as e:
                    logger.error(f"Compensación de cabeza: {e}")
            self._terminar()
            return
        self.ventana.after(TICK_MS, self._animar_cabeza)

    def _animar_comprobacion(self):
        if self.cancelada:
            return
        from src.detectors.calibracion import predecir
        self.t0 += TICK_MS
        x, y = self.comprobacion[self.indice_comp]
        if self.t0 <= self.espera:
            f = self.t0 / self.espera
            self._dibujar_punto(x, y, int(self.r_grande - (self.r_grande - self.r_pequeno) * f))
        elif self.t0 <= self.espera + self.medida:
            self._dibujar_punto(x, y, self.r_pequeno)
            r = FaceMesh().get_rasgos()
            if r is not None:
                self.muestras.append(r)
        else:
            if len(self.muestras) >= 6:
                mediana = np.median(np.asarray(self.muestras), axis=0)
                self.comp_rasgos.append((x, y, mediana.tolist()))
                px, py = predecir(self.modelo, mediana)
                self.errores.append(math.hypot(px - x, py - y))
                self.residuos_comp = getattr(self, "residuos_comp", []) + [[x, y, round(px - x, 1), round(py - y, 1)]]
            self._siguiente_comprobacion()
            return
        self.ventana.after(TICK_MS, self._animar_comprobacion)

    # ------------------------------------------------------------ final --
    def _terminar(self):
        modelo = getattr(self, "modelo", None)
        if modelo is not None:
            modelo["retraso_ms"] = round(getattr(self, "retraso_estimado", 0.1) * 1000)
        if modelo is not None and getattr(self, "errores", None):
            modelo["error_real_px"] = round(float(np.median(self.errores)))
            modelo["errores_comprobacion"] = [round(e) for e in self.errores]
            modelo["residuos_comprobacion"] = getattr(self, "residuos_comp", [])
            logger.info(f"Comprobación: errores {modelo['errores_comprobacion']} px, "
                        f"mediana {modelo['error_real_px']} px")
        self._cerrar()
        if modelo is not None:
            ConfigManager().set_temp_config("ojos_calibracion", modelo)
            ConfigManager().apply_config()
            MouseController().reiniciar_mirada()
            if not self.solo_comprobar:
                self._guardar_datos(modelo)
        self.al_terminar(modelo)

    def _guardar_datos(self, modelo):
        """Guarda las muestras crudas de la calibración en el perfil
        (calibracion_datos.json) para poder reajustar el modelo sin repetirla
        (herramientas/reajustar_calibracion.py)."""
        import json
        from pathlib import Path
        try:
            perdidos = set(getattr(self, "objetivos_perdidos", []))
            datos = {
                "fecha": time.strftime("%Y-%m-%d %H:%M:%S"),
                "monitor": list(self.monitor),
                "puntos_fijos": [o for i, o in enumerate(self.objetivos) if i not in perdidos],
                "rasgos_fijos": [list(map(float, r)) for r in self.rasgos_por_punto],
                "seguimiento_puntos": [list(map(float, p)) for p in self.seg_puntos],
                "seguimiento_rasgos": [list(map(float, r)) for r in self.seg_rasgos],
                "retraso_ms": modelo.get("retraso_ms"),
                "comprobacion": [{"x": x, "y": y, "rasgos": r} for x, y, r in self.comp_rasgos],
                "cabezas_fijos": [list(map(float, c)) for c in self.cabezas_fijos],
                "cabeza_muestras": [{"cabeza": list(map(float, c)), "rasgos": list(map(float, r))}
                                    for c, r in self.cabeza_muestras],
                "objetivo_cabeza": list(getattr(self, "objetivo_cabeza", (0, 0))),
                "resultado": {k: modelo.get(k) for k in ("error_px", "error_real_px",
                                                          "errores_comprobacion", "lambda",
                                                          "cabeza_mejora_px")},
            }
            ruta = Path(ConfigManager().curr_profile_path, "calibracion_datos.json")
            with open(ruta, "w", encoding="utf-8") as f:
                json.dump(datos, f)
            logger.info(f"Datos de calibración guardados en {ruta}")
        except Exception as e:
            logger.warning(f"No se pudieron guardar los datos de calibración: {e}")

    def cancelar(self):
        if self.cancelada:
            return
        self._cerrar()
        self.al_terminar(None)

    def _cerrar(self):
        self.cancelada = True
        MouseController().calibrando = False
        try:
            self.ventana.destroy()
        except Exception:
            pass


class VentanaRecentrado:
    """Corrección rápida del centro: un solo punto en el centro de la pantalla
    calibrada. La diferencia entre lo previsto y el centro se guarda como
    desplazamiento fijo. Se abre con los ojos cerrados 1,2 s (o desde la
    página Puntero) y dura unos 2 segundos."""

    ESPERA_MS = 900
    MEDIDA_MS = 1000

    def __init__(self, tk_root, al_terminar):
        self.al_terminar = al_terminar
        self.cancelada = False
        modelo = ConfigManager().config.get("ojos_calibracion")
        if not es_valido(modelo):
            self.cancelada = True
            al_terminar(False)
            return
        self.modelo = modelo
        x1, y1, x2, y2 = modelo["monitor"]
        w, h = x2 - x1, y2 - y1
        self.centro = (x1 + w / 2, y1 + h / 2)

        self.ventana = tkinter.Toplevel(tk_root)
        self.ventana.title("Winclus centro")
        self.ventana.overrideredirect(True)
        self.ventana.attributes("-topmost", True)
        self.ventana.geometry(f"{w}x{h}+{x1}+{y1}")
        self.ventana.configure(bg=FONDO)
        self.lienzo = tkinter.Canvas(self.ventana, width=w, height=h, bg=FONDO,
                                     bd=0, highlightthickness=0)
        self.lienzo.pack()
        self.ventana.bind("<Escape>", lambda e: self.cancelar())
        self.ventana.focus_force()
        self.lienzo.create_text(w // 2, int(h * 0.36), text="Mira el punto del centro",
                                fill=TEXTO, font=(estilo.FAMILIA_TEXTO, 26))
        r = RADIO_GRANDE
        self.punto = self.lienzo.create_oval(w / 2 - r, h / 2 - r, w / 2 + r, h / 2 + r,
                                             fill=PUNTO, outline="")
        rc = RADIO_PEQUENO // 2
        self.lienzo.create_oval(w / 2 - rc, h / 2 - rc, w / 2 + rc, h / 2 + rc,
                                fill=FONDO, outline="")
        self.muestras = []
        self.t0 = 0
        MouseController().calibrando = True
        self.ventana.after(TICK_MS, self._animar)

    def _animar(self):
        if self.cancelada:
            return
        self.t0 += TICK_MS
        if self.t0 > self.ESPERA_MS:
            r = FaceMesh().get_rasgos()
            if r is not None:
                self.muestras.append(r)
        if self.t0 > self.ESPERA_MS + self.MEDIDA_MS:
            self._terminar()
            return
        self.ventana.after(TICK_MS, self._animar)

    def _terminar(self):
        ok = False
        if len(self.muestras) >= 6:
            nuevo = corregir_centro(self.modelo, np.median(np.asarray(self.muestras), axis=0),
                                    self.centro)
            ConfigManager().set_temp_config("ojos_calibracion", nuevo)
            ConfigManager().apply_config()
            MouseController().reiniciar_mirada()
            ok = True
        else:
            logger.warning("Recentrado: no se vieron los ojos")
        self._cerrar()
        self.al_terminar(ok)

    def cancelar(self):
        if self.cancelada:
            return
        self._cerrar()
        self.al_terminar(False)

    def _cerrar(self):
        self.cancelada = True
        MouseController().calibrando = False
        try:
            self.ventana.destroy()
        except Exception:
            pass
