# Copyright 2023 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
import concurrent.futures as futures
import logging
import threading
import time
import tkinter as tk

import numpy as np
import numpy.typing as npt
import pyautogui

import src.utils as utils
from src.accel_graph import SigmoidAccel
from src.config_manager import ConfigManager
from src.singleton_meta import Singleton

logger = logging.getLogger("MouseController")

pyautogui.PAUSE = 0
pyautogui.FAILSAFE = False

# Max buffer number for apply smoothing.
N_BUFFER = 100


def decidir_salto(fijacion, ultimo_salto_punto, salto_px, mirada_moviendo, cabeza_quieta) -> bool:
    """Híbrido: ¿debe saltar el puntero a la fijación actual?

    Salta si la mirada se fijó (no está deslizándose) en un sitio nuevo, a
    «salto_px» o más del último salto, y la cabeza está quieta. La primera
    fijación siempre salta."""
    if fijacion is None or mirada_moviendo:
        return False
    if ultimo_salto_punto is None:
        return True
    if not cabeza_quieta:
        return False
    d = np.hypot(fijacion[0] - ultimo_salto_punto[0], fijacion[1] - ultimo_salto_punto[1])
    return bool(d >= salto_px)


class MouseController(metaclass=Singleton):

    def __init__(self):
        logger.info("Intialize MouseController singleton")
        self.prev_x = 0
        self.prev_y = 0
        self.curr_track_loc = None
        self.smooth_kernel = None
        self.delay_count = 0
        self.top_count = 0
        self.is_started = False
        self.is_destroyed = False
        self.stop_flag = None
        self.is_active = None
        # Modo «ojos»: última mirada (gx, gy) y su versión suavizada
        self.curr_mirada = None
        self.mirada_suave = None
        self.mirada_muestras = []
        # Modo directo: rasgos de la mirada, punto previsto y punto de fijación
        self.curr_rasgos = None
        self.rasgos_ultimo = None
        self.rasgos_muestras = []
        self.filtro_directo = utils.FiltroOneEuro2D(min_cutoff=1.0, beta=0.004)
        self.filtros_cabeza = [utils.FiltroOneEuro(min_cutoff=0.6, beta=0.01) for _ in range(4)]
        self.fijador = utils.Fijacion()
        self.punto_directo = None     # (x, y) suavizado, para la interfaz
        self.fijacion = None          # (x, y) donde está quieto el puntero
        self.calibrando = False       # la ventana de calibración manda
        self.lupa = None              # geometría de la lupa mientras está abierta
        self.lupa_fuera_desde = None  # desde cuándo la mirada está fuera de la lupa
        self.congelado_hasta = 0.0    # no mover el puntero hasta este instante
        self.ultimo_destino = None    # último punto al que se llevó el puntero
        # Modo híbrido: la mirada salta, la cabeza afina
        self.ultimo_salto = 0.0       # cuándo saltó el puntero por la mirada
        self.ultimo_salto_punto = None
        self.cabeza_desde_salto = (0.0, 0.0)   # cuánto afinó la cabeza desde el salto

    def congelar(self, segundos: float) -> None:
        """Deja quieto el puntero un momento (p. ej. mientras se hace un clic
        en un punto concreto desde otro hilo)."""
        self.congelado_hasta = time.time() + segundos
        self.fijacion = None
        self.fijador.reiniciar()
        self.ultimo_destino = None

    def start(self):
        if not self.is_started:
            logger.info("Start MouseController singleton")
            # Trackpoint buffer x, y
            self.buffer = np.zeros([N_BUFFER, 2])
            self.accel = SigmoidAccel()
            self.pool = futures.ThreadPoolExecutor(max_workers=1)
            self.screen_w, self.screen_h = pyautogui.size()
            self.calc_smooth_kernel()

            self.is_active = tk.BooleanVar()
            self.is_active.set(ConfigManager().config["auto_play"])

            self.stop_flag = threading.Event()
            self.pool.submit(self.main_loop)
            self.is_started = True

    def calc_smooth_kernel(self):
        new_pointer_smooth = ConfigManager().config["pointer_smooth"]
        if self.smooth_kernel is None:
            self.smooth_kernel = utils.calc_smooth_kernel(new_pointer_smooth)

        elif new_pointer_smooth != len(self.smooth_kernel):
            self.smooth_kernel = utils.calc_smooth_kernel(new_pointer_smooth)

        else:
            pass

    def asymmetry_scale(self, vel_x, vel_y):
        if vel_x > 0:
            vel_x *= ConfigManager().config["spd_right"]
        else:
            vel_x *= ConfigManager().config["spd_left"]

        if vel_y > 0:
            vel_y *= ConfigManager().config["spd_down"]
        else:
            vel_y *= ConfigManager().config["spd_up"]

        return vel_x, vel_y

    def act(self, track_loc: npt.ArrayLike):
        self.curr_track_loc = track_loc

    def act_mirada(self, mirada):
        """Mirada (gx, gy) del detector de iris, o None si no es fiable."""
        self.curr_mirada = mirada

    def act_rasgos(self, rasgos, cabeza=None):
        """Rasgos de la mirada para el modo directo (o None si no son fiables)
        y postura de la cabeza para compensar sus movimientos."""
        self.curr_rasgos = rasgos
        self.curr_cabeza = cabeza

    def reiniciar_mirada(self):
        self.mirada_muestras = []
        self.mirada_suave = None
        self.rasgos_muestras = []
        self.rasgos_ultimo = None
        self.filtro_directo.reiniciar()
        for f in self.filtros_cabeza:
            f.reiniciar()
        self.fijador.reiniciar()
        self.punto_directo = None
        self.fijacion = None
        self.ultimo_salto_punto = None
        self.cabeza_desde_salto = (0.0, 0.0)

    def _mirada_filtrada(self):
        """Punto de pantalla que se mira, suavizado, o None si no hay rasgos
        nuevos y fiables (parpadeo, sin cara, sin calibrar)."""
        from src.detectors.calibracion import es_valido, predecir

        cfg = ConfigManager().config
        modelo = cfg.get("ojos_calibracion")
        if self.curr_rasgos is None:
            return None   # parpadeo o sin cara: el puntero se queda donde está
        if not es_valido(modelo, len(self.curr_rasgos)):
            return None

        # Solo se procesa cada rasgo nuevo una vez (llegan a ~30 fps; este
        # bucle va a ~60 Hz)
        if self.curr_rasgos is self.rasgos_ultimo:
            return None
        self.rasgos_ultimo = self.curr_rasgos

        # Mediana de 5 fotogramas contra saltos sueltos del iris, y One Euro
        # después: muy suave en reposo, rápido al mover la vista.
        self.rasgos_muestras.append(self.curr_rasgos)
        self.rasgos_muestras = self.rasgos_muestras[-5:]
        rasgos = np.median(np.asarray(self.rasgos_muestras), axis=0)

        # La postura de la cabeza también se suaviza: la matriz de MediaPipe
        # tiembla unas décimas de grado y eso serían varios píxeles.
        cabeza = getattr(self, "curr_cabeza", None)
        if cabeza is not None:
            c = list(cabeza)
            for i, f in zip((0, 1, 3, 4), self.filtros_cabeza):
                c[i] = f(c[i])
            cabeza = tuple(c)

        px, py = predecir(modelo, rasgos, cabeza=cabeza)
        suavizado = max(1, int(cfg.get("ojos_suavizado", 6)))
        # 1 → corte 3 Hz (casi sin suavizar); 6 → 0,7 Hz; 30 → 0,2 Hz
        self.filtro_directo.configurar(min_cutoff=3.0 / suavizado ** 0.8, beta=0.003)
        px, py = self.filtro_directo(px, py)
        self.punto_directo = (px, py)
        return px, py

    def mover_por_mirada_directa(self) -> None:
        """Modo directo: el puntero va al punto de la pantalla que se mira.

        Se suaviza con la media de las últimas N muestras y, además, el
        puntero solo se mueve cuando la mirada se aleja más de
        «ojos_fijacion_px» del sitio donde está: así, mientras se fija la
        vista en algo, el puntero se queda quieto (y el clic por permanencia
        puede actuar) en vez de temblar."""
        cfg = ConfigManager().config
        punto = self._mirada_filtrada()
        if punto is None:
            return
        px, py = punto

        # Con la lupa abierta el puntero solo se mueve dentro de ella
        if self.lupa is not None:
            wx1, wy1, wx2, wy2 = self.lupa["rect"]
            margen = 30
            if wx1 - margen <= px <= wx2 + margen and wy1 - margen <= py <= wy2 + margen:
                self.lupa_fuera_desde = None
                px = min(max(px, wx1), wx2 - 1)
                py = min(max(py, wy1), wy2 - 1)
            else:
                if self.lupa_fuera_desde is None:
                    self.lupa_fuera_desde = time.time()
                return

        radio = float(cfg.get("ojos_fijacion_px", 60))
        persistencia = float(cfg.get("ojos_persistencia_ms", 150)) / 1000
        self.fijacion = self.fijador.actualizar(px, py, radio, persistencia,
                                                radio_salto=max(3 * radio, 250.0))
        destino = (int(self.fijacion[0]), int(self.fijacion[1]))
        if destino != self.ultimo_destino:
            self.ultimo_destino = destino
            pyautogui.moveTo(*destino)

    def mover_hibrido(self) -> None:
        """Modo híbrido: la mirada salta el puntero a la zona que se mira y la
        cabeza lo afina con movimientos pequeños.

        Un salto solo ocurre cuando la mirada se fija en un sitio nuevo, lejos
        («hibrido_salto_px») del último sitio al que saltó, y la cabeza está
        quieta: así, afinar con la cabeza (que también mueve un poco la
        estimación de la mirada) no provoca saltos falsos. Tras el salto, la
        cabeza no mueve el puntero durante «hibrido_pausa_ms»."""
        cfg = ConfigManager().config
        ahora = time.time()

        vel = self._velocidad_cabeza()
        factor = cfg.get("hibrido_cabeza", 40) / 100
        vx, vy = (vel[0] * factor, vel[1] * factor) if vel is not None else (0.0, 0.0)
        cabeza_quieta = np.hypot(vx, vy) < 0.6

        punto = self._mirada_filtrada()
        if punto is not None:
            px, py = punto
            radio = float(cfg.get("ojos_fijacion_px", 60))
            persistencia = float(cfg.get("ojos_persistencia_ms", 150)) / 1000
            self.fijacion = self.fijador.actualizar(px, py, radio, persistencia,
                                                    radio_salto=max(3 * radio, 250.0))
            if decidir_salto(self.fijacion, self.ultimo_salto_punto,
                             float(cfg.get("hibrido_salto_px", 150)),
                             self.fijador.moviendo, cabeza_quieta):
                destino = (int(self.fijacion[0]), int(self.fijacion[1]))
                self.ultimo_salto = ahora
                self.ultimo_salto_punto = self.fijacion
                self.cabeza_desde_salto = (0.0, 0.0)
                self.ultimo_destino = destino
                pyautogui.moveTo(*destino)
                return

        if vel is None or (vx == 0.0 and vy == 0.0):
            return
        if ahora - self.ultimo_salto < cfg.get("hibrido_pausa_ms", 250) / 1000:
            return
        pyautogui.move(xOffset=vx, yOffset=vy)
        self.cabeza_desde_salto = (self.cabeza_desde_salto[0] + vx, self.cabeza_desde_salto[1] + vy)

    def fijar_en(self, x, y) -> None:
        """El imán (src/iman.py) llevó el puntero a un control: la fijación
        de la mirada pasa a estar ahí para que no lo devuelva."""
        punto = (float(x), float(y))
        self.fijador.punto = punto
        self.fijador.fuera_desde = None
        self.fijador.moviendo = False
        self.fijacion = punto
        self.ultimo_destino = (int(x), int(y))
        if self.ultimo_salto_punto is not None:
            self.ultimo_salto_punto = punto

    def afinado_con_cabeza(self, minimo_px: float = 12.0) -> bool:
        """Híbrido: ¿la cabeza movió el puntero desde el último salto? Si sí,
        el puntero está donde la persona quiso de verdad (vale para aprender)."""
        dx, dy = self.cabeza_desde_salto
        return float(np.hypot(dx, dy)) >= minimo_px

    def _velocidad_cabeza(self):
        """(vx, vy) en píxeles por vuelta según el movimiento de la cabeza,
        o None mientras el búfer de suavizado se llena."""
        if self.curr_track_loc is None:
            return None
        self.buffer = np.roll(self.buffer, shift=-1, axis=0)
        self.buffer[-1] = self.curr_track_loc

        # Get latest x, y and smooth.
        smooth_px, smooth_py = utils.apply_smoothing(self.buffer, self.smooth_kernel)
        vel_x = smooth_px - self.prev_x
        vel_y = smooth_py - self.prev_y
        self.prev_x = smooth_px
        self.prev_y = smooth_py

        # In delay state
        self.delay_count += 1
        if self.delay_count < N_BUFFER:
            return None

        vel_x, vel_y = self.asymmetry_scale(vel_x, vel_y)
        if ConfigManager().config["mouse_acceleration"]:
            vel_x *= self.accel(vel_x)
            vel_y *= self.accel(vel_y)
        return vel_x, vel_y

    def velocidad_por_mirada(self):
        """Modo «ojos»: el puntero se mueve como con una palanca. Mirar a un
        lado lo empuja hacia ese lado; volver al centro lo detiene."""
        cfg = ConfigManager().config
        if self.curr_mirada is None:
            self.mirada_muestras = []
            return 0.0, 0.0

        # Suavizado por media móvil de las últimas N miradas
        n = max(1, int(cfg.get("ojos_suavizado", 6)))
        self.mirada_muestras.append(self.curr_mirada)
        self.mirada_muestras = self.mirada_muestras[-n:]
        gx = sum(m[0] for m in self.mirada_muestras) / len(self.mirada_muestras)
        gy = sum(m[1] for m in self.mirada_muestras) / len(self.mirada_muestras)
        self.mirada_suave = (gx, gy)

        cx, cy = cfg.get("ojos_centro", [0.0, 0.0])
        zona = cfg.get("ojos_zona_muerta", 4) / 100
        ganancia = cfg.get("ojos_velocidad", 50) * 2.0   # px por tick por unidad
        vertical = cfg.get("ojos_vertical", 150) / 100

        def palanca(d):
            m = abs(d) - zona
            if m <= 0:
                return 0.0
            return np.sign(d) * m * ganancia

        vel_x = palanca(gx - cx)
        vel_y = palanca(gy - cy) * vertical
        tope = 30.0
        return float(np.clip(vel_x, -tope, tope)), float(np.clip(vel_y, -tope, tope))

    def main_loop(self) -> None:
        """ Separate thread for mouse controller
        """

        if self.is_destroyed:
            return

        while not self.stop_flag.is_set():
            try:
                self._vuelta()
            except Exception as e:
                # Sin esto una excepción mataría el hilo y el puntero se
                # quedaría quieto para siempre sin dejar rastro
                logger.error(f"Error moviendo el puntero (se sigue): {e}", exc_info=e)
                time.sleep(0.05)

    def _vuelta(self) -> None:
        """Una vuelta del bucle del puntero (ver main_loop)."""
        if not self.is_active.get():
            time.sleep(0.001)
            return

        if self.calibrando or time.time() < self.congelado_hasta:
            time.sleep(0.01)
            return

        # Un rastreador externo (Tobii, Windows Eye Control…) ya mueve el puntero del
        # sistema: Winclus no lo toca y se queda con los clics y los gestos
        if ConfigManager().config.get("puntero_externo", False):
            time.sleep(ConfigManager().config["tick_interval_ms"] / 1000)
            return

        if ConfigManager().config.get("modo_puntero") == "ojos":
            submodo = ConfigManager().config.get("ojos_modo", "directo")
            if submodo == "directo":
                try:
                    self.mover_por_mirada_directa()
                except Exception as e:
                    logger.warning(f"Mirada directa: {e}")
            elif submodo == "hibrido":
                try:
                    self.mover_hibrido()
                except Exception as e:
                    logger.warning(f"Híbrido: {e}")
                time.sleep(ConfigManager().config["tick_interval_ms"] / 1000)
                return
            else:
                vel_x, vel_y = self.velocidad_por_mirada()
                if vel_x != 0.0 or vel_y != 0.0:
                    pyautogui.move(xOffset=vel_x, yOffset=vel_y)
            # Mantener el búfer de cabeza al día para cambiar de modo sin salto
            if self.curr_track_loc is not None:
                self.buffer = np.roll(self.buffer, shift=-1, axis=0)
                self.buffer[-1] = self.curr_track_loc
                self.prev_x, self.prev_y = utils.apply_smoothing(
                    self.buffer, self.smooth_kernel)
            time.sleep(ConfigManager().config["tick_interval_ms"] / 1000)
            return

        vel = self._velocidad_cabeza()
        if vel is None:
            time.sleep(0.001)
            return
        vel_x, vel_y = vel

        # pydirectinput is not working here
        pyautogui.move(xOffset=vel_x, yOffset=vel_y)

        time.sleep(ConfigManager().config["tick_interval_ms"] / 1000)

    def set_active(self, flag: bool) -> None:
        self.is_active.set(flag)
        if flag:
            self.delay_count = 0

    def toggle_active(self):
        logging.info("Toggle active")
        curr_state = self.is_active.get()
        self.set_active(not curr_state)

    def destroy(self):
        if self.is_active is not None:
            self.is_active.set(False)
        if self.stop_flag is not None:
            self.stop_flag.set()
        self.is_destroyed = True
