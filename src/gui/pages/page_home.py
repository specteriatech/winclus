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
# Adaptado para Winclus: página de inicio propia, con tarjetas grandes.

import logging
import tkinter
from functools import partial

import customtkinter
from PIL import Image

from src import estilo
from src.gui.frames.safe_disposable_frame import SafeDisposableFrame

ILUSTRACION_SIZE = (380, 196)
ICONO_SIZE = (36, 36)

# Tarjetas de acceso: icono, título, explicación corta y página de destino.
ACCESOS = [
    ("camara", "Cámara", "Elige la cámara que te va a ver", "page_camera"),
    ("puntero", "Puntero", "Con la cabeza o con los ojos", "page_cursor"),
    ("clic", "Clics", "Parpadeo, boca, cejas o quedarte quieto", "page_gestures"),
    ("teclado", "Teclas", "Gestos que pulsan una tecla", "page_keyboard"),
    ("escribir", "Escribir", "Teclado en pantalla con sugerencias", "page_escribir"),
    ("asistente", "Asistente", "Dile lo que quieres y Winclus lo hace", "page_asistente"),
]


class PageHome(SafeDisposableFrame):

    def __init__(self, master, root_callback: callable, **kwargs):
        super().__init__(master, **kwargs)
        logging.info("Create PageHome")
        self.configure(fg_color="transparent")

        self.grid_columnconfigure((0, 1), weight=1, uniform="col")
        self.grid_rowconfigure(5, weight=1)

        # Título y explicación
        titulo = customtkinter.CTkLabel(master=self,
                                        text="Winclus",
                                        anchor="w",
                                        text_color=estilo.PRIMARIO,
                                        font=estilo.fuente("titulo"))
        titulo.grid(row=0, column=0, padx=(28, 10), pady=(28, 2), sticky="sw")

        des_txt = ("Mueve el puntero con tu cabeza o con tus ojos y haz clic "
                   "con un parpadeo o un gesto. Solo necesitas una cámara web.")
        des_label = customtkinter.CTkLabel(master=self,
                                           text=des_txt,
                                           wraplength=340,
                                           anchor="w",
                                           justify=tkinter.LEFT,
                                           font=estilo.fuente("cuerpo"))
        des_label.grid(row=1, column=0, padx=(28, 10), pady=(4, 6), sticky="nw")

        # Ilustración propia (persona, portátil y cámara), a la derecha del título
        ilus = customtkinter.CTkImage(
            Image.open("assets/images/inicio_ilustracion.png"),
            size=ILUSTRACION_SIZE)
        ilus_label = customtkinter.CTkLabel(self, image=ilus, text="")
        ilus_label.grid(row=0, column=1, rowspan=2, padx=(10, 28), pady=(16, 0),
                        sticky="e")

        # Tarjetas grandes, 2 por fila
        for i, (icono, nombre, detalle, pagina) in enumerate(ACCESOS):
            fila, col = 2 + i // 2, i % 2
            im = estilo.imagen_doble(f"iconos/{icono}", ICONO_SIZE)
            btn = customtkinter.CTkButton(
                master=self,
                text=f"  {nombre}\n  {detalle}",
                image=im,
                compound="left",
                anchor="w",
                height=96,
                corner_radius=18,
                border_width=2,
                border_color=estilo.BORDE,
                fg_color=estilo.TARJETA,
                hover_color=estilo.PRIMARIO_SUAVE,
                text_color=estilo.TEXTO,
                font=estilo.fuente("boton_normal"),
                command=partial(root_callback,
                                function_name="change_page",
                                args={"target": pagina}))
            btn.grid(row=fila, column=col,
                     padx=(28 if col == 0 else 10, 28 if col == 1 else 10),
                     pady=10, sticky="ew")

        # Aviso
        aviso = customtkinter.CTkLabel(
            master=self,
            text=("Winclus es gratuito y de código abierto. "
                  "No es un dispositivo médico."),
            anchor="w",
            text_color=estilo.TEXTO_SUAVE,
            font=estilo.fuente("pequena"))
        aviso.grid(row=6, column=0, columnspan=2, padx=28, pady=(6, 18),
                   sticky="sw")
