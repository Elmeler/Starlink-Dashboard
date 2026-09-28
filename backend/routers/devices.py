import time
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from dish.devices import get_connected_devices
from dish.wifi import get_wan_details, get_wifi_status, set_wifi_band, set_wifi_network

router = APIRouter()

_WAN_TTL     = 30
_DEVICES_TTL = 20
_WIFI_TTL    = 15

_wan_cache:     dict[str, tuple[float, dict]] = {}
_devices_cache: dict[str, tuple[float, list]] = {}
_wifi_cache:    dict[str, tuple[float, dict]] = {}


@router.get("/devices")
def devices(router_address: str = Query(default="192.168.1.1:9000")):
    """Connected devices (DHCP clients) from the Starlink router."""
    now = time.monotonic()
    cached = _devices_cache.get(router_address)
    if cached and now - cached[0] < _DEVICES_TTL:
        result = cached[1]
    else:
        result = get_connected_devices(router_address=router_address)
        _devices_cache[router_address] = (now, result)

    return {
        "router_address": router_address,
        "devices": result,
    }


@router.get("/wan")
def wan(router_address: str = Query(default="192.168.1.1:9000")):
    """WAN / network details from the Starlink router."""
    now = time.monotonic()
    cached = _wan_cache.get(router_address)
    if cached and now - cached[0] < _WAN_TTL:
        return cached[1]

    result = get_wan_details(router_address=router_address)
    _wan_cache[router_address] = (now, result)
    return result


@router.get("/wifi")
def wifi(router_address: str = Query(default="192.168.1.1:9000")):
    """WiFi network status — per-BSS enabled/disabled, SSID, auth type. No passwords."""
    now = time.monotonic()
    cached = _wifi_cache.get(router_address)
    if cached and now - cached[0] < _WIFI_TTL:
        return cached[1]

    result = get_wifi_status(router_address=router_address)
    _wifi_cache[router_address] = (now, result)
    return result


class BandToggle(BaseModel):
    band_id: int          # 2 = 2.4 GHz, 5 = 5 GHz
    enable: bool
    router_address: str = "192.168.1.1:9000"


@router.post("/wifi/band")
def wifi_band(body: BandToggle):
    """Enable or disable a WiFi band (2.4 GHz or 5 GHz)."""
    try:
        set_wifi_band(body.band_id, body.enable, router_address=body.router_address)
        _wifi_cache.pop(body.router_address, None)
        return {"ok": True}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


class NetworkUpdate(BaseModel):
    iface: str
    ssid: str | None = None
    password: str | None = None
    router_address: str = "192.168.1.1:9000"


@router.post("/wifi/network")
def wifi_network(body: NetworkUpdate):
    """Change SSID and/or password for one BSS (identified by iface_name)."""
    if body.ssid is not None and not body.ssid.strip():
        raise HTTPException(status_code=400, detail="SSID cannot be empty")
    if body.password is not None and len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    try:
        set_wifi_network(
            body.iface,
            ssid=body.ssid.strip() if body.ssid else None,
            password=body.password,
            router_address=body.router_address,
        )
        _wifi_cache.pop(body.router_address, None)
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
