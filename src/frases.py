"""Frases guardadas para decir con un clic (capa «Frases» del teclado).

Se guardan por perfil en configs/<perfil>/frases.json (una lista de textos),
así viajan con el perfil al exportarlo. Si no hay archivo, se usan las de
POR_DEFECTO.
"""

import json
import logging
from pathlib import Path

from src.config_manager import ConfigManager

logger = logging.getLogger("Frases")

ARCHIVO = "frases.json"
MAX_FRASES = 16          # 4 filas de 4 en el teclado

POR_DEFECTO = [
    "Sí", "No", "Gracias", "Necesito ayuda",
    "Tengo sed", "Tengo hambre", "Tengo dolor", "Quiero ir al baño",
    "Tengo frío", "Tengo calor", "Estoy cansado", "Quiero descansar",
    "Llama a mi familia", "Espera un momento", "No entiendo", "Hasta luego",
]


def _ruta(ruta=None) -> Path:
    if ruta is not None:
        return Path(ruta)
    return Path(ConfigManager().curr_profile_path or "configs/Inicial", ARCHIVO)


def cargar(ruta=None) -> list:
    r = _ruta(ruta)
    if r.is_file():
        try:
            with open(r, encoding="utf-8") as f:
                datos = json.load(f)
            frases = [str(x).strip() for x in datos if str(x).strip()]
            return frases[:MAX_FRASES]
        except Exception as e:
            logger.warning(f"No se pudieron leer las frases de {r}: {e}")
    return list(POR_DEFECTO)


def guardar(frases, ruta=None) -> list:
    limpias = []
    for f in frases:
        f = " ".join(str(f).split())
        if f and f not in limpias:
            limpias.append(f)
    limpias = limpias[:MAX_FRASES]
    r = _ruta(ruta)
    try:
        r.parent.mkdir(parents=True, exist_ok=True)
        with open(r, "w", encoding="utf-8") as fh:
            json.dump(limpias, fh, ensure_ascii=False, indent=2)
        logger.info(f"{len(limpias)} frases guardadas en {r}")
    except Exception as e:
        logger.warning(f"No se pudieron guardar las frases en {r}: {e}")
    return limpias
