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
import os
import sys

# OpenCV con Media Foundation tarda 7 s en cada operación si usa las
# transformaciones por hardware; sin ellas abre la cámara en menos de un
# segundo a 1080p. Debe fijarse antes de importar cv2.
os.environ.setdefault("OPENCV_VIDEOIO_MSMF_ENABLE_HW_TRANSFORMS", "0")

import customtkinter

import src.gui as gui
from src.pipeline import Pipeline
from src.task_killer import TaskKiller

FORMAT = "%(asctime)s %(levelname)s %(name)s: %(funcName)s: %(message)s"
logging.basicConfig(format=FORMAT,
                    level=logging.INFO,
                    handlers=[
                        logging.FileHandler("log.txt", mode='w', encoding="utf-8"),
                        logging.StreamHandler(sys.stdout)
                    ])


class MainApp(gui.MainGui, Pipeline):

    def __init__(self, tk_root):
        super().__init__(tk_root)
        # Wait for window drawing.
        self.tk_root.wm_protocol("WM_DELETE_WINDOW", self.close_all)

        self.is_active = True

        # Enter loop
        self.tk_root.after(1, self.anim_loop)

    def anim_loop(self):
        """Una vuelta del pipeline. Un error en cualquier detector o
        controlador se registra con su traza y el bucle SIGUE: antes se
        detenía para siempre y el puntero dejaba de moverse en silencio."""
        if not self.is_active:
            return
        try:
            # Run detectors and controllers.
            self.pipeline_tick()
        except Exception as e:
            logging.critical(f"Error en el pipeline (se sigue): {e}", exc_info=e)
        finally:
            if self.is_active:
                self.tk_root.after(1, self.anim_loop)

    def close_all(self):
        logging.info("Close all")
        self.is_active = False
        # Completely clost this process
        TaskKiller().exit()


def _excepcion_no_controlada(tipo, valor, traza):
    """Sin consola (pythonw o el ejecutable) una excepción del hilo principal
    desaparecería sin dejar rastro: se escribe en log.txt."""
    logging.critical("Excepción no controlada", exc_info=(tipo, valor, traza))


sys.excepthook = _excepcion_no_controlada


def identidad_windows() -> None:
    """Que Windows agrupe la ventana como «Winclus» (y no como Python) en la
    barra de tareas. Debe llamarse antes de crear la ventana."""
    try:
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("Winclus.Winclus")
    except Exception:  # noqa: BLE001 - en otro sistema no existe shell32
        pass


if __name__ == "__main__":
    # Los recursos (assets, configs) cuelgan de la carpeta del programa, tanto
    # al ejecutar el .py como dentro del ejecutable empaquetado con PyInstaller
    os.chdir(getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__))))
    identidad_windows()
    tk_root = customtkinter.CTk()

    logging.info("Starting main app.")
    TaskKiller().start()

    main_app = MainApp(tk_root)
    main_app.tk_root.mainloop()

    main_app = None
