#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Starlink Monitor — startup script
#
# Usage:
#   ./start.sh           Development mode  (backend on :8000, Vite on :5173)
#   ./start.sh --prod    Production mode   (single process on :8000, React
#                                           pre-built and served by FastAPI)
#   ./start.sh --help
#
# Environment variables (optional overrides):
#   DISH_ADDRESS   gRPC target  (default: 192.168.100.1:9200)
#   BACKEND_PORT   FastAPI port (default: 8000)
#   FRONTEND_PORT  Vite port    (default: 5173, dev mode only)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROD=0
for arg in "$@"; do
  case "$arg" in
    --prod)   PROD=1 ;;
    --help|-h)
      sed -n '2,13p' "$0" | sed 's/^# \{0,2\}//'
      exit 0
      ;;
  esac
done

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
DISH_ADDRESS="${DISH_ADDRESS:-192.168.100.1:9200}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/backend/.venv"

# ── colour helpers ─────────────────────────────────────────────────────────────
red()    { printf '\033[0;31m%s\033[0m\n' "$*"; }
green()  { printf '\033[0;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n'    "$*"; }

# ── auto-install Node.js on Debian / Raspberry Pi OS ─────────────────────────
install_nodejs() {
  yellow "-> Node.js not found — installing via NodeSource (requires sudo) …"

  # Ensure curl is available
  if ! command -v curl &>/dev/null; then
    yellow "   Installing curl …"
    sudo apt-get install -y curl
  fi

  # NodeSource LTS (v20) — works on arm64 and armv7l (Pi 3/4/5)
  # --connect-timeout 10: fail fast instead of hanging when offline
  if ! curl -fsSL --connect-timeout 10 https://deb.nodesource.com/setup_20.x | sudo -E bash -; then
    red "ERROR: Node.js auto-install failed (no internet or NodeSource unreachable)."
    red "  Install manually: https://nodejs.org/en/download"
    exit 1
  fi
  sudo apt-get install -y nodejs

  if ! command -v npm &>/dev/null; then
    red "ERROR: Node.js installation failed. Please install manually:"
    red "  https://nodejs.org/en/download"
    exit 1
  fi

  green "  Node.js $(node --version) / npm $(npm --version) installed."
}

# ── detect python ─────────────────────────────────────────────────────────────
PYTHON=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then
    ver=$("$cmd" -c 'import sys; print(sys.version_info >= (3,11))' 2>/dev/null)
    if [[ "$ver" == "True" ]]; then
      PYTHON="$cmd"
      break
    fi
  fi
done

if [[ -z "$PYTHON" ]]; then
  red "ERROR: Python 3.11+ not found."
  red "  Raspberry Pi OS: sudo apt install python3.11 python3.11-venv python3-full"
  red "  Other systems  : https://python.org/downloads"
  exit 1
fi

# ── detect or install Node.js / npm ───────────────────────────────────────────
NPM=""
for cmd in npm npm.cmd; do
  if command -v "$cmd" &>/dev/null; then
    NPM="$cmd"
    break
  fi
done

if [[ -z "$NPM" ]]; then
  # Production mode with a pre-built dist: Node not strictly needed
  if [[ "$PROD" -eq 1 && -d "$SCRIPT_DIR/frontend/dist" ]]; then
    yellow "npm not found but frontend/dist/ already exists — skipping build step."
  # On Debian/Pi we can auto-install via apt + NodeSource
  elif command -v apt-get &>/dev/null; then
    install_nodejs
    NPM="npm"
  else
    red "ERROR: npm not found and auto-install is only supported on Debian/Ubuntu/Raspberry Pi OS."
    red "  Please install Node.js 18+ from https://nodejs.org then re-run ./start.sh"
    exit 1
  fi
fi

# ── banner ────────────────────────────────────────────────────────────────────
echo ""
bold "┌─ Starlink Monitor ──────────────────────────────────────┐"
if [[ "$PROD" -eq 1 ]]; then
bold "│  Mode   : Production (single process)                   │"
else
bold "│  Mode   : Development (two processes)                   │"
fi
bold "│  Python : $("$PYTHON" --version)"
[[ -n "$NPM" ]] && bold "│  Node   : $(node --version) / npm $("$NPM" --version)"
bold "│  Dish   : $DISH_ADDRESS"
bold "└─────────────────────────────────────────────────────────┘"
echo ""

# ── create / reuse Python virtual environment ─────────────────────────────────
if [[ ! -f "$VENV_DIR/bin/activate" ]]; then
  yellow "-> Creating Python virtual environment at backend/.venv …"

  if ! "$PYTHON" -m venv "$VENV_DIR" 2>/dev/null; then
    red "ERROR: could not create venv. On Raspberry Pi / Debian, run:"
    red "  sudo apt install python3-venv python3-full"
    exit 1
  fi
  green "  Virtual environment created."
else
  green "  Reusing existing virtual environment at backend/.venv"
fi

VENV_PYTHON="$VENV_DIR/bin/python"
VENV_PIP="$VENV_DIR/bin/pip"

# ── install backend dependencies (skip when requirements.txt hasn't changed) ──
REQ_FILE="$SCRIPT_DIR/backend/requirements.txt"
REQ_HASH_FILE="$VENV_DIR/.req_hash"
REQ_HASH=$(md5sum "$REQ_FILE" 2>/dev/null | cut -d' ' -f1 \
        || shasum "$REQ_FILE" 2>/dev/null | cut -d' ' -f1 \
        || echo "unknown")

if [[ -f "$REQ_HASH_FILE" && "$(cat "$REQ_HASH_FILE")" == "$REQ_HASH" && "$REQ_HASH" != "unknown" ]]; then
  green "  Backend dependencies up to date — skipping install."
else
  yellow "-> Installing / updating backend dependencies …"
  if ! "$VENV_PIP" install -r "$REQ_FILE" -q; then
    red "ERROR: pip install failed."
    red "  If you are offline, ensure all packages are cached or pre-installed in the venv."
    exit 1
  fi
  echo "$REQ_HASH" > "$REQ_HASH_FILE"
  green "  Backend dependencies ready."
fi

# ── production frontend build ─────────────────────────────────────────────────
npm_install_if_needed() {
  local dir="$1"
  # npm ci writes node_modules/.package-lock.json on success; compare with
  # package-lock.json to decide whether an install is actually needed.
  if [[ -f "$dir/node_modules/.package-lock.json" ]] && \
     diff -q "$dir/package-lock.json" "$dir/node_modules/.package-lock.json" &>/dev/null; then
    green "  Frontend dependencies up to date — skipping npm ci."
  else
    yellow "-> Installing frontend dependencies …"
    if ! "$NPM" ci -q; then
      red "ERROR: npm ci failed."
      red "  If you are offline, ensure node_modules/ is already populated."
      exit 1
    fi
    green "  Frontend dependencies ready."
  fi
}

if [[ "$PROD" -eq 1 && -n "$NPM" ]]; then
  cd "$SCRIPT_DIR/frontend"
  npm_install_if_needed "$SCRIPT_DIR/frontend"

  yellow "-> Building React app …"
  "$NPM" run build
  cd "$SCRIPT_DIR"
  green "  Frontend built — will be served by FastAPI."
elif [[ "$PROD" -eq 1 ]]; then
  yellow "  Skipping frontend build (using existing dist/)."
fi

# ── launch backend ─────────────────────────────────────────────────────────────
SERVE_STATIC_VAL=0
[[ "$PROD" -eq 1 ]] && SERVE_STATIC_VAL=1

yellow "-> Starting backend on http://0.0.0.0:${BACKEND_PORT} …"
DISH_ADDRESS="$DISH_ADDRESS" SERVE_STATIC="$SERVE_STATIC_VAL" \
  "$VENV_PYTHON" -m uvicorn main:app \
    --host 0.0.0.0 \
    --port "$BACKEND_PORT" \
    --app-dir "$SCRIPT_DIR/backend" \
    ${PROD:+--workers 2} &
BACKEND_PID=$!

# ── launch Vite dev server ─────────────────────────────────────────────────────
FRONTEND_PID=""
if [[ "$PROD" -eq 0 && -n "$NPM" ]]; then
  yellow "-> Starting Vite dev server …"
  cd "$SCRIPT_DIR/frontend"
  npm_install_if_needed "$SCRIPT_DIR/frontend"
  # --logLevel warn / --clearScreen false: suppress Vite's own "Local:/Network:"
  # ready banner so it can't print a second, differently-formatted port after
  # our summary below — the summary at the end of this script is the one
  # source of truth for which URL to open.
  "$NPM" run dev -- --port "$FRONTEND_PORT" --clearScreen false --logLevel warn &
  FRONTEND_PID=$!
  cd "$SCRIPT_DIR"
fi

# ── wait for services to actually bind before printing the summary ───────────
wait_for_port() {
  local port="$1" tries="${2:-40}"
  for ((i = 0; i < tries; i++)); do
    if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
      exec 3<&- 3>&-
      return 0
    fi
    sleep 0.25
  done
  return 1
}

wait_for_port "$BACKEND_PORT" || true
[[ -n "$FRONTEND_PID" ]] && { wait_for_port "$FRONTEND_PORT" || true; }

# ── ready — this is the single, authoritative summary; keep it last ──────────
echo ""
bold "════════════════════════════════════════════════════════════"
green "  Starlink Monitor is running"
echo ""
if [[ "$PROD" -eq 1 ]]; then
  green  "  ➜  Web UI (open this in your browser):"
  bold   "       http://localhost:${BACKEND_PORT}"
  echo ""
  yellow "     API docs are disabled in production mode."
else
  green  "  ➜  Web UI (open this in your browser):"
  bold   "       http://localhost:${FRONTEND_PORT}"
  echo ""
  yellow "     Backend API (used internally by the dashboard; only needed"
  yellow "     for development/debugging — Swagger docs):"
  yellow "       http://localhost:${BACKEND_PORT}/docs"
fi
bold "════════════════════════════════════════════════════════════"
echo ""
yellow "  Press Ctrl+C to stop all processes"
echo ""

# ── cleanup on exit ────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  yellow "Shutting down …"
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  kill "$BACKEND_PID"       2>/dev/null || true
  wait 2>/dev/null || true
  green "Stopped."
}
trap cleanup EXIT INT TERM

wait
