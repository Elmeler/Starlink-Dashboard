import asyncio
import json
import os
import sys
import socket
import threading
import time
import traceback
import urllib.request
import webbrowser
import psutil
from pathlib import Path

# ── Crash log (must be first so every import error is captured) ───────────────
_log_path = Path(os.path.expanduser("~")) / "starlink_monitor.log"
try:
    _log_file = open(_log_path, "w", buffering=1, encoding="utf-8")
    sys.stdout = _log_file
    sys.stderr = _log_file
    print(f"Starlink Monitor starting — log: {_log_path}")
except Exception:
    pass

# ── pywebview (optional — falls back to browser if pythonnet unavailable) ─────
try:
    import webview
    _WEBVIEW_AVAILABLE = True
    print("pywebview loaded OK")
except Exception as _wv_err:
    _WEBVIEW_AVAILABLE = False
    print(f"pywebview unavailable ({_wv_err}) — will open browser instead")

import uvicorn
from pystray import Icon, Menu, MenuItem
from PIL import Image, ImageDraw

# ── Constants ─────────────────────────────────────────────────────────────────
APP_VERSION  = "1.0.5"
APP_URL      = "http://127.0.0.1:8001"
GITHUB_API   = "https://api.github.com/repos/Elmeler/Starlink-Dashboard/releases/latest"
PROCESS_NAME = "Starlink Monitor.exe"

# ── Config (window geometry persisted across sessions) ────────────────────────

def _config_path():
    appdata = os.getenv("APPDATA") or str(Path.home() / ".config")
    return Path(appdata) / "StarlinkMonitor" / "config.json"

def _load_config():
    try:
        p = _config_path()
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}

def _save_config(data):
    try:
        p = _config_path()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"Config save failed: {e}")

# ── Frontend path resolution ──────────────────────────────────────────────────

def get_frontend_dist_path():
    if getattr(sys, 'frozen', False):
        exe_dir = Path(sys.executable).parent
        for candidate in [exe_dir / "_internal" / "frontend" / "dist",
                          exe_dir / "frontend" / "dist"]:
            if candidate.exists():
                print(f"[OK] Bundled frontend: {candidate}")
                return candidate

    dev_path = Path(__file__).parent.parent / "frontend" / "dist"
    if dev_path.exists():
        print(f"[OK] Dev frontend: {dev_path}")
        return dev_path

    print("[ERROR] frontend/dist not found — run 'npm run build' in frontend/")
    return None

# ── Set env vars before importing main ───────────────────────────────────────
frontend_path = get_frontend_dist_path()
if frontend_path:
    os.environ["FRONTEND_DIST"] = str(frontend_path)
os.environ["SERVE_STATIC"] = "1"

from main import app  # noqa: E402  (intentional late import)

# ── Icon ──────────────────────────────────────────────────────────────────────

def create_icon():
    candidates = []
    if getattr(sys, 'frozen', False):
        exe_dir = Path(sys.executable).parent
        candidates += [exe_dir / "_internal" / "icon.ico", exe_dir / "icon.ico"]
    candidates.append(Path(__file__).parent / "icon.ico")

    for path in candidates:
        if path.exists():
            try:
                return Image.open(path).convert("RGBA").resize((64, 64), Image.LANCZOS)
            except Exception:
                pass

    size = 64
    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([0, 0, size - 1, size - 1], fill=(30, 144, 255), outline=(255, 255, 255))
    draw.text((size // 2, size // 2), "SL", fill=(255, 255, 255), anchor="mm")
    return img

# ── Single-instance guard ─────────────────────────────────────────────────────

def check_single_instance():
    current_pid = os.getpid()
    try:
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                if proc.info['name'] == PROCESS_NAME and proc.info['pid'] != current_pid:
                    print(f"Terminating old instance: PID {proc.info['pid']}")
                    proc.terminate()
                    try:
                        proc.wait(timeout=3)
                    except psutil.TimeoutExpired:
                        proc.kill()
                    time.sleep(0.5)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except Exception as e:
        print(f"Single-instance check warning: {e}")

# ── Server ────────────────────────────────────────────────────────────────────

def run_server():
    try:
        print("Starting FastAPI server…")
        config = uvicorn.Config(app, host="127.0.0.1", port=8001, log_level="info")
        server = uvicorn.Server(config)
        asyncio.run(server.serve())
    except OSError as e:
        if "Address already in use" in str(e):
            print("ERROR: Port 8001 already in use")
        else:
            print(f"ERROR: {e}")
    except Exception as e:
        print(f"Server error: {e}")
        traceback.print_exc()

def wait_for_server(max_attempts=40, delay=0.5):
    for attempt in range(max_attempts):
        try:
            s = socket.socket()
            if s.connect_ex(("127.0.0.1", 8001)) == 0:
                s.close()
                print(f"Server ready after {attempt * delay:.1f}s")
                return True
            s.close()
        except Exception:
            pass
        time.sleep(delay)
    print("Server did not become ready in time")
    return False

# ── Auto-update check ─────────────────────────────────────────────────────────

def _parse_version(v):
    try:
        return tuple(int(x) for x in v.lstrip('v').split('.')[:3])
    except Exception:
        return (0, 0, 0)

def _check_updates(icon):
    try:
        req = urllib.request.Request(GITHUB_API, headers={"User-Agent": "StarlinkMonitor"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        latest_tag = data.get("tag_name", "")
        if latest_tag and _parse_version(latest_tag) > _parse_version(APP_VERSION):
            msg = f"v{latest_tag.lstrip('v')} is available (you have v{APP_VERSION})"
            print(f"Update available: {msg}")
            try:
                icon.notify(msg, "Starlink Monitor Update")
            except Exception:
                pass
        else:
            print(f"Up to date (v{APP_VERSION})")
    except Exception as e:
        print(f"Update check failed: {e}")

# ── Window state ──────────────────────────────────────────────────────────────

_window = None

def _save_geometry():
    if not _window:
        return
    try:
        raw = _window.evaluate_js(
            "JSON.stringify({x:window.screenX,y:window.screenY,"
            "w:window.outerWidth,h:window.outerHeight})"
        )
        if raw:
            g   = json.loads(raw)
            cfg = _load_config()
            cfg.update({"window_x": g["x"], "window_y": g["y"],
                        "window_w": g["w"],  "window_h": g["h"]})
            _save_config(cfg)
            print(f"Geometry saved: {g}")
    except Exception as e:
        print(f"Geometry save failed: {e}")

def _show_window():
    if _window:
        try:
            _window.show()
        except Exception as e:
            print(f"show() error: {e}")

def _hide_window():
    if _window:
        try:
            _window.hide()
        except Exception as e:
            print(f"hide() error: {e}")

def _quit_app(icon, item):
    print("Quit requested")
    _save_geometry()
    try:
        icon.stop()
    except Exception:
        pass
    if _window:
        try:
            _window.destroy()
        except Exception:
            pass
    os._exit(0)

# ── Startup sequence (pystray setup thread) ───────────────────────────────────

def _startup(icon):
    print("Waiting for server…")
    wait_for_server()
    print("Server ready")

    if _window:
        try:
            _window.load_url(APP_URL)
            _window.show()
        except Exception as e:
            print(f"Window show error: {e}")
            traceback.print_exc()
    elif not _WEBVIEW_AVAILABLE:
        webbrowser.open(APP_URL)

    # Update check runs after window is visible — non-blocking
    threading.Thread(target=_check_updates, args=(icon,), daemon=True).start()

# ── Window close → hide to tray ───────────────────────────────────────────────

def _on_window_closing():
    _save_geometry()
    threading.Thread(target=_hide_window, daemon=True).start()
    return False  # prevent window destruction

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    global _window

    print("=" * 60)
    print(f"Starlink Monitor v{APP_VERSION}")
    print(f"pywebview: {'yes' if _WEBVIEW_AVAILABLE else 'no (browser fallback)'}")
    print("=" * 60)

    check_single_instance()

    server_thread = threading.Thread(target=run_server, daemon=False)
    server_thread.start()

    menu_items = (
        [MenuItem("Show Dashboard", lambda i, it: _show_window()),
         MenuItem("Hide Dashboard", lambda i, it: _hide_window())]
        if _WEBVIEW_AVAILABLE else
        [MenuItem("Open Dashboard", lambda i, it: webbrowser.open(APP_URL))]
    ) + [MenuItem("Quit", _quit_app)]

    icon_obj = None
    try:
        icon_obj = Icon("Starlink Monitor", create_icon(), menu=Menu(*menu_items))
        if _WEBVIEW_AVAILABLE:
            icon_obj.run_detached(setup=_startup)
            print("Tray icon running detached")
        else:
            icon_obj.run(setup=_startup)
            return
    except Exception as e:
        print(f"Tray icon error: {e}")
        traceback.print_exc()
        if not _WEBVIEW_AVAILABLE:
            wait_for_server()
            webbrowser.open(APP_URL)
            server_thread.join()
            return

    # ── pywebview window ──────────────────────────────────────────────────────
    cfg = _load_config()
    w   = cfg.get("window_w", 1440)
    h   = cfg.get("window_h", 900)
    x   = cfg.get("window_x")   # None = OS default (centered)
    y   = cfg.get("window_y")

    print(f"Creating window: {w}x{h} at ({x},{y})")
    try:
        kw = dict(title="Starlink Monitor", url="about:blank",
                  width=w, height=h, min_size=(900, 600), hidden=True)
        if x is not None and y is not None:
            kw["x"] = x
            kw["y"] = y
        _window = webview.create_window(**kw)
        _window.events.closing += _on_window_closing
        print("Starting webview GUI loop")
        webview.start(private_mode=False)
        print("Webview exited")
    except Exception as e:
        print(f"Webview failed: {e}")
        traceback.print_exc()
        wait_for_server()
        webbrowser.open(APP_URL)
        server_thread.join()
        return

    try:
        icon_obj.stop()
    except Exception:
        pass


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
    finally:
        try:
            if '_log_file' in dir() and not _log_file.closed:
                _log_file.flush()
                _log_file.close()
        except Exception:
            pass
