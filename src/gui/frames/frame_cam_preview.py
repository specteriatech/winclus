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
# Adaptado para Gestik: miniatura de la cámara en una tarjeta con un
# botón grande «Activar / Pausar» en vez del interruptor pequeño original.

import tkinter

import customtkinter
from PIL import Image, ImageTk

from src import estilo
from src.camera_manager import CameraManager
from src.config_manager import ConfigManager
from src.controllers import MouseController
from src.gui.frames.safe_disposable_frame import SafeDisposableFrame

CANVAS_WIDTH = 216
CANVAS_HEIGHT = 162


class FrameCamPreview(SafeDisposableFrame):

    def __init__(self, master, master_callback: callable, **kwargs):
        super().__init__(master, **kwargs)
        self.master_callback = master_callback

        self.grid_columnconfigure(0, weight=1)
        self.configure(fg_color=estilo.PANEL, corner_radius=0)

        # Tarjeta que agrupa miniatura, botón y estado
        self.tarjeta = customtkinter.CTkFrame(master=self,
                                              fg_color=estilo.TARJETA,
                                              corner_radius=16)
        self.tarjeta.grid(row=0, column=0, padx=16, pady=(6, 16), sticky="ew")
        self.tarjeta.grid_columnconfigure(0, weight=1)

        # Miniatura de la cámara
        self.placeholder_im = Image.open("assets/images/placeholder.png")
        self.placeholder_im = ImageTk.PhotoImage(
            image=self.placeholder_im.resize((CANVAS_WIDTH, CANVAS_HEIGHT)))

        self.canvas = tkinter.Canvas(master=self.tarjeta,
                                     width=CANVAS_WIDTH,
                                     height=CANVAS_HEIGHT,
                                     bd=0,
                                     highlightthickness=0)
        estilo.registrar_lienzo(self.canvas, estilo.TARJETA)
        self.canvas.grid(row=0, column=0, padx=8, pady=(8, 6))

        # Botón principal: Activar / Pausar
        self.boton = customtkinter.CTkButton(master=self.tarjeta,
                                             text="Activar",
                                             width=CANVAS_WIDTH,
                                             height=54,
                                             corner_radius=14,
                                             font=estilo.fuente("boton_grande"),
                                             command=self.alternar)
        self.boton.grid(row=1, column=0, padx=8, pady=(2, 4))

        # Estado en una línea
        self.estado = customtkinter.CTkLabel(master=self.tarjeta,
                                             text="",
                                             wraplength=CANVAS_WIDTH,
                                             justify=tkinter.LEFT,
                                             anchor="w",
                                             text_color=estilo.TEXTO_SUAVE,
                                             font=estilo.fuente("pequena"))
        self.estado.grid(row=2, column=0, padx=10, pady=(0, 8), sticky="w")

        # El estado real vive en MouseController (también lo cambian los gestos
        # de pausa); el botón solo lo refleja.
        self.activo_var = MouseController().is_active
        self.activo_var.trace_add("write", lambda *_: self.refrescar())
        if ConfigManager().config["auto_play"]:
            self.activo_var.set(True)
        self.refrescar()

        # Primera imagen
        self.canvas_image = self.canvas.create_image(0,
                                                     0,
                                                     image=self.placeholder_im,
                                                     anchor=tkinter.NW)
        self.new_photo = None
        self.after(1, self.camera_loop)

    def alternar(self):
        nuevo = not self.activo_var.get()
        self.master_callback("toggle_switch", {"switch_status": nuevo})

    def refrescar(self):
        if self.is_destroyed:
            return
        if self.activo_var.get():
            self.boton.configure(text="Pausar",
                                 fg_color=estilo.PRIMARIO,
                                 hover_color=estilo.PRIMARIO_HOVER,
                                 text_color=estilo.TEXTO_SOBRE_PRIMARIO)
            self.estado.configure(
                text="Activo: mueve la cabeza para mover el puntero.")
        else:
            self.boton.configure(text="Activar",
                                 fg_color=estilo.AMBAR,
                                 hover_color=estilo.AMBAR_HOVER,
                                 text_color=estilo.TEXTO_SOBRE_AMBAR)
            self.estado.configure(
                text="En pausa: pulsa Activar para empezar.")

    def camera_loop(self):
        if self.is_destroyed:
            return
        if self.is_active:
            if CameraManager().is_destroyed:
                return
            frame_rgb = CameraManager().get_debug_frame()
            # Se guarda la referencia para que no la borre el recolector
            self.new_photo = ImageTk.PhotoImage(
                image=Image.fromarray(frame_rgb).resize((CANVAS_WIDTH,
                                                         CANVAS_HEIGHT)))
            self.canvas.itemconfig(self.canvas_image, image=self.new_photo)
            self.canvas.update()

            self.after(ConfigManager().config["tick_interval_ms"],
                       self.camera_loop)

    def enter(self):
        super().enter()
        self.after(1, self.camera_loop)

    def destroy(self):
        super().destroy()
