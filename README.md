# Starlink Monitor

<div align="center">
  <img src="SL-Dash.png" alt="Starlink Monitor Icon" width="128" height="128" />
</div>

A local web dashboard that connects to a Starlink dish via its built-in gRPC
API and displays live telemetry, obstruction maps, connected devices, and alert
history — no cloud account required.

![Dashboard preview — dark Starlink-branded UI with throughput/latency charts, obstruction map, and stat cards]

---

## Requirements

| Dependency | Minimum version | Notes |
|---|---|---|
| Python | 3.11+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | bundled with Node |
| Network | — | Must be on the same LAN as the dish |

The dash talks to the dish at **`192.168.100.1:9200`** (no authentication).
This is the standard Starlink local gateway — you must be connected to the
dish's local network (via ethernet, or through a router that connects to the
dish).

---

## Quick start

### Windows (Standalone .exe — Easiest)

Download and run the pre-built Windows application — no Python installation needed!

```powershell
git clone <this-repo> starlink-dashboard
cd starlink-dashboard
.\build-windows.bat
```

Run the built executable:
```
backend\dist\Starlink Monitor\Starlink Monitor.exe
```

The dashboard will automatically open in your browser at **http://localhost:8001**.

**Or build manually:**
- See [WINDOWS_BUILD.md](WINDOWS_BUILD.md) for detailed build instructions and troubleshooting

### Linux / macOS / Raspberry Pi

```bash
git clone <this-repo> starlink-dashboard
cd starlink-dashboard
chmod +x start.sh
./start.sh
```

Open **http://localhost:5173** in your browser.  
The backend API is at **http://localhost:8000/docs**.

### Windows

```powershell
git clone <this-repo> starlink-dashboard
cd starlink-dashboard
.\start.ps1
```

Open **http://localhost:5173** in your browser.

> **First-time only — execution policy**  
> If you see "running scripts is disabled", run this once in an elevated PowerShell window, then retry:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
> Or bypass it per-invocation:
> ```powershell
> pwsh -ExecutionPolicy Bypass -File .\start.ps1
> ```

---

## Modes

### Development (default)

Runs the FastAPI backend on `:8000` and the Vite dev server on `:5173`.
Hot-module reload is enabled — save any `.jsx` file and the browser updates
instantly.

```bash
# Linux / macOS / Pi
./start.sh

# Windows
.\start.ps1
```

> On Windows, the backend opens in a second console window titled
> **"Starlink Monitor — Backend"**. Closing or Ctrl+C-ing the Vite window
> (this window) stops both.

### Production / Raspberry Pi

Builds the React app once, then serves everything from a single FastAPI
process on `:8000`.  No Node.js needs to stay running after the build.

```bash
# Linux / macOS / Pi
./start.sh --prod

# Windows
.\start.ps1 -Prod
```

Open **http://localhost:8000**.

#### Auto-start on boot (systemd — Pi)

```ini
# /etc/systemd/system/starlink-monitor.service
[Unit]
Description=Starlink Monitor
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/starlink-dashboard
ExecStart=/home/pi/starlink-dashboard/start.sh --prod
Restart=on-failure
RestartSec=10
Environment=DISH_ADDRESS=192.168.100.1:9200
Environment=BACKEND_PORT=8000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now starlink-monitor
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DISH_ADDRESS` | `192.168.100.1:9200` | Dish gRPC endpoint |
| `BACKEND_PORT` | `8000` | FastAPI listen port |
| `FRONTEND_PORT` | `5173` | Vite dev-server port (dev mode) |
| `SERVE_STATIC` | `0` | Set `1` to serve `frontend/dist/` from FastAPI |

**Windows — setting env vars before launching:**
```powershell
$env:BACKEND_PORT = '8001'; .\start.ps1 -Prod
```

---

## Project structure

```
starlink-dashboard/
├── start.sh                  # Startup script (Linux / macOS / Pi)
├── start.ps1                 # Startup script (Windows PowerShell)
├── backend/
│   ├── main.py               # FastAPI app + lifespan
│   ├── requirements.txt
│   ├── starlink_grpc.py      # Vendored gRPC client (reflection-based)
│   ├── dish/
│   │   ├── client.py         # gRPC channel singleton + reconnect
│   │   ├── telemetry.py      # Background polling (1 s status, 5 s history)
│   │   ├── diagnostics.py    # Obstruction map + pointing
│   │   ├── devices.py        # DHCP clients (Starlink router)
│   │   ├── wifi.py           # WAN / network details
│   │   └── alerts.py         # Alert flag parser
│   └── routers/
│       ├── health.py         # GET /api/health
│       ├── status.py         # GET /api/status
│       ├── history.py        # GET /api/history
│       ├── diagnostics.py    # GET /api/diagnostics
│       ├── devices.py        # GET /api/devices  GET /api/wan
│       └── ws.py             # WS  /ws/live
└── frontend/
    ├── vite.config.js        # Dev proxy: /api/* → :8000
    ├── tailwind.config.js    # Brand colour tokens
    └── src/
        ├── App.jsx           # Shell + LiveContext + routing
        ├── hooks/
        │   ├── useLiveData.js  # WebSocket hook, 900-pt buffer, auto-reconnect
        │   ├── useApi.js       # REST polling hook
        │   ├── useAlertLog.js  # Alert history tracking (localStorage)
        │   └── useSettings.js  # Persistent settings (localStorage)
        ├── components/
        │   ├── Layout/         # Sidebar, Header
        │   ├── Cards/          # StatCard, AlertBanner
        │   ├── Charts/         # ThroughputChart, LatencyChart (Recharts)
        │   ├── ObstructionMap.jsx
        │   ├── SatelliteTracker.jsx
        │   ├── TempGauge.jsx
        │   ├── DeviceTable.jsx
        │   └── WanDetails.jsx
        └── pages/
            ├── Dashboard.jsx   # Stat cards, charts, obstruction map
            ├── Diagnostics.jsx # Large map, sat tracker, temp gauges
            ├── Devices.jsx     # Device table + WAN details
            ├── Alerts.jsx      # Active alerts + history log
            └── Settings.jsx    # Dish IP, poll interval, °C/°F
```

---

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Backend alive + dish reachability check |
| GET | `/api/status` | Current dish status snapshot |
| GET | `/api/history?last=900` | Rolling history buffer (max 900 points, 1 s each) |
| GET | `/api/diagnostics` | Obstruction map + pointing + temperatures |
| GET | `/api/devices` | Connected clients (requires Starlink router) |
| GET | `/api/wan` | WAN / network details (requires Starlink router) |
| WS | `/ws/live` | 1-second telemetry broadcast |

### WebSocket message shape

```json
{
  "timestamp":             1234567890,
  "download_mbps":         187.4,
  "upload_mbps":           23.1,
  "latency_ms":            28.0,
  "drop_rate_pct":         0.4,
  "uptime_s":              86400,
  "state":                 "CONNECTED",
  "is_obstructed":         false,
  "fraction_obstructed_pct": 1.2,
  "snr_above_floor":       true,
  "dish_temp_c":           43.0,
  "board_temp_c":          null,
  "direction_azimuth":     45.2,
  "direction_elevation":   67.8,
  "gps_ready":             true,
  "gps_sats":              8,
  "software_version":      "...",
  "hardware_version":      "...",
  "alerts":                []
}
```

---

## Dashboard pages

| Page | Route | What it shows |
|---|---|---|
| Dashboard | `/` | 6 stat cards, 15-min throughput + latency charts, compact obstruction map, WAN details |
| Diagnostics | `/diagnostics` | Full 260 px obstruction map, satellite tracker with trail, temperature arc gauges, GPS / SNR status |
| Devices | `/devices` | Sortable/filterable DHCP client table with OUI-based device icons, WAN details sidebar |
| Alerts | `/alerts` | Active alert cards + persistent history log with start time, duration, resolved badge |
| Settings | `/settings` | Dish IP, test connection, °C/°F toggle, poll interval |

---

## Connected devices and WAN details

Device and WAN data comes from the **Starlink mesh router** (a separate device),
not the dish itself.  These pages show "no data" if you:

- Use the dish in bypass mode with your own router, or
- Have a Gen 1 dish without a Starlink router

If you have a Starlink router, it is typically at `192.168.1.1:9000`.
The backend probes this address automatically.

---

## Troubleshooting

**`/api/health` returns `dish_reachable: false`**
- Confirm you're on the Starlink local network (ping `192.168.100.1`)
- Check that no firewall blocks port 9200

**Charts show no data**
- The dish must be powered on and reachable; the backend polls every 1 s
- Reload the page after a few seconds — the history buffer fills from live data

**"No signal data" on the obstruction map**
- The map endpoint makes a separate gRPC call with a 4 s timeout; if the dish
  is slow to respond, the map returns null and the dashboard shows the placeholder

**Raspberry Pi: `pip install` fails on `grpcio`**
- `grpcio` has arm64 wheels on PyPI for Python 3.11+; ensure you're not on
  a 32-bit Pi OS image
- If needed: `sudo apt install python3-grpcio` before running `start.sh`

**Port already in use**
```bash
# Linux / macOS / Pi
BACKEND_PORT=8001 FRONTEND_PORT=5174 ./start.sh
```
```powershell
# Windows
$env:BACKEND_PORT = '8001'; $env:FRONTEND_PORT = '5174'; .\start.ps1
```

**Windows: "running scripts is disabled"**
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

**Windows: `pip install grpcio` fails**  
- Ensure you have the [Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe) installed.  
- Or install a pre-built wheel: `pip install grpcio --only-binary=:all:`

**Windows: backend window closes immediately**  
Open a terminal, `cd` into the repo, and run `.\start.ps1` manually so you
can read any error messages before the window closes.
