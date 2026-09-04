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
# Adaptado para Puntero Libre: menú lateral con botones de texto en español
# (el original usaba imágenes con el texto en inglés).

from functools import partial

import customtkinter
from PIL import Image

from src.config_manager import ConfigManager
from src.gui.frames.safe_disposable_frame import SafeDisposableFrame

AZUL_CLARO = "#F9FBFE"
AZUL_SELECCION = "#E3ECFA"
TEXTO = "#202124"
PROF_DROP_SIZE = 220, 40

# Nombre de cada pestaña tal como lo ve la persona.
PESTANAS = {
    "page_home": "Inicio",
    "page_camera": "Cámara",
    "page_cursor": "Puntero",
    "page_gestures": "Clics",
    "page_keyboard": "Teclas",
}


class FrameMenu(SafeDisposableFrame):

    def __init__(self, master, master_callback: callable, **kwargs):
        super().__init__(master, **kwargs)

        self.grid_rowconfigure(6, weight=1)
        self.grid_columnconfigure(0, weight=1)
        self.grid_propagate(False)
        self.configure(fg_color=AZUL_CLARO)

        self.master_callback = master_callback

        # Botón del perfil actual
        prof_drop = customtkinter.CTkImage(
            Image.open("assets/images/prof_drop_head.png"), size=PROF_DROP_SIZE)
        profile_btn = customtkinter.CTkLabel(
            master=self,
            textvariable=ConfigManager().curr_profile_name,
            image=prof_drop,
            height=42,
            compound="center",
            anchor="w",
            cursor="hand2",
        )
        profile_btn.bind("<Button-1>",
                         partial(self.master_callback, "show_profile_switcher"))

        profile_btn.grid(row=0,
                         column=0,
                         padx=35,
                         pady=10,
                         ipadx=0,
                         ipady=0,
                         sticky="nw",
                         columnspan=1,
                         rowspan=1)

        self.fuente_normal = customtkinter.CTkFont(size=16)
        self.fuente_negrita = customtkinter.CTkFont(size=16, weight="bold")
        self.btns = self.create_tab_btn(PESTANAS, offset=1)

    def create_tab_btn(self, pestanas: dict, offset):

        out_dict = {}
        for idx, (k, nombre) in enumerate(pestanas.items()):
            btn = customtkinter.CTkButton(master=self,
                                          text=nombre,
                                          anchor="w",
                                          width=225,
                                          height=48,
                                          border_spacing=0,
                                          border_width=0,
                                          hover=True,
                                          hover_color=AZUL_SELECCION,
                                          corner_radius=8,
                                          fg_color=AZUL_CLARO,
                                          text_color=TEXTO,
                                          font=self.fuente_normal,
                                          command=partial(
                                              self.master_callback,
                                              function_name="change_page",
                                              args={"target": k}))

            btn.grid(row=idx + offset,
                     column=0,
                     padx=(18, 0),
                     pady=2,
                     ipadx=0,
                     ipady=0,
                     sticky="nw")
            out_dict[k] = btn
        return out_dict

    def set_tab_active(self, tab_name: str):
        for k, btn in self.btns.items():
            if k == tab_name:
                btn.configure(fg_color=AZUL_SELECCION, font=self.fuente_negrita)
            else:
                btn.configure(fg_color=AZUL_CLARO, font=self.fuente_normal)
