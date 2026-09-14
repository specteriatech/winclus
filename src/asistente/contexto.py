"""Qué hay en la pantalla: ventana activa, controles con nombre y texto.

Usa UI Automation (comtypes), como el imán (src/iman.py). COM es de un solo
hilo: cada hilo que use el lector debe tener su propia instancia (el
asistente lo usa desde su propio hilo).
"""

import logging
import time
import unicodedata

import win32gui
import win32process

logger = logging.getLogger("Contexto")

# Tipos de control de UI Automation que interesan al cerebro
TIPOS = {
    50000: "botón", 50002: "casilla", 50003: "lista", 50004: "campo", 50005: "enlace",
    50007: "elemento", 50008: "lista", 50011: "menú", 50013: "opción", 50019: "pestaña",
    50020: "texto", 50024: "elemento", 50031: "botón", 50030: "documento", 50032: "ventana",
}
CLICABLES = {50000, 50002, 50003, 50004, 50005, 50007, 50011, 50013, 50019, 50024, 50031}
MAX_CONTROLES = 45
MAX_TEXTO = 1500


def _sin_acentos(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")


class LectorPantalla:

    def __init__(self, hwnd_fijo=None):
        self.uia = None
        self.UIA = None
        self.hwnd_fijo = hwnd_fijo    # para pruebas: leer esta ventana y no la activa

    def _asegurar(self):
        if self.uia is not None:
            return
        import comtypes
        import comtypes.client
        comtypes.CoInitialize()
        comtypes.client.GetModule("UIAutomationCore.dll")
        from comtypes.gen import UIAutomationClient as UIA
        self.UIA = UIA
        self.uia = comtypes.client.CreateObject(UIA.CUIAutomation, interface=UIA.IUIAutomation)

    # ------------------------------------------------------------ ventana --
    def _hwnd(self):
        return self.hwnd_fijo or win32gui.GetForegroundWindow()

    def ventana_activa(self) -> dict:
        hwnd = self._hwnd()
        titulo = win32gui.GetWindowText(hwnd) if hwnd else ""
        proceso = ""
        try:
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            import win32api
            import win32con
            h = win32api.OpenProcess(win32con.PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
            try:
                ruta = win32process.GetModuleFileNameEx(h, 0)
                proceso = ruta.replace("\\", "/").split("/")[-1].replace(".exe", "")
            finally:
                win32api.CloseHandle(h)
        except Exception:
            pass
        return {"hwnd": hwnd, "titulo": titulo, "proceso": proceso}

    def _elemento_ventana(self):
        self._asegurar()
        hwnd = self._hwnd()
        if not hwnd:
            return None
        try:
            return self.uia.ElementFromHandle(hwnd)
        except Exception as e:
            logger.warning(f"Ventana activa sin UI Automation: {e}")
            return None

    # ----------------------------------------------------------- controles --
    def controles(self, max_n: int = MAX_CONTROLES) -> list:
        """Controles con nombre de la ventana activa: dicts con nombre, tipo,
        centro (x, y) y si es clicable. Ordenados de arriba abajo."""
        el = self._elemento_ventana()
        if el is None:
            return []
        UIA = self.UIA
        cache = self.uia.CreateCacheRequest()
        for pid in (UIA.UIA_NamePropertyId, UIA.UIA_ControlTypePropertyId,
                    UIA.UIA_BoundingRectanglePropertyId, UIA.UIA_IsOffscreenPropertyId):
            cache.AddProperty(pid)
        try:
            todos = el.FindAllBuildCache(UIA.TreeScope_Descendants, self.uia.CreateTrueCondition(), cache)
        except Exception as e:
            logger.warning(f"No se pudieron leer los controles: {e}")
            return []
        salida = []
        vistos = set()
        for i in range(min(todos.Length, 600)):
            try:
                e = todos.GetElement(i)
                nombre = (e.CachedName or "").strip()
                tipo = int(e.CachedControlType)
                r = e.CachedBoundingRectangle
                fuera = bool(e.CachedIsOffscreen)
            except Exception:
                continue
            if not nombre or fuera or r.right <= r.left or r.bottom <= r.top:
                continue
            if tipo not in TIPOS or tipo in (50032,):
                continue
            if tipo == 50020 and len(nombre) < 3:
                continue
            clave = (nombre[:60], tipo)
            if clave in vistos:
                continue
            vistos.add(clave)
            salida.append({
                "nombre": nombre[:80], "tipo": TIPOS[tipo], "clicable": tipo in CLICABLES,
                "x": (r.left + r.right) // 2, "y": (r.top + r.bottom) // 2,
                "ancho": r.right - r.left, "alto": r.bottom - r.top,
            })
        salida.sort(key=lambda c: (c["y"] // 40, c["x"]))
        clicables = [c for c in salida if c["clicable"]]
        textos = [c for c in salida if not c["clicable"]]
        return (clicables + textos)[:max_n]

    def buscar_control(self, nombre: str):
        """Centro (x, y) del control clicable cuyo nombre mejor coincide, o None."""
        objetivo = _sin_acentos(nombre.strip())
        if not objetivo:
            return None
        candidatos = [c for c in self.controles(max_n=300) if c["clicable"]]
        exactos = [c for c in candidatos if _sin_acentos(c["nombre"]) == objetivo]
        empieza = [c for c in candidatos if _sin_acentos(c["nombre"]).startswith(objetivo)]
        contiene = [c for c in candidatos if objetivo in _sin_acentos(c["nombre"])]
        palabras = [c for c in candidatos
                    if all(p in _sin_acentos(c["nombre"]) for p in objetivo.split())]
        for lista in (exactos, empieza, contiene, palabras):
            if lista:
                return (lista[0]["x"], lista[0]["y"], lista[0]["nombre"])
        return None

    # --------------------------------------------------------------- texto --
    def texto(self, max_car: int = MAX_TEXTO) -> str:
        """Texto principal de la ventana activa (documento o campo con
        TextPattern); si no hay, los textos visibles con nombre."""
        el = self._elemento_ventana()
        if el is None:
            return ""
        UIA = self.UIA
        for tipo in (50030, 50004, 50033):   # documento, campo, panel
            try:
                cond = self.uia.CreatePropertyCondition(UIA.UIA_ControlTypePropertyId, tipo)
                f = el.FindFirst(UIA.TreeScope_Descendants, cond)
                if f is None:
                    continue
                p = f.GetCurrentPattern(UIA.UIA_TextPatternId)
                if not p:
                    continue
                tp = p.QueryInterface(UIA.IUIAutomationTextPattern)
                t = (tp.DocumentRange.GetText(max_car) or "").strip()
                if len(t) > 20:
                    return t[:max_car]
            except Exception:
                continue
        trozos = [c["nombre"] for c in self.controles(max_n=120) if c["tipo"] == "texto"]
        return " · ".join(trozos)[:max_car]

    # ------------------------------------------------------------- resumen --
    def resumen(self, con_texto: bool = True) -> str:
        """Descripción compacta para el cerebro."""
        t0 = time.time()
        v = self.ventana_activa()
        partes = [f"Ventana activa: «{v['titulo']}» (programa {v['proceso'] or 'desconocido'})."]
        ctr = self.controles()
        if ctr:
            lista = "; ".join(f"{c['tipo']} «{c['nombre']}»" for c in ctr)
            partes.append(f"Controles visibles: {lista}.")
        else:
            partes.append("Controles visibles: ninguno legible.")
        if con_texto:
            t = self.texto(600)
            if t:
                partes.append(f"Texto en pantalla: {t}")
        logger.info(f"Contexto leído en {(time.time() - t0) * 1000:.0f} ms: {len(ctr)} controles")
        return "\n".join(partes)
