# -*- mode: python ; coding: utf-8 -*-
import os
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Get the absolute path to the frontend dist folder
# Use absolute path calculation based on spec file location
spec_dir = os.getcwd()  # PyInstaller runs from the spec directory
frontend_dist = os.path.join(spec_dir, "..", "frontend", "dist")

# Collect data files for packages that need them
datas = []
if os.path.exists(frontend_dist):
    datas.append((frontend_dist, "frontend/dist"))
    print(f"Including frontend from: {frontend_dist}")
else:
    print(f"Warning: frontend/dist not found at {frontend_dist}")

# Add data files for packages
datas += collect_data_files("uvicorn")
datas += collect_data_files("fastapi")

# Collect hidden imports for gRPC and other packages
hiddenimports = [
    "uvicorn.logging",
    "uvicorn.lifespan",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websocket",
    "uvicorn.protocols.websocket.auto",
    "uvicorn.lifespan.on",
    "fastapi",
    "fastapi.openapi",
    "grpc",
    "grpc.aio",
    "_grpc_protos",
]
hiddenimports += collect_submodules("grpc")

a = Analysis(
    ["tray.py"],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludedimports=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="Starlink Monitor",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="icon.ico",
)

# Use onedir mode (creates folder with exe + dependencies)
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
