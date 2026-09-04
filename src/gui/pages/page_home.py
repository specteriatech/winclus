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
# Adaptado para Puntero Libre: página de inicio en español con botones de texto.

import logging
import tkinter
from functools import partial

import customtkinter
from PIL import Image

from src.gui.frames.safe_disposable_frame import SafeDisposableFrame

HOME_IM_SIZE = (441, 215)
AZUL_CLARO = "#F1F5FB"
AZUL_SELECCION = "#E3ECFA"
TEXTO = "#202124"
TEXTO_SUAVE = "#5F6368"

# Botones grandes de la página de inicio: título, explicación corta y página.
ACCESOS = [
    ("Cámara", "Elige la cámara que te va a ver", "page_camera"),
    ("Puntero", "Ajusta qué tan rápido se mueve", "page_cursor"),
    ("Clics", "Elige cómo hacer clic con tu cara", "page_gestures"),
    ("Teclas", "Gestos que pulsan una tecla", "page_keyboard"),
]


class PageHome(SafeDisposableFrame):

    def __init__(self, master, root_callback: callable, **kwargs):
        super().__init__(master, **kwargs)
        logging.info("Create PageHome")

        self.grid_rowconfigure(6, weight=1)
        self.grid_columnconfigure(1, weight=1)

        # Título
        top_label = customtkinter.CTkLabel(master=self, text="Puntero Libre")
        top_label.cget("font").configure(size=26, weight="bold")
        top_label.grid(row=0,
                       column=0,
                       padx=20,
                       pady=(20, 5),
                       sticky="new",
                       columnspan=2)

        # Explicación
        des_txt = ("Mueve el puntero con tu cabeza y haz clic con gestos de tu cara. "
                   "Solo necesitas una cámara web.")
        des_label = customtkinter.CTkLabel(master=self,
                                           text=des_txt,
                                           wraplength=520,
                                           justify=tkinter.CENTER)
        des_label.cget("font").configure(size=15)
        des_label.grid(row=1,
                       column=0,
                       padx=20,
                       pady=(5, 5),
                       sticky="new",
                       columnspan=2)

        # Aviso
        disc_txt = ("Puntero Libre es gratuito y de código abierto. "
                    "No es un dispositivo médico.")
        disc_label = customtkinter.CTkLabel(master=self,
                                            text=disc_txt,
                                            wraplength=700,
                                            text_color=TEXTO_SUAVE,
                                            justify=tkinter.CENTER)
        disc_label.cget("font").configure(size=13)
        disc_label.grid(row=2,
                        column=0,
                        padx=20,
                        pady=(5, 10),
                        sticky="new",
                        columnspan=2)

        # Botones de acceso a cada página
        fuente_btn = customtkinter.CTkFont(size=15)
        for fila, (titulo, detalle, pagina) in enumerate(ACCESOS, start=3):
            btn = customtkinter.CTkButton(
                master=self,
                text=f"{titulo}\n{detalle}",
                anchor="w",
                width=260,
                height=70,
                corner_radius=12,
                fg_color=AZUL_CLARO,
                hover_color=AZUL_SELECCION,
                text_color=TEXTO,
                font=fuente_btn,
                command=partial(root_callback,
                                function_name="change_page",
                                args={"target": pagina}))
            btn.grid(row=fila, column=0, padx=60, pady=8, sticky="nw")

        # Dibujo de la cara y la pantalla (sin texto ni marcas)
        home_im = customtkinter.CTkImage(
            Image.open("assets/images/home_im.png"), size=HOME_IM_SIZE)
        label = customtkinter.CTkLabel(self,
                                       image=home_im,
                                       width=HOME_IM_SIZE[0],
                                       height=HOME_IM_SIZE[1],
                                       text="")
        label.grid(row=3, column=1, padx=20, pady=20, rowspan=3, sticky="we")
