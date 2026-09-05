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
# Adaptado para Gestik: página «Clics» con el selector «Cómo hago clic»
# (parpadeo, boca, cejas o quedarse quieto) arriba y las demás acciones abajo.

import tkinter as tk
from functools import partial

import customtkinter

from src import estilo
from PIL import Image

import src.shape_list as shape_list
from src.config_manager import ConfigManager
from src.controllers import ControladorClic
from src.detectors import FaceMesh
from src.gui.balloon import Balloon
from src.gui.dropdown import Dropdown
from src.gui.frames.safe_disposable_frame import SafeDisposableFrame, SafeDisposableScrollableFrame
from src.gui.tarjetas import SelectorTarjetas

MAX_ROWS = 2
HELP_ICON_SIZE = (18, 18)
DIV_WIDTH = 240
DEFAULT_TRIGGER_TYPE = "single"
GREEN = estilo.OK
YELLOW = estilo.ALERTA

BALLOON_TXT = "Qué tan marcado debe ser el gesto\npara que haga la acción"

# Formas de hacer clic izquierdo: clave de config, icono, título, explicación
OPCIONES_CLIC = [
    ("parpadeo", "ojo", "Parpadear", "Cierro los ojos un momento"),
    ("boca", "boca", "Abrir la boca", "Abro la boca un poco"),
    ("cejas", "cejas", "Subir las cejas", "Levanto las dos cejas"),
    ("quieto", "reloj", "Quedarme quieto", "Dejo el puntero quieto"),
]
GESTO_DEL_MODO = {"boca": "Abrir la boca", "cejas": "Subir las cejas"}
DURACIONES_PARPADEO = {"Rápido": 200, "Normal": 350, "Largo": 600}
UMBRAL_GESTO_DEFECTO = 0.5


class FrameSelectGesture(SafeDisposableFrame):
    """Lista «Otras acciones»: clic derecho, rueda, pausa, centrar, pantalla."""

    def __init__(
        self,
        master,
        **kwargs,
    ):
        super().__init__(master, **kwargs)
        self.is_active = False

        self.grid_rowconfigure(MAX_ROWS, weight=1)
        self.grid_columnconfigure(1, weight=1)

        # Float UIs
        self.shared_info_balloon = Balloon(
            self, image_path="assets/images/balloon.png")
        self.shared_dropdown = Dropdown(
            self,
            dropdown_items=shape_list.available_gestures,
            width=DIV_WIDTH,
            callback=self.dropdown_callback)

        self.help_icon = customtkinter.CTkImage(
            Image.open("assets/images/help.png").resize(HELP_ICON_SIZE),
            size=HELP_ICON_SIZE)

        # Divs
        self.divs = self.create_divs(shape_list.acciones_secundarias,
                                     shape_list.available_gestures_keys)
        self.load_initial_keybinds()
        self.slider_dragging = False

    def set_div_inactive(self, div):
        none_gesture = shape_list.available_gestures_keys[0]
        div["selected_gesture"] = none_gesture
        div["combobox"].set(none_gesture)
        div["slider"].grid_remove()
        div["tips_label"].grid_remove()
        div["subtle_label"].grid_remove()
        div["slider"].grid_remove()
        div["volume_bar"].grid_remove()

    def set_div_active(self, div, gesture_name, thres):
        div["selected_gesture"] = gesture_name
        div["combobox"].set(gesture_name)
        div["slider"].set(int(thres * 100))
        div["slider"].configure(state="normal")

        div["tips_label"].grid()
        div["subtle_label"].grid()
        div["slider"].grid()
        div["volume_bar"].grid()

    def load_initial_keybinds(self):
        """Load default from config and set the UI
        """

        for div_name, div in self.divs.items():
            self.set_div_inactive(div)
        self.shared_dropdown.enable_all_except([])

        for gesture_name, (
                device, action_key, thres,
                trigger_type) in ConfigManager().mouse_bindings.items():
            if [device, action_key] not in shape_list.available_actions_values:
                continue
            action_idx = shape_list.available_actions_values.index(
                [device, action_key])
            target_action_name = shape_list.available_actions_keys[action_idx]
            # El clic izquierdo se elige arriba; aquí solo se bloquea su gesto
            if target_action_name in self.divs:
                div = self.divs[target_action_name]
                self.set_div_active(div, gesture_name, thres)
            self.shared_dropdown.disable_item(gesture_name)
        self.shared_dropdown.refresh_items()

    def create_divs(self, action_list: list, gesture_list: list):
        out_dict = {}

        for idx, action_name in enumerate(action_list):
            row = idx % (MAX_ROWS + 1)
            column = idx // (MAX_ROWS + 1)

            # Action label
            label = customtkinter.CTkLabel(master=self,
                                           text=action_name,
                                           height=175,
                                           width=300,
                                           anchor='nw',
                                           justify=tk.LEFT)
            label.configure(font=estilo.fuente("etiqueta"))
            label.grid(row=row,
                       column=column,
                       padx=(20, 20),
                       pady=(0, 0),
                       sticky="nw")

            # Combobox
            drop = customtkinter.CTkOptionMenu(master=self,
                                               values=[gesture_list[0]],
                                               width=240,
                                               dynamic_resizing=False,
                                               state="disabled")
            drop.grid(row=row,
                      column=column,
                      padx=(20, 20),
                      pady=(28, 10),
                      sticky="nw")
            self.shared_dropdown.register_widget(drop, action_name)

            # Label ?
            tips_label = customtkinter.CTkLabel(master=self,
                                                image=self.help_icon,
                                                compound='right',
                                                text="Tamaño del gesto",
                                                text_color=estilo.TEXTO_SUAVE,
                                                justify='left')
            tips_label.configure(font=estilo.fuente("pequena"))
            tips_label.grid(row=row,
                            column=column,
                            padx=(20, 20),
                            pady=(62, 10),
                            sticky="nw")
            tips_label.grid_remove()
            self.shared_info_balloon.register_widget(tips_label, BALLOON_TXT)

            # Volume bar
            volume_bar = customtkinter.CTkProgressBar(
                master=self,
                width=240,
            )
            volume_bar.grid(row=row,
                            column=column,
                            padx=(20, 20),
                            pady=(92, 10),
                            sticky="nw")
            volume_bar.grid_remove()

            # Slider
            slider = customtkinter.CTkSlider(master=self,
                                             from_=1,
                                             to=100,
                                             width=250,
                                             number_of_steps=100,
                                             command=partial(
                                                 self.slider_drag_callback,
                                                 action_name))
            slider.bind("<Button-1>",
                        partial(self.slider_mouse_down_callback, action_name))
            slider.bind("<ButtonRelease-1>",
                        partial(self.slider_mouse_up_callback, action_name))
            slider.configure(state="disabled", hover=False)
            slider.grid(row=row,
                        column=column,
                        padx=(15, 20),
                        pady=(112, 10),
                        sticky="nw")
            slider.grid_remove()

            # Subtle, Exaggerated
            subtle_label = customtkinter.CTkLabel(
                master=self,
                text="Suave\t\t\t   Exagerado",
                text_color=estilo.TEXTO_SUAVE,
                justify=tk.LEFT)
            subtle_label.configure(font=estilo.fuente("pequena"))
            subtle_label.grid(row=row,
                              column=column,
                              padx=(20, 20),
                              pady=(128, 10),
                              sticky="nw")
            subtle_label.grid_remove()

            out_dict[action_name] = {
                "label": label,
                "combobox": drop,
                "tips_label": tips_label,
                "slider": slider,
                "volume_bar": volume_bar,
                "subtle_label": subtle_label,
                "selected_gesture": gesture_list[0],
            }

        return out_dict

    def slider_drag_callback(self, caller_name: str, slider_value: str):
        self.slider_dragging = True

    def slider_mouse_down_callback(self, caller_name: str, event):
        self.slider_dragging = True

    def slider_mouse_up_callback(self, caller_name: str, event):
        self.slider_dragging = False
        div = self.divs[caller_name]
        target_device, target_action = shape_list.available_actions[caller_name]

        # change int [0,100] to float [0,1]
        thres_value = div["slider"].get() / 100

        ConfigManager().set_temp_mouse_binding(
            div["selected_gesture"],
            device=target_device,
            action=target_action,
            threshold=thres_value,
            trigger_type=DEFAULT_TRIGGER_TYPE)
        ConfigManager().apply_mouse_bindings()

    def dropdown_callback(self, caller_name: str, target_gesture: str):
        div = self.divs[caller_name]

        # Release old item
        if div["selected_gesture"] != target_gesture:
            self.shared_dropdown.enable_item(div["selected_gesture"])
        div["selected_gesture"] = target_gesture
        div["combobox"].set(target_gesture)

        # Set keybind
        target_device, target_action = shape_list.available_actions[caller_name]

        # get float [0,1] value
        if target_gesture != shape_list.SIN_GESTO:
            div["slider"].configure(state="normal")
            div["slider"].grid()
            div["volume_bar"].grid()
            div["tips_label"].grid()
            div["subtle_label"].grid()
            thres_value = div["slider"].get() / 100
            ConfigManager().set_temp_mouse_binding(
                target_gesture,
                device=target_device,
                action=target_action,
                threshold=thres_value,
                trigger_type=DEFAULT_TRIGGER_TYPE)

        # Remove keybind if "None"
        else:
            div["slider"].configure(state="disabled")
            div["slider"].grid_remove()
            div["volume_bar"].grid_remove()
            div["tips_label"].grid_remove()
            div["subtle_label"].grid_remove()
            ConfigManager().remove_temp_mouse_binding(device=target_device,
                                                      action=target_action)

        ConfigManager().apply_mouse_bindings()

    def update_volume_preview(self):

        bs = FaceMesh().get_blendshapes()
        if bs is None:
            return

        for div_name, div in self.divs.items():

            if div["selected_gesture"] == shape_list.SIN_GESTO:
                continue

            bs_idx = shape_list.blendshape_indices[div["selected_gesture"]]
            bs_value = bs[bs_idx]
            div["volume_bar"].set(bs_value)

            slider_value = div["slider"].get() / 100
            if bs_value > slider_value:
                div["volume_bar"].configure(progress_color=GREEN)  # green
            else:
                div["volume_bar"].configure(progress_color=YELLOW)  # yellow

    def frame_loop(self):
        if self.is_destroyed:
            return

        if self.is_active:
            self.update_volume_preview()
            self.after(50, self.frame_loop)
        else:
            return

    def inner_refresh_profile(self):
        # Create new divs form the new profile
        self.load_initial_keybinds()

    def enter(self):
        super().enter()
        #self.load_initial_keybinds()
        self.after(1, self.frame_loop)

    def leave(self):
        super().leave()


# ---------------------------------------------------------------------------- #
#                         Ajustes de cada forma de clic                         #
# ---------------------------------------------------------------------------- #


class AjustesParpadeo(customtkinter.CTkFrame):

    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.grid_columnconfigure(0, weight=1)

        customtkinter.CTkLabel(self,
                               text="Cuánto tiempo cierro los ojos",
                               font=estilo.fuente("etiqueta")).grid(
                                   row=0, column=0, padx=16, pady=(12, 2), sticky="w")
        self.duracion = customtkinter.CTkSegmentedButton(
            self,
            values=list(DURACIONES_PARPADEO.keys()),
            width=300,
            height=40,
            font=estilo.fuente("boton_normal"),
            command=self.cambiar_duracion)
        self.duracion.grid(row=1, column=0, padx=16, pady=(2, 4), sticky="w")
        self.ayuda_duracion = customtkinter.CTkLabel(
            self,
            text="",
            text_color=estilo.TEXTO_SUAVE,
            font=estilo.fuente("pequena"))
        self.ayuda_duracion.grid(row=2, column=0, padx=16, pady=(0, 10), sticky="w")

        customtkinter.CTkLabel(self,
                               text="Tus ojos ahora",
                               font=estilo.fuente("etiqueta")).grid(
                                   row=3, column=0, padx=16, pady=(6, 2), sticky="w")
        self.barra = customtkinter.CTkProgressBar(self, width=300, height=14)
        self.barra.set(1.0)
        self.barra.grid(row=4, column=0, padx=16, pady=2, sticky="w")
        self.estado = customtkinter.CTkLabel(self,
                                             text="",
                                             font=estilo.fuente("cuerpo"))
        self.estado.grid(row=5, column=0, padx=16, pady=(2, 0), sticky="w")
        self.medidas = customtkinter.CTkLabel(self,
                                              text="",
                                              text_color=estilo.TEXTO_SUAVE,
                                              font=estilo.fuente("pequena"))
        self.medidas.grid(row=6, column=0, padx=16, pady=(0, 12), sticky="w")

    def cargar(self):
        ms = ConfigManager().config.get("parpadeo_ms", 200)
        nombre = "Rápido"
        for n, v in DURACIONES_PARPADEO.items():
            if v == ms:
                nombre = n
        self.duracion.set(nombre)
        self._texto_ayuda(ms)

    def _texto_ayuda(self, ms):
        segundos = f"{ms / 1000:.2f}".replace(".", ",")
        self.ayuda_duracion.configure(
            text=f"Un parpadeo normal no cuenta. Cierra los ojos: a los {segundos} s "
            "se hace el clic, sin tener que abrirlos.")

    def cambiar_duracion(self, nombre):
        ms = DURACIONES_PARPADEO[nombre]
        ConfigManager().set_temp_config("parpadeo_ms", ms)
        ConfigManager().apply_config()
        self._texto_ayuda(ms)

    def refrescar(self):
        e = FaceMesh().parpadeo.estado
        rel = max(0.0, min(1.0, e["relacion"]))
        self.barra.set(rel)
        if ControladorClic().hubo_clic_reciente():
            self.estado.configure(text="¡Clic!", text_color=estilo.PRIMARIO)
            self.barra.configure(progress_color=estilo.PRIMARIO)
        elif e["cerrados"]:
            self.estado.configure(text=f"Ojos cerrados: {e['cerrados_ms']} ms",
                                  text_color=estilo.TEXTO)
            self.barra.configure(progress_color=estilo.ALERTA)
        elif not e["listo"]:
            self.estado.configure(text="Aprendiendo cómo son tus ojos…",
                                  text_color=estilo.TEXTO_SUAVE)
            self.barra.configure(progress_color=estilo.TEXTO_SUAVE)
        else:
            self.estado.configure(text="Ojos abiertos", text_color=estilo.TEXTO)
            self.barra.configure(progress_color=estilo.OK)
        a_der, a_izq = e["apertura"]
        b_der, b_izq = e["base"]
        self.medidas.configure(
            text=f"Apertura {a_der:.2f} / {a_izq:.2f}   ·   normal {b_der:.2f} / {b_izq:.2f}"
            f"   ·   umbral {ConfigManager().config.get('parpadeo_umbral', 0.55):.2f}")


class AjustesGesto(customtkinter.CTkFrame):
    """Boca o cejas: tamaño del gesto con barra en vivo."""

    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.gesto = None
        self.arrastrando = False

        customtkinter.CTkLabel(self,
                               text="Tamaño del gesto",
                               font=estilo.fuente("etiqueta")).grid(
                                   row=0, column=0, padx=16, pady=(12, 2), sticky="w")
        self.ayuda = customtkinter.CTkLabel(self,
                                            text="",
                                            text_color=estilo.TEXTO_SUAVE,
                                            font=estilo.fuente("pequena"))
        self.ayuda.grid(row=1, column=0, padx=16, pady=(0, 6), sticky="w")
        self.barra = customtkinter.CTkProgressBar(self, width=300, height=14)
        self.barra.grid(row=2, column=0, padx=16, pady=(4, 2), sticky="w")
        self.slider = customtkinter.CTkSlider(self,
                                              from_=1,
                                              to=100,
                                              width=310,
                                              number_of_steps=100)
        self.slider.bind("<Button-1>", lambda e: setattr(self, "arrastrando", True))
        self.slider.bind("<ButtonRelease-1>", self.soltar)
        self.slider.grid(row=3, column=0, padx=11, pady=(2, 0), sticky="w")
        customtkinter.CTkLabel(self,
                               text="Suave\t\t\t\tExagerado",
                               text_color=estilo.TEXTO_SUAVE,
                               font=estilo.fuente("pequena")).grid(
                                   row=4, column=0, padx=16, pady=(0, 12), sticky="w")

    def cargar(self, gesto: str):
        self.gesto = gesto
        umbral = UMBRAL_GESTO_DEFECTO
        b = ConfigManager().mouse_bindings.get(gesto)
        if b and b[0] == "mouse" and b[1] == "left":
            umbral = b[2]
        self.slider.set(int(umbral * 100))
        self.ayuda.configure(
            text="La barra se pone verde cuando el gesto supera la marca: ahí se hace el clic.")

    def soltar(self, event=None):
        self.arrastrando = False
        if self.gesto is None:
            return
        ConfigManager().set_temp_mouse_binding(self.gesto,
                                               device="mouse",
                                               action="left",
                                               threshold=self.slider.get() / 100,
                                               trigger_type=DEFAULT_TRIGGER_TYPE)
        ConfigManager().apply_mouse_bindings()

    def refrescar(self):
        bs = FaceMesh().get_blendshapes()
        if bs is None or self.gesto is None:
            return
        valor = float(bs[shape_list.blendshape_indices[self.gesto]])
        self.barra.set(valor)
        self.barra.configure(progress_color=GREEN if valor > self.slider.get() / 100 else YELLOW)


class AjustesQuieto(customtkinter.CTkFrame):

    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.arrastrando = False

        customtkinter.CTkLabel(self,
                               text="Cuánto tiempo quieto antes del clic",
                               font=estilo.fuente("etiqueta")).grid(
                                   row=0, column=0, padx=16, pady=(12, 2), sticky="w")
        self.slider = customtkinter.CTkSlider(self,
                                              from_=300,
                                              to=3000,
                                              width=310,
                                              number_of_steps=27,
                                              command=self.arrastrar)
        self.slider.bind("<ButtonRelease-1>", self.soltar)
        self.slider.grid(row=1, column=0, padx=11, pady=(4, 0), sticky="w")
        self.valor = customtkinter.CTkLabel(self,
                                            text="",
                                            font=estilo.fuente("cuerpo"))
        self.valor.grid(row=1, column=1, padx=(6, 16), pady=(2, 0), sticky="w")
        customtkinter.CTkLabel(self,
                               text="Más rápido\t\t\tMás tiempo",
                               text_color=estilo.TEXTO_SUAVE,
                               font=estilo.fuente("pequena")).grid(
                                   row=2, column=0, padx=16, pady=(0, 8), sticky="w")

        self.anillo_var = tk.BooleanVar(value=True)
        self.anillo = customtkinter.CTkCheckBox(
            self,
            text="Mostrar el anillo que se llena junto al puntero",
            variable=self.anillo_var,
            font=estilo.fuente("cuerpo"),
            command=self.cambiar_anillo)
        self.anillo.grid(row=3, column=0, columnspan=2, padx=16, pady=(4, 6), sticky="w")

        customtkinter.CTkLabel(
            self,
            text=("Cuando dejas el puntero quieto sobre algo, se llena el anillo y se hace\n"
                  "clic solo. Para no hacer clic, sigue moviendo el puntero."),
            text_color=estilo.TEXTO_SUAVE,
            justify=tk.LEFT,
            font=estilo.fuente("pequena")).grid(
                row=4, column=0, columnspan=2, padx=16, pady=(0, 12), sticky="w")

    def _texto(self, ms):
        self.valor.configure(text=f"{ms / 1000:.1f} s".replace(".", ","))

    def cargar(self):
        ms = ConfigManager().config.get("quieto_ms", 1100)
        self.slider.set(ms)
        self._texto(ms)
        self.anillo_var.set(bool(ConfigManager().config.get("quieto_anillo", True)))

    def arrastrar(self, valor):
        self._texto(int(valor))

    def soltar(self, event=None):
        ms = int(self.slider.get())
        self._texto(ms)
        ConfigManager().set_temp_config("quieto_ms", ms)
        ConfigManager().apply_config()

    def cambiar_anillo(self):
        ConfigManager().set_temp_config("quieto_anillo", bool(self.anillo_var.get()))
        ConfigManager().apply_config()

    def refrescar(self):
        pass


# ---------------------------------------------------------------------------- #
#                                   Página                                     #
# ---------------------------------------------------------------------------- #


class PageSelectGestures(SafeDisposableFrame):

    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)

        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)
        self.is_active = False
        self.grid_propagate(False)
        self.bind_id_leave = None

        self.lienzo = SafeDisposableScrollableFrame(self,
                                                    fg_color="transparent",
                                                    logger_name="clics_scroll")
        self.lienzo.grid(row=0, column=0, sticky="nsew")
        self.lienzo.grid_columnconfigure(0, weight=1)
        c = self.lienzo

        # Top label.
        self.top_label = customtkinter.CTkLabel(master=c, text="Cómo hago clic")
        self.top_label.configure(font=estilo.fuente("titulo"))
        self.top_label.grid(row=0, column=0, padx=20, pady=(5, 0), sticky="nw")

        des_txt = ("Elige cómo haces el clic izquierdo, el más usado. "
                   "Las demás acciones se eligen más abajo.")
        des_label = customtkinter.CTkLabel(master=c,
                                           text=des_txt,
                                           wraplength=700,
                                           justify=tk.LEFT)
        des_label.configure(font=estilo.fuente("cuerpo"))
        des_label.grid(row=1, column=0, padx=20, pady=(4, 10), sticky="nw")

        self.selector = SelectorTarjetas(c, OPCIONES_CLIC, self.cambiar_modo, ancho=168)
        self.selector.grid(row=2, column=0, padx=20, pady=(0, 10), sticky="w")

        # Tarjeta de ajustes del modo elegido
        self.tarjeta = customtkinter.CTkFrame(c, fg_color=estilo.TARJETA, corner_radius=16)
        self.tarjeta.grid(row=3, column=0, padx=20, pady=(0, 6), sticky="ew")
        self.tarjeta.grid_columnconfigure(0, weight=1)
        self.ajustes = {
            "parpadeo": AjustesParpadeo(self.tarjeta),
            "gesto": AjustesGesto(self.tarjeta),
            "quieto": AjustesQuieto(self.tarjeta),
        }
        for a in self.ajustes.values():
            a.grid(row=0, column=0, sticky="ew")
            a.grid_remove()
        self.ajuste_visible = None

        # Otras acciones
        sub = customtkinter.CTkLabel(master=c, text="Otras acciones con gestos")
        sub.configure(font=estilo.fuente("subtitulo"))
        sub.grid(row=4, column=0, padx=20, pady=(16, 0), sticky="nw")
        sub_des = customtkinter.CTkLabel(
            master=c,
            text="Elige qué gesto de tu cara hace cada acción. Con la barra ajustas qué tan marcado debe ser.",
            wraplength=700,
            justify=tk.LEFT)
        sub_des.configure(font=estilo.fuente("cuerpo"))
        sub_des.grid(row=5, column=0, padx=20, pady=(2, 6), sticky="nw")

        self.inner_frame = FrameSelectGesture(c, logger_name="FrameSelectGesture")
        self.inner_frame.grid(row=6, column=0, padx=5, pady=5, sticky="nw")

        self.cargar_modo()

    # ------------------------------------------------------------- modo --
    def cargar_modo(self):
        modo = ConfigManager().config.get("modo_clic", "parpadeo")
        if modo not in GESTO_DEL_MODO and modo not in ("parpadeo", "quieto"):
            modo = "parpadeo"
        self.selector.marcar(modo)
        self.mostrar_ajustes(modo)

    def mostrar_ajustes(self, modo):
        clave = "gesto" if modo in GESTO_DEL_MODO else modo
        for k, a in self.ajustes.items():
            if k == clave:
                a.grid()
            else:
                a.grid_remove()
        self.ajuste_visible = self.ajustes[clave]
        if clave == "gesto":
            self.ajuste_visible.cargar(GESTO_DEL_MODO[modo])
        else:
            self.ajuste_visible.cargar()

    def cambiar_modo(self, modo):
        ConfigManager().set_temp_config("modo_clic", modo)
        ConfigManager().apply_config()

        if modo in GESTO_DEL_MODO:
            gesto = GESTO_DEL_MODO[modo]
            umbral = UMBRAL_GESTO_DEFECTO
            b = ConfigManager().mouse_bindings.get(gesto)
            if b and b[0] == "mouse" and b[1] == "left":
                umbral = b[2]
            ConfigManager().set_temp_mouse_binding(gesto,
                                                   device="mouse",
                                                   action="left",
                                                   threshold=umbral,
                                                   trigger_type=DEFAULT_TRIGGER_TYPE)
        else:
            ConfigManager().remove_temp_mouse_binding(device="mouse", action="left")
        ConfigManager().apply_mouse_bindings()

        # El gesto pudo estar en «Otras acciones»: se vuelve a leer la lista
        self.inner_frame.inner_refresh_profile()
        self.mostrar_ajustes(modo)

    # ------------------------------------------------------------- bucle --
    def frame_loop(self):
        if self.is_destroyed:
            return
        if self.is_active:
            if self.ajuste_visible is not None:
                self.ajuste_visible.refrescar()
            self.after(50, self.frame_loop)

    def enter(self):
        super().enter()
        self.inner_frame.enter()
        self.after(1, self.frame_loop)

        # Hide dropdown when mouse leave the frame
        self.bind_id_leave = self.bind(
            "<Leave>", self.inner_frame.shared_dropdown.hide_dropdown)

    def refresh_profile(self):
        self.inner_frame.inner_refresh_profile()
        self.cargar_modo()

    def leave(self):
        super().leave()
        self.inner_frame.leave()
        self.unbind("<Leave>", self.bind_id_leave)
        self.inner_frame.shared_dropdown.hide_dropdown()

    def destroy(self):
        super().destroy()
        self.inner_frame.destroy()
