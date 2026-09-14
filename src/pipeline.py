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

from src.camera_manager import CameraManager
from src.controllers import ControladorClic, Keybinder, MouseController
from src.detectors import FaceMesh
from src.detectors.aprendizaje import AprendizajeClics


class Pipeline:

    def __init__(self):
        logging.info("Init Pipeline")

    def pipeline_tick(self) -> None:

        # Detect landmarks (async) only when a new camera frame arrived.
        # Antes del primer fotograma la imagen es la de relleno (que tiene
        # una cara dibujada): no se detecta nada sobre ella.
        frame_id = CameraManager().get_frame_id()
        if frame_id == 0:
            MouseController().act_mirada(None)
            MouseController().act_rasgos(None)
            CameraManager().draw_overlay(track_loc=None)
            return
        if frame_id != getattr(self, "_ultimo_frame", None):
            self._ultimo_frame = frame_id
            FaceMesh().detect_frame(CameraManager().get_raw_frame())

        # Get facial landmarks
        landmarks = FaceMesh().get_landmarks()
        if (landmarks is None):
            MouseController().act_mirada(None)
            MouseController().act_rasgos(None)
            ControladorClic().tick()
            CameraManager().draw_overlay(track_loc=None)
            return

        # Control mouse position (head or eyes)
        track_loc = FaceMesh().get_track_loc()
        MouseController().act(track_loc)
        MouseController().act_mirada(FaceMesh().get_mirada())
        MouseController().act_rasgos(FaceMesh().get_rasgos(), FaceMesh().get_cabeza())
        # Calibración invisible: recuerda los rasgos por si llega un clic
        AprendizajeClics().registrar(FaceMesh().get_rasgos(), FaceMesh().get_cabeza())

        # Control keyboard
        blendshape_values = FaceMesh().get_blendshapes()
        Keybinder().act(blendshape_values)

        # Clic por parpadeo o por permanencia
        ControladorClic().tick()

        # Draw frame overlay
        CameraManager().draw_overlay(track_loc, FaceMesh().mirada.puntos)
