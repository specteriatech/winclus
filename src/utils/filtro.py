"""Filtro One Euro (Casiez, Roustan y Vogel, 2012).

Suaviza mucho cuando la señal está quieta (quita el temblor) y poco cuando
se mueve rápido (no añade retraso). Es el filtro habitual para punteros
guiados por la mirada o por la mano.

- min_cutoff: frecuencia de corte en reposo (Hz). Más baja = más suave.
- beta: cuánto se abre el corte al moverse. Más alta = responde antes.
"""

import math
import time


class FiltroOneEuro:

    def __init__(self, min_cutoff=1.0, beta=0.01, d_cutoff=1.0):
        self.min_cutoff = float(min_cutoff)
        self.beta = float(beta)
        self.d_cutoff = float(d_cutoff)
        self.reiniciar()

    def reiniciar(self):
        self.x_prev = None
        self.dx_prev = 0.0
        self.t_prev = None

    @staticmethod
    def _alpha(cutoff, dt):
        tau = 1.0 / (2 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def __call__(self, x, t=None):
        if t is None:
            t = time.time()
        if self.x_prev is None:
            self.x_prev = x
            self.t_prev = t
            return x
        dt = max(1e-3, t - self.t_prev)
        self.t_prev = t

        dx = (x - self.x_prev) / dt
        a_d = self._alpha(self.d_cutoff, dt)
        dx_hat = a_d * dx + (1 - a_d) * self.dx_prev

        cutoff = self.min_cutoff + self.beta * abs(dx_hat)
        a = self._alpha(cutoff, dt)
        x_hat = a * x + (1 - a) * self.x_prev

        self.x_prev = x_hat
        self.dx_prev = dx_hat
        return x_hat


class Fijacion:
    """Mantiene el puntero quieto mientras la mirada se queda cerca, y lo
    desliza suavemente cuando se va de verdad.

    - Dentro de `radio` px del punto de fijación: no se mueve (el temblor y
      las microsacadas no llegan al puntero).
    - Fuera del radio pero cerca: solo empieza a moverse si la mirada lleva
      `persistencia_s` fuera (un fotograma suelto no lo mueve); entonces se
      desliza una fracción `paso` por tick hasta alcanzarla.
    - Muy lejos (`radio_salto`): salta al instante, para que un cambio de
      objetivo claro no se note lento.
    """

    LLEGADA_PX = 6   # una vez en marcha, se desliza hasta quedar así de cerca

    def __init__(self):
        self.punto = None
        self.fuera_desde = None
        self.moviendo = False

    def reiniciar(self):
        self.punto = None
        self.fuera_desde = None
        self.moviendo = False

    def actualizar(self, x, y, radio, persistencia_s, radio_salto, paso=0.25, t=None):
        if t is None:
            t = time.time()
        if self.punto is None:
            self.punto = (x, y)
            return self.punto
        fx, fy = self.punto
        d = math.hypot(x - fx, y - fy)
        if d >= radio_salto:
            self.punto = (x, y)
            self.fuera_desde = None
            self.moviendo = False
        elif self.moviendo:
            # En marcha: se desliza hasta llegar de verdad al punto mirado,
            # y ahí vuelve a quedarse quieto
            if d <= self.LLEGADA_PX:
                self.punto = (x, y)
                self.moviendo = False
            else:
                self.punto = (fx + paso * (x - fx), fy + paso * (y - fy))
        elif d > radio:
            if self.fuera_desde is None:
                self.fuera_desde = t
            elif t - self.fuera_desde >= persistencia_s:
                self.moviendo = True
                self.fuera_desde = None
                self.punto = (fx + paso * (x - fx), fy + paso * (y - fy))
        else:
            self.fuera_desde = None
        return self.punto


class FiltroOneEuro2D:
    """Dos filtros, uno por eje, con los mismos parámetros."""

    def __init__(self, min_cutoff=1.0, beta=0.01, d_cutoff=1.0):
        self.fx = FiltroOneEuro(min_cutoff, beta, d_cutoff)
        self.fy = FiltroOneEuro(min_cutoff, beta, d_cutoff)

    def configurar(self, min_cutoff=None, beta=None):
        for f in (self.fx, self.fy):
            if min_cutoff is not None:
                f.min_cutoff = float(min_cutoff)
            if beta is not None:
                f.beta = float(beta)

    def reiniciar(self):
        self.fx.reiniciar()
        self.fy.reiniciar()

    def __call__(self, x, y, t=None):
        if t is None:
            t = time.time()
        return self.fx(x, t), self.fy(y, t)
