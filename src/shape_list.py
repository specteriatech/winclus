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
#
# Adaptado para Winclus: nombres de gestos y acciones en español.

# Nombre que se muestra cuando una acción no tiene gesto asignado.
SIN_GESTO = "Ninguno"

# Lista de los 52 blendshapes de MediaPipe en su orden original.
# Los que la persona puede elegir tienen nombre en español; el resto conserva
# el nombre técnico. Derecha e izquierda están intercambiadas porque la
# cámara se ve en espejo.
blendshape_names = [
    SIN_GESTO,
    "Bajar la ceja derecha",
    "Bajar la ceja izquierda",
    "Subir las cejas",
    "Subir la ceja derecha",
    "Subir la ceja izquierda",
    "cheekPuff",
    "cheekSquintRight",
    "cheekSquintLeft",
    "eyeBlinkRight",
    "eyeBlinkLeft",
    "eyeLookDownRight",
    "eyeLookDownLeft",
    "eyeLookInRight",
    "eyeLookInLeft",
    "eyeLookOutRight",
    "eyeLookOutLeft",
    "eyeLookUpRight",
    "eyeLookUpLeft",
    "eyeSquintRight",
    "eyeSquintLeft",
    "eyeWideRight",
    "eyeWideLeft",
    "jawForward",
    "jawRight",
    "Abrir la boca",
    "jawLeft",
    "mouthClose",
    "mouthDimpleRight",
    "mouthDimpleLeft",
    "mouthFrownRight",
    "mouthFrownLeft",
    "mouthFunnel",
    "Boca hacia la derecha",
    "mouthLowerDownRight",
    "mouthLowerDownLeft",
    "mouthPressRight",
    "mouthPressLeft",
    "mouthPucker",
    "Boca hacia la izquierda",
    "Meter el labio de abajo",
    "Meter el labio de arriba",
    "mouthShrugLower",
    "mouthShrugUpper",
    "mouthSmileRight",
    "mouthSmileLeft",
    "mouthStretchRight",
    "mouthStretchLeft",
    "mouthUpperUpRight",
    "mouthUpperUpLeft",
    "noseSneerRight",
    "noseSneerLeft",
    # Gestos que Winclus calcula además de los 52 de MediaPipe (detectors/facemesh.py):
    # un guiño es un ojo cerrado con el otro abierto (un parpadeo normal no cuenta) y la
    # inclinación sale del balanceo de la cabeza. Derecha e izquierda, como se ven en espejo.
    "Guiñar el ojo izquierdo",
    "Guiñar el ojo derecho",
    "Inclinar la cabeza a la izquierda",
    "Inclinar la cabeza a la derecha",
]
N_MEDIAPIPE = 52                     # los que da el modelo; después van los calculados
blendshape_indices = {name: i for i, name in enumerate(blendshape_names)}

# Acciones del mouse que se pueden asignar a un gesto.
available_actions = {
    "Clic izquierdo": ["mouse", "left"],
    "Clic derecho": ["mouse", "right"],
    "Clic del medio (rueda)": ["mouse", "middle"],
    "Pausar o reanudar": ["mouse", "pause"],
    "Llevar el puntero al centro": ["mouse", "reset"],
    "Cambiar de pantalla": ["mouse", "cycle"]
}
available_actions_keys = list(available_actions.keys())
# Acciones que se asignan en la lista «Otras acciones» (el clic izquierdo se
# elige en «Cómo hago clic»).
acciones_secundarias = [k for k in available_actions if k != "Clic izquierdo"]
available_actions_values = list(available_actions.values())

# Gestos que la persona puede elegir, con su dibujo.
available_gestures = {
    SIN_GESTO: "assets/images/dropdowns/ninguno.png",
    "Abrir la boca": "assets/images/dropdowns/abrir_boca.png",
    "Boca hacia la izquierda": "assets/images/dropdowns/boca_izquierda.png",
    "Boca hacia la derecha": "assets/images/dropdowns/boca_derecha.png",
    "Meter el labio de abajo": "assets/images/dropdowns/meter_labio_abajo.png",
    "Subir la ceja izquierda": "assets/images/dropdowns/subir_ceja_izquierda.png",
    "Bajar la ceja izquierda": "assets/images/dropdowns/bajar_ceja_izquierda.png",
    "Subir la ceja derecha": "assets/images/dropdowns/subir_ceja_derecha.png",
    "Bajar la ceja derecha": "assets/images/dropdowns/bajar_ceja_derecha.png",
    "Subir las cejas": "assets/images/dropdowns/subir_cejas.png",
    "Guiñar el ojo izquierdo": "assets/images/dropdowns/guino_izquierdo.png",
    "Guiñar el ojo derecho": "assets/images/dropdowns/guino_derecho.png",
    "Inclinar la cabeza a la izquierda": "assets/images/dropdowns/cabeza_izquierda.png",
    "Inclinar la cabeza a la derecha": "assets/images/dropdowns/cabeza_derecha.png",
}
for k, v in available_gestures.items():
    assert k in blendshape_names, f"{k} no está en blendshape_names"
available_gestures_keys = list(available_gestures.keys())

# Nombre de tecla de tkinter -> nombre que entiende pydirectinput
keyboard_keys = {
    # Números
    "0": "0",
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8",
    "9": "9",

    # Teclas de función
    "f1": "f1",
    "f2": "f2",
    "f3": "f3",
    "f4": "f4",
    "f5": "f5",
    "f6": "f6",
    "f7": "f7",
    "f8": "f8",
    "f9": "f9",
    "f10": "f10",
    "f11": "f11",
    "f12": "f12",
    "f13": "f13",
    "f14": "f14",
    "f15": "f15",
    "f16": "f16",
    "f17": "f17",
    "f18": "f18",
    "f19": "f19",
    "f20": "f20",
    "f21": "f21",
    "f22": "f22",
    "f23": "f23",
    "f24": "f24",

    # Letras
    "a": "a",
    "b": "b",
    "c": "c",
    "d": "d",
    "e": "e",
    "f": "f",
    "g": "g",
    "h": "h",
    "i": "i",
    "j": "j",
    "k": "k",
    "l": "l",
    "m": "m",
    "n": "n",
    "o": "o",
    "p": "p",
    "q": "q",
    "r": "r",
    "s": "s",
    "t": "t",
    "u": "u",
    "v": "v",
    "w": "w",
    "x": "x",
    "y": "y",
    "z": "z",

    # Signos
    "exclam": "!",
    "at": "@",
    "numbersign": "#",
    "dollar": "$",
    "percent": "%",
    "asciicircum": "^",
    "ampersand": "&",
    "asterisk": "*",
    "parenleft": "(",
    "parenright": ")",
    "minus": "-",
    "plus": "+",
    "underscore": "_",
    "equal": "=",
    "bracketleft": "[",
    "bracketright": "]",
    "braceleft": "{",
    "braceright": "}",
    "backslash": "\\",
    "semicolon": ";",
    "colon": ":",
    "apostrophe": "'",
    "quotedbl": "\"",
    "grave": "`",
    "comma": ",",
    "less": "<",
    "greater": ">",
    "question": "?",
    "slash": "/",
    "asciitilde": "~",
    "bar": "|",
    "period": ".",

    # Otras
    "return": "enter",
    "backspace": "backspace",
    "tab": "tab",
    "space": "space",
    "delete": "delete",
    "home": "home",
    "end": "end",
    "next": "pagedown",
    "prior": "pageup",
    "win_l": "win",
    "caps_lock": "capslock",
    "shift_l": "shiftleft",
    "shift_r": "shiftright",
    "control_l": "ctrlleft",
    "control_r": "ctrlright",
    "alt_l": "altleft",
    "alt_r": "altright",
    "num_lock": "numlock",

    # Flechas
    "up": "up",
    "down": "down",
    "left": "left",
    "right": "right",
}
available_keyboard_keys = list(keyboard_keys.keys())
