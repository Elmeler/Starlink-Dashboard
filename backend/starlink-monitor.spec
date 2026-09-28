# -*- mode: python ; coding: utf-8 -*-
import os
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# SPECPATH is the directory containing the spec file (backend/).
# Go one level up to reach the repo root, then into frontend/dist.
spec_dir = os.path.abspath(SPECPATH)
frontend_dist = os.path.normpath(os.path.join(spec_dir, "..", "frontend", "dist"))

datas = []
if os.path.exists(frontend_dist):
    datas.append((frontend_dist, "frontend/dist"))
    print(f"Including frontend from: {frontend_dist}")
else:
    print(f"WARNING: frontend/dist not found at {frontend_dist}")
    print("Run 'npm run build' in the frontend directory first.")

icon_file = os.path.join(spec_dir, "icon.ico")
if os.path.exists(icon_file):
    datas.append((icon_file, "."))
else:
    print("WARNING: icon.ico not found — run python generate_icon.py first.")

datas += collect_data_files("uvicorn")
datas += collect_data_files("fastapi")
datas += collect_data_files("webview")

hiddenimports = [
    # pywebview
    "webview",
    "webview.platforms.winforms",
    "clr",
    # uvicorn internals
    "uvicorn.logging",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    # fastapi / starlette
    "fastapi",
    "fastapi.openapi",
    "starlette.routing",
    "starlette.staticfiles",
    # gRPC
    "grpc",
    "grpc.aio",
    # Starlink client
    "starlink_grpc",
    "yagrc",
    "yagrc.reflector",
]
hiddenimports += collect_submodules("grpc")
hiddenimports += collect_submodules("starlink_grpc")

a = Analysis(
    ["tray.py"],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# onedir mode: EXE only gets scripts — binaries/datas go into COLLECT
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Starlink Monitor",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="icon.ico",
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="Starlink Monitor",
)
