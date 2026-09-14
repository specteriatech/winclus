"""Crea el ZIP de distribución de Winclus a partir de dist/Winclus.

    .venv\\Scripts\\python.exe herramientas\\empaquetar.py

Antes hay que haber construido el ejecutable:

    .venv\\Scripts\\python.exe -m PyInstaller --noconfirm build.spec

El resultado es dist/Winclus-Windows.zip (nombre fijo: es el que descarga
web/instalar.ps1 y el botón de la landing desde la release de GitHub) con la
carpeta «Winclus» dentro y el LEEME de instalación.
"""
import shutil
import sys
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))
from src.config_manager import VERSION  # noqa: E402

CARPETA = RAIZ / "dist" / "Winclus"
LEEME = RAIZ / "herramientas" / "LEEME_instalacion.txt"
ZIP = RAIZ / "dist" / "Winclus-Windows.zip"
NO_INCLUIR = {"log.txt"}


def main() -> None:
    if not (CARPETA / "Winclus.exe").exists():
        sys.exit("No existe dist/Winclus/Winclus.exe: construye primero con PyInstaller.")
    shutil.copy(LEEME, CARPETA / "LEEME.txt")
    if ZIP.exists():
        ZIP.unlink()
    total = 0
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for archivo in sorted(CARPETA.rglob("*")):
            if archivo.is_dir() or archivo.name in NO_INCLUIR:
                continue
            z.write(archivo, Path("Winclus") / archivo.relative_to(CARPETA))
            total += 1
    print(f"Winclus {VERSION}: {total} archivos -> {ZIP} ({ZIP.stat().st_size / 1e6:.0f} MB)")


if __name__ == "__main__":
    main()
