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

import copy
import json
import logging
import re
import shutil
import zipfile
import time
import tkinter as tk
from pathlib import Path

from src.singleton_meta import Singleton
from src.task_killer import TaskKiller

VERSION = "0.1.0"

DEFAULT_JSON = Path("configs/default.json")
BACKUP_PROFILE = Path("configs/Inicial")

logger = logging.getLogger("ConfigManager")

# Claves añadidas por Winclus a cursor.json. Si un perfil viejo no las tiene,
# se rellenan con estos valores al cargarlo.
VALORES_POR_DEFECTO = {
    # Resolución a la que se captura para el detector (la vista previa sigue
    # a fix_width x fix_height). Más resolución = iris más preciso.
    "captura_ancho": 1920,
    "captura_alto": 1080,
    # Buscar el borde del iris en la imagen grande (detectors/iris_fino.py).
    # Con poca luz tiembla más que MediaPipe; solo conviene con buena luz y
    # la cámara cerca (ojo de más de 120 px de ancho).
    "iris_afinado": False,
    # Cómo hago clic: "parpadeo", "boca", "cejas" o "quieto"
    "modo_clic": "parpadeo",
    "parpadeo_ms": 200,          # ojos cerrados al menos este tiempo = clic
    "parpadeo_umbral": 0.55,     # fracción de la apertura normal del ojo
    "quieto_ms": 1100,           # puntero quieto este tiempo = clic
    "quieto_radio_px": 40,       # moverse menos que esto sigue siendo «quieto»
    "quieto_anillo": True,       # dibujar el anillo que se llena junto al puntero
    # Cómo muevo el puntero: "cabeza" u "ojos"
    "modo_puntero": "cabeza",
    # Con los ojos: "directo" (el puntero va a donde miras, tras calibrar),
    # "hibrido" (la mirada salta el puntero a la zona y la cabeza lo afina)
    # o "palanca" (mirar a un lado empuja el puntero hacia ese lado)
    "ojos_modo": "directo",
    "hibrido_cabeza": 40,        # % de la velocidad de cabeza para afinar
    "hibrido_salto_px": 150,     # la mirada debe irse al menos esto para saltar
    "hibrido_pausa_ms": 250,     # tras un salto, la cabeza no mueve durante esto
    "ojos_calibracion": None,    # modelo de detectors/calibracion.py
    "ojos_fijacion_px": 60,      # el puntero no se mueve si la mirada cambia menos
    "ojos_persistencia_ms": 150, # la mirada debe llevar este tiempo fuera para moverlo
    "puntero_externo": False,    # otro aparato mueve el puntero (Tobii, Windows Eye Control): Winclus solo clics y gestos
    "bordes_desplazan": True,    # el puntero en el borde de abajo baja la página y en el de arriba la sube
    "lupa_activa": True,         # clic en dos pasos con la zona agrandada
    "lupa_zoom": 3,              # aumento de la lupa
    "lupa_region_px": 220,       # lado de la zona real que se agranda
    "lupa_tiempo_max_s": 8,      # se cierra sola si no se hace clic
    "ojos_recentrar_largo": True,   # ojos cerrados 1,2 s = corregir el centro
    # Opciones de la calibración
    "calib_modo": "normal",      # "rapida" (9 puntos), "normal" (13 + seguimiento), "completa" (25 + largo)
    "calib_lento": False,        # más tiempo por punto
    "calib_punto_grande": False, # punto más grande, para quien ve peor
    "calib_cabeza": True,        # paso opcional de compensación de cabeza
    "calib_invisible": True,     # aprender de cada clic (detectors/aprendizaje.py)
    "avisos_visuales": True,     # etiqueta junto al puntero en cada clic (gui/aviso.py)
    "avisos_sonido": False,      # pitido corto en cada clic
    # Voz (src/voz.py): tecla «Decir» y frases guardadas
    "voz_activa": True,
    "voz_nombre": "",            # descripción de la voz SAPI; vacío = la primera en español
    "voz_velocidad": 0,          # -5 (lenta) .. 5 (rápida)
    "voz_eco": False,            # leer cada palabra al terminarla
    # Hablarle a Winclus (src/escucha.py, src/control_voz.py)
    "voz_escuchar_al_activar": False,   # encender el micrófono al activar Winclus
    "voz_dictado_confirmar": False,     # enseñar lo dictado y esperar un «sí»
    # Barrido con un pulsador en todo Windows (src/barrido.py)
    "barrido_activo": False,
    "barrido_ms": 1500,          # tiempo en cada control
    "barrido_tecla": "espacio",  # tecla-pulsador: "espacio", "intro", "f8", "f9", "f10" o "ninguna" (solo el gesto)
    "barrido_voz": True,         # decir el nombre de cada control marcado
    # Imán a los controles (src/iman.py), solo con el puntero por los ojos
    "iman_activo": True,
    "iman_radio_px": 90,
    "ojos_usar": "ambos",        # "ambos", "derecho" o "izquierdo"
    "ojos_centro": [0.0, 0.0],   # palanca: mirada en reposo («Fijar el centro»)
    "ojos_velocidad": 50,        # 1..100
    "ojos_zona_muerta": 4,       # 1..15, en centésimas del ancho del ojo
    "ojos_vertical": 150,        # % de velocidad extra en vertical
    "ojos_suavizado": 6,         # 1..30 muestras
    # Teclado en pantalla (gui/teclado_pantalla.py)
    "teclado_posicion": "abajo",       # "abajo" o "arriba"
    "teclado_altura": 32,              # % del alto de la pantalla
    "teclado_ancho": 100,              # % del ancho de la pantalla
    "teclado_prediccion": True,        # fila de palabras sugeridas
    "teclado_sonido": True,            # pitido corto al pulsar
    "teclado_mostrar_al_activar": False,
}


class ConfigManager(metaclass=Singleton):

    def __init__(self):
        logger.info("Intialize ConfigManager singleton")
        self.version = VERSION
        self.unsave_configs = False
        self.unsave_mouse_bindings = False
        self.unsave_keyboard_bindings = False
        self.config = None

        # Load config
        self.curr_profile_path = None
        self.curr_profile_name = tk.StringVar()
        self.is_started = False

        self.profiles = self.list_profile()

    def start(self):
        if not self.is_started:
            logger.info("Start ConfigManager singleton")
            if not DEFAULT_JSON.is_file():
                logger.critical(f"Missing {DEFAULT_JSON}, exit program...")
                TaskKiller().exit()

            try:
                with open(DEFAULT_JSON) as f:
                    self.load_profile(json.load(f)["default"])
            except Exception as e:
                logging.error(e)
                logging.error(
                    f"Failed to load default profile {DEFAULT_JSON}, using first profile instead."
                )
                self.load_profile(self.list_profile()[0])
            self.is_started = True

    def list_profile(self) -> list:
        profile_dirs = []
        for dir in DEFAULT_JSON.parent.glob("*"):
            if dir.is_dir():
                profile_dirs.append(dir.name)
        logger.info(profile_dirs)
        return profile_dirs

    def remove_profile(self, profile_name):
        logger.info(f"Remove profile {profile_name}")
        shutil.rmtree(Path(DEFAULT_JSON.parent, profile_name))
        self.profiles.remove(profile_name)
        logger.info(f"Current profiles: {self.profiles}")

    def add_profile(self):
        # Random name base on local timestamp
        new_profile_name = "Perfil " + str(hex(int(time.time() * 1000)))[-5:]
        logger.info(f"Add profile {new_profile_name}")
        shutil.copytree(BACKUP_PROFILE,
                        Path(DEFAULT_JSON.parent, new_profile_name))
        self.profiles.append(new_profile_name)
        logger.info(f"Current profiles: {self.profiles}")

    def export_profile(self, profile_name: str, destino) -> Path:
        """Empaqueta los archivos del perfil (ajustes, gestos, calibración y
        clics aprendidos) en un .winclus, que es un zip normal."""
        origen = Path(DEFAULT_JSON.parent, profile_name)
        destino = Path(destino)
        with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
            for f in sorted(origen.iterdir()):
                if f.is_file() and f.suffix == ".json":
                    z.write(f, f.name)
        logger.info(f"Perfil {profile_name} exportado a {destino}")
        return destino

    def import_profile(self, origen, nombre=None) -> str:
        """Crea un perfil nuevo a partir de un .winclus. Nunca pisa uno que
        exista: si el nombre está ocupado, añade un número. Devuelve el
        nombre del perfil creado."""
        origen = Path(origen)
        with zipfile.ZipFile(origen) as z:
            nombres = [n for n in z.namelist() if n.endswith(".json") and "/" not in n and "\\" not in n]
            for necesario in ("cursor.json", "mouse_bindings.json", "keyboard_bindings.json"):
                if necesario not in nombres:
                    raise ValueError(f"No es un perfil de Winclus: falta {necesario}")
            base = re.sub(r'[\\/:*?"<>|]+', " ", nombre or origen.stem).strip() or "Perfil importado"
            final, i = base, 2
            while Path(DEFAULT_JSON.parent, final).exists():
                final = f"{base} {i}"
                i += 1
            carpeta = Path(DEFAULT_JSON.parent, final)
            carpeta.mkdir()
            for n in nombres:
                carpeta.joinpath(n).write_bytes(z.read(n))
        self.profiles.append(final)
        logger.info(f"Perfil importado de {origen} como «{final}»")
        return final

    def rename_profile(self, old_profile_name, new_profile_name):
        logger.info(f"Rename profile {old_profile_name} to {new_profile_name}")
        shutil.move(Path(DEFAULT_JSON.parent, old_profile_name),
                    Path(DEFAULT_JSON.parent, new_profile_name))
        self.profiles.remove(old_profile_name)
        self.profiles.append(new_profile_name)

        if self.curr_profile_name.get() == old_profile_name:
            self.curr_profile_name.set(new_profile_name)



    def load_profile(self, profile_name: str) -> list[bool, Path]:
        profile_path = Path(DEFAULT_JSON.parent, profile_name)
        logger.info(f"Loading profile: {profile_path}")

        cursor_config_file = Path(profile_path, "cursor.json")
        mouse_bindings_file = Path(profile_path, "mouse_bindings.json")
        keyboard_bindings_file = Path(profile_path, "keyboard_bindings.json")

        if (not cursor_config_file.is_file()) or (
                not mouse_bindings_file.is_file()) or (
                    not keyboard_bindings_file.is_file()):
            logger.critical(
                f"{profile_path.as_posix()} Invalid configuration files or missing files, exit program..."
            )
            raise FileNotFoundError

        # Load cursor config
        with open(cursor_config_file) as f:
            self.config = json.load(f)
        for clave, valor in VALORES_POR_DEFECTO.items():
            self.config.setdefault(clave, copy.deepcopy(valor))

        # Load mouse bindings
        with open(mouse_bindings_file) as f:
            self.mouse_bindings = json.load(f)

        # Load keyboard bindings
        with open(keyboard_bindings_file) as f:
            self.keyboard_bindings = json.load(f)

        self.temp_config = copy.deepcopy(self.config)
        self.temp_mouse_bindings = copy.deepcopy(self.mouse_bindings)
        self.temp_keyboard_bindings = copy.deepcopy(self.keyboard_bindings)

        self.curr_profile_path = profile_path
        self.curr_profile_name.set(profile_name)

    def switch_profile(self, profile_name: str):
        logger.info(f"Switching to profile: {profile_name}")
        self.load_profile(profile_name)
        with open(DEFAULT_JSON, "w") as f:
            json.dump({"default": profile_name}, f)

    # ------------------------------- BASIC CONFIG ------------------------------- #

    def set_temp_config(self, field: str, value):
        logger.info(f"Setting {field} to {value}")
        self.temp_config[field] = value
        self.unsave_configs = True

    def write_config_file(self):
        cursor_config_file = Path(self.curr_profile_path, "cursor.json")
        logger.info(f"Writing config file {cursor_config_file}")
        with open(cursor_config_file, 'w') as f:
            json.dump(self.config, f, indent=4, separators=(', ', ': '))

    def apply_config(self):
        logger.info("Applying config")
        self.config = copy.deepcopy(self.temp_config)
        self.write_config_file()
        self.unsave_configs = False

    # ------------------------------ MOUSE BINDINGS CONFIG ----------------------------- #

    def set_temp_mouse_binding(self, gesture, device: str, action: str,
                               threshold: float, trigger_type: str):

        logger.info(
            "setting keybind for gesture: %s, device: %s, key: %s, threshold: %s, trigger_type: %s",
            gesture, device, action, threshold, trigger_type)

        # Remove duplicate keybinds
        self.remove_temp_mouse_binding(device, action)

        # Assign
        self.temp_mouse_bindings[gesture] = [
            device, action, float(threshold), trigger_type
        ]
        self.unsave_mouse_bindings = True

    def remove_temp_mouse_binding(self, device: str, action: str):
        logger.info(
            f"remove_temp_mouse_binding for device: {device}, key: {action}")
        out_keybinds = {}
        for key, vals in self.temp_mouse_bindings.items():
            if (device == vals[0]) and (action == vals[1]):
                continue
            out_keybinds[key] = vals
        self.temp_mouse_bindings = out_keybinds
        self.unsave_mouse_bindings = True

    def apply_mouse_bindings(self):
        logger.info("Applying keybinds")
        self.mouse_bindings = copy.deepcopy(self.temp_mouse_bindings)
        self.write_mouse_bindings_file()
        self.unsave_mouse_bindings = False

    def write_mouse_bindings_file(self):
        mouse_bindings_file = Path(self.curr_profile_path,
                                   "mouse_bindings.json")
        logger.info(f"Writing keybinds file {mouse_bindings_file}")

        with open(mouse_bindings_file, 'w') as f:
            out_json = dict(sorted(self.mouse_bindings.items()))
            json.dump(out_json, f, indent=4, separators=(', ', ': '))

    # ------------------------------ KEYBOARD BINDINGS CONFIG ----------------------------- #

    def set_temp_keyboard_binding(self, device: str, key_action: str,
                                  gesture: str, threshold: float,
                                  trigger_type: str):
        logger.info(
            "setting keybind for gesture: %s, device: %s, key: %s, threshold: %s, trigger_type: %s",
            gesture, device, key_action, threshold, trigger_type)

        # Remove duplicate keybinds
        self.remove_temp_keyboard_binding(device, key_action, gesture)

        # Assign
        self.temp_keyboard_bindings[gesture] = [
            device, key_action,
            float(threshold), trigger_type
        ]
        self.unsave_keyboard_bindings = True

    def remove_temp_keyboard_binding(self,
                                     device: str,
                                     key_action: str = "None",
                                     gesture: str = "None"):
        """Remove binding from config by providing either key_action or gesture.
        """

        logger.info(
            f"remove_temp_keyboard_binding for device: {device}, key: {key_action} or gesture {gesture}"
        )

        out_keybinds = {}
        for ges, vals in self.temp_keyboard_bindings.items():
            if (gesture == ges):
                continue
            if (key_action == vals[1]):
                continue

            out_keybinds[ges] = vals

        self.temp_keyboard_bindings = out_keybinds

        self.unsave_keyboard_bindings = True
        return

    def apply_keyboard_bindings(self):
        logger.info("Applying keyboard bindings")

        self.keyboard_bindings = copy.deepcopy(self.temp_keyboard_bindings)
        self.write_keyboard_bindings_file()
        self.unsave_keyboard_bindings = False

    def write_keyboard_bindings_file(self):
        keyboard_bindings_file = Path(self.curr_profile_path,
                                      "keyboard_bindings.json")
        logger.info(f"Writing keyboard bindings file {keyboard_bindings_file}")

        with open(keyboard_bindings_file, 'w') as f:
            out_json = dict(sorted(self.keyboard_bindings.items()))
            json.dump(out_json, f, indent=4, separators=(', ', ': '))

    # ---------------------------------------------------------------------------- #
    def apply_all(self):
        self.apply_config()
        self.apply_mouse_bindings()
        self.apply_keyboard_bindings()

    def destroy(self):
        logger.info("Destory")
