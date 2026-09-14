"""Página «Escribir»: el teclado en pantalla y sus ajustes.

Desde aquí se muestra u oculta el teclado y se elige dónde va, cuánto ocupa
y si sugiere palabras. Los cambios se aplican al momento sobre el teclado
(gui/teclado_pantalla.py), que llega por el atributo `teclado` puesto desde
main_gui.py.
"""

import logging
import tkinter
from functools import partial

import customtkinter

from src import estilo
from src.config_manager import ConfigManager
from src import frases as frases_mod
from src.gui.controles import botones_paso
from src.gui.frames.safe_disposable_frame import SafeDisposableFrame, SafeDisposableScrollableFrame
from src.voz import Voz

logger = logging.getLogger("PageEscribir")

DESLIZADORES = [
    # clave, texto, mínimo, máximo, unidad
    ("teclado_altura", "Altura del teclado", 20, 55, "% de la pantalla"),
    ("teclado_ancho", "Ancho del teclado", 50, 100, "% de la pantalla"),
]

CASILLAS = [
    ("teclado_prediccion", "Sugerir palabras mientras escribo",
     "Arriba del teclado aparecen hasta cinco palabras que empiezan como la que llevas. "
     "Pulsar una la completa y añade un espacio."),
    ("teclado_sonido", "Sonido corto al pulsar una tecla",
     "Ayuda a saber que la tecla entró sin tener que mirar el texto."),
    ("teclado_mostrar_al_activar", "Mostrar el teclado al activar Winclus",
     "Cuando pulses Activar, el teclado aparece solo."),
]


class PageEscribir(SafeDisposableFrame):

    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        self.teclado = None     # lo pone main_gui
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)
        self.grid_propagate(False)
        self.arrastrando = False
        # Todo va dentro de un marco con desplazamiento (la página es larga)
        self.lienzo = SafeDisposableScrollableFrame(self, fg_color="transparent",
                                                    logger_name="escribir_scroll")
        self.lienzo.grid(row=0, column=0, sticky="nsew")
        self.lienzo.grid_columnconfigure(0, weight=1)
        c = self.lienzo

        customtkinter.CTkLabel(c, text="Escribir",
                               font=estilo.fuente("titulo")).grid(
                                   row=0, column=0, padx=20, pady=(5, 0), sticky="nw")
        customtkinter.CTkLabel(
            c,
            text=("Un teclado grande en la pantalla. Cada tecla se pulsa con el "
                  "clic que tengas elegido: parpadeo, boca, cejas o quedarte "
                  "quieto encima. Lo que escribes va a la ventana que estaba activa."),
            wraplength=700, justify=tkinter.LEFT,
            font=estilo.fuente("cuerpo")).grid(row=1, column=0, padx=20,
                                               pady=(4, 12), sticky="nw")

        # Botón grande de mostrar / ocultar
        self.boton = customtkinter.CTkButton(c,
                                             text="Mostrar el teclado",
                                             height=64,
                                             width=320,
                                             corner_radius=18,
                                             fg_color=estilo.AMBAR,
                                             hover_color=estilo.AMBAR_HOVER,
                                             text_color=estilo.TEXTO_SOBRE_AMBAR,
                                             font=estilo.fuente("boton_grande"),
                                             command=self.alternar)
        self.boton.grid(row=2, column=0, padx=20, pady=(0, 16), sticky="w")

        tarjeta = customtkinter.CTkFrame(c, fg_color=estilo.TARJETA, corner_radius=16)
        tarjeta.grid(row=3, column=0, padx=20, pady=(0, 10), sticky="ew")
        tarjeta.grid_columnconfigure(1, weight=1)

        customtkinter.CTkLabel(tarjeta, text="Dónde y cuánto",
                               font=estilo.fuente("subtitulo")).grid(
                                   row=0, column=0, columnspan=2, padx=20,
                                   pady=(12, 4), sticky="w")

        # Posición
        customtkinter.CTkLabel(tarjeta, text="Posición",
                               font=estilo.fuente("etiqueta")).grid(
                                   row=1, column=0, padx=20, pady=8, sticky="w")
        self.posicion = customtkinter.CTkSegmentedButton(
            tarjeta, values=["Abajo", "Arriba"], width=240, height=38,
            font=estilo.fuente("boton_normal"), command=self.cambiar_posicion)
        self.posicion.grid(row=1, column=1, padx=20, pady=8, sticky="w")

        # Deslizadores
        self.deslizadores = {}
        for i, (clave, texto, lo, hi, unidad) in enumerate(DESLIZADORES):
            fila = 2 + i
            customtkinter.CTkLabel(tarjeta, text=texto,
                                   font=estilo.fuente("etiqueta")).grid(
                                       row=fila, column=0, padx=20, pady=8, sticky="w")
            caja = customtkinter.CTkFrame(tarjeta, fg_color="transparent")
            caja.grid(row=fila, column=1, padx=20, pady=8, sticky="w")
            deslizador = customtkinter.CTkSlider(caja, from_=lo, to=hi, width=240,
                                                 number_of_steps=hi - lo,
                                                 command=partial(self.arrastrar, clave))
            deslizador.grid(row=0, column=0)
            deslizador.bind("<ButtonRelease-1>", partial(self.soltar, clave))
            valor = customtkinter.CTkLabel(caja, text="", width=140, anchor="w",
                                           text_color=estilo.TEXTO_SUAVE,
                                           font=estilo.fuente("pequena"))
            valor.grid(row=0, column=1, padx=(12, 0))
            botones_paso(caja, deslizador,
                         lambda v, c=clave: (self.arrastrar(c, v), self.soltar(c, None))).grid(
                             row=0, column=2, padx=(8, 0))
            self.deslizadores[clave] = (deslizador, valor, unidad)

        # Casillas
        self.casillas = {}
        fila = 2 + len(DESLIZADORES)
        for clave, texto, ayuda in CASILLAS:
            var = tkinter.BooleanVar()
            customtkinter.CTkCheckBox(tarjeta, text=texto, variable=var,
                                      font=estilo.fuente("cuerpo"),
                                      command=partial(self.cambiar_casilla, clave)).grid(
                                          row=fila, column=0, columnspan=2, padx=20,
                                          pady=(10, 0), sticky="w")
            customtkinter.CTkLabel(tarjeta, text=ayuda, wraplength=640,
                                   justify=tkinter.LEFT,
                                   text_color=estilo.TEXTO_SUAVE,
                                   font=estilo.fuente("pequena")).grid(
                                       row=fila + 1, column=0, columnspan=2,
                                       padx=(52, 20), pady=(0, 4), sticky="w")
            self.casillas[clave] = var
            fila += 2
        customtkinter.CTkLabel(tarjeta, text="").grid(row=fila, column=0, pady=2)

        # ---------------------------------------------------------- voz --
        customtkinter.CTkLabel(c, text="Voz", font=estilo.fuente("subtitulo")).grid(
            row=4, column=0, padx=20, pady=(10, 0), sticky="w")
        voz = customtkinter.CTkFrame(c, fg_color=estilo.TARJETA, corner_radius=16)
        voz.grid(row=5, column=0, padx=20, pady=(6, 10), sticky="ew")
        voz.grid_columnconfigure(1, weight=1)
        customtkinter.CTkLabel(
            voz,
            text=("La tecla «Decir» del teclado lee en voz alta lo que llevas escrito, y la capa "
                  "«Frases» dice una frase guardada con un solo clic. Para quien no puede hablar."),
            wraplength=680, justify=tkinter.LEFT, text_color=estilo.TEXTO_SUAVE,
            font=estilo.fuente("pequena")).grid(row=0, column=0, columnspan=2, padx=20, pady=(10, 4), sticky="w")
        self.voz_vars = {}
        for i, (clave, texto) in enumerate((("voz_activa", "Leer en voz alta"),
                                            ("voz_eco", "Leer cada palabra al terminarla (para quien ve poco)"))):
            var = tkinter.BooleanVar()
            customtkinter.CTkCheckBox(voz, text=texto, variable=var, font=estilo.fuente("cuerpo"),
                                      command=partial(self._guardar_voz, clave)).grid(
                                          row=1 + i, column=0, columnspan=2, padx=20, pady=(6, 0), sticky="w")
            self.voz_vars[clave] = var
        customtkinter.CTkLabel(voz, text="Voz", font=estilo.fuente("etiqueta")).grid(
            row=3, column=0, padx=20, pady=(10, 4), sticky="w")
        self.voz_menu = customtkinter.CTkOptionMenu(voz, values=["(buscando voces…)"], width=360, height=36,
                                                    font=estilo.fuente("cuerpo"),
                                                    command=self._elegir_voz)
        self.voz_menu.grid(row=3, column=1, padx=(0, 20), pady=(10, 4), sticky="w")
        customtkinter.CTkLabel(voz, text="Velocidad", font=estilo.fuente("etiqueta")).grid(
            row=4, column=0, padx=20, pady=4, sticky="w")
        caja_v = customtkinter.CTkFrame(voz, fg_color="transparent")
        caja_v.grid(row=4, column=1, padx=(0, 20), pady=4, sticky="w")
        self.voz_vel = customtkinter.CTkSlider(caja_v, from_=-5, to=5, number_of_steps=10, width=240,
                                               command=lambda v: self.voz_vel_txt.configure(text=self._texto_vel(v)))
        self.voz_vel.grid(row=0, column=0)
        self.voz_vel.bind("<ButtonRelease-1>", lambda e: self._guardar_vel())
        self.voz_vel_txt = customtkinter.CTkLabel(caja_v, text="", width=90, anchor="w",
                                                  text_color=estilo.TEXTO_SUAVE, font=estilo.fuente("pequena"))
        self.voz_vel_txt.grid(row=0, column=1, padx=(12, 0))
        botones_paso(caja_v, self.voz_vel, lambda v: self._guardar_vel()).grid(row=0, column=2, padx=(8, 0))
        customtkinter.CTkButton(voz, text="Probar la voz", width=160, height=36,
                                font=estilo.fuente("boton_normal"),
                                command=lambda: Voz().decir("Hola, soy Winclus. Así sueno.", forzar=True)).grid(
                                    row=5, column=0, columnspan=2, padx=20, pady=(6, 12), sticky="w")

        # ------------------------------------------------------- frases --
        customtkinter.CTkLabel(c, text="Frases para decir", font=estilo.fuente("subtitulo")).grid(
            row=6, column=0, padx=20, pady=(6, 0), sticky="w")
        fr = customtkinter.CTkFrame(c, fg_color=estilo.TARJETA, corner_radius=16)
        fr.grid(row=7, column=0, padx=20, pady=(6, 16), sticky="ew")
        fr.grid_columnconfigure(0, weight=1)
        customtkinter.CTkLabel(
            fr,
            text=(f"Una frase por línea, hasta {frases_mod.MAX_FRASES}. Aparecen como teclas grandes en la "
                  "capa «Frases» del teclado y se guardan con el perfil."),
            wraplength=680, justify=tkinter.LEFT, text_color=estilo.TEXTO_SUAVE,
            font=estilo.fuente("pequena")).grid(row=0, column=0, padx=20, pady=(10, 4), sticky="w")
        self.frases_caja = customtkinter.CTkTextbox(fr, height=150, font=estilo.fuente("cuerpo"))
        self.frases_caja.grid(row=1, column=0, padx=20, pady=4, sticky="ew")
        fila_fr = customtkinter.CTkFrame(fr, fg_color="transparent")
        fila_fr.grid(row=2, column=0, padx=20, pady=(4, 12), sticky="w")
        customtkinter.CTkButton(fila_fr, text="Guardar frases", width=160, height=36,
                                font=estilo.fuente("boton_normal"),
                                command=self._guardar_frases).grid(row=0, column=0, padx=(0, 10))
        customtkinter.CTkButton(fila_fr, text="Volver a las de ejemplo", width=200, height=36,
                                fg_color="transparent", border_width=1, border_color=estilo.BORDE,
                                text_color=estilo.TEXTO, font=estilo.fuente("boton_normal"),
                                command=self._frases_ejemplo).grid(row=0, column=1)
        self.frases_aviso = customtkinter.CTkLabel(fila_fr, text="", text_color=estilo.TEXTO_SUAVE,
                                                   font=estilo.fuente("pequena"))
        self.frases_aviso.grid(row=0, column=2, padx=(12, 0))

        self.cargar()
        self.after(300, self._cargar_voces)

    # ------------------------------------------------------------ carga --
    def cargar(self):
        cfg = ConfigManager().config
        self.posicion.set("Arriba" if cfg.get("teclado_posicion", "abajo") == "arriba" else "Abajo")
        for clave, (deslizador, etiqueta, unidad) in self.deslizadores.items():
            v = int(cfg.get(clave, 32))
            deslizador.set(v)
            etiqueta.configure(text=f"{v} {unidad}")
        for clave, var in self.casillas.items():
            var.set(bool(cfg.get(clave, True)))
        for clave, var in self.voz_vars.items():
            var.set(bool(cfg.get(clave, clave == "voz_activa")))
        v = int(cfg.get("voz_velocidad", 0))
        self.voz_vel.set(v)
        self.voz_vel_txt.configure(text=self._texto_vel(v))
        self._cargar_frases()
        self.refrescar_boton()

    def refresh_profile(self):
        self.cargar()

    # -------------------------------------------------------------- voz --
    @staticmethod
    def _texto_vel(v):
        v = int(round(float(v)))
        return "normal" if v == 0 else (f"lenta {v}" if v < 0 else f"rápida +{v}")

    def _cargar_voces(self):
        voces = Voz().voces(espera_s=0.05)
        if not voces:
            if Voz().disponible is False:
                self.voz_menu.configure(values=["(no hay voces instaladas)"])
                self.voz_menu.set("(no hay voces instaladas)")
            else:
                self.after(300, self._cargar_voces)
            return
        self.voz_menu.configure(values=voces)
        actual = ConfigManager().config.get("voz_nombre") or Voz().voz_por_defecto()
        self.voz_menu.set(actual if actual in voces else voces[0])

    def _elegir_voz(self, nombre):
        ConfigManager().set_temp_config("voz_nombre", nombre)
        ConfigManager().apply_config()
        Voz().decir("Así sueno.", forzar=True)

    def _guardar_voz(self, clave):
        ConfigManager().set_temp_config(clave, bool(self.voz_vars[clave].get()))
        ConfigManager().apply_config()

    def _guardar_vel(self):
        v = int(round(self.voz_vel.get()))
        self.voz_vel_txt.configure(text=self._texto_vel(v))
        ConfigManager().set_temp_config("voz_velocidad", v)
        ConfigManager().apply_config()

    # ----------------------------------------------------------- frases --
    def _cargar_frases(self):
        self.frases_caja.delete("1.0", "end")
        self.frases_caja.insert("1.0", "\n".join(frases_mod.cargar()))
        self.frases_aviso.configure(text="")

    def _guardar_frases(self):
        lineas = self.frases_caja.get("1.0", "end").splitlines()
        guardadas = frases_mod.guardar(lineas)
        self.frases_caja.delete("1.0", "end")
        self.frases_caja.insert("1.0", "\n".join(guardadas))
        self.frases_aviso.configure(text=f"{len(guardadas)} frases guardadas.")
        if self.teclado is not None:
            self.teclado.reconstruir()

    def _frases_ejemplo(self):
        self.frases_caja.delete("1.0", "end")
        self.frases_caja.insert("1.0", "\n".join(frases_mod.POR_DEFECTO))
        self.frases_aviso.configure(text="Pulsa «Guardar frases» para aplicarlas.")

    def refrescar_boton(self, visible=None):
        if visible is None:
            visible = self.teclado is not None and self.teclado.visible
        if visible:
            self.boton.configure(text="Ocultar el teclado",
                                 fg_color=estilo.PRIMARIO,
                                 hover_color=estilo.PRIMARIO_HOVER,
                                 text_color=estilo.TEXTO_SOBRE_PRIMARIO)
        else:
            self.boton.configure(text="Mostrar el teclado",
                                 fg_color=estilo.AMBAR,
                                 hover_color=estilo.AMBAR_HOVER,
                                 text_color=estilo.TEXTO_SOBRE_AMBAR)

    # ---------------------------------------------------------- cambios --
    def _guardar(self, clave, valor):
        ConfigManager().set_temp_config(clave, valor)
        ConfigManager().apply_config()
        if self.teclado is not None:
            self.teclado.reconstruir()

    def alternar(self):
        if self.teclado is not None:
            self.teclado.alternar()
        self.refrescar_boton()

    def cambiar_posicion(self, nombre):
        self._guardar("teclado_posicion", "arriba" if nombre == "Arriba" else "abajo")

    def arrastrar(self, clave, valor):
        deslizador, etiqueta, unidad = self.deslizadores[clave]
        etiqueta.configure(text=f"{int(valor)} {unidad}")

    def soltar(self, clave, evento):
        deslizador, etiqueta, unidad = self.deslizadores[clave]
        self._guardar(clave, int(deslizador.get()))

    def cambiar_casilla(self, clave):
        self._guardar(clave, bool(self.casillas[clave].get()))

    def enter(self):
        super().enter()
        self.refrescar_boton()
