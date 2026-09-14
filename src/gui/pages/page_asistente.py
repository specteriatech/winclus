"""Página «Asistente»: dile a Winclus lo que quieres y lo hace.

Una caja grande para escribir la petición (con el teclado en pantalla o el
físico), botones grandes, un registro de lo que va haciendo y la
configuración del cerebro (Claude con clave, Ollama local o reglas).
"""

import logging
import tkinter
from functools import partial

import customtkinter

from src import ajustes_globales, estilo
from src.asistente import Asistente
from src.asistente import cerebro as cerebro_mod
from src.gui.frames.safe_disposable_frame import SafeDisposableFrame, SafeDisposableScrollableFrame

logger = logging.getLogger("page_asistente")

EJEMPLOS = [
    "Abre YouTube y pon música relajante",
    "Busca en Google el tiempo de mañana",
    "Abre el bloc de notas y escribe la lista de la compra",
    "Lee la pantalla",
]


class PageAsistente(SafeDisposableFrame):

    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)
        self.grid_propagate(False)
        self.lienzo = SafeDisposableScrollableFrame(self, fg_color="transparent",
                                                    logger_name="asistente_scroll")
        self.lienzo.grid(row=0, column=0, sticky="nsew")
        self.lienzo.grid_columnconfigure(0, weight=1)
        c = self.lienzo

        customtkinter.CTkLabel(c, text="Asistente", font=estilo.fuente("titulo")).grid(
            row=0, column=0, padx=20, pady=(5, 0), sticky="nw")
        customtkinter.CTkLabel(
            c,
            text=("Escribe lo que quieres hacer, con tus palabras, y Winclus lo hace por ti: abre "
                  "programas, busca en internet, escribe, pulsa botones y te lee la pantalla. "
                  "Te va contando en voz alta lo que hace."),
            wraplength=700, justify=tkinter.LEFT, font=estilo.fuente("cuerpo")).grid(
                row=1, column=0, padx=20, pady=(4, 10), sticky="nw")

        # Petición
        tarjeta = customtkinter.CTkFrame(c, fg_color=estilo.TARJETA, corner_radius=16)
        tarjeta.grid(row=2, column=0, padx=20, pady=(0, 10), sticky="ew")
        tarjeta.grid_columnconfigure(0, weight=1)
        customtkinter.CTkLabel(tarjeta, text="¿Qué quieres hacer?", font=estilo.fuente("etiqueta")).grid(
            row=0, column=0, padx=20, pady=(12, 4), sticky="w")
        self.caja = customtkinter.CTkTextbox(tarjeta, height=84, font=estilo.fuente("subtitulo"), wrap="word")
        self.caja.grid(row=1, column=0, padx=20, pady=(0, 8), sticky="ew")
        fila = customtkinter.CTkFrame(tarjeta, fg_color="transparent")
        fila.grid(row=2, column=0, padx=20, pady=(0, 8), sticky="w")
        self.boton_hacer = customtkinter.CTkButton(
            fila, text="Hacerlo", width=190, height=56, corner_radius=16,
            fg_color=estilo.AMBAR, hover_color=estilo.AMBAR_HOVER, text_color=estilo.TEXTO_SOBRE_AMBAR,
            font=estilo.fuente("boton_grande"), command=self.hacer)
        self.boton_hacer.grid(row=0, column=0, padx=(0, 10))
        customtkinter.CTkButton(fila, text="Leer la pantalla", width=170, height=56, corner_radius=16,
                                font=estilo.fuente("boton"), command=self.leer).grid(row=0, column=1, padx=(0, 10))
        customtkinter.CTkButton(fila, text="Parar", width=110, height=56, corner_radius=16,
                                fg_color=estilo.TARJETA, border_width=2, border_color=estilo.ERROR,
                                text_color=estilo.ERROR, hover_color=estilo.ENTRADA_ERROR,
                                font=estilo.fuente("boton"), command=self.parar).grid(row=0, column=2, padx=(0, 10))
        customtkinter.CTkButton(fila, text="Borrar", width=100, height=56, corner_radius=16,
                                fg_color="transparent", border_width=1, border_color=estilo.BORDE,
                                text_color=estilo.TEXTO, font=estilo.fuente("boton_normal"),
                                command=lambda: self.caja.delete("1.0", "end")).grid(row=0, column=3)
        # Ejemplos de un clic
        ejemplos = customtkinter.CTkFrame(tarjeta, fg_color="transparent")
        ejemplos.grid(row=3, column=0, padx=20, pady=(0, 12), sticky="w")
        customtkinter.CTkLabel(ejemplos, text="Por ejemplo:", text_color=estilo.TEXTO_SUAVE,
                               font=estilo.fuente("pequena")).grid(row=0, column=0, columnspan=4, sticky="w")
        for i, texto in enumerate(EJEMPLOS):
            customtkinter.CTkButton(ejemplos, text=texto, height=34, corner_radius=10,
                                    fg_color=estilo.PRIMARIO_SUAVE, hover_color=estilo.BORDE,
                                    text_color=estilo.PRIMARIO, font=estilo.fuente("pequena"),
                                    command=partial(self._ejemplo, texto)).grid(
                                        row=1 + i // 2, column=i % 2, padx=(0, 8), pady=(4, 0), sticky="w")

        # Registro
        customtkinter.CTkLabel(c, text="Lo que va haciendo", font=estilo.fuente("subtitulo")).grid(
            row=3, column=0, padx=20, pady=(6, 0), sticky="w")
        self.registro = customtkinter.CTkTextbox(c, height=190, font=estilo.fuente("cuerpo"), wrap="word",
                                                 fg_color=estilo.TARJETA)
        self.registro.grid(row=4, column=0, padx=20, pady=(6, 10), sticky="ew")
        self.registro.configure(state="disabled")

        # Cerebro
        customtkinter.CTkLabel(c, text="Cerebro", font=estilo.fuente("subtitulo")).grid(
            row=5, column=0, padx=20, pady=(6, 0), sticky="w")
        cb = customtkinter.CTkFrame(c, fg_color=estilo.TARJETA, corner_radius=16)
        cb.grid(row=6, column=0, padx=20, pady=(6, 16), sticky="ew")
        cb.grid_columnconfigure(1, weight=1)
        customtkinter.CTkLabel(
            cb,
            text=("El asistente piensa con Claude si pones una clave de la API (lo mejor, entiende "
                  "cualquier petición y puede mirar la pantalla), o con un modelo local de Ollama si "
                  "está instalado (gratis y sin internet), o con reglas básicas si no hay ninguno."),
            wraplength=680, justify=tkinter.LEFT, text_color=estilo.TEXTO_SUAVE,
            font=estilo.fuente("pequena")).grid(row=0, column=0, columnspan=3, padx=20, pady=(10, 6), sticky="w")
        self.estado_cerebro = customtkinter.CTkLabel(cb, text="", font=estilo.fuente("cuerpo"),
                                                     text_color=estilo.PRIMARIO)
        self.estado_cerebro.grid(row=1, column=0, columnspan=3, padx=20, pady=(0, 8), sticky="w")
        customtkinter.CTkLabel(cb, text="Usar", font=estilo.fuente("etiqueta")).grid(
            row=2, column=0, padx=20, pady=4, sticky="w")
        self.selector = customtkinter.CTkSegmentedButton(
            cb, values=["Automático", "Claude", "Ollama", "Reglas"], height=36,
            font=estilo.fuente("boton_normal"), command=self._cambiar_cerebro)
        self.selector.grid(row=2, column=1, columnspan=2, padx=(0, 20), pady=4, sticky="w")
        customtkinter.CTkLabel(cb, text="Clave de Claude", font=estilo.fuente("etiqueta")).grid(
            row=3, column=0, padx=20, pady=4, sticky="w")
        self.clave = customtkinter.CTkEntry(cb, width=380, height=36, show="•",
                                            placeholder_text="sk-ant-…", font=estilo.fuente("cuerpo"))
        self.clave.grid(row=3, column=1, padx=(0, 10), pady=4, sticky="w")
        customtkinter.CTkButton(cb, text="Guardar clave", width=140, height=36,
                                font=estilo.fuente("boton_normal"),
                                command=self._guardar_clave).grid(row=3, column=2, padx=(0, 20), pady=4, sticky="w")
        customtkinter.CTkLabel(cb, text="Modelo de Ollama", font=estilo.fuente("etiqueta")).grid(
            row=4, column=0, padx=20, pady=(4, 12), sticky="w")
        self.modelo_ollama = customtkinter.CTkOptionMenu(cb, values=["(buscando…)"], width=260, height=36,
                                                         font=estilo.fuente("cuerpo"),
                                                         command=self._cambiar_modelo_ollama)
        self.modelo_ollama.grid(row=4, column=1, columnspan=2, padx=(0, 20), pady=(4, 12), sticky="w")

        Asistente().al_mensaje = self._mensaje_hilo
        self._cargar()

    # ------------------------------------------------------------- carga --
    def _cargar(self):
        pref = ajustes_globales.obtener("asistente_cerebro", "auto")
        self.selector.set({"auto": "Automático", "claude": "Claude", "ollama": "Ollama", "reglas": "Reglas"}.get(pref, "Automático"))
        if cerebro_mod.clave_claude():
            self.clave.delete(0, "end")
            self.clave.insert(0, cerebro_mod.clave_claude())
        self.after(100, self._refrescar_estado)
        self.after(150, self._cargar_modelos_ollama)

    def _refrescar_estado(self):
        try:
            self.estado_cerebro.configure(text=f"Ahora mismo usaría: {Asistente().nombre_cerebro()}")
        except Exception as e:
            self.estado_cerebro.configure(text=f"Cerebro no disponible: {e}")

    def _cargar_modelos_ollama(self):
        modelos = cerebro_mod.ollama_disponible() or []
        modelos = [m for m in modelos if "embed" not in m]
        if not modelos:
            self.modelo_ollama.configure(values=["(Ollama no responde)"])
            self.modelo_ollama.set("(Ollama no responde)")
            return
        self.modelo_ollama.configure(values=modelos)
        actual = ajustes_globales.obtener("modelo_ollama", cerebro_mod.MODELO_OLLAMA)
        self.modelo_ollama.set(actual if actual in modelos else modelos[0])

    # ----------------------------------------------------------- acciones --
    def _ejemplo(self, texto):
        self.caja.delete("1.0", "end")
        self.caja.insert("1.0", texto)

    def hacer(self):
        peticion = self.caja.get("1.0", "end").strip()
        if not peticion:
            self._mensaje("Escribe primero qué quieres hacer.", "error")
            return
        Asistente().pedir(peticion)

    def leer(self):
        if not Asistente().leer_pantalla():
            self._mensaje("Estoy ocupado; pulsa Parar antes.", "error")

    def parar(self):
        Asistente().parar()

    def _cambiar_cerebro(self, nombre):
        clave = {"Automático": "auto", "Claude": "claude", "Ollama": "ollama", "Reglas": "reglas"}[nombre]
        ajustes_globales.guardar("asistente_cerebro", clave)
        self._refrescar_estado()

    def _guardar_clave(self):
        ajustes_globales.guardar("clave_claude", self.clave.get().strip())
        self._mensaje("Clave guardada." if self.clave.get().strip() else "Clave borrada.", "info")
        self._refrescar_estado()

    def _cambiar_modelo_ollama(self, nombre):
        if nombre.startswith("("):
            return
        ajustes_globales.guardar("modelo_ollama", nombre)
        self._refrescar_estado()

    # ----------------------------------------------------------- registro --
    def _mensaje_hilo(self, texto, tipo):
        # Llega desde el hilo del asistente: pasar al hilo de tkinter
        try:
            self.after(0, lambda: self._mensaje(texto, tipo))
        except Exception:
            pass

    def _mensaje(self, texto, tipo="asistente"):
        prefijo = {"tu": "Tú: ", "asistente": "Winclus: ", "accion": "  → ", "error": "⚠ ", "info": "· "}.get(tipo, "")
        self.registro.configure(state="normal")
        self.registro.insert("end", prefijo + texto + "\n")
        self.registro.see("end")
        self.registro.configure(state="disabled")

    def enter(self):
        super().enter()
        self._refrescar_estado()

    def refresh_profile(self):
        pass

    def enfocar(self):
        try:
            self.caja.focus_set()
        except Exception:
            pass
