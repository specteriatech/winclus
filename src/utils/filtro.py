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
