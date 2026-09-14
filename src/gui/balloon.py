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
# Adaptado para Winclus: globo de ayuda con los colores del estilo propio.

from functools import partial

import customtkinter

from src import estilo

BALLOON_SIZE = (305, 80)
# Color "mágico" que Windows vuelve transparente: así el globo tiene esquinas
# redondas. No puede ser blanco porque las tarjetas claras son blancas.
TRANSPARENTE = "#FE01FE"


class Balloon():
    """Globo de texto que aparece al pasar el mouse sobre un widget registrado."""

    def __init__(self, master, image_path: str = ""):

        self.float_window = customtkinter.CTkToplevel(master)
        self.float_window.wm_overrideredirect(True)
        self.float_window.lift()
        self.float_window.wm_attributes("-topmost", True)
        self.float_window.wm_attributes("-disabled", True)
        self.float_window.configure(fg_color=TRANSPARENTE)
        self.float_window.wm_attributes("-transparentcolor", TRANSPARENTE)

        # Sin icono en la barra de tareas
        self.float_window.wm_attributes('-toolwindow', 'True')

        self.balloon_image = estilo.imagen_doble("globo", BALLOON_SIZE)

        self.label = customtkinter.CTkLabel(
            self.float_window,
            text="",
            compound='center',
            justify='left',
            width=BALLOON_SIZE[0],
            height=BALLOON_SIZE[1],
            fg_color="transparent",
            text_color=estilo.TEXTO,
            font=estilo.fuente("pequena"),
            image=self.balloon_image)

        self.label.grid(row=0, column=0, sticky="nsew")

        self._displayed = False
        self.float_window.withdraw()
        self.float_window.group(master)

    def register_widget(self, widget, text: str):
        if text != "":
            widget.bind("<Enter>", partial(self.show_balloon, widget, text))
            widget.bind("<Leave>", partial(self.hide_balloon, widget))

    def show_balloon(self, widget, text, event):

        if not self._displayed:
            self.label.configure(text=text)
            self._displayed = True
            self.float_window.wm_geometry(
                f"{BALLOON_SIZE[0]}x{BALLOON_SIZE[1]}+{widget.winfo_rootx()+widget.winfo_width()}+{widget.winfo_rooty()-10}"
            )

            self.float_window.lift()
            self.float_window.deiconify()

    def hide_balloon(self, widget, event):

        if self._displayed:

            self._displayed = False
            self.float_window.withdraw()
