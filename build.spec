# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path
import mediapipe
import customtkinter

block_cipher = None

# Perfil «Inicial» limpio: el cursor.json del repo lleva la calibración de ojos
# de quien desarrolla; el ejecutable sale con los valores de fábrica.
import json, sys
sys.path.insert(0, str(Path(SPECPATH)))
from src.config_manager import VALORES_POR_DEFECTO
_cursor = json.loads(Path("configs/Inicial/cursor.json").read_text(encoding="utf-8"))
for _clave in ("ojos_calibracion", "ojos_centro"):
    _cursor[_clave] = VALORES_POR_DEFECTO[_clave]
Path("build/Inicial_limpio").mkdir(parents=True, exist_ok=True)
CURSOR_LIMPIO = Path("build/Inicial_limpio/cursor.json")  # mismo nombre que en el perfil
CURSOR_LIMPIO.write_text(json.dumps(_cursor, indent=4, ensure_ascii=False), encoding="utf-8")

mp_init = Path(mediapipe.__file__)
mp_modules =  Path(mp_init.parent,"modules")
# Librería nativa de las tareas (face_landmarker) en mediapipe >= 0.10.30
mp_tasks_c = Path(mp_init.parent, "tasks", "c")

ctk_init = Path(customtkinter.__file__)
ctk_modules =  Path(ctk_init.parent,"modules")



app = Analysis(
    ['run_app.py'],
    pathex=[],
    binaries=[],
    datas=[(mp_modules.as_posix(), 'mediapipe/modules'),
                    (mp_tasks_c.as_posix(), 'mediapipe/tasks/c'),
                    ('assets','assets'),
                    # Solo el perfil de fábrica: los demás perfiles y los datos
                    # aprendidos (calibración, clics) son personales y no se distribuyen
                    ('configs/default.json', 'configs'),
                    ('configs/Inicial/keyboard_bindings.json', 'configs/Inicial'),
                    ('configs/Inicial/mouse_bindings.json', 'configs/Inicial'),
                    (CURSOR_LIMPIO.as_posix(), 'configs/Inicial'),
                    (ctk_init.parent.as_posix(), 'customtkinter')],
    hiddenimports=['mediapipe.tasks.c',
                   # winsdk carga sus módulos por nombre (reconocimiento de voz)
                   'winsdk.windows.media.speechrecognition',
                   'winsdk.windows.globalization'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz_app = PYZ(app.pure, app.zipped_data, cipher=block_cipher)

exe_app = EXE(
    pyz_app,
    app.scripts,
    [],
    exclude_binaries=True,
    name='Winclus',
    icon='assets/images/icono.ico',
    version='herramientas/version_info.txt',
    contents_directory='.',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)


coll = COLLECT(
    exe_app,
    app.binaries,
    app.zipfiles,
    app.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='Winclus',
)
