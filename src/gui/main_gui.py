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
import pyautogui

from src import estilo
from PIL import Image

import src.gui.frames as frames
import src.gui.pages as pages
from src.config_manager import ConfigManager
from src.controllers import ControladorClic, MouseController
from src.asistente import Asistente
from src.detectors.aprendizaje import AprendizajeClics
from src.voz import Voz
from src.gui.anillo import Anillo
from src.gui.calibracion import VentanaRecentrado
from src.gui.lupa import Lupa
from src.gui.aviso import AvisoPuntero
from src.iman import Iman
from src.gui.menu_clics import MenuClics
from src.gui.teclado_pantalla import TecladoPantalla

customtkinter.set_default_color_theme("assets/themes/tema.json")
estilo.aplicar_modo(estilo.modo_guardado(), guardar=False)

logger = logging.getLogger("MainGUi")


def _icono_ventana(tk_root) -> None:
    """Pone el icono de Winclus también en tamaño grande (barra de tareas y
    Alt+Tab); iconbitmap solo fija el pequeño de la barra de título."""
    import ctypes
    from pathlib import Path
    tk_root.update_idletasks()
    user32 = ctypes.windll.user32
    hwnd = user32.GetParent(tk_root.winfo_id())
    ruta = str(Path("assets/images/icono.ico").resolve())
    IMAGE_ICON, LR_LOADFROMFILE, WM_SETICON = 1, 0x10, 0x0080
    for tamano, tipo in ((256, 1), (32, 0)):  # ICON_BIG, ICON_SMALL
        h = user32.LoadImageW(None, ruta, IMAGE_ICON, tamano, tamano, LR_LOADFROMFILE)
        if h:
            user32.SendMessageW(hwnd, WM_SETICON, tipo, h)


class MainGui():

    def __init__(self, tk_root):
        logger.info("Init MainGui")
        super().__init__()
        self.tk_root = tk_root

        self.tk_root.geometry("1120x760")
        self.tk_root.title(f"Winclus {ConfigManager().version}")
        self.tk_root.iconbitmap("assets/images/icono.ico")
        try:
            _icono_ventana(self.tk_root)
        except Exception as e:  # noqa: BLE001
            logger.warning("Icono grande no aplicado: %s", e)
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
                ),
            "page_escribir":
                pages.PageEscribir(
                    master=self.tk_root,
                    logger_name="page_escribir",
                ),
            "page_asistente":
                pages.PageAsistente(
                    master=self.tk_root,
                    logger_name="page_asistente",
                ),
        }

        self.page_names = list(self.pages.keys())
        self.curr_page_name = None
        for name, page in self.pages.items():
            # Page home extended full window
            # Fila 0 queda para el aviso de pausa: así no tapa el título de la página
            page.grid(row=1,
                      column=1,
                      padx=(10, 18),
                      pady=14,
                      sticky="nsew",
                      rowspan=2,
                      columnspan=1)

        self.change_page("page_home")

        # Aviso grande cuando el puntero está en pausa (encima de las páginas)
        self.aviso_pausa = customtkinter.CTkFrame(self.tk_root,
                                                  fg_color=estilo.AMBAR,
                                                  corner_radius=14)
        customtkinter.CTkLabel(
            self.aviso_pausa,
            text="Puntero en pausa: Winclus no mueve el puntero ni hace clic.",
            text_color=estilo.TEXTO_SOBRE_AMBAR,
            font=estilo.fuente("etiqueta")).grid(row=0, column=0,
                                                 padx=(18, 12), pady=10)
        customtkinter.CTkButton(
            self.aviso_pausa,
            text="Activar",
            width=110,
            height=36,
            corner_radius=10,
            fg_color=estilo.PRIMARIO,
            hover_color=estilo.PRIMARIO_HOVER,
            text_color=estilo.TEXTO_SOBRE_PRIMARIO,
            font=estilo.fuente("boton"),
            command=lambda: self.set_mediapipe_mouse_enable(True)).grid(
                row=0, column=1, padx=(0, 12), pady=8)
        MouseController().is_active.trace_add(
            "write", lambda *_: self.refrescar_aviso_pausa())
        self.refrescar_aviso_pausa()

        # Profile UI
        self.frame_profile_switcher = frames.FrameProfileSwitcher(
            self.tk_root, main_gui_callback=self.root_function_callback)
        self.frame_profile_editor = frames.FrameProfileEditor(
            self.tk_root, main_gui_callback=self.root_function_callback)

        # Anillo del clic por permanencia (sigue al puntero por toda la pantalla)
        # y aviso visual de cada clic
        self.anillo = Anillo(self.tk_root)
        self.aviso = AvisoPuntero(self.tk_root)
        ControladorClic().avisar = self.aviso.mostrar
        self.tk_root.after(33, self.anillo_loop)

        # Lupa de dos pasos y corrección rápida del centro (modo ojos)
        self.lupa = Lupa(self.tk_root)
        self.recentrado = None
        ControladorClic().lupa_gui = self.lupa
        ControladorClic().abrir_recentrado = self.abrir_recentrado
        # Sobre el botón «Pausar» un parpadeo no pausa; los ojos cerrados 1,2 s sí
        ControladorClic().sobre_pausar = self.frame_preview.contiene_boton
        ControladorClic().pausar = lambda: self.set_mediapipe_mouse_enable(False)
        ControladorClic().avisar_pausa = self.frame_preview.avisar_como_pausar

        # Calibración invisible: el modelo nuevo se aplica en el hilo de tkinter
        AprendizajeClics().programar = lambda fn: self.tk_root.after(0, fn)
        AprendizajeClics().al_aplicar = lambda modelo: self.pages["page_cursor"].calibracion_aprendida(modelo)

        # Teclado en pantalla (página «Escribir»)
        self.teclado = TecladoPantalla(self.tk_root)
        self.teclado.al_cambiar_visible = self.pages["page_escribir"].refrescar_boton
        self.pages["page_escribir"].teclado = self.teclado
        ControladorClic().teclado_gui = self.teclado

        # Imán a los controles (con el puntero por los ojos)
        def imantar(x, y):
            MouseController().congelar(0.3)
            MouseController().fijar_en(x, y)
            pyautogui.moveTo(int(x), int(y))
        Iman().mover = imantar
        Iman().avisar = self.aviso.mostrar
        Iman().start()

        # Asistente: habla con la voz de Winclus y se abre desde el menú de clics
        Asistente().decir = lambda texto: Voz().decir(texto, forzar=True)
        ControladorClic().abrir_asistente = self.abrir_asistente

        # Menú de clics (ojos cerrados 1,2 s): derecho, doble, arrastrar, rueda…
        self.menu_clics = MenuClics(self.tk_root)
        ControladorClic().menu_gui = self.menu_clics
        ControladorClic().alternar_teclado = self.teclado.alternar

    def abrir_asistente(self):
        self.root_function_callback("change_page", {"target": "page_asistente"})
        try:
            self.tk_root.deiconify()
            self.tk_root.lift()
            self.pages["page_asistente"].enfocar()
        except Exception as e:
            logger.warning(f"Abrir asistente: {e}")

    def refrescar_aviso_pausa(self):
        activo = MouseController().is_active.get()
        if activo:
            self.aviso_pausa.grid_remove()
        else:
            # En su propia fila, encima de la página: no tapa nada
            self.aviso_pausa.grid(row=0, column=1, padx=(10, 18), pady=(14, 0), sticky="e")

    def abrir_recentrado(self):
        if self.recentrado is not None:
            return
        self.recentrado = VentanaRecentrado(self.tk_root, self._recentrado_terminado)

    def _recentrado_terminado(self, ok):
        self.recentrado = None
        logger.info(f"Recentrado {'hecho' if ok else 'cancelado'}")
        if "page_cursor" in self.pages:
            self.pages["page_cursor"].refresh_profile()

    def anillo_loop(self):
        if self.anillo is None:
            return
        try:
            self.anillo.actualizar(ControladorClic().estado_anillo())
            if self.aviso is not None:
                self.aviso.actualizar()
        except Exception as e:
            logger.warning(f"Anillo: {e}")
        self.tk_root.after(33, self.anillo_loop)

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
            self.pages["page_escribir"].refresh_profile()
            self.teclado.reconstruir()

    def cam_preview_callback(self, function_name, args: dict, **kwargs):
        logger.info(f"cam_preview_callback {function_name} with {args}")

        if function_name == "toggle_switch":
            self.set_mediapipe_mouse_enable(new_state=args["switch_status"])

    def set_mediapipe_mouse_enable(self, new_state: bool):
        if new_state:
            MouseController().set_active(True)
            if ConfigManager().config.get("teclado_mostrar_al_activar", False):
                self.teclado.mostrar()
        else:
            MouseController().set_active(False)
        if self.aviso is not None and ConfigManager().config.get("avisos_visuales", True):
            self.aviso.mostrar("Activado" if new_state else "En pausa", 1200,
                               color=estilo.PRIMARIO if new_state else estilo.AMBAR)

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
        if self.anillo is not None:
            self.anillo.destruir()
            self.anillo = None
        if getattr(self, "aviso", None) is not None:
            self.aviso.destruir()
            self.aviso = None
        if self.lupa is not None:
            self.lupa.destruir()
            self.lupa = None
        if self.teclado is not None:
            self.teclado.destruir()
            self.teclado = None
        if getattr(self, "menu_clics", None) is not None:
            self.menu_clics.destruir()
            self.menu_clics = None
        self.frame_preview.leave()
        self.frame_preview.destroy()
        self.frame_menu.leave()
        self.frame_menu.destroy()
        for page in self.pages.values():
            page.leave()
            page.destroy()

        self.tk_root.quit()
        self.tk_root.destroy()
