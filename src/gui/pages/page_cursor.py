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
# Adaptado para Gestik: página «Puntero» con el selector «Cómo muevo el
# puntero» (con la cabeza o con los ojos) y los ajustes de cada modo.

import logging
import tkinter
from functools import partial

import customtkinter

from src import estilo
import numpy as np
from PIL import Image

from src.config_manager import ConfigManager
from src.controllers import MouseController
from src.detectors import FaceMesh
from src.gui.balloon import Balloon
from src.gui.frames.safe_disposable_frame import SafeDisposableFrame, SafeDisposableScrollableFrame
from src.gui.tarjetas import SelectorTarjetas

logger = logging.getLogger("PageCursor")
MAX_ROWS = 3
HELP_ICON_SIZE = (18, 18)
MAX_HOLD_TRIG = 5000

OPCIONES_PUNTERO = [
    ("cabeza", "cabeza", "Con la cabeza", "Muevo la cabeza y el puntero la sigue"),
    ("ojos", "ojo", "Con los ojos", "Miro hacia un lado y el puntero va hacia allá"),
]

AJUSTES_CABEZA = {
    "Hacia arriba": ["spd_up", "", 0, 100],
    "Hacia abajo": ["spd_down", "", 0, 100],
    "Hacia la derecha": ["spd_right", "", 0, 100],
    "Hacia la izquierda": ["spd_left", "", 0, 100],
    "(Avanzado) Suavizar el puntero": [
        "pointer_smooth",
        "Qué tan suave se mueve el puntero.\nSubirlo quita el temblor, pero\nresponde un poco más lento.",
        1, 100
    ],
    "(Avanzado) Suavizar los gestos": [
        "shape_smooth", "Evita que un gesto se dispare\nvarias veces por un parpadeo\nde la detección.",
        1, 100
    ],
    "(Avanzado) Tiempo para mantener (ms)": [
        "hold_trigger_ms",
        "Cuánto tiempo (en milisegundos)\nhay que sostener el gesto para\nque el clic se quede presionado.",
        1, MAX_HOLD_TRIG
    ]
}

AJUSTES_OJOS = {
    "Velocidad": [
        "ojos_velocidad",
        "Qué tan rápido va el puntero\ncuando miras hacia un lado.", 1, 100
    ],
    "Zona quieta": [
        "ojos_zona_muerta",
        "Cuánto puedes mover los ojos\nsin que el puntero se mueva.\nSúbela si el puntero se va solo.",
        1, 15
    ],
    "Arriba y abajo (%)": [
        "ojos_vertical",
        "Los ojos se mueven menos hacia\narriba y abajo: aquí se compensa.", 50, 300
    ],
    "(Avanzado) Suavizar la mirada": [
        "ojos_suavizado", "Más suave = menos temblor,\npero responde más lento.", 1, 30
    ],
}

# Cuadro donde se ve la mirada en vivo
CUADRO = (220, 160)
ESCALA_MIRADA = 500   # píxeles del cuadro por unidad de mirada


class FrameSelectGesture(SafeDisposableFrame):
    """Lista de deslizadores que escriben directamente en cursor.json."""

    def __init__(
        self,
        master,
        ajustes: dict = None,
        **kwargs,
    ):
        super().__init__(master, **kwargs)

        self.grid_rowconfigure(MAX_ROWS, weight=1)
        self.grid_columnconfigure(1, weight=1)
        self.slider_dragging = False
        self.help_icon = customtkinter.CTkImage(
            Image.open("assets/images/help.png").resize(HELP_ICON_SIZE),
            size=HELP_ICON_SIZE)

        self.shared_info_balloon = Balloon(
            self, image_path="assets/images/balloon.png")

        # Slider divs
        self.divs = self.create_divs(ajustes if ajustes is not None else AJUSTES_CABEZA)

        self.load_initial_config()

    def load_initial_config(self):
        """Load default from config and set the UI
        """

        for cfg_name, div in self.divs.items():

            cfg_value = int(
                np.clip(ConfigManager().config[cfg_name],
                        a_min=0,
                        a_max=MAX_HOLD_TRIG))
            div["slider"].set(cfg_value)
            # Temporary remove trace, adjust the value and put it back
            div["entry_var"].trace_vdelete("w", div["entry_trace_id"])
            div["entry_var"].set(cfg_value)
            div["entry_trace_id"] = div["entry_var"].trace(
                "w", div["entry_trace_fn"])

    def create_divs(self, directions: dict):
        out_dict = {}

        for idx, (show_name, (cfg_name, balloon_text, slider_min,
                              slider_max)) in enumerate(directions.items()):

            help_image = self.help_icon if balloon_text != "" else None
            # Label
            label = customtkinter.CTkLabel(master=self,
                                           image=help_image,
                                           compound='right',
                                           text=show_name,
                                           justify=tkinter.LEFT)
            label.configure(font=estilo.fuente("etiqueta"))
            label.grid(row=idx, column=0, padx=20, pady=(10, 10), sticky="nw")
            self.shared_info_balloon.register_widget(label, balloon_text)

            # Slider
            slider = customtkinter.CTkSlider(master=self,
                                             from_=slider_min,
                                             to=slider_max,
                                             width=250,
                                             number_of_steps=min(99, slider_max - slider_min),
                                             command=partial(
                                                 self.slider_drag_callback,
                                                 cfg_name))
            slider.bind("<Button-1>",
                        partial(self.slider_mouse_down_callback, cfg_name))
            slider.bind("<ButtonRelease-1>",
                        partial(self.slider_mouse_up_callback, cfg_name))
            slider.grid(row=idx, column=0, padx=30, pady=(40, 10), sticky="nw")

            # Number entry
            entry_var = tkinter.StringVar()
            entry_trace_fn = partial(self.entry_changed_callback, cfg_name,
                                     slider_min, slider_max)
            entry_var_trace_id = entry_var.trace("w", entry_trace_fn)
            entry = customtkinter.CTkEntry(
                master=self,
                validate='all',
                textvariable=entry_var,
                #validatecommand=vcmd,
                width=62)
            entry.grid(row=idx,
                       column=0,
                       padx=(300, 5),
                       pady=(34, 10),
                       sticky="nw")

            out_dict[cfg_name] = {
                "label": label,
                "slider": slider,
                "entry": entry,
                "entry_var": entry_var,
                "entry_trace_id": entry_var_trace_id,
                "entry_trace_fn": entry_trace_fn
            }
        return out_dict

    def validate_entry_input(self, P, slider_min, slider_max):
        slider_min = int(slider_min)
        slider_max = int(slider_max)

        if str.isdigit(P):
            P = int(P)

            if P < slider_min:
                return False
            elif P > slider_max:
                return False

            return True
        else:
            return False

    def entry_changed_callback(self, div_name, slider_min, slider_max, var,
                               index, mode):
        """Update value with entery text
        """
        is_valid_input = True
        div = self.divs[div_name]

        entry_value = div["entry_var"].get()

        # Check if valid input
        if not str.isdigit(entry_value):
            is_valid_input = False
        else:
            new_value = int(entry_value)
            if not new_value in range(slider_min, slider_max + 1):
                is_valid_input = False

        # Update slider and config
        if is_valid_input:
            div["entry"].configure(fg_color=estilo.TARJETA)
            div["slider"].set(new_value)

            # Don't update config when dragging
            if not self.slider_dragging:
                ConfigManager().set_temp_config(field=div_name, value=new_value)
                ConfigManager().apply_config()
                MouseController().calc_smooth_kernel()
        else:
            div["entry"].configure(fg_color=estilo.ENTRADA_ERROR)

    def slider_drag_callback(self, div_name: str, new_value: str):
        """Update value when slider being drag
        """
        self.slider_dragging = True
        new_value = int(new_value)
        div = self.divs[div_name]
        div["entry_var"].set(new_value)

    def slider_mouse_down_callback(self, div_name: str, event):
        self.slider_dragging = True

    def slider_mouse_up_callback(self, div_name: str, event):
        self.slider_dragging = False
        div = self.divs[div_name]
        new_value = int(div["entry_var"].get())
        ConfigManager().set_temp_config(field=div_name, value=new_value)
        ConfigManager().apply_config()
        MouseController().calc_smooth_kernel()

    def inner_refresh_profile(self):
        self.load_initial_config()


class FrameOjos(customtkinter.CTkFrame):
    """Ajustes del modo «con los ojos»: fijar el centro, ver la mirada en vivo
    y los deslizadores de velocidad."""

    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.grid_columnconfigure(1, weight=1)
        self.muestras = None       # se llena mientras se fija el centro
        self.cuenta = 0

        # Columna izquierda: fijar centro + cuadro de la mirada
        izq = customtkinter.CTkFrame(self, fg_color="transparent")
        izq.grid(row=0, column=0, padx=(16, 8), pady=12, sticky="nw")

        customtkinter.CTkLabel(izq,
                               text="Primero, fija el centro",
                               font=estilo.fuente("etiqueta")).grid(
                                   row=0, column=0, sticky="w")
        customtkinter.CTkLabel(
            izq,
            text=("Ponte cómodo, mira al centro de la pantalla\n"
                  "y pulsa el botón. Cuando mires ahí,\nel puntero se quedará quieto."),
            text_color=estilo.TEXTO_SUAVE,
            justify=tkinter.LEFT,
            font=estilo.fuente("pequena")).grid(row=1, column=0, pady=(0, 6), sticky="w")
        self.boton = customtkinter.CTkButton(izq,
                                             text="Fijar el centro",
                                             width=CUADRO[0],
                                             height=44,
                                             font=estilo.fuente("boton"),
                                             command=self.fijar_centro)
        self.boton.grid(row=2, column=0, pady=(0, 4), sticky="w")
        self.aviso = customtkinter.CTkLabel(izq,
                                            text="",
                                            font=estilo.fuente("cuerpo"))
        self.aviso.grid(row=3, column=0, pady=(0, 6), sticky="w")

        customtkinter.CTkLabel(izq,
                               text="Tu mirada ahora",
                               font=estilo.fuente("etiqueta")).grid(
                                   row=4, column=0, pady=(6, 2), sticky="w")
        self.cuadro = tkinter.Canvas(izq,
                                     width=CUADRO[0],
                                     height=CUADRO[1],
                                     bd=0,
                                     highlightthickness=0)
        estilo.registrar_lienzo(self.cuadro, estilo.PANEL)
        self.cuadro.grid(row=5, column=0, sticky="w")
        cx, cy = CUADRO[0] // 2, CUADRO[1] // 2
        self.cruz = [
            self.cuadro.create_line(cx, 0, cx, CUADRO[1], fill=estilo.BORDE[0]),
            self.cuadro.create_line(0, cy, CUADRO[0], cy, fill=estilo.BORDE[0]),
        ]
        self.zona = self.cuadro.create_oval(cx - 10, cy - 10, cx + 10, cy + 10,
                                            outline=estilo.PRIMARIO[0], width=2)
        self.punto = self.cuadro.create_oval(cx - 7, cy - 7, cx + 7, cy + 7,
                                             fill=estilo.AMBAR[0], outline="")
        self.texto_cuadro = self.cuadro.create_text(cx, CUADRO[1] - 12,
                                                    text="",
                                                    fill=estilo.TEXTO_SUAVE[0],
                                                    font=(estilo.FAMILIA_TEXTO, 10))

        # Columna derecha: deslizadores
        self.deslizadores = FrameSelectGesture(self,
                                               ajustes=AJUSTES_OJOS,
                                               fg_color="transparent",
                                               logger_name="ojos_sliders")
        self.deslizadores.grid(row=0, column=1, padx=(0, 8), pady=4, sticky="nw")

    def cargar(self):
        self.deslizadores.inner_refresh_profile()
        self.aviso.configure(text="")

    # ------------------------------------------------------- fijar centro --
    def fijar_centro(self):
        if self.muestras is not None:
            return
        self.cuenta = 3
        self.boton.configure(state="disabled")
        self._cuenta_atras()

    def _cuenta_atras(self):
        if self.cuenta > 0:
            self.aviso.configure(text=f"Mira al centro de la pantalla… {self.cuenta}",
                                 text_color=estilo.PRIMARIO)
            self.cuenta -= 1
            self.after(1000, self._cuenta_atras)
        else:
            self.aviso.configure(text="Quieto, midiendo…", text_color=estilo.PRIMARIO)
            self.muestras = []
            self.after(50, self._medir)

    def _medir(self):
        m = FaceMesh().get_mirada()
        if m is not None:
            self.muestras.append(m)
        if len(self.muestras) < 20 and self.cuenta > -40:
            self.cuenta -= 1
            self.after(50, self._medir)
            return
        if len(self.muestras) >= 5:
            gx = float(np.mean([s[0] for s in self.muestras]))
            gy = float(np.mean([s[1] for s in self.muestras]))
            ConfigManager().set_temp_config("ojos_centro", [gx, gy])
            ConfigManager().apply_config()
            MouseController().reiniciar_mirada()
            logger.info(f"Centro de la mirada fijado en ({gx:.3f}, {gy:.3f})")
            self.aviso.configure(text="Listo. El centro quedó guardado.",
                                 text_color=estilo.OK)
        else:
            self.aviso.configure(text="No vi tus ojos. Acércate a la cámara e inténtalo otra vez.",
                                 text_color=estilo.ERROR)
        self.muestras = None
        self.boton.configure(state="normal")

    # -------------------------------------------------------------- vivo --
    def refrescar(self):
        cfg = ConfigManager().config
        cx, cy = CUADRO[0] // 2, CUADRO[1] // 2
        r = cfg.get("ojos_zona_muerta", 4) / 100 * ESCALA_MIRADA
        self.cuadro.coords(self.zona, cx - r, cy - r, cx + r, cy + r)
        self.cuadro.itemconfigure(self.zona, outline=estilo.color_actual(estilo.PRIMARIO))
        for linea in self.cruz:
            self.cuadro.itemconfigure(linea, fill=estilo.color_actual(estilo.BORDE))
        self.cuadro.itemconfigure(self.texto_cuadro, fill=estilo.color_actual(estilo.TEXTO_SUAVE))

        m = MouseController().mirada_suave if cfg.get("modo_puntero") == "ojos" else None
        if m is None:
            m = FaceMesh().get_mirada()
        if m is None:
            self.cuadro.itemconfigure(self.punto, state="hidden")
            self.cuadro.itemconfigure(self.texto_cuadro, text="No veo tus ojos")
            return
        c0 = cfg.get("ojos_centro", [0.0, 0.0])
        dx = (m[0] - c0[0]) * ESCALA_MIRADA
        dy = (m[1] - c0[1]) * ESCALA_MIRADA
        px = max(8, min(CUADRO[0] - 8, cx + dx))
        py = max(8, min(CUADRO[1] - 8, cy + dy))
        self.cuadro.coords(self.punto, px - 7, py - 7, px + 7, py + 7)
        self.cuadro.itemconfigure(self.punto, state="normal")
        self.cuadro.itemconfigure(
            self.texto_cuadro,
            text=f"x {m[0] - c0[0]:+.3f}   y {m[1] - c0[1]:+.3f}")


class PageCursor(SafeDisposableFrame):

    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)

        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)
        self.is_active = False
        self.grid_propagate(False)
        self.task = {}

        self.lienzo = SafeDisposableScrollableFrame(self,
                                                    fg_color="transparent",
                                                    logger_name="puntero_scroll")
        self.lienzo.grid(row=0, column=0, sticky="nsew")
        self.lienzo.grid_columnconfigure(0, weight=1)
        c = self.lienzo

        # Top label.
        self.top_label = customtkinter.CTkLabel(master=c, text="Cómo muevo el puntero")
        self.top_label.configure(font=estilo.fuente("titulo"))
        self.top_label.grid(row=0, column=0, padx=20, pady=(5, 0), sticky="nw")

        des_txt = ("Con la cabeza es lo más preciso. Con los ojos sirve si no puedes "
                   "mover la cabeza: el puntero va hacia donde miras, como una palanca.")
        des_label = customtkinter.CTkLabel(master=c,
                                           text=des_txt,
                                           wraplength=700,
                                           justify=tkinter.LEFT)
        des_label.configure(font=estilo.fuente("cuerpo"))
        des_label.grid(row=1, column=0, padx=20, pady=(4, 10), sticky="nw")

        self.selector = SelectorTarjetas(c, OPCIONES_PUNTERO, self.cambiar_modo, ancho=270)
        self.selector.grid(row=2, column=0, padx=20, pady=(0, 10), sticky="w")

        self.tarjeta = customtkinter.CTkFrame(c, fg_color=estilo.TARJETA, corner_radius=16)
        self.tarjeta.grid(row=3, column=0, padx=20, pady=(0, 10), sticky="ew")
        self.tarjeta.grid_columnconfigure(0, weight=1)

        self.subtitulo = customtkinter.CTkLabel(self.tarjeta, text="",
                                                font=estilo.fuente("subtitulo"))
        self.subtitulo.grid(row=0, column=0, padx=20, pady=(12, 0), sticky="w")

        self.frame_cabeza = FrameSelectGesture(self.tarjeta,
                                               fg_color="transparent",
                                               logger_name="cabeza_sliders")
        self.frame_cabeza.grid(row=1, column=0, padx=5, pady=5, sticky="nw")
        self.frame_ojos = FrameOjos(self.tarjeta)
        self.frame_ojos.grid(row=1, column=0, padx=5, pady=5, sticky="nw")
        self.modo = None
        self.cargar_modo()

    def cargar_modo(self):
        modo = ConfigManager().config.get("modo_puntero", "cabeza")
        if modo not in ("cabeza", "ojos"):
            modo = "cabeza"
        self.selector.marcar(modo)
        self.mostrar(modo)

    def mostrar(self, modo):
        self.modo = modo
        if modo == "ojos":
            self.frame_cabeza.grid_remove()
            self.frame_ojos.grid()
            self.frame_ojos.cargar()
            self.subtitulo.configure(text="Ajustes de los ojos")
        else:
            self.frame_ojos.grid_remove()
            self.frame_cabeza.grid()
            self.frame_cabeza.inner_refresh_profile()
            self.subtitulo.configure(text="Velocidad del puntero en cada dirección")

    def cambiar_modo(self, modo):
        ConfigManager().set_temp_config("modo_puntero", modo)
        ConfigManager().apply_config()
        MouseController().reiniciar_mirada()
        self.mostrar(modo)

    def frame_loop(self):
        if self.is_destroyed:
            return
        if self.is_active:
            if self.modo == "ojos":
                self.frame_ojos.refrescar()
            self.after(50, self.frame_loop)

    def enter(self):
        super().enter()
        self.after(1, self.frame_loop)

    def refresh_profile(self):
        self.frame_cabeza.inner_refresh_profile()
        self.cargar_modo()
