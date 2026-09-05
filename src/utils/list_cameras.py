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

import cv2

logger = logging.getLogger("ListCamera")


def __open_camera_task(i):

    logger.info(f"Try openning camera: {i}")

    try:
        cap = cv2.VideoCapture(cv2.CAP_DSHOW + i)

        if cap.getBackendName() != "DSHOW":
            logger.info(f"Camera {i}: {cap.getBackendName()} is not supported")
            return (False, i, None)

        if cap.get(cv2.CAP_PROP_FRAME_WIDTH) <= 0:
            logger.info(f"Camera {i}: frame size error.")
            return False, i, None

        ret, frame = cap.read()
        cv2.waitKey(1)

        if not ret:
            logger.info(f"Camera {i}: No frame returned")
            return (False, i, None)

        h, w, _ = frame.shape
        logger.info(f"Camera {i}: {cap} height: {h} width: {w}")

        return (True, i, cap)
    except Exception as e:
        logger.warning(f"Camera {i}: not found {e}")
        return (False, i, None)


def assign_caps_unblock(caps, i):
    ret, _, cap = __open_camera_task(i)
    if not ret:
        logger.info(f"Camera {i}: Failed to open")
    if cap is not None:
        caps[i] = cap

    else:
        if i in caps:
            del caps[i]


def assign_caps_queue(caps, done_callback: callable, max_search: int):

    for i in range(max_search):

        # block
        ret, _, cap = __open_camera_task(i)
        if not ret:
            logger.info(f"Camera {i}: Failed to open")
        if cap is not None:
            caps[i] = cap

    done_callback()


def reabrir_alta_resolucion(caps, i, ancho: int, alto: int) -> bool:
    """Vuelve a abrir la cámara `i` con Media Foundation a la resolución pedida
    (en formato comprimido MJPG). Con DirectShow la c922 se queda en YUY2 y
    cae a 10 fps a 720p; con MSMF mantiene ~23 fps hasta 1080p. Si no se
    consigue, se reabre como estaba."""
    viejo = caps.get(i)
    caps[i] = None          # el bucle de lectura espera mientras tanto
    if viejo is not None:
        viejo.release()
    try:
        cap = cv2.VideoCapture(i, cv2.CAP_MSMF)
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, ancho)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, alto)
        cap.set(cv2.CAP_PROP_FPS, 30)
        ret, frame = cap.read()
        if ret and frame is not None and frame.shape[1] >= ancho * 0.9:
            logger.info(f"Camera {i}: alta resolución {frame.shape[1]}x{frame.shape[0]} (MSMF)")
            caps[i] = cap
            return True
        logger.warning(f"Camera {i}: no da {ancho}x{alto} con MSMF; se vuelve a DirectShow")
        cap.release()
    except Exception as e:
        logger.warning(f"Camera {i}: fallo al reabrir en alta resolución: {e}")
    ret, _, cap = __open_camera_task(i)
    if cap is not None:
        caps[i] = cap
    return False


def open_camera(caps, i):
    """For swapping camera
    """
    pool = futures.ThreadPoolExecutor(max_workers=1)
    pool.submit(assign_caps_unblock, caps, i)
