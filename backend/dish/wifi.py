"""
WAN and WiFi details from the Starlink router (192.168.1.1:9000).

Data sources:
  get_network_interfaces  — WAN IP (eth1 / mac_wan), IPv6
  wifi_get_config         — DNS servers, SSID, router hw/sw version, per-BSS WiFi status
  wifi_set_config         — enable/disable bands, change SSID, set new password
"""

import logging
from typing import Optional

import grpc

logger = logging.getLogger(__name__)

# band integer → human label
_BAND_NAME = {2: '2.4GHz', 5: '5GHz', 6: '5GHz High'}

ROUTER_ADDRESS = "192.168.1.1:9000"


def get_wan_details(router_address: str = ROUTER_ADDRESS) -> dict:
    try:
        import yagrc.reflector as reflector

        with grpc.insecure_channel(router_address) as channel:
            future = grpc.channel_ready_future(channel)
            future.result(timeout=2)

            grclient = reflector.GrpcReflectionClient()
            grclient.load_protocols(channel, symbols=["SpaceX.API.Device.Device"])
            DeviceStub = grclient.service_stub_class("SpaceX.API.Device.Device")
            Request    = grclient.message_class("SpaceX.API.Device.Request")
            stub       = DeviceStub(channel)

            ifaces: list = []
            try:
                ifaces_resp = stub.Handle(Request(get_network_interfaces={}), timeout=5)
                ifaces = list(
                    getattr(getattr(ifaces_resp, "get_network_interfaces", None),
                            "network_interfaces", []) or []
                )
            except Exception as exc:
                logger.debug("get_network_interfaces unavailable: %s", exc)

            wifi_cfg = None
            try:
                cfg_resp = stub.Handle(Request(wifi_get_config={}), timeout=5)
                wifi_cfg = getattr(
                    getattr(cfg_resp, "wifi_get_config", None), "wifi_config", None
                )
            except Exception as exc:
                logger.debug("wifi_get_config unavailable: %s", exc)

        return _parse_wan(ifaces, wifi_cfg)

    except Exception as exc:
        logger.debug("WAN details unavailable (no Starlink router?): %s", exc)
        return _empty_wan()


def _parse_wan(ifaces, wifi_cfg) -> dict:
    wan_ip    = None
    ipv6_addr = None

    # Identify the WAN interface by matching mac_wan from config, or by
    # having a routable IPv4 address (Starlink CGNAT is 100.x.x.x/10)
    wan_mac = _str(getattr(wifi_cfg, "mac_wan", None)) if wifi_cfg else None

    for iface in ifaces:
        mac       = _str(getattr(iface, "mac_address", None))
        ipv4_list = list(getattr(iface, "ipv4_addresses", []) or [])
        ipv6_list = list(getattr(iface, "ipv6_addresses", []) or [])

        is_wan = bool(
            (wan_mac and mac and mac.lower() == wan_mac.lower())
            or any(_is_routable_v4(str(a)) for a in ipv4_list)
        )
        if not is_wan:
            continue

        if ipv4_list:
            wan_ip = str(ipv4_list[0]).split("/")[0]

        for addr in ipv6_list:
            s = str(addr).split("/")[0]
            if not s.lower().startswith("fe80"):
                ipv6_addr = s
                break
        break

    # DNS nameservers
    dns_servers: list[str] = []
    if wifi_cfg:
        dns_servers = [str(ns) for ns in (getattr(wifi_cfg, "nameservers", []) or []) if str(ns).strip()]

    # NAT type: infer from WAN IP range
    nat_type: Optional[str] = None
    if wan_ip:
        nat_type = "CGNAT" if _is_cgnat(wan_ip) else "Public"

    # SSID: first SSIDs from the first network entry
    ssids: list[str] = []
    if wifi_cfg:
        for net in list(getattr(wifi_cfg, "networks", []) or [])[:1]:
            for bss in list(getattr(net, "basic_service_sets", []) or []):
                s = _str(getattr(bss, "ssid", None))
                if s and s not in ssids:
                    ssids.append(s)

    # Router version from boot info
    router_sw: Optional[str] = None
    if wifi_cfg:
        boot = getattr(wifi_cfg, "boot", None)
        if boot:
            router_sw = _str(getattr(boot, "even_side_software_version", None)) \
                     or _str(getattr(boot, "odd_side_software_version",  None))

    return {
        "wan_ip":       wan_ip,
        "ipv6_address": ipv6_addr,
        "dns_servers":  dns_servers,
        "nat_type":     nat_type,
        "ssid":         ssids[0] if ssids else None,
        "router_sw":    router_sw,
    }


def _is_routable_v4(addr: str) -> bool:
    ip = addr.split("/")[0]
    # Starlink CGNAT (100.64.0.0/10) or any other non-private routable range
    return ip.startswith("100.") or (
        not ip.startswith("192.168.")
        and not ip.startswith("10.")
        and not ip.startswith("172.")
        and not ip.startswith("127.")
        and not ip.startswith("169.254.")
        and bool(ip)
    )


def _is_cgnat(ip: str) -> bool:
    # 100.64.0.0/10 — Starlink's CGNAT range (second octet 64-127)
    try:
        parts = [int(x) for x in ip.split(".")]
        return parts[0] == 100 and 64 <= parts[1] <= 127
    except Exception:
        return False


def _empty_wan() -> dict:
    return {
        "wan_ip":       None,
        "ipv6_address": None,
        "dns_servers":  [],
        "nat_type":     None,
        "ssid":         None,
        "router_sw":    None,
    }


def _str(value) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


# ── WiFi status (read-only, no passwords) ─────────────────────────────────────

def get_wifi_status(router_address: str = ROUTER_ADDRESS) -> dict:
    """Return per-BSS WiFi status and band enable flags. Passwords are never included."""
    try:
        import yagrc.reflector as reflector

        with grpc.insecure_channel(router_address) as channel:
            future = grpc.channel_ready_future(channel)
            future.result(timeout=2)

            gc = reflector.GrpcReflectionClient()
            gc.load_protocols(channel, symbols=["SpaceX.API.Device.Device"])
            DeviceStub = gc.service_stub_class("SpaceX.API.Device.Device")
            Request    = gc.message_class("SpaceX.API.Device.Request")
            stub       = DeviceStub(channel)

            resp = stub.Handle(Request(wifi_get_config={}), timeout=5)
            cfg  = resp.wifi_get_config.wifi_config

            networks = []
            for net in list(cfg.networks or []):
                for bss in list(net.basic_service_sets or []):
                    band_val  = int(getattr(bss, 'band', 0))
                    auth_type = _bss_auth_type(bss)
                    networks.append({
                        'ssid':      _str(bss.ssid),
                        'band':      _BAND_NAME.get(band_val, f'RF_{band_val}'),
                        'band_id':   band_val,
                        'iface':     _str(bss.iface_name),
                        'enabled':   not bool(getattr(bss, 'disable', False)),
                        'hidden':    bool(getattr(bss, 'hidden', False)),
                        'auth_type': auth_type,
                        'guest':     bool(net.guest),
                    })

            return {
                'networks':     networks,
                'disable_2ghz': bool(cfg.disable_2ghz),
                'disable_5ghz': bool(cfg.disable_5ghz),
                'bypass_mode':  bool(cfg.bypass_mode),
            }

    except Exception as exc:
        logger.debug("WiFi status unavailable: %s", exc)
        return {'networks': [], 'disable_2ghz': None, 'disable_5ghz': None, 'bypass_mode': None}


def _bss_auth_type(bss) -> str:
    """Return the active auth type label for a BSS proto message."""
    # A non-empty (masked) password string means that auth type is active.
    for field, label in [('auth_wpa3', 'WPA3'), ('auth_wpa2_wpa3', 'WPA2/WPA3'), ('auth_wpa2', 'WPA2')]:
        auth = getattr(bss, field, None)
        if auth and getattr(auth, 'password', ''):
            return label
    return 'Open'


# ── WiFi write operations ──────────────────────────────────────────────────────

def _open_router(router_address: str):
    """Return (channel, stub, Request, metadata) — caller must close the channel.

    Attempts management_login with empty credentials to acquire an auth token.
    Starlink routers require this token as gRPC metadata for all write operations
    (wifi_set_config, etc.).  Read operations work without it.
    """
    import yagrc.reflector as reflector

    channel = grpc.insecure_channel(router_address)
    try:
        grpc.channel_ready_future(channel).result(timeout=2)
        gc = reflector.GrpcReflectionClient()
        gc.load_protocols(channel, symbols=["SpaceX.API.Device.Device"])
        stub    = gc.service_stub_class("SpaceX.API.Device.Device")(channel)
        Request = gc.message_class("SpaceX.API.Device.Request")

        metadata: list[tuple[str, str]] = []
        try:
            login_resp = stub.Handle(
                Request(management_login={"name": "", "password": ""}),
                timeout=5,
            )
            token = getattr(getattr(login_resp, "management_login", None), "token", "")
            if token:
                metadata = [("token", token)]
                logger.debug("management_login succeeded")
        except Exception as exc:
            logger.debug("management_login skipped: %s", exc)

        return channel, stub, Request, metadata
    except Exception:
        channel.close()
        raise


def set_wifi_band(band_id: int, enable: bool, router_address: str = ROUTER_ADDRESS) -> None:
    """Enable or disable a WiFi band. band_id: 2 = 2.4 GHz, 5 = 5 GHz."""
    channel, stub, Request, meta = _open_router(router_address)
    try:
        cfg = stub.Handle(Request(wifi_get_config={}), timeout=5, metadata=meta).wifi_get_config.wifi_config

        if band_id == 2:
            cfg.disable_2ghz       = not enable
            cfg.apply_disable_2ghz = True
        elif band_id == 5:
            cfg.disable_5ghz       = not enable
            cfg.apply_disable_5ghz = True
        else:
            raise ValueError(f"Unsupported band_id: {band_id}")

        stub.Handle(Request(wifi_set_config={"wifi_config": cfg}), timeout=10, metadata=meta)
    finally:
        channel.close()


def set_wifi_network(iface: str, ssid: Optional[str] = None, password: Optional[str] = None,
                     router_address: str = ROUTER_ADDRESS) -> None:
    """Change SSID and/or password for the BSS identified by iface_name.

    Handles both updating an existing secured network and transitioning an Open
    network to WPA3 (or WPA2 if WPA3 is not available on this BSS).
    Password must be at least 8 characters when provided.
    """
    channel, stub, Request, meta = _open_router(router_address)
    try:
        cfg     = stub.Handle(Request(wifi_get_config={}), timeout=5, metadata=meta).wifi_get_config.wifi_config
        updated = False

        for net in list(cfg.networks or []):
            for bss in list(net.basic_service_sets or []):
                if bss.iface_name != iface:
                    continue
                if ssid is not None:
                    bss.ssid = ssid
                if password is not None:
                    _set_bss_password(bss, password)
                updated = True
                break
            if updated:
                break

        if not updated:
            raise ValueError(f"Interface {iface!r} not found in WiFi config")

        cfg.apply_networks = True
        stub.Handle(Request(wifi_set_config={"wifi_config": cfg}), timeout=10, metadata=meta)
    finally:
        channel.close()


def _set_bss_password(bss, password: str) -> None:
    """Set the password on a BSS proto message.

    Prefers WPA3 > WPA2/WPA3 > WPA2.  If the network is currently Open (no
    auth field has a non-empty password), the password is set on the first
    available auth type to transition the network from Open to WPA.
    """
    # Preferred auth order: WPA3 first (most secure), then mixed, then WPA2
    auth_fields = ('auth_wpa3', 'auth_wpa2_wpa3', 'auth_wpa2')

    # Pass 1: update whichever auth type is already active (has a password)
    for field in auth_fields:
        auth = getattr(bss, field, None)
        if auth is not None and getattr(auth, 'password', ''):
            auth.password = password
            return

    # Pass 2: network is Open — set password on the first available auth type
    # to transition from Open to WPA
    for field in auth_fields:
        auth = getattr(bss, field, None)
        if auth is not None:
            auth.password = password
            return

    logger.warning("Could not find any auth field on BSS %s to set password", getattr(bss, 'iface_name', '?'))
