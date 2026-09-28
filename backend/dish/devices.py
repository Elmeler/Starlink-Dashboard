"""
Connected device and DHCP lease data.

Like WAN details, this data lives on the Starlink router (not the dish).
Returns an empty list when the router is unreachable.
"""

import concurrent.futures
import logging
import socket

_dns_pool = concurrent.futures.ThreadPoolExecutor(max_workers=32, thread_name_prefix="dns")

import grpc

logger = logging.getLogger(__name__)

ROUTER_ADDRESS = "192.168.1.1:9000"


def get_connected_devices(router_address: str = ROUTER_ADDRESS) -> list[dict]:
    """
    Attempt to pull DHCP/client list from a Starlink router.
    Returns a list of device dicts with keys:
      hostname, mac, ip, band, signal_dbm, lease_expiry
    """
    try:
        import yagrc.reflector as reflector

        with grpc.insecure_channel(router_address) as channel:
            future = grpc.channel_ready_future(channel)
            future.result(timeout=2)

            grclient = reflector.GrpcReflectionClient()
            grclient.load_protocols(channel, symbols=["SpaceX.API.Device.Device"])
            DeviceStub = grclient.service_stub_class("SpaceX.API.Device.Device")
            Request = grclient.message_class("SpaceX.API.Device.Request")

            stub = DeviceStub(channel)
            response = stub.Handle(Request(wifi_get_clients={}), timeout=5)
            clients_resp = getattr(response, "wifi_get_clients", None)

            if clients_resp is None:
                return []

            clients = getattr(clients_resp, "clients", []) or []
            return _resolve_hostnames([_parse_client(c) for c in clients])

    except Exception as exc:
        logger.debug("Device list unavailable (no Starlink router?): %s", exc)
        return []


def _parse_client(client) -> dict:
    import time

    signal    = getattr(client, "signal_strength", None)
    iface_name      = _str(getattr(client, "iface_name", None))
    iface_enum_name = _iface_enum_name(client)
    band            = _map_band(iface_name, iface_enum_name)

    secs_left = getattr(client, "seconds_until_dhcp_lease_expires", None)
    lease     = (int(time.time() + float(secs_left))
                 if secs_left and float(secs_left) > 0 else None)

    rx = getattr(client, "rx_stats", None)
    tx = getattr(client, "tx_stats", None)

    is_wired = band == "wired"
    return {
        "hostname":     _str(getattr(client, "name", None)) or "Unknown",
        "mac":          _str(getattr(client, "mac_address", None)),
        "ip":           _str(getattr(client, "ip_address", None)),
        "band":         band,
        # WiFi-only metrics — null for wired connections
        "signal_dbm":   None if is_wired else _safe_float(signal),
        "snr":          None if is_wired else _safe_float(getattr(client, "snr", None)),
        "lease_expiry": lease,
        "active":       bool(getattr(client, "active", False)),
        "rx_mbps":      _safe_float(getattr(rx, "rate_mbps_last_15s", None)),
        "tx_mbps":      _safe_float(getattr(tx, "rate_mbps_last_15s", None)),
        "upload_mb":    _safe_float(getattr(client, "upload_mb",   None)),
        "download_mb":  _safe_float(getattr(client, "download_mb", None)),
    }


def _resolve_hostnames(devices: list[dict], timeout: float = 0.4) -> list[dict]:
    """Reverse-DNS lookup for devices whose hostname is still 'Unknown'.
    Runs lookups in parallel; gives up after `timeout` seconds."""
    candidates = [
        (i, d["ip"]) for i, d in enumerate(devices)
        if d.get("ip") and d.get("hostname") == "Unknown"
    ]
    if not candidates:
        return devices

    def lookup(ip: str) -> str | None:
        try:
            name, _, _ = socket.gethostbyaddr(ip)
            return name
        except OSError:
            return None

    fmap = {_dns_pool.submit(lookup, ip): i for i, ip in candidates}
    done, _ = concurrent.futures.wait(fmap, timeout=timeout)
    for fut in done:
        idx = fmap[fut]
        name = fut.result()
        if name:
            devices[idx] = {**devices[idx], "hostname": name}

    return devices


def _safe_float(value) -> float | None:
    if value is None:
        return None
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return None


def _iface_enum_name(client) -> str:
    """
    Return the string name of the iface enum (e.g. 'ETH', 'RF_2GHZ').
    yagrc returns enum fields as integers; the name lives on the field
    descriptor, not on the integer value itself.
    """
    try:
        val        = int(getattr(client, "iface", 0))
        field_desc = client.DESCRIPTOR.fields_by_name["iface"]
        return field_desc.enum_type.values_by_number[val].name
    except Exception:
        return str(getattr(client, "iface", ""))


def _map_band(iface_name: str, iface_enum_name: str = "") -> str:
    # iface_name (e.g. "ra0", "rax0") is populated for Wi-Fi clients
    n = (iface_name or "").lower()
    if n:
        if "eth" in n or n.startswith("lan"):
            return "wired"
        if "rax" in n or "5g" in n:   # rax0 = 5 GHz radio
            return "5GHz"
        if "ra" in n:                  # ra0/ra1/ra2 = 2.4 GHz
            return "2.4GHz"

    # Fall back to the resolved enum name string
    s = (iface_enum_name or "").upper()
    if "ETH" in s:
        return "wired"
    if "5GHZ" in s or "5G" in s:
        return "5GHz"
    if "2GHZ" in s or "2G" in s or "RF" in s:
        return "2.4GHz"

    return "unknown"


def _str(value) -> str:
    if value is None:
        return ""
    return str(value).strip()
