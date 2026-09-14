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
# Adaptado para Winclus: miniatura de la cámara en una tarjeta con un
# botón grande «Activar / Pausar» en vez del interruptor pequeño original.

import time
import tkinter

import customtkinter
from PIL import Image, ImageTk

from src import estilo
from src.camera_manager import CameraManager
from src.config_manager import ConfigManager
from src.controllers import ControladorClic, MouseController
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
        self.aviso_hasta = 0.0    # mientras dure, el estado explica cómo pausar
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

    def contiene_boton(self, x, y) -> bool:
        """¿Está el punto de pantalla (x, y) sobre el botón Activar/Pausar?"""
        try:
            if not self.boton.winfo_viewable():
                return False
            x1 = self.boton.winfo_rootx()
            y1 = self.boton.winfo_rooty()
            x2 = x1 + self.boton.winfo_width()
            y2 = y1 + self.boton.winfo_height()
        except tkinter.TclError:
            return False
        return x1 <= x < x2 and y1 <= y < y2

    def avisar_como_pausar(self):
        """Un parpadeo sobre «Pausar» no pausa: se explica el gesto largo."""
        self.aviso_hasta = time.time() + 4.0
        self.estado.configure(
            text="Para pausar, cierra los ojos 1,2 s mirando este botón.",
            text_color=estilo.AMBAR)
        self.after(4100, self.refrescar)

    def alternar(self):
        nuevo = not self.activo_var.get()
        self.master_callback("toggle_switch", {"switch_status": nuevo})

    def refrescar(self):
        if self.is_destroyed:
            return
        if time.time() < self.aviso_hasta and self.activo_var.get():
            return
        self.estado.configure(text_color=estilo.TEXTO_SUAVE)
        if self.activo_var.get():
            self.boton.configure(text="Pausar",
                                 fg_color=estilo.PRIMARIO,
                                 hover_color=estilo.PRIMARIO_HOVER,
                                 text_color=estilo.TEXTO_SOBRE_PRIMARIO)
            if ConfigManager().config.get("modo_puntero") == "ojos":
                texto = "Activo con los ojos."
            else:
                texto = "Activo con la cabeza."
            # Máximo dos líneas para que la tarjeta no crezca
            if ControladorClic().arrastrando:
                self.estado.configure(text="Arrastrando: haz tu gesto de clic para soltar.",
                                      text_color=estilo.AMBAR)
                return
            self.estado.configure(
                text=texto + " Para pausar: ojos cerrados 1,2 s sobre el botón.")
        else:
            self.boton.configure(text="Activar",
                                 fg_color=estilo.AMBAR,
                                 hover_color=estilo.AMBAR_HOVER,
                                 text_color=estilo.TEXTO_SOBRE_AMBAR)
            self.estado.configure(
                text="En pausa: el puntero no se mueve. Pulsa Activar.")

    def camera_loop(self):
        if self.is_destroyed:
            return
        if self.is_active:
            if CameraManager().is_destroyed:
                return
            modo = (ConfigManager().config.get("modo_puntero"), ControladorClic().arrastrando)
            if modo != getattr(self, "modo_mostrado", None):
                self.modo_mostrado = modo
                self.refrescar()
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
