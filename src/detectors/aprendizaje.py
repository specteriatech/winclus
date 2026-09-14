"""Calibración invisible: Winclus aprende a calibrar los ojos con cada clic.

Cada clic que hace la persona es una muestra: en ese instante miraba el
punto donde estaba el puntero, y sabemos qué rasgos tenían sus ojos justo
antes. Con esas parejas (rasgos → punto de la pantalla) se reajusta el
modelo de detectors/calibracion.py sin que la persona haga nada.

De dónde salen muestras fiables:
- Puntero por cabeza (o palanca de ojos) y clic por parpadeo, permanencia,
  boca o cejas: el puntero está donde la persona mira. Es una verdad
  independiente del modelo de ojos, así que sirve incluso para calibrar de
  cero sin pasar por la pantalla de calibración.
- Modo directo con lupa: el primer gesto abre la lupa con los rasgos de ese
  momento; el segundo pulsa el punto real. Ese punto es más exacto que la
  previsión del modelo (el error queda dividido por el aumento).
- Modo híbrido, si la cabeza afinó el puntero tras el salto: el punto
  final es donde la persona quería de verdad (fuente «hibrido»).
- Modo directo sin lupa NO sirve: el puntero está donde el modelo dijo, y
  aprender de eso sería confirmarse a sí mismo.

Los rasgos se toman de un poco antes del clic (con un parpadeo los ojos
están cerrados en el momento del clic). Las muestras se guardan en
configs/<perfil>/clics_aprendidos.json y cada cierto número de clics se
reajusta el modelo en un hilo aparte. El modelo nuevo solo se aplica si
acierta mejor que el actual en los clics más recientes, que se dejan fuera
del ajuste para que la comparación sea honesta.
"""

import json
import logging
import threading
import time
from collections import Counter, deque
from pathlib import Path

import numpy as np

from src.config_manager import ConfigManager
from src.detectors import calibracion
from src.detectors.mirada import NOMBRES_RASGOS
from src.singleton_meta import Singleton

logger = logging.getLogger("Aprendizaje")

ARCHIVO = "clics_aprendidos.json"
MAX_MUESTRAS = 400            # se conservan los últimos
MIN_PARA_CALIBRAR = 30        # clics para calibrar de cero
MIN_PARA_MEJORAR = 12         # clics para intentar mejorar un modelo que ya existe
CLICS_ENTRE_AJUSTES = 10
SEGUNDOS_ENTRE_AJUSTES = 30
VENTANA_PARPADEO = (0.9, 0.35)   # s antes del clic en que los ojos aún estaban abiertos
VENTANA_ABIERTOS = (0.5, 0.05)   # clic por permanencia, boca o cejas: ojos abiertos
MIN_MUESTRAS_VENTANA = 4
MAX_DESV_VENTANA = 0.10       # si la mirada se movía (desv. de gx/gy), no vale
PESO_CLIC = 4.0               # cada clic pesa como 4 muestras de seguimiento
N_FIJOS_CLICS = 40            # los clics más recientes pesan como puntos fijos
EXTENSION_MIN = 0.30          # los clics deben cubrir esta fracción del monitor
ERROR_MAX_INICIAL = 200       # calibrar de cero solo si el error queda por debajo
ERROR_MAX_MEJORA = 150        # sustituir un modelo solo si el nuevo acierta al menos así
RONDAS_CABEZA = 2             # alternar modelo base y compensación de cabeza


def monitor_de(x, y):
    """Rectángulo (x1, y1, x2, y2) del monitor que contiene el punto."""
    try:
        import win32api
        monitores = [m[2] for m in win32api.EnumDisplayMonitors()]
        for x1, y1, x2, y2 in monitores:
            if x1 <= x < x2 and y1 <= y < y2:
                return [int(x1), int(y1), int(x2), int(y2)]
        x1, y1, x2, y2 = monitores[0]
        return [int(x1), int(y1), int(x2), int(y2)]
    except Exception:
        import pyautogui
        w, h = pyautogui.size()
        return [0, 0, int(w), int(h)]


# ------------------------------------------------------------ cálculo puro --
def ajustar_con_clics(muestras, actual, datos_base, monitor, inactivos, n_rasgos=None):
    """Reajusta el modelo con los clics guardados. No toca la configuración.

    muestras: lista de dicts {x, y, rasgos, cabeza}; actual: modelo en uso o
    None; datos_base: datos crudos de la última calibración (o None);
    monitor: rectángulo del monitor calibrado.
    Devuelve un dict con «ok», «mensaje», «modelo» (None si no se aplica),
    «error_antes», «error_despues» y «n»."""
    n_rasgos = n_rasgos or len(NOMBRES_RASGOS)
    muestras = [m for m in muestras if len(m.get("rasgos", ())) == n_rasgos]
    n = len(muestras)
    valido = calibracion.es_valido(actual, n_rasgos)
    minimo = MIN_PARA_MEJORAR if valido else MIN_PARA_CALIBRAR
    if n < minimo:
        return {"ok": False, "n": n, "modelo": None,
                "mensaje": f"Faltan clics: {n} de {minimo}."}

    x1, y1, x2, y2 = monitor
    P = np.asarray([[m["x"], m["y"]] for m in muestras], dtype=np.float64)
    if not valido:
        ext_x = (P[:, 0].max() - P[:, 0].min()) / max(1, x2 - x1)
        ext_y = (P[:, 1].max() - P[:, 1].min()) / max(1, y2 - y1)
        if ext_x < EXTENSION_MIN or ext_y < EXTENSION_MIN:
            return {"ok": False, "n": n, "modelo": None,
                    "mensaje": "Los clics cubren poca pantalla todavía: haz clic también en los bordes."}

    # Parte de los clics recientes se guarda para comprobar, no para ajustar:
    # uno de cada dos entre los últimos, para que el ajuste también vea lo
    # más nuevo (la postura cambia con el tiempo).
    n_eval = max(6, n // 4)
    recientes = muestras[-2 * n_eval:]
    prueba = recientes[1::2]
    ajuste = muestras[:-2 * n_eval] + recientes[0::2]

    def pesos_de(conjunto):
        """Los clics más nuevos pesan más (van del más viejo al más nuevo)."""
        k = len(conjunto)
        return [8.0 if i < N_FIJOS_CLICS else PESO_CLIC if i < N_FIJOS_CLICS + 100
                else PESO_CLIC / 2 if i < N_FIJOS_CLICS + 200 else 1.0
                for i in range(k - 1, -1, -1)]

    def ajustar_base(conjunto, correcciones):
        """Modelo de rasgos → pantalla; a cada clic se le resta lo que ya
        explica la compensación de cabeza (correcciones), si la hay."""
        pts = [[m["x"] - dx, m["y"] - dy] for m, (dx, dy) in zip(conjunto, correcciones)]
        ras = [list(map(float, m["rasgos"])) for m in conjunto]
        pesos = pesos_de(conjunto)
        if datos_base:
            return calibracion.ajustar(
                datos_base["puntos_fijos"], datos_base["rasgos_fijos"], monitor,
                datos_base.get("seguimiento_puntos"), datos_base.get("seguimiento_rasgos"),
                inactivos=inactivos, puntos_extra=pts, rasgos_extra=ras, peso_extra=pesos)
        # Sin calibración previa: los clics más nuevos hacen de puntos fijos
        # (con ellos se elige la regularización) y el resto acompaña
        corte = max(0, len(pts) - N_FIJOS_CLICS)
        return calibracion.ajustar(pts[corte:], ras[corte:], monitor, inactivos=inactivos,
                                   puntos_extra=pts[:corte], rasgos_extra=ras[:corte],
                                   peso_extra=pesos[:corte])

    def correcciones_con(modelo_cabeza, conjunto):
        return [calibracion.correccion_cabeza(modelo_cabeza, m["cabeza"]) if m.get("cabeza")
                else (0.0, 0.0) for m in conjunto]

    def ajustar(conjunto):
        # Con el puntero por la cabeza, la cabeza se mueve mucho entre clic y
        # clic: el modelo base y la compensación de cabeza se ajustan por
        # turnos (cada uno sobre lo que el otro no explica). Se parte de la
        # compensación que ya tuviera el modelo actual.
        con_cabeza = [m for m in conjunto if m.get("cabeza")]
        cabeza_previa = (valido and actual.get("cabeza_coef") and actual.get("cabeza_ref"))
        correcciones = correcciones_con(actual, conjunto) if cabeza_previa else [(0.0, 0.0)] * len(conjunto)
        modelo = ajustar_base(conjunto, correcciones)
        if len(con_cabeza) < 30:
            if cabeza_previa:
                modelo["cabeza_ref"] = actual["cabeza_ref"]
                modelo["cabeza_coef"] = actual["cabeza_coef"]
            modelo["sesgo"] = [0.0, 0.0]
            return modelo
        ref = np.median(np.asarray([m["cabeza"] for m in con_cabeza], dtype=np.float64), axis=0)
        for ronda in range(RONDAS_CABEZA):
            modelo = calibracion.ajustar_cabeza(
                modelo, ref, [m["cabeza"] for m in con_cabeza],
                [m["rasgos"] for m in con_cabeza], [[m["x"], m["y"]] for m in con_cabeza])
            if ronda == RONDAS_CABEZA - 1:
                break
            base = ajustar_base(conjunto, correcciones_con(modelo, conjunto))
            base["cabeza_ref"] = modelo["cabeza_ref"]
            base["cabeza_coef"] = modelo["cabeza_coef"]
            modelo = base
        modelo["sesgo"] = [0.0, 0.0]
        return modelo

    def error(modelo, conjunto):
        if not calibracion.es_valido(modelo, n_rasgos):
            return float("inf")
        e = []
        for m in conjunto:
            px, py = calibracion.predecir(modelo, m["rasgos"], cabeza=m.get("cabeza"))
            e.append(float(np.hypot(px - m["x"], py - m["y"])))
        return float(np.median(e))

    try:
        candidato = ajustar(ajuste)
    except Exception as e:
        logger.warning(f"Calibración invisible: no se pudo ajustar: {e}")
        return {"ok": False, "n": n, "modelo": None, "mensaje": f"No se pudo ajustar: {e}"}

    err_antes = error(actual, prueba) if valido else float("inf")
    err_despues = error(candidato, prueba)
    logger.info(f"Calibración invisible: {n} clics ({len(ajuste)} para ajustar, {n_eval} de prueba); "
                f"error actual {err_antes:.0f} px, nuevo {err_despues:.0f} px")

    if not valido and err_despues > ERROR_MAX_INICIAL:
        return {"ok": False, "n": n, "modelo": None, "error_antes": None,
                "error_despues": round(err_despues),
                "mensaje": f"Todavía impreciso (±{err_despues:.0f} px): sigue haciendo clics."}
    if valido and err_despues >= err_antes - 2:
        return {"ok": False, "n": n, "modelo": None, "error_antes": round(err_antes),
                "error_despues": round(err_despues),
                "mensaje": f"El modelo actual sigue siendo mejor (±{err_antes:.0f} px frente a ±{err_despues:.0f})."}
    if valido and err_despues > ERROR_MAX_MEJORA:
        # Ni el modelo actual ni el nuevo aciertan en los últimos clics: lo
        # más probable es que esos clics no sean donde se miraba
        return {"ok": False, "n": n, "modelo": None, "error_antes": round(err_antes),
                "error_despues": round(err_despues),
                "mensaje": f"Los últimos clics no cuadran con la mirada (±{err_despues:.0f} px): no se cambia nada."}

    # Aceptado: ajuste final con todos los clics
    try:
        modelo = ajustar(muestras)
    except Exception as e:
        modelo = candidato
        logger.warning(f"Calibración invisible: ajuste final falló, se usa el candidato: {e}")
    if valido:
        for k in ("retraso_ms",):
            if k in actual:
                modelo[k] = actual[k]
    modelo["error_real_px"] = round(err_despues)
    modelo["variante"] = "aprendido de clics"
    modelo["aprendido"] = {
        "n_clics": n,
        "fecha": time.strftime("%Y-%m-%d %H:%M:%S"),
        "error_antes": None if not valido else round(err_antes),
        "error_despues": round(err_despues),
        "origen": "calibracion+clics" if datos_base else "clics",
    }
    if valido:
        mensaje = f"Mejorado con {n} clics: ±{err_antes:.0f} → ±{err_despues:.0f} px."
    else:
        mensaje = f"Calibrado solo con tus {n} clics (±{err_despues:.0f} px)."
    return {"ok": True, "n": n, "modelo": modelo, "error_antes": None if not valido else round(err_antes),
            "error_despues": round(err_despues), "mensaje": mensaje}


# ----------------------------------------------------------------- singleton --
class AprendizajeClics(metaclass=Singleton):

    def __init__(self):
        self.historial = deque(maxlen=150)   # (t, rasgos, cabeza) de los últimos ~5 s
        self.muestras = []
        self.ruta = None
        self.candado = threading.Lock()
        self.nuevos = 0                      # clics desde el último ajuste
        self.ultimo_ajuste = 0.0
        self.ajustando = False
        self.resultado = None                # último resultado (dict) para la interfaz
        self.programar = None                # fn(callable): ejecutar en el hilo de tkinter
        self.al_aplicar = None               # aviso a la interfaz cuando cambia el modelo

    # ----------------------------------------------------------- entrada --
    def activo(self) -> bool:
        cfg = ConfigManager().config
        return bool(cfg) and bool(cfg.get("calib_invisible", True))

    def registrar(self, rasgos, cabeza=None) -> None:
        """Se llama en cada vuelta del pipeline con los rasgos actuales (o None)."""
        if rasgos is None:
            return
        with self.candado:
            self.historial.append((time.time(), tuple(float(v) for v in rasgos),
                                   None if cabeza is None else tuple(float(v) for v in cabeza)))

    def _rasgos_antes(self, t, ventana):
        desde, hasta = t - ventana[0], t - ventana[1]
        with self.candado:
            sel = [(r, c) for (tt, r, c) in self.historial if desde <= tt <= hasta]
        if len(sel) < MIN_MUESTRAS_VENTANA:
            return None, None
        R = np.asarray([r for r, _ in sel], dtype=np.float64)
        if float(R[:, :6].std(axis=0).max()) > MAX_DESV_VENTANA:
            return None, None   # la mirada se estaba moviendo
        rasgos = np.median(R, axis=0).tolist()
        cabezas = [c for _, c in sel if c is not None]
        cabeza = np.median(np.asarray(cabezas, dtype=np.float64), axis=0).tolist() if cabezas else None
        return rasgos, cabeza

    def anotar_clic(self, x, y, fuente: str, t=None, parpadeo: bool = True) -> bool:
        """Guarda un clic como muestra. fuente: «cabeza», «palanca» o «lupa».
        t: instante del gesto cuyos rasgos valen (por defecto ahora)."""
        if not self.activo():
            return False
        t = t or time.time()
        rasgos, cabeza = self._rasgos_antes(t, VENTANA_PARPADEO if parpadeo else VENTANA_ABIERTOS)
        if rasgos is None:
            logger.info(f"Clic ({fuente}) sin rasgos fiables justo antes: no se aprende")
            return False
        muestra = {"t": round(t, 2), "x": float(x), "y": float(y), "rasgos": rasgos,
                   "cabeza": cabeza, "fuente": fuente, "monitor": monitor_de(x, y)}
        self._cargar()
        with self.candado:
            self.muestras.append(muestra)
            del self.muestras[:-MAX_MUESTRAS]
            n = len(self.muestras)
        self.nuevos += 1
        logger.info(f"Clic aprendido ({fuente}) en ({x:.0f}, {y:.0f}): {n} guardados")
        if n % 3 == 0:
            self._guardar()
        self._quiza_ajustar()
        return True

    def anotar_clic_puntero(self, parpadeo: bool) -> bool:
        """Clic hecho por Winclus en la posición actual del puntero. Decide si
        vale según cómo se mueve el puntero."""
        if not self.activo():
            return False
        cfg = ConfigManager().config
        if cfg.get("modo_puntero") == "ojos":
            submodo = cfg.get("ojos_modo", "directo")
            if submodo == "directo":
                return False   # el puntero está donde dijo el modelo: no es verdad nueva
            if submodo == "hibrido":
                from src.controllers.mouse_controller import MouseController
                if not MouseController().afinado_con_cabeza():
                    return False   # solo saltó la mirada: sería confirmarse a sí mismo
                fuente = "hibrido"
            else:
                fuente = "palanca"
        else:
            fuente = "cabeza"
        import pyautogui
        x, y = pyautogui.position()
        return self.anotar_clic(x, y, fuente, parpadeo=parpadeo)

    # ------------------------------------------------------------ archivo --
    def _cargar(self) -> None:
        ruta = Path(ConfigManager().curr_profile_path, ARCHIVO)
        if ruta == self.ruta:
            return
        self.ruta = ruta
        muestras = []
        if ruta.is_file():
            try:
                with open(ruta, encoding="utf-8") as f:
                    datos = json.load(f)
                muestras = [m for m in datos.get("muestras", [])
                            if len(m.get("rasgos", ())) == len(NOMBRES_RASGOS)]
            except Exception as e:
                logger.warning(f"No se pudieron leer los clics aprendidos: {e}")
        with self.candado:
            self.muestras = muestras[-MAX_MUESTRAS:]
        self.nuevos = 0
        self.resultado = None
        logger.info(f"Clics aprendidos cargados de {ruta}: {len(muestras)}")

    def _guardar(self) -> None:
        if self.ruta is None:
            return
        try:
            with self.candado:
                copia = list(self.muestras)
            with open(self.ruta, "w", encoding="utf-8") as f:
                json.dump({"version": 1, "muestras": copia}, f)
        except Exception as e:
            logger.warning(f"No se pudieron guardar los clics aprendidos: {e}")

    def olvidar(self) -> None:
        """Borra los clics guardados del perfil actual."""
        self._cargar()
        with self.candado:
            self.muestras = []
        self.nuevos = 0
        self.resultado = None
        self._guardar()
        logger.info("Clics aprendidos borrados")

    def n_muestras(self) -> int:
        self._cargar()
        with self.candado:
            return len(self.muestras)

    # ------------------------------------------------------------- ajuste --
    def _modelo_valido(self) -> bool:
        return calibracion.es_valido(ConfigManager().config.get("ojos_calibracion"), len(NOMBRES_RASGOS))

    def _quiza_ajustar(self) -> None:
        if self.ajustando:
            return
        n = self.n_muestras()
        valido = self._modelo_valido()
        if n < (MIN_PARA_MEJORAR if valido else MIN_PARA_CALIBRAR):
            return
        if self.nuevos < (CLICS_ENTRE_AJUSTES if valido else 5):
            return
        if time.time() - self.ultimo_ajuste < SEGUNDOS_ENTRE_AJUSTES:
            return
        self.ajustar_en_hilo()

    def ajustar_en_hilo(self) -> bool:
        """Lanza el reajuste en un hilo aparte. Devuelve False si ya hay uno."""
        if self.ajustando:
            return False
        self.ajustando = True
        threading.Thread(target=self._ajustar_hilo, name="calib_invisible", daemon=True).start()
        return True

    def _ajustar_hilo(self) -> None:
        try:
            resultado = self.calcular()
            self.resultado = resultado
            if resultado.get("modelo") is not None:
                if self.programar is not None:
                    self.programar(lambda: self._aplicar(resultado["modelo"]))
                else:
                    self._aplicar(resultado["modelo"])
        except Exception as e:
            logger.warning(f"Calibración invisible: {e}")
            self.resultado = {"ok": False, "mensaje": f"Error al ajustar: {e}"}
        finally:
            self.ultimo_ajuste = time.time()
            self.nuevos = 0
            self.ajustando = False

    def _datos_base(self, monitor):
        """Datos crudos de la última calibración, si son compatibles."""
        ruta = Path(ConfigManager().curr_profile_path, "calibracion_datos.json")
        if not ruta.is_file():
            return None
        try:
            with open(ruta, encoding="utf-8") as f:
                datos = json.load(f)
        except Exception as e:
            logger.warning(f"No se pudieron leer los datos de calibración: {e}")
            return None
        if not datos.get("rasgos_fijos") or len(datos["rasgos_fijos"][0]) != len(NOMBRES_RASGOS):
            return None
        if list(datos.get("monitor", [])) != list(monitor):
            return None
        return datos

    def calcular(self) -> dict:
        """Reajuste con los clics guardados (sin aplicar). Se puede llamar
        desde cualquier hilo."""
        self._cargar()
        with self.candado:
            muestras = list(self.muestras)
        cfg = ConfigManager().config
        actual = cfg.get("ojos_calibracion")
        valido = calibracion.es_valido(actual, len(NOMBRES_RASGOS))
        if valido:
            monitor = [int(v) for v in actual["monitor"]]
            inactivos = list(actual.get("inactivos") or [])
        else:
            if not muestras:
                return {"ok": False, "n": 0, "modelo": None, "mensaje": "Todavía no hay clics."}
            monitor = list(Counter(tuple(m["monitor"]) for m in muestras).most_common(1)[0][0])
            inactivos = calibracion.inactivos_por_ojos(NOMBRES_RASGOS, cfg.get("ojos_usar", "ambos"))
        muestras = [m for m in muestras if list(m.get("monitor", [])) == monitor]
        return ajustar_con_clics(muestras, actual if valido else None,
                                 self._datos_base(monitor), monitor, inactivos)

    def _aplicar(self, modelo) -> None:
        ConfigManager().set_temp_config("ojos_calibracion", modelo)
        ConfigManager().apply_config()
        self._guardar()
        a = modelo.get("aprendido", {})
        logger.info(f"Calibración invisible aplicada: {a.get('n_clics')} clics, "
                    f"error {a.get('error_antes')} → {a.get('error_despues')} px")
        if self.al_aplicar is not None:
            try:
                self.al_aplicar(modelo)
            except Exception as e:
                logger.warning(f"Aviso de calibración aplicada: {e}")

    # ------------------------------------------------------------ interfaz --
    def estado_texto(self) -> str:
        if not self.activo():
            return "Desactivada: Winclus no aprende de tus clics."
        n = self.n_muestras()
        valido = self._modelo_valido()
        if self.ajustando:
            return f"Ajustando con {n} clics…"
        if not valido:
            if n < MIN_PARA_CALIBRAR:
                return (f"Aprendiendo: {n} de {MIN_PARA_CALIBRAR} clics. Usa el puntero con la cabeza "
                        f"y haz clic por toda la pantalla; con {MIN_PARA_CALIBRAR} calibrará los ojos sola.")
            texto = f"{n} clics guardados."
        else:
            a = (ConfigManager().config.get("ojos_calibracion") or {}).get("aprendido")
            if a:
                antes = f"±{a['error_antes']} → " if a.get("error_antes") is not None else ""
                texto = (f"{n} clics guardados. Última mejora ({a.get('fecha', '')[:16]}): "
                         f"{antes}±{a['error_despues']} px con {a['n_clics']} clics.")
            else:
                texto = f"{n} clics guardados; todavía no han mejorado la calibración."
        if self.resultado and not self.resultado.get("ok"):
            texto += " " + self.resultado.get("mensaje", "")
        return texto
