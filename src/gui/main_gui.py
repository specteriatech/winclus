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

import logging
import tkinter as tk

import customtkinter

from src import estilo
from PIL import Image

import src.gui.frames as frames
import src.gui.pages as pages
from src.config_manager import ConfigManager
from src.controllers import MouseController

customtkinter.set_default_color_theme("assets/themes/tema.json")
estilo.aplicar_modo(estilo.modo_guardado(), guardar=False)

logger = logging.getLogger("MainGUi")


class MainGui():

    def __init__(self, tk_root):
        logger.info("Init MainGui")
        super().__init__()
        self.tk_root = tk_root

        self.tk_root.geometry("1120x760")
        self.tk_root.title(f"Gestik {ConfigManager().version}")
        self.tk_root.iconbitmap("assets/images/icono.ico")
        self.tk_root.resizable(width=False, height=False)

        self.tk_root.grid_rowconfigure(1, weight=1)
        self.tk_root.grid_columnconfigure(1, weight=1)

        # Columna lateral: menú arriba (crece) y cámara con botón Activar abajo
        self.lateral = customtkinter.CTkFrame(self.tk_root,
                                              width=280,
                                              corner_radius=0,
                                              fg_color=estilo.PANEL)
        self.lateral.grid(row=0, column=0, sticky="nsw", rowspan=3)
        self.lateral.grid_propagate(False)
        self.lateral.grid_rowconfigure(0, weight=1)
        self.lateral.grid_columnconfigure(0, weight=1)

        self.frame_menu = frames.FrameMenu(self.lateral,
                                           self.root_function_callback,
                                           width=280,
                                           logger_name="frame_menu")
        self.frame_menu.grid(row=0, column=0, sticky="nsew")

        self.frame_preview = frames.FrameCamPreview(self.lateral,
                                                    self.cam_preview_callback,
                                                    logger_name="frame_preview")
        self.frame_preview.grid(row=1, column=0, sticky="sew")
        self.frame_preview.enter()

        # Create all wizard pages and grid them.
        self.pages = {
            "page_home":
                pages.PageHome(master=self.tk_root,
                               logger_name="page_home",
                               root_callback=self.root_function_callback),
            "page_camera":
                pages.PageSelectCamera(
                    master=self.tk_root,
                    logger_name="page_camera",
                ),
            "page_cursor":
                pages.PageCursor(
                    master=self.tk_root,
                    logger_name="page_cursor",
                ),
            "page_gestures":
                pages.PageSelectGestures(
                    master=self.tk_root,
                    logger_name="page_gestures",
                ),
            "page_keyboard":
                pages.PageKeyboard(
                    master=self.tk_root,
                    logger_name="page_keyboard",
                )
        }

        self.page_names = list(self.pages.keys())
        self.curr_page_name = None
        for name, page in self.pages.items():
            # Page home extended full window
            page.grid(row=0,
                      column=1,
                      padx=(10, 18),
                      pady=14,
                      sticky="nsew",
                      rowspan=2,
                      columnspan=1)

        self.change_page("page_home")

        # Profile UI
        self.frame_profile_switcher = frames.FrameProfileSwitcher(
            self.tk_root, main_gui_callback=self.root_function_callback)
        self.frame_profile_editor = frames.FrameProfileEditor(
            self.tk_root, main_gui_callback=self.root_function_callback)

    def root_function_callback(self, function_name, args: dict = {}, **kwargs):
        logger.info(f"root_function_callback {function_name} with {args}")

        # Basic page navigate
        if function_name == "change_page":
            self.change_page(args["target"])
            self.frame_menu.set_tab_active(tab_name=args["target"])

        # Profiles
        elif function_name == "show_profile_switcher":
            self.frame_profile_switcher.enter()
        elif function_name == "show_profile_editor":
            self.frame_profile_editor.enter()

        elif function_name == "refresh_profiles":
            logger.info("refresh_profile")
            self.pages["page_gestures"].refresh_profile()
            self.pages["page_camera"].refresh_profile()
            self.pages["page_cursor"].refresh_profile()
            self.pages["page_keyboard"].refresh_profile()

    def cam_preview_callback(self, function_name, args: dict, **kwargs):
        logger.info(f"cam_preview_callback {function_name} with {args}")

        if function_name == "toggle_switch":
            self.set_mediapipe_mouse_enable(new_state=args["switch_status"])

    def set_mediapipe_mouse_enable(self, new_state: bool):
        if new_state:
            MouseController().set_active(True)
        else:
            MouseController().set_active(False)

    def change_page(self, target_page_name: str):

        if self.curr_page_name == target_page_name:
            return

        for name, page in self.pages.items():
            if name == target_page_name:
                page.grid()
                self.pages[target_page_name].enter()
                self.curr_page_name = target_page_name

            else:
                page.grid_remove()
                page.leave()

    def del_main_gui(self):
        logger.info("Deleting MainGui instance")
        # try:
        self.frame_preview.leave()
        self.frame_preview.destroy()
        self.frame_menu.leave()
        self.frame_menu.destroy()
        for page in self.pages.values():
            page.leave()
            page.destroy()

        self.tk_root.quit()
        self.tk_root.destroy()
