"""El micrófono de Windows: cuál es, si está en silencio y si llega voz.

Quien solo puede usar la voz se queda sin nada si el micrófono está mudo y
el programa no lo dice: se habla y no pasa nada, sin saber por qué. Este
módulo mira el micrófono por el que escucha Windows (Core Audio, con
comtypes, sin instalar nada nuevo) y `diagnostico()` convierte esos números
en una frase que se le puede decir a la persona.

`pico()` solo tiene sentido mientras algo está capturando: si nadie graba,
Windows devuelve 0 aunque haya ruido. Por eso se usa mientras `src/escucha.py`
está escuchando.
"""

import logging
from ctypes import POINTER, c_float, c_int, c_uint32, c_ulong, c_ushort, c_void_p, c_wchar_p, Structure

import comtypes
import comtypes.client
from comtypes import COMMETHOD, GUID, HRESULT, IUnknown

logger = logging.getLogger("Microfono")

CLSID_MMDeviceEnumerator = GUID("{BCDE0395-E52F-467C-8E3D-C4579291692E}")
CAPTURA, CONSOLA, ACTIVO = 1, 0, 1        # eCapture, eConsole, DEVICE_STATE_ACTIVE
CLSCTX_ALL = 23

# Umbrales, medidos con el casco del usuario el 19-sep-2026: con nadie hablando
# el pico se queda por debajo de 0,04; hablando normal pasa de 0,1 de sobra.
PICO_SILENCIO = 0.05
PICO_VOZ = 0.10
VOLUMEN_BAJO = 0.15


class PROPERTYKEY(Structure):
    _fields_ = [("fmtid", GUID), ("pid", c_ulong)]


class PROPVARIANT(Structure):
    # Solo interesa el caso VT_LPWSTR (el nombre del aparato); el resto del
    # sindiós de PROPVARIANT se ignora a propósito. El orden y el tamaño
    # importan: vt y tres reservados de dos bytes, y a partir de ahí la unión
    # (un puntero en 64 bits). Con campos de cuatro bytes el nombre sale vacío.
    _fields_ = [("vt", c_ushort), ("r1", c_ushort), ("r2", c_ushort), ("r3", c_ushort),
                ("pwszVal", c_wchar_p), ("relleno", c_void_p)]


PKEY_Device_FriendlyName = PROPERTYKEY()
PKEY_Device_FriendlyName.fmtid = GUID("{A45C254E-DF1C-4EFD-8020-67D146A850E0}")
PKEY_Device_FriendlyName.pid = 14


class IPropertyStore(IUnknown):
    _iid_ = GUID("{886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99}")
    _methods_ = [
        COMMETHOD([], HRESULT, "GetCount", (["out"], POINTER(c_ulong), "c")),
        COMMETHOD([], HRESULT, "GetAt", (["in"], c_ulong, "i"), (["out"], POINTER(PROPERTYKEY), "k")),
        COMMETHOD([], HRESULT, "GetValue", (["in"], POINTER(PROPERTYKEY), "k"),
                  (["out"], POINTER(PROPVARIANT), "v")),
    ]


class IMMDevice(IUnknown):
    _iid_ = GUID("{D666063F-1587-4E43-81F1-B948E807363F}")
    _methods_ = [
        COMMETHOD([], HRESULT, "Activate",
                  (["in"], POINTER(GUID), "iid"), (["in"], c_uint32, "dwClsCtx"),
                  (["in"], c_void_p, "pActivationParams"),
                  (["out"], POINTER(POINTER(IUnknown)), "ppInterface")),
        COMMETHOD([], HRESULT, "OpenPropertyStore", (["in"], c_uint32, "acceso"),
                  (["out"], POINTER(POINTER(IPropertyStore)), "pp")),
    ]


class IMMDeviceEnumerator(IUnknown):
    _iid_ = GUID("{A95664D2-9614-4F35-A746-DE8DB63617E6}")
    _methods_ = [
        COMMETHOD([], HRESULT, "EnumAudioEndpoints", (["in"], c_uint32, "flujo"),
                  (["in"], c_uint32, "estado"), (["out"], POINTER(POINTER(IUnknown)), "pp")),
        COMMETHOD([], HRESULT, "GetDefaultAudioEndpoint", (["in"], c_uint32, "flujo"),
                  (["in"], c_uint32, "papel"), (["out"], POINTER(POINTER(IMMDevice)), "pp")),
    ]


class IAudioMeterInformation(IUnknown):
    _iid_ = GUID("{C02216F6-8C67-4B5B-9D00-D008E73E0064}")
    _methods_ = [COMMETHOD([], HRESULT, "GetPeakValue", (["out"], POINTER(c_float), "pico"))]


class IAudioEndpointVolume(IUnknown):
    _iid_ = GUID("{5CDF2C82-841E-4546-9722-0CF74078229A}")
    _methods_ = [
        COMMETHOD([], HRESULT, "RegisterControlChangeNotify", (["in"], c_void_p, "p")),
        COMMETHOD([], HRESULT, "UnregisterControlChangeNotify", (["in"], c_void_p, "p")),
        COMMETHOD([], HRESULT, "GetChannelCount", (["out"], POINTER(c_uint32), "n")),
        COMMETHOD([], HRESULT, "SetMasterVolumeLevel", (["in"], c_float, "f"), (["in"], POINTER(GUID), "g")),
        COMMETHOD([], HRESULT, "SetMasterVolumeLevelScalar", (["in"], c_float, "f"), (["in"], POINTER(GUID), "g")),
        COMMETHOD([], HRESULT, "GetMasterVolumeLevel", (["out"], POINTER(c_float), "f")),
        COMMETHOD([], HRESULT, "GetMasterVolumeLevelScalar", (["out"], POINTER(c_float), "f")),
        COMMETHOD([], HRESULT, "SetChannelVolumeLevel", (["in"], c_uint32, "c"), (["in"], c_float, "f"),
                  (["in"], POINTER(GUID), "g")),
        COMMETHOD([], HRESULT, "SetChannelVolumeLevelScalar", (["in"], c_uint32, "c"), (["in"], c_float, "f"),
                  (["in"], POINTER(GUID), "g")),
        COMMETHOD([], HRESULT, "GetChannelVolumeLevel", (["in"], c_uint32, "c"), (["out"], POINTER(c_float), "f")),
        COMMETHOD([], HRESULT, "GetChannelVolumeLevelScalar", (["in"], c_uint32, "c"),
                  (["out"], POINTER(c_float), "f")),
        COMMETHOD([], HRESULT, "SetMute", (["in"], c_int, "b"), (["in"], POINTER(GUID), "g")),
        COMMETHOD([], HRESULT, "GetMute", (["out"], POINTER(c_int), "b")),
    ]


class Microfono:
    """El micrófono por el que escucha Windows. Cada hilo, el suyo (COM)."""

    def __init__(self):
        self._dispositivo = None
        self._medidor = None
        self._volumen = None
        self._roto = False

    def _asegurar(self):
        if self._dispositivo is not None or self._roto:
            return
        try:
            comtypes.CoInitialize()
            enumerador = comtypes.client.CreateObject(CLSID_MMDeviceEnumerator,
                                                      interface=IMMDeviceEnumerator)
            self._dispositivo = enumerador.GetDefaultAudioEndpoint(CAPTURA, CONSOLA)
            self._medidor = self._dispositivo.Activate(
                IAudioMeterInformation._iid_, CLSCTX_ALL, None).QueryInterface(IAudioMeterInformation)
            self._volumen = self._dispositivo.Activate(
                IAudioEndpointVolume._iid_, CLSCTX_ALL, None).QueryInterface(IAudioEndpointVolume)
        except Exception as e:                      # sin micrófono, sin audio, sin permisos
            logger.info(f"Sin micrófono que mirar: {e}")
            self._roto = True

    @property
    def hay(self) -> bool:
        self._asegurar()
        return self._dispositivo is not None

    def nombre(self) -> str:
        self._asegurar()
        if self._dispositivo is None:
            return ""
        try:
            almacen = self._dispositivo.OpenPropertyStore(0)     # STGM_READ
            valor = almacen.GetValue(PKEY_Device_FriendlyName)
            return valor.pwszVal or ""
        except Exception as e:
            logger.info(f"Sin nombre del micrófono: {e}")
            return ""

    def silenciado(self) -> bool:
        self._asegurar()
        if self._volumen is None:
            return False
        try:
            return bool(self._volumen.GetMute())
        except Exception:
            return False

    def volumen(self) -> float:
        self._asegurar()
        if self._volumen is None:
            return 1.0
        try:
            return float(self._volumen.GetMasterVolumeLevelScalar())
        except Exception:
            return 1.0

    def pico(self) -> float:
        """Cuánto suena ahora mismo (0 a 1). Solo vale si algo está capturando."""
        self._asegurar()
        if self._medidor is None:
            return 0.0
        try:
            return float(self._medidor.GetPeakValue())
        except Exception:
            return 0.0

    def estado(self) -> dict:
        return {"hay": self.hay, "nombre": self.nombre(),
                "silenciado": self.silenciado(), "volumen": round(self.volumen(), 2)}


def diagnostico(pico_max: float, silenciado: bool, volumen: float,
                oyo_algo: bool, nombre: str = "") -> str:
    """Por qué Winclus no te oye, en una frase. Cadena vacía = todo bien.

    Es una función aparte y sin COM para poder probarla sin micrófono
    (herramientas\\pruebas\\prueba_voz.py).
    """
    donde = f" «{nombre}»" if nombre else ""
    if oyo_algo:
        return ""
    if silenciado:
        return (f"Tu micrófono{donde} está en silencio. Enciéndelo en Configuración, Sistema, "
                "Sonido, o con el botón del propio micrófono.")
    if volumen < VOLUMEN_BAJO:
        return (f"El volumen del micrófono{donde} está casi a cero ({int(volumen * 100)} %). "
                "Súbelo en Configuración, Sistema, Sonido.")
    if pico_max < PICO_SILENCIO:
        return (f"No me llega nada por el micrófono{donde}. Mira que sea ese el que usas y que "
                "no tenga el botón de silencio puesto; puedes cambiarlo en Configuración, "
                "Sistema, Sonido, Entrada.")
    if pico_max < PICO_VOZ:
        return (f"Te oigo muy bajito por el micrófono{donde}. Acércatelo o sube su volumen en "
                "Configuración, Sistema, Sonido.")
    return ("Te oigo, pero no entiendo lo que dices. Habla un poco más despacio y di una orden "
            "de la lista; si quieres, di «¿qué puedo decir?».")
