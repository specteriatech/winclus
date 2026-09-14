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

import logging
import time

import mediapipe as mp
import numpy as np
import numpy.typing as npt
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

import src.utils as utils
from src.config_manager import ConfigManager
from src.detectors.mirada import DetectorMirada
from src.detectors.parpadeo import DetectorParpadeo
from src.singleton_meta import Singleton

logger = logging.getLogger("FaceMesh")

MP_TASK_FILE = "assets/task/face_landmarker_with_blendshapes.task"

BLENDS_MAX_BUFFER = 100
N_SHAPES = 52
np.set_printoptions(precision=2, suppress=True)


class FaceMesh(metaclass=Singleton):

    def __init__(self):
        logger.info("Intialize FaceMesh singleton")
        self.mp_landmarks = None
        self.track_loc = None
        self.blendshapes_buffer = np.zeros([BLENDS_MAX_BUFFER, N_SHAPES])
        self.smooth_blendshapes = None
        self.model = None
        self.latest_time_ms = 0
        self.is_started = False
        self.n_frames = 0
        self.cabeza = None
        self.parpadeo = DetectorParpadeo()
        self.mirada = DetectorMirada()
        self.n_puntos_avisado = False

    def start(self):
        if not self.is_started:
            logger.info("Start FaceMesh singleton")
            # In Windows, needs to open buffer directly
            with open(MP_TASK_FILE, mode="rb") as f:
                f_buffer = f.read()
            base_options = python.BaseOptions(model_asset_buffer=f_buffer)
            options = vision.FaceLandmarkerOptions(
                base_options=base_options,
                output_face_blendshapes=True,
                output_facial_transformation_matrixes=True,
                running_mode=mp.tasks.vision.RunningMode.LIVE_STREAM,
                num_faces=1,
                result_callback=self.mp_callback)
            self.model = vision.FaceLandmarker.create_from_options(options)

            self.calc_smooth_kernel()

    def calc_smooth_kernel(self):
        self.smooth_kernel = utils.calc_smooth_kernel(
            ConfigManager().config["shape_smooth"])

    def calc_track_loc(self, mp_result, use_transformation_matrix=False):
        screen_w = ConfigManager().config["fix_width"]
        screen_h = ConfigManager().config["fix_height"]
        landmarks = mp_result.face_landmarks[0]

        if use_transformation_matrix:
            M = mp_result.facial_transformation_matrixes[0]
            U, _, V = np.linalg.svd(M[:3, :3])
            R = U @ V

            res = R @ np.array([0, 0, 1])

            x_pixel = (res[0] / 1) * 0.3
            y_pixel = (res[1] / 1) * 0.3

            x_pixel = screen_w / 2 + (x_pixel * screen_w / 2)
            y_pixel = screen_h / 2 - (y_pixel * screen_h / 2)

        else:
            axs = []
            ays = []

            for p in ConfigManager().config["tracking_vert_idxs"]:
                px = landmarks[p].x * screen_w
                py = landmarks[p].y * screen_h
                axs.append(px)
                ays.append(py)

            x_pixel = np.mean(axs)
            y_pixel = np.mean(ays)

        return np.array([x_pixel, y_pixel], np.float32)

    def mp_callback(self, mp_result, output_image, timestamp_ms: int):
        if len(mp_result.face_landmarks) >= 1 and len(
                mp_result.face_blendshapes) >= 1:
            self.mp_landmarks = mp_result.face_landmarks[0]
            # Point for moving pointer
            self.track_loc = self.calc_track_loc(
                mp_result,
                use_transformation_matrix=ConfigManager(
                ).config["use_transformation_matrix"])
            self.blendshapes_buffer = np.roll(self.blendshapes_buffer,
                                              shift=-1,
                                              axis=0)

            self.blendshapes_buffer[-1] = np.array(
                [b.score for b in mp_result.face_blendshapes[0]])
            self.smooth_blendshapes = utils.apply_smoothing(
                self.blendshapes_buffer, self.smooth_kernel)

            # Parpadeo (clic) y mirada (puntero con los ojos)
            cfg = ConfigManager().config
            ancho, alto = cfg["fix_width"], cfg["fix_height"]
            self.parpadeo.procesar(self.mp_landmarks, ancho, alto,
                                   cfg.get("parpadeo_umbral", 0.55),
                                   cfg.get("parpadeo_ms", 200),
                                   blendshapes=self.blendshapes_buffer[-1])
            imagen = None
            if cfg.get("iris_afinado", False):
                try:
                    imagen = output_image.numpy_view()
                except Exception:
                    imagen = None
            self.mirada.procesar(self.mp_landmarks, ancho, alto,
                                 self.blendshapes_buffer[-1], imagen)
            if not self.n_puntos_avisado:
                self.n_puntos_avisado = True
                logger.info(f"Puntos por cara: {len(self.mp_landmarks)} "
                            f"(iris disponible: {self.mirada.disponible})")
            self.n_frames += 1

            # Postura de la cabeza (giro y posición) desde la matriz de MediaPipe
            self.cabeza = self.calc_cabeza(mp_result)

        else:
            self.mp_landmarks = None
            self.track_loc = None
            self.cabeza = None
            self.mirada._sin_datos()

    @staticmethod
    def calc_cabeza(mp_result):
        """(guiñada, cabeceo, balanceo en grados, x, y, z en cm) de la cabeza
        respecto a la cámara, o None. Sirve para compensar en el modo directo
        los pequeños movimientos de cabeza tras calibrar."""
        try:
            M = np.asarray(mp_result.facial_transformation_matrixes[0], dtype=np.float64)
        except Exception:
            return None
        if M.shape != (4, 4):
            return None
        R = M[:3, :3]
        adelante = R @ np.array([0.0, 0.0, 1.0])
        derecha = R @ np.array([1.0, 0.0, 0.0])
        yaw = np.degrees(np.arctan2(adelante[0], adelante[2]))
        pitch = np.degrees(np.arctan2(adelante[1], adelante[2]))
        roll = np.degrees(np.arctan2(derecha[1], derecha[0]))
        tx, ty, tz = M[:3, 3]
        return (float(yaw), float(pitch), float(roll), float(tx), float(ty), float(tz))

    def detect_frame(self, frame_np: npt.ArrayLike):

        t_ms = int(time.time() * 1000)
        if t_ms <= self.latest_time_ms:
            return

        frame_mp = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_np)
        self.model.detect_async(frame_mp, t_ms)
        self.latest_time_ms = t_ms

    def get_landmarks(self):
        return self.mp_landmarks

    def get_track_loc(self):
        return self.track_loc

    def get_blendshapes(self):
        return self.smooth_blendshapes

    def get_mirada(self):
        """(gx, gy) o None si no hay cara, no hay iris o los ojos están cerrados."""
        if not self.mirada.disponible or not self.parpadeo.ojos_abiertos():
            return None
        return self.mirada.mirada

    def get_rasgos(self):
        """Vector de rasgos de la mirada para el modo directo, o None."""
        if not self.mirada.disponible or not self.parpadeo.ojos_abiertos():
            return None
        return self.mirada.rasgos

    def get_cabeza(self):
        """Postura de la cabeza (ver calc_cabeza) o None."""
        return self.cabeza

    def destroy(self):
        if self.model is not None:
            self.model.close()
        self.model = None
        self.mp_landmarks = None
        self.blendshapes_buffer = None
