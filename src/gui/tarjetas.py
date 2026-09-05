"""Fila de tarjetas grandes para elegir una opción entre pocas.

Cada tarjeta tiene icono, título y una línea de explicación. La elegida se
resalta con el color principal. Pensada para manejarse con la cara: botones
grandes y separados.
"""

from functools import partial

import customtkinter

from src import estilo

ICONO_SIZE = (34, 34)


class SelectorTarjetas(customtkinter.CTkFrame):

    def __init__(self, master, opciones, callback, ancho=180, alto=92, **kwargs):
        """opciones: lista de (clave, icono, título, explicación)."""
        super().__init__(master, fg_color="transparent", **kwargs)
        self.callback = callback
        self.botones = {}
        self.seleccionada = None
        for i, (clave, icono, titulo, detalle) in enumerate(opciones):
            im = estilo.imagen_doble(f"iconos/{icono}", ICONO_SIZE)
            btn = customtkinter.CTkButton(
                master=self,
                text=f"{titulo}\n{detalle}",
                image=im,
                compound="top",
                width=ancho,
                height=alto,
                corner_radius=16,
                border_width=2,
                border_color=estilo.BORDE,
                fg_color=estilo.TARJETA,
                hover_color=estilo.PRIMARIO_SUAVE,
                text_color=estilo.TEXTO,
                font=estilo.fuente("pequena"),
                command=partial(self.elegir, clave))
            btn.grid(row=0, column=i, padx=(0 if i == 0 else 8, 0), pady=2)
            self.botones[clave] = btn

    def marcar(self, clave: str) -> None:
        """Resalta la tarjeta sin llamar al callback."""
        self.seleccionada = clave
        for k, btn in self.botones.items():
            if k == clave:
                btn.configure(fg_color=estilo.PRIMARIO_SUAVE,
                              border_color=estilo.PRIMARIO,
                              text_color=estilo.PRIMARIO,
                              font=estilo.fuente("etiqueta_pequena"))
            else:
                btn.configure(fg_color=estilo.TARJETA,
                              border_color=estilo.BORDE,
                              text_color=estilo.TEXTO,
                              font=estilo.fuente("pequena"))

    def elegir(self, clave: str) -> None:
        if clave == self.seleccionada:
            return
        self.marcar(clave)
        self.callback(clave)
