"""Sugerencias de palabras para el teclado en pantalla.

Parte de una lista de las 50 000 palabras más frecuentes del español
(assets/datos/es_50k.txt, de FrequencyWords, CC BY-SA 4.0) y aprende las que
la persona escribe: cada palabra escrita suma peso, así las suyas suben a los
primeros puestos. Lo aprendido se guarda en configs/palabras_aprendidas.json.

Las búsquedas ignoran acentos: escribir «cancio» sugiere «canción».
"""

import bisect
import json
import logging
import unicodedata
from pathlib import Path

logger = logging.getLogger("Prediccion")

DICCIONARIO = Path("assets/datos/es_50k.txt")
APRENDIDAS = Path("configs/palabras_aprendidas.json")
MAX_PALABRAS = 30000       # con más no mejora y tarda en cargar
PESO_APRENDIDA = 20000     # cada uso propio vale como esta frecuencia
LARGO_MINIMO = 2

# La lista viene de subtítulos de películas y trae palabrotas muy arriba. No
# se sugieren (sí se aceptan si la persona las escribe y las aprende).
EXCLUIDAS = {
    "puta", "puto", "putas", "putos", "mierda", "joder", "coño", "cabrón", "cabron",
    "cabrones", "gilipollas", "polla", "pollas", "cojones", "carajo", "pendejo",
    "pendejos", "pendeja", "zorra", "zorras", "maricón", "maricon", "marica",
    "verga", "chingar", "chingada", "chingado", "pinche", "culo", "culos", "follar",
    "jodido", "jodida", "jodidos", "hostia", "hostias", "imbécil", "imbecil",
    "idiota", "idiotas", "estúpido", "estupido", "estúpida", "estupida", "bastardo",
    "bastardos", "perra", "perras", "putada", "capullo", "gilipollez", "coños",
    "mamada", "mamadas", "cagar", "cagada", "cagado", "tetas", "polvo", "hijoputa",
}


def sin_acentos(texto: str) -> str:
    """Quita tildes y diéresis pero conserva la ñ (es otra letra)."""
    salida = []
    for ch in texto.lower():
        if ch in "ñÑ":
            salida.append("ñ")
            continue
        base = unicodedata.normalize("NFD", ch)
        salida.append("".join(c for c in base if not unicodedata.combining(c)))
    return "".join(salida)


class Prediccion:

    def __init__(self):
        self.frecuencia = {}     # palabra -> frecuencia (diccionario + aprendidas)
        self.claves = []         # claves sin acento, ordenadas, para buscar
        self.por_clave = {}      # clave -> [palabras]
        self.aprendidas = {}
        self._cargar_diccionario()
        self._cargar_aprendidas()
        self._indexar()

    # ------------------------------------------------------------- carga --
    def _cargar_diccionario(self):
        try:
            with open(DICCIONARIO, encoding="utf-8") as f:
                for i, linea in enumerate(f):
                    if i >= MAX_PALABRAS:
                        break
                    partes = linea.split()
                    if len(partes) != 2:
                        continue
                    palabra, freq = partes
                    if len(palabra) < LARGO_MINIMO or not palabra.isalpha():
                        continue
                    if palabra in EXCLUIDAS:
                        continue
                    self.frecuencia[palabra] = int(freq)
        except OSError as e:
            logger.warning(f"No se pudo leer el diccionario {DICCIONARIO}: {e}")
        logger.info(f"Diccionario: {len(self.frecuencia)} palabras")

    def _cargar_aprendidas(self):
        try:
            with open(APRENDIDAS, encoding="utf-8") as f:
                self.aprendidas = {k: int(v) for k, v in json.load(f).items()}
        except (OSError, ValueError):
            self.aprendidas = {}
        for palabra, usos in self.aprendidas.items():
            self.frecuencia[palabra] = self.frecuencia.get(palabra, 0) + usos * PESO_APRENDIDA

    def _guardar_aprendidas(self):
        try:
            APRENDIDAS.parent.mkdir(parents=True, exist_ok=True)
            with open(APRENDIDAS, "w", encoding="utf-8") as f:
                json.dump(self.aprendidas, f, indent=2, ensure_ascii=False)
        except OSError as e:
            logger.warning(f"No se pudo guardar {APRENDIDAS}: {e}")

    def _indexar(self):
        self.por_clave = {}
        for palabra in self.frecuencia:
            self.por_clave.setdefault(sin_acentos(palabra), []).append(palabra)
        self.claves = sorted(self.por_clave)

    def _anadir_al_indice(self, palabra):
        clave = sin_acentos(palabra)
        if clave in self.por_clave:
            if palabra not in self.por_clave[clave]:
                self.por_clave[clave].append(palabra)
            return
        self.por_clave[clave] = [palabra]
        bisect.insort(self.claves, clave)

    # ----------------------------------------------------------- consulta --
    def sugerir(self, prefijo: str, n: int = 5) -> list:
        """Palabras que empiezan por el prefijo, de más a menos frecuente.
        Respeta las mayúsculas del prefijo: «Ho» sugiere «Hola»."""
        if not prefijo:
            return []
        clave = sin_acentos(prefijo)
        i = bisect.bisect_left(self.claves, clave)
        candidatas = []
        limite = 4000   # no recorrer medio diccionario con prefijos de una letra
        while i < len(self.claves) and self.claves[i].startswith(clave) and limite > 0:
            for palabra in self.por_clave[self.claves[i]]:
                candidatas.append((self.frecuencia.get(palabra, 0), palabra))
            i += 1
            limite -= 1
        candidatas.sort(reverse=True)
        salida = []
        for _, palabra in candidatas:
            palabra = self._con_mayusculas(prefijo, palabra)
            if palabra.lower() == prefijo.lower() and len(candidatas) > 1:
                continue    # ya está escrita entera
            if palabra not in salida:
                salida.append(palabra)
            if len(salida) >= n:
                break
        return salida

    @staticmethod
    def _con_mayusculas(prefijo: str, palabra: str) -> str:
        if prefijo.isupper() and len(prefijo) > 1:
            return palabra.upper()
        if prefijo[:1].isupper():
            return palabra[:1].upper() + palabra[1:]
        return palabra

    def aprender(self, palabra: str) -> None:
        palabra = palabra.strip()
        if len(palabra) < 3 or not palabra.isalpha():
            return
        palabra = palabra if palabra.isupper() else palabra.lower()
        self.aprendidas[palabra] = self.aprendidas.get(palabra, 0) + 1
        self.frecuencia[palabra] = self.frecuencia.get(palabra, 0) + PESO_APRENDIDA
        self._anadir_al_indice(palabra)
        self._guardar_aprendidas()
