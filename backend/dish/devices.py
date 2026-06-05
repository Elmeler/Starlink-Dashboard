"""
Connected device and DHCP lease data.

Like WAN details, this data lives on the Starlink router (not the dish).
Returns an empty list when the router is unreachable.
"""

import logging

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
            return [_parse_client(c) for c in clients]

    except Exception as exc:
        logger.debug("Device list unavailable (no Starlink router?): %s", exc)
        return []


def _parse_client(client) -> dict:
    import time

    signal    = getattr(client, "signal_strength", None)
    iface_name = _str(getattr(client, "iface_name", None))
    iface_enum = getattr(client, "iface", None)
    band       = _map_band(iface_name, iface_enum)

    secs_left = getattr(client, "seconds_until_dhcp_lease_expires", None)
    lease     = (int(time.time() + float(secs_left))
                 if secs_left and float(secs_left) > 0 else None)

    rx = getattr(client, "rx_stats", None)
    tx = getattr(client, "tx_stats", None)

    return {
        "hostname":     _str(getattr(client, "name", None)) or "Unknown",
        "mac":          _str(getattr(client, "mac_address", None)),
        "ip":           _str(getattr(client, "ip_address", None)),
        "band":         band,
        "signal_dbm":   _safe_float(signal),
        "snr":          _safe_float(getattr(client, "snr", None)),
        "lease_expiry": lease,
        "active":       bool(getattr(client, "active", False)),
        "rx_mbps":      _safe_float(getattr(rx, "rate_mbps_last_15s", None)),
        "tx_mbps":      _safe_float(getattr(tx, "rate_mbps_last_15s", None)),
        "upload_mb":    _safe_float(getattr(client, "upload_mb",   None)),
        "download_mb":  _safe_float(getattr(client, "download_mb", None)),
    }


def _safe_float(value) -> float | None:
    try:
        v = float(value)
        return round(v, 2) if v != 0.0 else None
    except (TypeError, ValueError):
        return None


def _map_band(iface_name: str, iface_enum=None) -> str:
    # iface_name (e.g. "ra0", "rax0") is most reliable when present
    n = (iface_name or "").lower()
    if n:
        if "eth" in n or "lan" in n:
            return "wired"
        if "rax" in n or "5g" in n:   # rax0 = 5 GHz
            return "5GHz"
        if "ra" in n:                  # ra0, ra1, ra2 = 2.4 GHz
            return "2.4GHz"

    # Fall back to the iface enum value (yagrc returns it as an int;
    # str() on a proto enum gives its integer value, not its name, so
    # we look it up via the DESCRIPTOR if available)
    if iface_enum is not None:
        try:
            enum_name = iface_enum.DESCRIPTOR.name  # e.g. "ETH", "RF_2GHZ"
        except AttributeError:
            try:
                # EnumValueDescriptor path used by some yagrc versions
                desc = type(iface_enum).DESCRIPTOR
                enum_name = desc.values_by_number[int(iface_enum)].name
            except Exception:
                enum_name = str(iface_enum)
        s = enum_name.upper()
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
