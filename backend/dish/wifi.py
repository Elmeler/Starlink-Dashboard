"""
WAN and WiFi details from the Starlink router (192.168.1.1:9000).

Data sources:
  get_network_interfaces  — WAN IP (eth1 / mac_wan), IPv6
  wifi_get_config         — DNS servers, SSID, router hw/sw version
"""

import logging
from typing import Optional

import grpc

logger = logging.getLogger(__name__)

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
