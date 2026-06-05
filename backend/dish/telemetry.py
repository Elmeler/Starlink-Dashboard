"""
Background polling engine.

Two asyncio tasks run continuously once start_polling() is called:
  - _poll_status()  : calls status_data() every STATUS_INTERVAL seconds
  - _poll_history() : calls history_bulk_data() every HISTORY_INTERVAL seconds

Results are stored in module-level state and consumed by REST routers
and the WebSocket broadcaster.
"""

import asyncio
import logging
import time
from collections import deque
from typing import Optional

import grpc
import starlink_grpc

from dish.alerts import parse_alerts
from dish import store

logger = logging.getLogger(__name__)

STATUS_INTERVAL  = 1   # seconds between GetStatus polls
HISTORY_INTERVAL = 5   # seconds between GetHistory polls
HISTORY_MAXLEN   = 900 # rolling buffer size (15 min at 1 sample/s)

# ── shared state (written by background tasks, read by routers/WS) ──────────

_context: Optional[starlink_grpc.ChannelContext] = None
_dish_address: str = "192.168.100.1:9200"

# Latest parsed status snapshot
_current: dict = {}

# Whether the last gRPC status fetch succeeded
_dish_ok: bool = False

# Rolling 900-point history deque; each entry is one second of data
_history: deque = deque(maxlen=HISTORY_MAXLEN)

# Raw history counters for incremental fetches
_history_end_counter: Optional[int] = None

# Callbacks registered by the WebSocket broadcaster
_ws_callbacks: list = []


# ── public API ───────────────────────────────────────────────────────────────

def configure(address: str) -> None:
    """Update the dish address and reset the gRPC context."""
    global _dish_address, _context
    _dish_address = address
    if _context is not None:
        _context.close()
    _context = starlink_grpc.ChannelContext(target=address)


def get_context():
    return _context


def get_current() -> dict:
    return dict(_current)


def get_history() -> list[dict]:
    return list(_history)


def register_ws_callback(cb) -> None:
    _ws_callbacks.append(cb)


def unregister_ws_callback(cb) -> None:
    try:
        _ws_callbacks.remove(cb)
    except ValueError:
        pass


async def start_polling(address: str = "192.168.100.1:9200") -> None:
    """Launch both polling tasks. Called once from FastAPI lifespan."""
    configure(address)
    asyncio.create_task(_poll_status(), name="poll_status")
    asyncio.create_task(_poll_history(), name="poll_history")
    logger.info("Telemetry polling started -> %s", address)


# ── background tasks ─────────────────────────────────────────────────────────

async def _poll_status() -> None:
    global _current, _dish_ok
    backoff = 1.0
    while True:
        try:
            snapshot = await asyncio.get_event_loop().run_in_executor(
                None, _fetch_status
            )
            snapshot["dish_connected"] = True
            _current = snapshot
            _dish_ok = True
            backoff = 1.0
            for cb in list(_ws_callbacks):
                try:
                    await cb(snapshot)
                except Exception:
                    pass
        except starlink_grpc.GrpcError as exc:
            logger.warning("status poll failed: %s (retry in %.0fs)", exc, backoff)
            _dish_ok = False
            # Broadcast the disconnected state so the UI updates immediately
            error_msg = {"dish_connected": False, "timestamp": int(time.time())}
            for cb in list(_ws_callbacks):
                try:
                    await cb(error_msg)
                except Exception:
                    pass
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60.0)
            continue
        await asyncio.sleep(STATUS_INTERVAL)


async def _poll_history() -> None:
    global _history_end_counter
    backoff = 1.0
    while True:
        try:
            points = await asyncio.get_event_loop().run_in_executor(
                None, _fetch_history
            )
            for pt in points:
                _history.append(pt)
            if points:
                store.write_points(points)
            backoff = 1.0
        except starlink_grpc.GrpcError as exc:
            logger.warning("history poll failed: %s (retry in %.0fs)", exc, backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60.0)
            continue
        await asyncio.sleep(HISTORY_INTERVAL)


# ── synchronous fetch helpers (run in executor) ───────────────────────────────

def _fetch_status() -> dict:
    global _context
    try:
        raw = starlink_grpc.get_status(context=_context)
        status, obstruction, alerts_raw = starlink_grpc.status_data(context=_context, status=raw)
    except (starlink_grpc.GrpcError, grpc.RpcError, AttributeError, ValueError) as exc:
        raise starlink_grpc.GrpcError(exc) from exc

    # temperatures live in the raw protobuf, not in the high-level dict
    dish_temp, board_temp = _read_temps(raw)

    active_alerts = parse_alerts(alerts_raw)

    return {
        "timestamp":       int(time.time()),
        "id":              status.get("id"),
        "hardware_version": status.get("hardware_version"),
        "software_version": status.get("software_version"),
        "state":           status.get("state"),
        "uptime_s":        status.get("uptime"),
        "download_mbps":   _bps_to_mbps(status.get("downlink_throughput_bps")),
        "upload_mbps":     _bps_to_mbps(status.get("uplink_throughput_bps")),
        "latency_ms":      _round(status.get("pop_ping_latency_ms")),
        "drop_rate_pct":   _round(_frac_to_pct(status.get("pop_ping_drop_rate")), 3),
        "is_obstructed":   status.get("currently_obstructed"),
        "fraction_obstructed_pct": _round(_frac_to_pct(status.get("fraction_obstructed")), 2),
        "snr_above_floor": status.get("is_snr_above_noise_floor"),
        "direction_azimuth":   status.get("direction_azimuth"),
        "direction_elevation": status.get("direction_elevation"),
        "gps_ready":       status.get("gps_ready"),
        "gps_sats":        status.get("gps_sats"),
        "dish_temp_c":     dish_temp,
        "board_temp_c":    board_temp,
        "alerts":          active_alerts,
    }


def _read_temps(raw) -> tuple[Optional[float], Optional[float]]:
    """
    Read dish and board temperatures from the raw protobuf response.
    Field paths vary by firmware generation; try all known names.
    Returns (dish_temp_c, board_temp_c) — either may be None.
    """
    dish_temp  = None
    board_temp = None
    try:
        # Gen3+: dish_thermal_control sub-message
        thermal = getattr(raw, "dish_thermal_control", None)
        if thermal is not None:
            dish_temp  = _safe_temp(getattr(thermal, "inlet_temp_celsius",   None))
            board_temp = _safe_temp(getattr(thermal, "outlet_temp_celsius",  None))
            # Older Gen3 / Gen2 field name variants
            if dish_temp is None:
                dish_temp  = _safe_temp(getattr(thermal, "rack_temp_celsius",   None))
            if dish_temp is None:
                dish_temp  = _safe_temp(getattr(thermal, "dish_temp_celsius",   None))
            if board_temp is None:
                board_temp = _safe_temp(getattr(thermal, "board_temp_celsius",  None))

        # Fallback: top-level device_state (older firmwares)
        if dish_temp is None:
            state = getattr(raw, "device_state", None)
            if state is not None:
                dish_temp = _safe_temp(getattr(state, "rack_temp_celsius", None))
    except Exception:
        pass

    return dish_temp, board_temp


def _safe_temp(value) -> Optional[float]:
    try:
        v = float(value)
        # Reject 0.0 (protobuf unset default), NaN, and physically impossible values
        return round(v, 1) if -100 < v < 200 and v != 0 else None
    except (TypeError, ValueError):
        return None


def _fetch_history() -> list[dict]:
    global _history_end_counter, _context
    try:
        general, bulk = starlink_grpc.history_bulk_data(
            -1,
            start=_history_end_counter,
            context=_context,
        )
    except (starlink_grpc.GrpcError, grpc.RpcError) as exc:
        raise starlink_grpc.GrpcError(exc) from exc

    _history_end_counter = general.get("end_counter")

    samples = general.get("samples", 0)
    if not samples:
        return []

    dl_bps   = bulk.get("downlink_throughput_bps", [])
    ul_bps   = bulk.get("uplink_throughput_bps",   [])
    latency  = bulk.get("pop_ping_latency_ms",      [])
    drop     = bulk.get("pop_ping_drop_rate",        [])
    power    = bulk.get("power_w",                   [])

    # end_counter is the counter value of the last sample; work backwards
    end_ts = int(time.time())
    points = []
    for i in range(samples):
        ts = end_ts - (samples - 1 - i)
        points.append({
            "timestamp":     ts,
            "download_mbps": _bps_to_mbps(_safe(dl_bps, i)),
            "upload_mbps":   _bps_to_mbps(_safe(ul_bps, i)),
            "latency_ms":    _round(_safe(latency, i)),
            "drop_rate_pct": _round(_frac_to_pct(_safe(drop, i)), 3),
            "power_w":       _round(_safe(power, i), 1),
        })
    return points


# ── small helpers ─────────────────────────────────────────────────────────────

def _bps_to_mbps(bps) -> Optional[float]:
    if bps is None:
        return None
    return round(float(bps) / 1_000_000, 2)


def _frac_to_pct(frac) -> Optional[float]:
    if frac is None:
        return None
    return float(frac) * 100.0


def _round(value, ndigits: int = 1) -> Optional[float]:
    if value is None:
        return None
    return round(float(value), ndigits)


def _safe(seq, i: int):
    try:
        return seq[i]
    except (IndexError, TypeError):
        return None
