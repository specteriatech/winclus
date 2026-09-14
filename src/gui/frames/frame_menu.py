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
# Adaptado para Winclus: barra lateral propia con nombre del programa,
# selector de perfil, pestañas con icono y texto, y cambio de modo claro/oscuro.

from functools import partial

import customtkinter
from PIL import Image

from src import estilo
from src.config_manager import ConfigManager
from src.gui.frames.safe_disposable_frame import SafeDisposableFrame

PERFIL_SIZE = 232, 42
ICONO_SIZE = 26, 26
MARCA_SIZE = 44, 44

# Pestañas: clave interna -> (texto, icono)
PESTANAS = {
    "page_home": ("Inicio", "casa"),
    "page_camera": ("Cámara", "camara"),
    "page_cursor": ("Puntero", "puntero"),
    "page_gestures": ("Clics", "clic"),
    "page_keyboard": ("Teclas", "teclado"),
    "page_escribir": ("Escribir", "escribir"),
    "page_asistente": ("Asistente", "asistente"),
}


class FrameMenu(SafeDisposableFrame):

    def __init__(self, master, master_callback: callable, **kwargs):
        super().__init__(master, **kwargs)

        self.grid_rowconfigure(8, weight=1)
        self.grid_columnconfigure(0, weight=1)
        self.configure(fg_color=estilo.PANEL, corner_radius=0)

        self.master_callback = master_callback

        # Nombre del programa con su icono
        marca_im = estilo.imagen_doble("logo_winclus", MARCA_SIZE)
        marca = customtkinter.CTkLabel(master=self,
                                       text="  Winclus",
                                       image=marca_im,
                                       compound="left",
                                       anchor="w",
                                       text_color=estilo.PRIMARIO,
                                       font=estilo.fuente("marca"))
        marca.grid(row=0, column=0, padx=24, pady=(12, 4), sticky="w")

        # Selector de perfil
        perfil_im = estilo.imagen_doble("perfil_fondo", PERFIL_SIZE)
        profile_btn = customtkinter.CTkLabel(
            master=self,
            textvariable=ConfigManager().curr_profile_name,
            image=perfil_im,
            height=PERFIL_SIZE[1],
            compound="center",
            anchor="w",
            cursor="hand2",
            font=estilo.fuente("cuerpo"),
        )
        profile_btn.bind("<Button-1>",
                         partial(self.master_callback, "show_profile_switcher"))
        profile_btn.grid(row=1, column=0, padx=24, pady=(2, 10), sticky="w")

        self.btns = self.create_tab_btn(PESTANAS, offset=2)

        # Cambio de modo claro / oscuro, abajo del todo
        self.icono_sol = estilo.imagen_doble("iconos/sol", ICONO_SIZE)
        self.icono_luna = estilo.imagen_doble("iconos/luna", ICONO_SIZE)
        self.btn_modo = customtkinter.CTkButton(master=self,
                                                text="",
                                                anchor="w",
                                                width=232,
                                                height=40,
                                                fg_color="transparent",
                                                hover_color=estilo.PRIMARIO_SUAVE,
                                                text_color=estilo.TEXTO_SUAVE,
                                                font=estilo.fuente("pequena"),
                                                command=self.cambiar_modo)
        self.btn_modo.grid(row=9, column=0, padx=24, pady=(4, 10), sticky="sw")
        self.refrescar_boton_modo()

    def create_tab_btn(self, pestanas: dict, offset):
        out_dict = {}
        for idx, (k, (nombre, icono)) in enumerate(pestanas.items()):
            im = estilo.imagen_doble(f"iconos/{icono}", ICONO_SIZE)
            btn = customtkinter.CTkButton(master=self,
                                          text="   " + nombre,
                                          image=im,
                                          compound="left",
                                          anchor="w",
                                          width=232,
                                          height=46,
                                          corner_radius=14,
                                          fg_color="transparent",
                                          hover_color=estilo.PRIMARIO_SUAVE,
                                          text_color=estilo.TEXTO,
                                          font=estilo.fuente("boton_normal"),
                                          command=partial(
                                              self.master_callback,
                                              function_name="change_page",
                                              args={"target": k}))
            btn.grid(row=idx + offset, column=0, padx=24, pady=2, sticky="w")
            out_dict[k] = btn
        return out_dict

    def set_tab_active(self, tab_name: str):
        for k, btn in self.btns.items():
            if k == tab_name:
                btn.configure(fg_color=estilo.PRIMARIO_SUAVE,
                              text_color=estilo.PRIMARIO,
                              font=estilo.fuente("boton"))
            else:
                btn.configure(fg_color="transparent",
                              text_color=estilo.TEXTO,
                              font=estilo.fuente("boton_normal"))

    def refrescar_boton_modo(self):
        if estilo.es_oscuro():
            self.btn_modo.configure(text="   Modo claro", image=self.icono_sol)
        else:
            self.btn_modo.configure(text="   Modo oscuro", image=self.icono_luna)

    def cambiar_modo(self):
        estilo.alternar_modo()
        self.refrescar_boton_modo()
