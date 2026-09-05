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
        self.punto_directo = None     # (x, y) suavizado, para la interfaz
        self.fijacion = None          # (x, y) donde está quieto el puntero
        self.calibrando = False       # la ventana de calibración manda

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

    def act_rasgos(self, rasgos):
        """Rasgos de la mirada para el modo directo, o None si no son fiables."""
        self.curr_rasgos = rasgos

    def reiniciar_mirada(self):
        self.mirada_muestras = []
        self.mirada_suave = None
        self.rasgos_muestras = []
        self.rasgos_ultimo = None
        self.filtro_directo.reiniciar()
        self.punto_directo = None
        self.fijacion = None

    def mover_por_mirada_directa(self) -> None:
        """Modo directo: el puntero va al punto de la pantalla que se mira.

        Se suaviza con la media de las últimas N muestras y, además, el
        puntero solo se mueve cuando la mirada se aleja más de
        «ojos_fijacion_px» del sitio donde está: así, mientras se fija la
        vista en algo, el puntero se queda quieto (y el clic por permanencia
        puede actuar) en vez de temblar."""
        from src.detectors.calibracion import es_valido, predecir

        cfg = ConfigManager().config
        modelo = cfg.get("ojos_calibracion")
        if self.curr_rasgos is None:
            return   # parpadeo o sin cara: el puntero se queda donde está
        if not es_valido(modelo, len(self.curr_rasgos)):
            return

        # Solo se procesa cada rasgo nuevo una vez (llegan a ~30 fps; este
        # bucle va a ~60 Hz)
        if self.curr_rasgos is self.rasgos_ultimo:
            return
        self.rasgos_ultimo = self.curr_rasgos

        # Mediana corta contra saltos sueltos del iris, y One Euro después:
        # muy suave en reposo, rápido al mover la vista.
        self.rasgos_muestras.append(self.curr_rasgos)
        self.rasgos_muestras = self.rasgos_muestras[-3:]
        rasgos = np.median(np.asarray(self.rasgos_muestras), axis=0)
        px, py = predecir(modelo, rasgos)
        suavizado = max(1, int(cfg.get("ojos_suavizado", 6)))
        # 1 → corte 4 Hz (casi sin suavizar); 30 → 0,25 Hz (muy suave)
        self.filtro_directo.configurar(min_cutoff=4.0 / (1 + (suavizado - 1) * 0.5),
                                       beta=0.004)
        px, py = self.filtro_directo(px, py)
        self.punto_directo = (px, py)

        radio = float(cfg.get("ojos_fijacion_px", 60))
        if self.fijacion is None:
            self.fijacion = (px, py)
        else:
            fx, fy = self.fijacion
            if np.hypot(px - fx, py - fy) > radio:
                # Se desliza hacia el nuevo punto en pocos ticks
                self.fijacion = (fx + 0.35 * (px - fx), fy + 0.35 * (py - fy))
        pyautogui.moveTo(int(self.fijacion[0]), int(self.fijacion[1]))

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
            if not self.is_active.get():
                time.sleep(0.001)
                continue

            if self.calibrando:
                time.sleep(0.01)
                continue

            if ConfigManager().config.get("modo_puntero") == "ojos":
                if ConfigManager().config.get("ojos_modo", "directo") == "directo":
                    try:
                        self.mover_por_mirada_directa()
                    except Exception as e:
                        logger.warning(f"Mirada directa: {e}")
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
                continue

            if self.curr_track_loc is None:
                time.sleep(0.001)
                continue

            self.buffer = np.roll(self.buffer, shift=-1, axis=0)
            self.buffer[-1] = self.curr_track_loc

            # Get latest x, y and smooth.
            smooth_px, smooth_py = utils.apply_smoothing(
                self.buffer, self.smooth_kernel)

            vel_x = smooth_px - self.prev_x
            vel_y = smooth_py - self.prev_y

            self.prev_x = smooth_px
            self.prev_y = smooth_py

            # In delay state
            self.delay_count += 1
            if self.delay_count < N_BUFFER:
                time.sleep(0.001)
                continue

            vel_x, vel_y = self.asymmetry_scale(vel_x, vel_y)

            if ConfigManager().config["mouse_acceleration"]:
                vel_x *= self.accel(vel_x)
                vel_y *= self.accel(vel_y)

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
