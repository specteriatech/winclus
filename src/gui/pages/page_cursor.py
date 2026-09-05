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
# Adaptado para Gestik: página «Puntero» con el selector «Cómo muevo el
# puntero» (con la cabeza o con los ojos) y los ajustes de cada modo.

import logging
import tkinter
from functools import partial

import customtkinter

from src import estilo
import numpy as np
from PIL import Image

from src.config_manager import ConfigManager
from src.controllers import MouseController
from src.detectors import FaceMesh
from src.detectors import calibracion
from src.gui.balloon import Balloon
from src.gui.calibracion import VentanaCalibracion
from src.gui.frames.safe_disposable_frame import SafeDisposableFrame, SafeDisposableScrollableFrame
from src.gui.tarjetas import SelectorTarjetas

logger = logging.getLogger("PageCursor")
MAX_ROWS = 3
HELP_ICON_SIZE = (18, 18)
MAX_HOLD_TRIG = 5000

OPCIONES_PUNTERO = [
    ("cabeza", "cabeza", "Con la cabeza", "Muevo la cabeza y el puntero la sigue"),
    ("ojos", "ojo", "Con los ojos", "El puntero va a donde miro"),
]

AJUSTES_CABEZA = {
    "Hacia arriba": ["spd_up", "", 0, 100],
    "Hacia abajo": ["spd_down", "", 0, 100],
    "Hacia la derecha": ["spd_right", "", 0, 100],
    "Hacia la izquierda": ["spd_left", "", 0, 100],
    "(Avanzado) Suavizar el puntero": [
        "pointer_smooth",
        "Qué tan suave se mueve el puntero.\nSubirlo quita el temblor, pero\nresponde un poco más lento.",
        1, 100
    ],
    "(Avanzado) Suavizar los gestos": [
        "shape_smooth", "Evita que un gesto se dispare\nvarias veces por un parpadeo\nde la detección.",
        1, 100
    ],
    "(Avanzado) Tiempo para mantener (ms)": [
        "hold_trigger_ms",
        "Cuánto tiempo (en milisegundos)\nhay que sostener el gesto para\nque el clic se quede presionado.",
        1, MAX_HOLD_TRIG
    ]
}

AJUSTES_OJOS = {
    "Velocidad": [
        "ojos_velocidad",
        "Qué tan rápido va el puntero\ncuando miras hacia un lado.", 1, 100
    ],
    "Zona quieta": [
        "ojos_zona_muerta",
        "Cuánto puedes mover los ojos\nsin que el puntero se mueva.\nSúbela si el puntero se va solo.",
        1, 15
    ],
    "Arriba y abajo (%)": [
        "ojos_vertical",
        "Los ojos se mueven menos hacia\narriba y abajo: aquí se compensa.", 50, 300
    ],
    "(Avanzado) Suavizar la mirada": [
        "ojos_suavizado", "Más suave = menos temblor,\npero responde más lento.", 1, 30
    ],
}

# Cuadro donde se ve la mirada en vivo
AJUSTES_DIRECTO = {
    "Quieto hasta que la mirada cambie (px)": [
        "ojos_fijacion_px",
        "El puntero no se mueve mientras tu\nmirada se queda cerca de donde está.\nSúbelo si el puntero tiembla;\nbájalo si no llega a cosas pequeñas.",
        20, 200
    ],
    "Espera antes de mover (ms)": [
        "ojos_persistencia_ms",
        "La mirada debe llevar este tiempo\nfuera de la zona quieta para que el\npuntero se mueva. Un vistazo\nsuelto no lo mueve.",
        0, 600
    ],
    "(Avanzado) Suavizar la mirada": [
        "ojos_suavizado", "Más suave = menos temblor,\npero responde más lento.", 1, 30
    ],
}

# Cuadro donde se ve la mirada en vivo
CUADRO = (220, 160)
PANTALLA_ALTO = 124   # mini pantalla 16:9 del modo directo
ESCALA_MIRADA = 500   # píxeles del cuadro por unidad de mirada


class FrameSelectGesture(SafeDisposableFrame):
    """Lista de deslizadores que escriben directamente en cursor.json."""

    def __init__(
        self,
        master,
        ajustes: dict = None,
        **kwargs,
    ):
        super().__init__(master, **kwargs)

        self.grid_rowconfigure(MAX_ROWS, weight=1)
        self.grid_columnconfigure(1, weight=1)
        self.slider_dragging = False
        self.help_icon = customtkinter.CTkImage(
            Image.open("assets/images/help.png").resize(HELP_ICON_SIZE),
            size=HELP_ICON_SIZE)

        self.shared_info_balloon = Balloon(
            self, image_path="assets/images/balloon.png")

        # Slider divs
        self.divs = self.create_divs(ajustes if ajustes is not None else AJUSTES_CABEZA)

        self.load_initial_config()

    def load_initial_config(self):
        """Load default from config and set the UI
        """

        for cfg_name, div in self.divs.items():

            cfg_value = int(
                np.clip(ConfigManager().config[cfg_name],
                        a_min=0,
                        a_max=MAX_HOLD_TRIG))
            div["slider"].set(cfg_value)
            # Temporary remove trace, adjust the value and put it back
            div["entry_var"].trace_vdelete("w", div["entry_trace_id"])
            div["entry_var"].set(cfg_value)
            div["entry_trace_id"] = div["entry_var"].trace(
                "w", div["entry_trace_fn"])

    def create_divs(self, directions: dict):
        out_dict = {}

        for idx, (show_name, (cfg_name, balloon_text, slider_min,
                              slider_max)) in enumerate(directions.items()):

            help_image = self.help_icon if balloon_text != "" else None
            # Label
            label = customtkinter.CTkLabel(master=self,
                                           image=help_image,
                                           compound='right',
                                           text=show_name,
                                           justify=tkinter.LEFT)
            label.configure(font=estilo.fuente("etiqueta"))
            label.grid(row=idx, column=0, padx=20, pady=(10, 10), sticky="nw")
            self.shared_info_balloon.register_widget(label, balloon_text)

            # Slider
            slider = customtkinter.CTkSlider(master=self,
                                             from_=slider_min,
                                             to=slider_max,
                                             width=250,
                                             number_of_steps=min(99, slider_max - slider_min),
                                             command=partial(
                                                 self.slider_drag_callback,
                                                 cfg_name))
            slider.bind("<Button-1>",
                        partial(self.slider_mouse_down_callback, cfg_name))
            slider.bind("<ButtonRelease-1>",
                        partial(self.slider_mouse_up_callback, cfg_name))
            slider.grid(row=idx, column=0, padx=30, pady=(40, 10), sticky="nw")

            # Number entry
            entry_var = tkinter.StringVar()
            entry_trace_fn = partial(self.entry_changed_callback, cfg_name,
                                     slider_min, slider_max)
            entry_var_trace_id = entry_var.trace("w", entry_trace_fn)
            entry = customtkinter.CTkEntry(
                master=self,
                validate='all',
                textvariable=entry_var,
                #validatecommand=vcmd,
                width=62)
            entry.grid(row=idx,
                       column=0,
                       padx=(300, 5),
                       pady=(34, 10),
                       sticky="nw")

            out_dict[cfg_name] = {
                "label": label,
                "slider": slider,
                "entry": entry,
                "entry_var": entry_var,
                "entry_trace_id": entry_var_trace_id,
                "entry_trace_fn": entry_trace_fn
            }
        return out_dict

    def validate_entry_input(self, P, slider_min, slider_max):
        slider_min = int(slider_min)
        slider_max = int(slider_max)

        if str.isdigit(P):
            P = int(P)

            if P < slider_min:
                return False
            elif P > slider_max:
                return False

            return True
        else:
            return False

    def entry_changed_callback(self, div_name, slider_min, slider_max, var,
                               index, mode):
        """Update value with entery text
        """
        is_valid_input = True
        div = self.divs[div_name]

        entry_value = div["entry_var"].get()

        # Check if valid input
        if not str.isdigit(entry_value):
            is_valid_input = False
        else:
            new_value = int(entry_value)
            if not new_value in range(slider_min, slider_max + 1):
                is_valid_input = False

        # Update slider and config
        if is_valid_input:
            div["entry"].configure(fg_color=estilo.TARJETA)
            div["slider"].set(new_value)

            # Don't update config when dragging
            if not self.slider_dragging:
                ConfigManager().set_temp_config(field=div_name, value=new_value)
                ConfigManager().apply_config()
                MouseController().calc_smooth_kernel()
        else:
            div["entry"].configure(fg_color=estilo.ENTRADA_ERROR)

    def slider_drag_callback(self, div_name: str, new_value: str):
        """Update value when slider being drag
        """
        self.slider_dragging = True
        new_value = int(new_value)
        div = self.divs[div_name]
        div["entry_var"].set(new_value)

    def slider_mouse_down_callback(self, div_name: str, event):
        self.slider_dragging = True

    def slider_mouse_up_callback(self, div_name: str, event):
        self.slider_dragging = False
        div = self.divs[div_name]
        new_value = int(div["entry_var"].get())
        ConfigManager().set_temp_config(field=div_name, value=new_value)
        ConfigManager().apply_config()
        MouseController().calc_smooth_kernel()

    def inner_refresh_profile(self):
        self.load_initial_config()


class FrameOjos(customtkinter.CTkFrame):
    """Ajustes del modo «con los ojos»: sub-modo directo (calibrar y mirar) o
    palanca (fijar el centro y empujar)."""

    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.grid_columnconfigure(0, weight=1)
        self.muestras = None       # se llena mientras se fija el centro (palanca)
        self.cuenta = 0
        self.ventana_calibracion = None
        self.al_calibrar = None    # callback para abrir la ventana (lo pone la página)

        # Sub-modo
        fila = customtkinter.CTkFrame(self, fg_color="transparent")
        fila.grid(row=0, column=0, padx=16, pady=(10, 4), sticky="w")
        self.selector_modo = customtkinter.CTkSegmentedButton(
            fila,
            values=["Directo", "Palanca"],
            width=260,
            height=38,
            font=estilo.fuente("boton_normal"),
            command=self.cambiar_submodo)
        self.selector_modo.grid(row=0, column=0, sticky="w")
        self.explicacion = customtkinter.CTkLabel(fila,
                                                  text="",
                                                  text_color=estilo.TEXTO_SUAVE,
                                                  justify=tkinter.LEFT,
                                                  font=estilo.fuente("pequena"))
        self.explicacion.grid(row=0, column=1, padx=(14, 0), sticky="w")

        self.panel_directo = self._crear_panel_directo()
        self.panel_palanca = self._crear_panel_palanca()
        self.panel_directo.grid(row=1, column=0, sticky="ew")
        self.panel_palanca.grid(row=1, column=0, sticky="ew")
        self.submodo = None

    # ------------------------------------------------------------ directo --
    def _crear_panel_directo(self):
        panel = customtkinter.CTkFrame(self, fg_color="transparent")
        panel.grid_columnconfigure(1, weight=1)

        izq = customtkinter.CTkFrame(panel, fg_color="transparent")
        izq.grid(row=0, column=0, padx=(16, 8), pady=8, sticky="nw")
        customtkinter.CTkLabel(izq,
                               text="Primero, calibra",
                               font=estilo.fuente("etiqueta")).grid(
                                   row=0, column=0, sticky="w")
        customtkinter.CTkLabel(
            izq,
            text=("Primero verás tus ojos, para revisar luz y distancia.\n"
                  "Luego 13 puntos fijos, un punto móvil que seguir\n"
                  "y 4 puntos de comprobación. Tarda un minuto.\n"
                  "Con Escape se cancela."),
            text_color=estilo.TEXTO_SUAVE,
            justify=tkinter.LEFT,
            font=estilo.fuente("pequena")).grid(row=1, column=0, pady=(0, 6), sticky="w")
        self.boton_calibrar = customtkinter.CTkButton(izq,
                                                      text="Calibrar",
                                                      width=CUADRO[0],
                                                      height=44,
                                                      font=estilo.fuente("boton"),
                                                      command=self.calibrar)
        self.boton_calibrar.grid(row=2, column=0, pady=(0, 4), sticky="w")
        self.estado_calibracion = customtkinter.CTkLabel(izq,
                                                         text="",
                                                         wraplength=CUADRO[0] + 40,
                                                         justify=tkinter.LEFT,
                                                         font=estilo.fuente("cuerpo"))
        self.estado_calibracion.grid(row=3, column=0, pady=(0, 6), sticky="w")
        fila_btn = customtkinter.CTkFrame(izq, fg_color="transparent")
        fila_btn.grid(row=6, column=0, pady=(8, 0), sticky="w")
        self.boton_comprobar = customtkinter.CTkButton(
            fila_btn, text="Comprobar precisión", width=CUADRO[0], height=36,
            fg_color=estilo.TARJETA, border_width=2, border_color=estilo.PRIMARIO,
            text_color=estilo.PRIMARIO, hover_color=estilo.PRIMARIO_SUAVE,
            font=estilo.fuente("boton_normal"), command=self.comprobar)
        self.boton_comprobar.grid(row=0, column=0, pady=(0, 6), sticky="w")
        self.boton_mejorar = customtkinter.CTkButton(
            fila_btn, text="Mejorar con los datos guardados", width=CUADRO[0], height=36,
            fg_color=estilo.TARJETA, border_width=2, border_color=estilo.PRIMARIO,
            text_color=estilo.PRIMARIO, hover_color=estilo.PRIMARIO_SUAVE,
            font=estilo.fuente("boton_normal"), command=self.mejorar)
        self.boton_mejorar.grid(row=1, column=0, sticky="w")
        self.aviso_mejora = customtkinter.CTkLabel(fila_btn, text="", wraplength=CUADRO[0] + 40,
                                                   justify=tkinter.LEFT,
                                                   text_color=estilo.TEXTO_SUAVE,
                                                   font=estilo.fuente("pequena"))
        self.aviso_mejora.grid(row=2, column=0, pady=(2, 0), sticky="w")

        customtkinter.CTkLabel(izq,
                               text="Dónde cae tu mirada",
                               font=estilo.fuente("etiqueta")).grid(
                                   row=4, column=0, pady=(6, 2), sticky="w")
        self.pantalla = tkinter.Canvas(izq,
                                       width=CUADRO[0],
                                       height=PANTALLA_ALTO,
                                       bd=0,
                                       highlightthickness=0)
        estilo.registrar_lienzo(self.pantalla, estilo.PANEL)
        self.pantalla.grid(row=5, column=0, sticky="w")
        self.p_borde = self.pantalla.create_rectangle(1, 1, CUADRO[0] - 2, PANTALLA_ALTO - 2,
                                                      outline=estilo.BORDE[0], width=2)
        self.p_mirada = self.pantalla.create_oval(0, 0, 0, 0, fill=estilo.AMBAR[0], outline="")
        self.p_puntero = self.pantalla.create_oval(0, 0, 0, 0, outline=estilo.PRIMARIO[0], width=2)
        self.p_texto = self.pantalla.create_text(CUADRO[0] // 2, PANTALLA_ALTO // 2,
                                                 text="", fill=estilo.TEXTO_SUAVE[0],
                                                 font=(estilo.FAMILIA_TEXTO, 10))

        der = customtkinter.CTkFrame(panel, fg_color="transparent")
        der.grid(row=0, column=1, padx=(0, 8), pady=4, sticky="nw")
        self.deslizadores_directo = FrameSelectGesture(der,
                                                       ajustes=AJUSTES_DIRECTO,
                                                       fg_color="transparent",
                                                       logger_name="directo_sliders")
        self.deslizadores_directo.grid(row=0, column=0, sticky="nw")

        # Opciones de precisión, debajo de los deslizadores
        opciones = customtkinter.CTkFrame(der, fg_color="transparent")
        opciones.grid(row=1, column=0, padx=(20, 0), pady=(0, 10), sticky="nw")
        self.lupa_var = tkinter.BooleanVar(value=True)
        customtkinter.CTkCheckBox(
            opciones,
            text="Lupa para afinar el clic",
            variable=self.lupa_var,
            font=estilo.fuente("cuerpo"),
            command=lambda: self._guardar("lupa_activa", bool(self.lupa_var.get()))).grid(
                row=0, column=0, pady=(2, 0), sticky="w")
        customtkinter.CTkLabel(
            opciones,
            text=("El primer gesto de clic agranda la zona que miras; dentro, "
                  "mira el sitio exacto y repite el gesto. Se cierra sola si apartas la vista."),
            wraplength=400,
            text_color=estilo.TEXTO_SUAVE,
            justify=tkinter.LEFT,
            font=estilo.fuente("pequena")).grid(row=1, column=0, padx=(28, 0), pady=(0, 8), sticky="w")
        self.recentrar_var = tkinter.BooleanVar(value=True)
        customtkinter.CTkCheckBox(
            opciones,
            text="Ojos cerrados 1,2 s: corregir el centro",
            variable=self.recentrar_var,
            font=estilo.fuente("cuerpo"),
            command=lambda: self._guardar("ojos_recentrar_largo", bool(self.recentrar_var.get()))).grid(
                row=2, column=0, pady=(2, 0), sticky="w")
        customtkinter.CTkLabel(
            opciones,
            text=("Si el puntero se desvía porque moviste un poco la cabeza, cierra los "
                  "ojos 1,2 s, mira el punto del centro y queda corregido en 2 segundos."),
            wraplength=400,
            text_color=estilo.TEXTO_SUAVE,
            justify=tkinter.LEFT,
            font=estilo.fuente("pequena")).grid(row=3, column=0, padx=(28, 0), pady=(0, 4), sticky="w")

        # Opciones de la calibración
        customtkinter.CTkLabel(opciones, text="Opciones de la calibración",
                               font=estilo.fuente("etiqueta")).grid(row=4, column=0, pady=(12, 2), sticky="w")
        self.opc = {}
        fila = 5
        for clave, titulo, valores, ayuda in (
                ("calib_modo", "Duración", [("rapida", "Rápida"), ("normal", "Normal"), ("completa", "Completa")],
                 "Rápida: 9 puntos, 30 s. Normal: 13 puntos y punto móvil, 1 min. Completa: 25 puntos y punto móvil largo, 2 min."),
                ("ojos_usar", "Ojos", [("ambos", "Los dos"), ("derecho", "Solo derecho"), ("izquierdo", "Solo izquierdo")],
                 "Si un ojo se ve peor o desvía (estrabismo), calibra solo con el otro.")):
            customtkinter.CTkLabel(opciones, text=titulo, font=estilo.fuente("cuerpo")).grid(
                row=fila, column=0, pady=(4, 0), sticky="w")
            seg = customtkinter.CTkSegmentedButton(
                opciones, values=[v[1] for v in valores], height=32,
                font=estilo.fuente("pequena"),
                command=lambda nombre, c=clave, vs=valores: self._guardar(
                    c, next(k for k, n in vs if n == nombre)))
            seg.grid(row=fila + 1, column=0, sticky="w")
            customtkinter.CTkLabel(opciones, text=ayuda, wraplength=430, justify=tkinter.LEFT,
                                   text_color=estilo.TEXTO_SUAVE,
                                   font=estilo.fuente("pequena")).grid(row=fila + 2, column=0, pady=(0, 4), sticky="w")
            self.opc[clave] = (seg, valores)
            fila += 3
        self.opc_vars = {}
        for clave, texto in (("calib_lento", "Más tiempo en cada punto"),
                             ("calib_punto_grande", "Punto más grande"),
                             ("calib_cabeza", "Paso final de compensación de cabeza")):
            var = tkinter.BooleanVar(value=False)
            customtkinter.CTkCheckBox(opciones, text=texto, variable=var, font=estilo.fuente("cuerpo"),
                                      command=lambda c=clave, v=var: self._guardar(c, bool(v.get()))).grid(
                                          row=fila, column=0, pady=(2, 0), sticky="w")
            self.opc_vars[clave] = var
            fila += 1
        return panel

    def _cargar_opciones(self):
        cfg = ConfigManager().config
        for clave, (seg, valores) in self.opc.items():
            actual = cfg.get(clave)
            nombre = next((n for k, n in valores if k == actual), valores[0][1])
            seg.set(nombre)
        for clave, var in self.opc_vars.items():
            var.set(bool(cfg.get(clave, False)))

    def _guardar(self, clave, valor):
        ConfigManager().set_temp_config(clave, valor)
        ConfigManager().apply_config()

    def calibrar(self):
        if self.al_calibrar is not None:
            self.al_calibrar(False)

    def comprobar(self):
        modelo = ConfigManager().config.get("ojos_calibracion")
        if not calibracion.es_valido(modelo):
            self.aviso_mejora.configure(text="Primero hay que calibrar.")
            return
        if self.al_calibrar is not None:
            self.al_calibrar(True)

    def mejorar(self):
        """Prueba variantes del modelo sobre los datos crudos de la última
        calibración y se queda con la de menor error en la comprobación."""
        import json
        from pathlib import Path
        from src.detectors.mirada import NOMBRES_RASGOS
        ruta = Path(ConfigManager().curr_profile_path, "calibracion_datos.json")
        if not ruta.is_file():
            self.aviso_mejora.configure(text="No hay datos guardados: calibra primero.")
            return
        try:
            with open(ruta, encoding="utf-8") as f:
                datos = json.load(f)
        except Exception as e:
            self.aviso_mejora.configure(text=f"No se pudieron leer los datos: {e}")
            return
        if datos.get("rasgos_fijos") and len(datos["rasgos_fijos"][0]) != len(NOMBRES_RASGOS):
            self.aviso_mejora.configure(text="Los datos son de una versión anterior: calibra otra vez.")
            return
        actual = ConfigManager().config.get("ojos_calibracion") or {}
        base = calibracion.inactivos_por_ojos(NOMBRES_RASGOS, ConfigManager().config.get("ojos_usar", "ambos"))
        self.aviso_mejora.configure(text="Probando variantes…")
        self.update_idletasks()
        modelo, nombre, err, tabla = calibracion.mejorar_con_datos(datos, NOMBRES_RASGOS, base)
        if modelo is None:
            self.aviso_mejora.configure(text=f"No se pudo mejorar: {nombre}.")
            return
        for k in ("sesgo", "cabeza_ref", "cabeza_coef", "retraso_ms", "cabeza_mejora_px"):
            if k in actual:
                modelo[k] = actual[k]
        actual_err = actual.get("error_real_px", actual.get("error_px", 9999))
        logger.info("Variantes: " + "; ".join(f"{n}: {e:.0f}/{l}" for n, e, l in tabla[:8]))
        if err + 2 < actual_err:
            ConfigManager().set_temp_config("ojos_calibracion", modelo)
            ConfigManager().apply_config()
            MouseController().reiniciar_mirada()
            self.aviso_mejora.configure(
                text=f"Mejor: «{nombre}», error {err:.0f} px (antes {actual_err}). Aplicado.")
        else:
            self.aviso_mejora.configure(
                text=f"El modelo actual ya es el mejor ({actual_err} px; la mejor variante da {err:.0f}).")
        self._texto_calibracion()

    def calibracion_terminada(self, modelo):
        self._texto_calibracion()
        if modelo is None:
            self.estado_calibracion.configure(text="Calibración cancelada.",
                                              text_color=estilo.TEXTO_SUAVE)

    def _texto_calibracion(self):
        modelo = ConfigManager().config.get("ojos_calibracion")
        from src.detectors.mirada import NOMBRES_RASGOS
        if isinstance(modelo, dict) and not calibracion.es_valido(modelo, len(NOMBRES_RASGOS)):
            self.estado_calibracion.configure(
                text="La calibración es de una versión anterior. Calibra otra vez.",
                text_color=estilo.ALERTA)
        elif isinstance(modelo, dict) and "error_px" in modelo:
            # El error real (puntos de comprobación) manda sobre el estimado
            err = modelo.get("error_real_px", modelo["error_px"])
            if err <= 80:
                calidad, color = "buena", estilo.OK
            elif err <= 160:
                calidad, color = "aceptable", estilo.ALERTA
            else:
                calidad, color = "floja: repite con más luz", estilo.ERROR
            sesgo = modelo.get("sesgo")
            extra = ""
            if sesgo and (abs(sesgo[0]) > 1 or abs(sesgo[1]) > 1):
                extra = f" Centro corregido ({sesgo[0]:+.0f}, {sesgo[1]:+.0f})."
            self.estado_calibracion.configure(
                text=f"Calibrado. Precisión {calidad} (±{err} px).{extra}", text_color=color)
            if err > 160:
                self.estado_calibracion.configure(
                    text=f"Calibrado, pero la precisión es {calidad} (±{err} px).{extra}")
        else:
            self.estado_calibracion.configure(text="Sin calibrar todavía.",
                                              text_color=estilo.ALERTA)

    def _dibujar_mapa_errores(self, modelo, x1, y1, ex, ey):
        """Puntos de la calibración con una línea hacia donde cayó la
        previsión (gris: puntos fijos; ámbar: comprobación). Se redibuja solo
        cuando cambia el modelo."""
        clave = (id(modelo), len(modelo.get("residuos_comprobacion", [])))
        if getattr(self, "_mapa_clave", None) == clave:
            return
        self._mapa_clave = clave
        for item in getattr(self, "_mapa_items", []):
            self.pantalla.delete(item)
        items = []
        gris = estilo.color_actual(estilo.TEXTO_SUAVE)
        ambar = estilo.color_actual(estilo.AMBAR)
        for (px, py), (dx, dy) in zip(modelo.get("puntos", []), modelo.get("residuos_fijos", [])):
            cx, cy = 2 + (px - x1) * ex, 2 + (py - y1) * ey
            items.append(self.pantalla.create_oval(cx - 2, cy - 2, cx + 2, cy + 2, fill=gris, outline=""))
            items.append(self.pantalla.create_line(cx, cy, cx + dx * ex, cy + dy * ey, fill=gris))
        for px, py, dx, dy in modelo.get("residuos_comprobacion", []):
            cx, cy = 2 + (px - x1) * ex, 2 + (py - y1) * ey
            items.append(self.pantalla.create_oval(cx - 2, cy - 2, cx + 2, cy + 2, fill=ambar, outline=""))
            items.append(self.pantalla.create_line(cx, cy, cx + dx * ex, cy + dy * ey, fill=ambar, width=2))
        for item in items:
            self.pantalla.tag_lower(item, self.p_mirada)
        self._mapa_items = items

    def _refrescar_directo(self):
        cfg = ConfigManager().config
        modelo = cfg.get("ojos_calibracion")
        self.pantalla.itemconfigure(self.p_borde, outline=estilo.color_actual(estilo.BORDE))
        self.pantalla.itemconfigure(self.p_texto, fill=estilo.color_actual(estilo.TEXTO_SUAVE))
        if not isinstance(modelo, dict) or "monitor" not in modelo:
            self.pantalla.itemconfigure(self.p_texto, text="Calibra para ver tu mirada")
            self.pantalla.itemconfigure(self.p_mirada, state="hidden")
            self.pantalla.itemconfigure(self.p_puntero, state="hidden")
            return
        x1, y1, x2, y2 = modelo["monitor"]
        ex = (CUADRO[0] - 4) / max(1, x2 - x1)
        ey = (PANTALLA_ALTO - 4) / max(1, y2 - y1)
        self._dibujar_mapa_errores(modelo, x1, y1, ex, ey)

        punto = MouseController().punto_directo
        if punto is None and MouseController().is_active is not None and not MouseController(
        ).is_active.get():
            # En pausa el controlador no calcula: se estima aquí para la vista
            r = FaceMesh().get_rasgos()
            if r is not None and calibracion.es_valido(modelo, len(r)):
                punto = calibracion.predecir(modelo, r, cabeza=FaceMesh().get_cabeza())
        if punto is None:
            self.pantalla.itemconfigure(self.p_texto, text="No veo tus ojos")
            self.pantalla.itemconfigure(self.p_mirada, state="hidden")
        else:
            px = 2 + (punto[0] - x1) * ex
            py = 2 + (punto[1] - y1) * ey
            self.pantalla.coords(self.p_mirada, px - 5, py - 5, px + 5, py + 5)
            self.pantalla.itemconfigure(self.p_mirada, state="normal")
            self.pantalla.itemconfigure(self.p_texto, text="")
        fij = MouseController().fijacion
        if fij is None:
            self.pantalla.itemconfigure(self.p_puntero, state="hidden")
        else:
            fx = 2 + (fij[0] - x1) * ex
            fy = 2 + (fij[1] - y1) * ey
            self.pantalla.coords(self.p_puntero, fx - 8, fy - 8, fx + 8, fy + 8)
            self.pantalla.itemconfigure(self.p_puntero, state="normal",
                                        outline=estilo.color_actual(estilo.PRIMARIO))

    # ------------------------------------------------------------ palanca --
    def _crear_panel_palanca(self):
        panel = customtkinter.CTkFrame(self, fg_color="transparent")
        panel.grid_columnconfigure(1, weight=1)

        izq = customtkinter.CTkFrame(panel, fg_color="transparent")
        izq.grid(row=0, column=0, padx=(16, 8), pady=8, sticky="nw")

        customtkinter.CTkLabel(izq,
                               text="Primero, fija el centro",
                               font=estilo.fuente("etiqueta")).grid(
                                   row=0, column=0, sticky="w")
        customtkinter.CTkLabel(
            izq,
            text=("Ponte cómodo, mira al centro de la pantalla\n"
                  "y pulsa el botón. Cuando mires ahí,\nel puntero se quedará quieto."),
            text_color=estilo.TEXTO_SUAVE,
            justify=tkinter.LEFT,
            font=estilo.fuente("pequena")).grid(row=1, column=0, pady=(0, 6), sticky="w")
        self.boton = customtkinter.CTkButton(izq,
                                             text="Fijar el centro",
                                             width=CUADRO[0],
                                             height=44,
                                             font=estilo.fuente("boton"),
                                             command=self.fijar_centro)
        self.boton.grid(row=2, column=0, pady=(0, 4), sticky="w")
        self.aviso = customtkinter.CTkLabel(izq,
                                            text="",
                                            font=estilo.fuente("cuerpo"))
        self.aviso.grid(row=3, column=0, pady=(0, 6), sticky="w")

        customtkinter.CTkLabel(izq,
                               text="Tu mirada ahora",
                               font=estilo.fuente("etiqueta")).grid(
                                   row=4, column=0, pady=(6, 2), sticky="w")
        self.cuadro = tkinter.Canvas(izq,
                                     width=CUADRO[0],
                                     height=CUADRO[1],
                                     bd=0,
                                     highlightthickness=0)
        estilo.registrar_lienzo(self.cuadro, estilo.PANEL)
        self.cuadro.grid(row=5, column=0, sticky="w")
        cx, cy = CUADRO[0] // 2, CUADRO[1] // 2
        self.cruz = [
            self.cuadro.create_line(cx, 0, cx, CUADRO[1], fill=estilo.BORDE[0]),
            self.cuadro.create_line(0, cy, CUADRO[0], cy, fill=estilo.BORDE[0]),
        ]
        self.zona = self.cuadro.create_oval(cx - 10, cy - 10, cx + 10, cy + 10,
                                            outline=estilo.PRIMARIO[0], width=2)
        self.punto = self.cuadro.create_oval(cx - 7, cy - 7, cx + 7, cy + 7,
                                             fill=estilo.AMBAR[0], outline="")
        self.texto_cuadro = self.cuadro.create_text(cx, CUADRO[1] - 12,
                                                    text="",
                                                    fill=estilo.TEXTO_SUAVE[0],
                                                    font=(estilo.FAMILIA_TEXTO, 10))

        self.deslizadores = FrameSelectGesture(panel,
                                               ajustes=AJUSTES_OJOS,
                                               fg_color="transparent",
                                               logger_name="ojos_sliders")
        self.deslizadores.grid(row=0, column=1, padx=(0, 8), pady=4, sticky="nw")
        return panel

    def fijar_centro(self):
        if self.muestras is not None:
            return
        self.cuenta = 3
        self.boton.configure(state="disabled")
        self._cuenta_atras()

    def _cuenta_atras(self):
        if self.cuenta > 0:
            self.aviso.configure(text=f"Mira al centro de la pantalla… {self.cuenta}",
                                 text_color=estilo.PRIMARIO)
            self.cuenta -= 1
            self.after(1000, self._cuenta_atras)
        else:
            self.aviso.configure(text="Quieto, midiendo…", text_color=estilo.PRIMARIO)
            self.muestras = []
            self.after(50, self._medir)

    def _medir(self):
        m = FaceMesh().get_mirada()
        if m is not None:
            self.muestras.append(m)
        if len(self.muestras) < 20 and self.cuenta > -40:
            self.cuenta -= 1
            self.after(50, self._medir)
            return
        if len(self.muestras) >= 5:
            gx = float(np.mean([s[0] for s in self.muestras]))
            gy = float(np.mean([s[1] for s in self.muestras]))
            ConfigManager().set_temp_config("ojos_centro", [gx, gy])
            ConfigManager().apply_config()
            MouseController().reiniciar_mirada()
            logger.info(f"Centro de la mirada fijado en ({gx:.3f}, {gy:.3f})")
            self.aviso.configure(text="Listo. El centro quedó guardado.",
                                 text_color=estilo.OK)
        else:
            self.aviso.configure(text="No vi tus ojos. Acércate a la cámara e inténtalo otra vez.",
                                 text_color=estilo.ERROR)
        self.muestras = None
        self.boton.configure(state="normal")

    def _refrescar_palanca(self):
        cfg = ConfigManager().config
        cx, cy = CUADRO[0] // 2, CUADRO[1] // 2
        r = cfg.get("ojos_zona_muerta", 4) / 100 * ESCALA_MIRADA
        self.cuadro.coords(self.zona, cx - r, cy - r, cx + r, cy + r)
        self.cuadro.itemconfigure(self.zona, outline=estilo.color_actual(estilo.PRIMARIO))
        for linea in self.cruz:
            self.cuadro.itemconfigure(linea, fill=estilo.color_actual(estilo.BORDE))
        self.cuadro.itemconfigure(self.texto_cuadro, fill=estilo.color_actual(estilo.TEXTO_SUAVE))

        m = MouseController().mirada_suave if cfg.get("modo_puntero") == "ojos" else None
        if m is None:
            m = FaceMesh().get_mirada()
        if m is None:
            self.cuadro.itemconfigure(self.punto, state="hidden")
            self.cuadro.itemconfigure(self.texto_cuadro, text="No veo tus ojos")
            return
        c0 = cfg.get("ojos_centro", [0.0, 0.0])
        dx = (m[0] - c0[0]) * ESCALA_MIRADA
        dy = (m[1] - c0[1]) * ESCALA_MIRADA
        px = max(8, min(CUADRO[0] - 8, cx + dx))
        py = max(8, min(CUADRO[1] - 8, cy + dy))
        self.cuadro.coords(self.punto, px - 7, py - 7, px + 7, py + 7)
        self.cuadro.itemconfigure(self.punto, state="normal")
        self.cuadro.itemconfigure(
            self.texto_cuadro,
            text=f"x {m[0] - c0[0]:+.3f}   y {m[1] - c0[1]:+.3f}")

    # ------------------------------------------------------------- común --
    def cargar(self):
        submodo = ConfigManager().config.get("ojos_modo", "directo")
        self.selector_modo.set("Palanca" if submodo == "palanca" else "Directo")
        self._mostrar_submodo(submodo)
        self.deslizadores.inner_refresh_profile()
        self.deslizadores_directo.inner_refresh_profile()
        self.lupa_var.set(bool(ConfigManager().config.get("lupa_activa", True)))
        self.recentrar_var.set(bool(ConfigManager().config.get("ojos_recentrar_largo", True)))
        self._cargar_opciones()
        self.aviso.configure(text="")
        self.aviso_mejora.configure(text="")
        self._texto_calibracion()

    def _mostrar_submodo(self, submodo):
        self.submodo = submodo
        if submodo == "palanca":
            self.panel_directo.grid_remove()
            self.panel_palanca.grid()
            self.explicacion.configure(
                text="Palanca: mirar hacia un lado empuja el puntero hacia ese lado.")
        else:
            self.panel_palanca.grid_remove()
            self.panel_directo.grid()
            self.explicacion.configure(
                text="Directo: el puntero va al punto de la pantalla que miras.")

    def cambiar_submodo(self, nombre):
        submodo = "palanca" if nombre == "Palanca" else "directo"
        ConfigManager().set_temp_config("ojos_modo", submodo)
        ConfigManager().apply_config()
        MouseController().reiniciar_mirada()
        self._mostrar_submodo(submodo)

    def refrescar(self):
        if self.submodo == "palanca":
            self._refrescar_palanca()
        else:
            self._refrescar_directo()


class PageCursor(SafeDisposableFrame):

    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)

        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)
        self.is_active = False
        self.grid_propagate(False)
        self.task = {}

        self.lienzo = SafeDisposableScrollableFrame(self,
                                                    fg_color="transparent",
                                                    logger_name="puntero_scroll")
        self.lienzo.grid(row=0, column=0, sticky="nsew")
        self.lienzo.grid_columnconfigure(0, weight=1)
        c = self.lienzo

        # Top label.
        self.top_label = customtkinter.CTkLabel(master=c, text="Cómo muevo el puntero")
        self.top_label.configure(font=estilo.fuente("titulo"))
        self.top_label.grid(row=0, column=0, padx=20, pady=(5, 0), sticky="nw")

        des_txt = ("Con la cabeza es lo más preciso. Con los ojos sirve si no puedes "
                   "mover la cabeza: tras una calibración corta, el puntero va al "
                   "punto que miras.")
        des_label = customtkinter.CTkLabel(master=c,
                                           text=des_txt,
                                           wraplength=700,
                                           justify=tkinter.LEFT)
        des_label.configure(font=estilo.fuente("cuerpo"))
        des_label.grid(row=1, column=0, padx=20, pady=(4, 10), sticky="nw")

        self.selector = SelectorTarjetas(c, OPCIONES_PUNTERO, self.cambiar_modo, ancho=270)
        self.selector.grid(row=2, column=0, padx=20, pady=(0, 10), sticky="w")

        self.tarjeta = customtkinter.CTkFrame(c, fg_color=estilo.TARJETA, corner_radius=16)
        self.tarjeta.grid(row=3, column=0, padx=20, pady=(0, 10), sticky="ew")
        self.tarjeta.grid_columnconfigure(0, weight=1)

        self.subtitulo = customtkinter.CTkLabel(self.tarjeta, text="",
                                                font=estilo.fuente("subtitulo"))
        self.subtitulo.grid(row=0, column=0, padx=20, pady=(12, 0), sticky="w")

        self.frame_cabeza = FrameSelectGesture(self.tarjeta,
                                               fg_color="transparent",
                                               logger_name="cabeza_sliders")
        self.frame_cabeza.grid(row=1, column=0, padx=5, pady=5, sticky="nw")
        self.frame_ojos = FrameOjos(self.tarjeta)
        self.frame_ojos.grid(row=1, column=0, padx=5, pady=5, sticky="nw")
        self.frame_ojos.al_calibrar = self.abrir_calibracion
        self.ventana_calibracion = None
        self.modo = None
        self.cargar_modo()

    def abrir_calibracion(self, solo_comprobar=False):
        if self.ventana_calibracion is not None:
            return
        self.ventana_calibracion = VentanaCalibracion(self.winfo_toplevel(),
                                                      self.calibracion_terminada,
                                                      solo_comprobar=solo_comprobar)

    def calibracion_terminada(self, modelo):
        self.ventana_calibracion = None
        self.frame_ojos.calibracion_terminada(modelo)

    def cargar_modo(self):
        modo = ConfigManager().config.get("modo_puntero", "cabeza")
        if modo not in ("cabeza", "ojos"):
            modo = "cabeza"
        self.selector.marcar(modo)
        self.mostrar(modo)

    def mostrar(self, modo):
        self.modo = modo
        if modo == "ojos":
            self.frame_cabeza.grid_remove()
            self.frame_ojos.grid()
            self.frame_ojos.cargar()
            self.subtitulo.configure(text="Ajustes de los ojos")
        else:
            self.frame_ojos.grid_remove()
            self.frame_cabeza.grid()
            self.frame_cabeza.inner_refresh_profile()
            self.subtitulo.configure(text="Velocidad del puntero en cada dirección")

    def cambiar_modo(self, modo):
        ConfigManager().set_temp_config("modo_puntero", modo)
        ConfigManager().apply_config()
        MouseController().reiniciar_mirada()
        self.mostrar(modo)

    def frame_loop(self):
        if self.is_destroyed:
            return
        if self.is_active:
            if self.modo == "ojos":
                self.frame_ojos.refrescar()
            self.after(50, self.frame_loop)

    def enter(self):
        super().enter()
        self.after(1, self.frame_loop)

    def refresh_profile(self):
        self.frame_cabeza.inner_refresh_profile()
        self.cargar_modo()
