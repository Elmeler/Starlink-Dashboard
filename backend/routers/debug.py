"""Diagnostic endpoints — not mounted in production (SERVE_STATIC=1)."""

import asyncio
import logging

import starlink_grpc
from fastapi import APIRouter, HTTPException

from dish import telemetry

router = APIRouter()
logger = logging.getLogger(__name__)


_SCALAR = (bool, int, float, str, type(None))


def _scalar(val):
    """Convert val to something JSON-safe."""
    if isinstance(val, _SCALAR):
        return val
    if isinstance(val, bytes):
        return val.hex()
    return str(val)


def _walk(msg, depth=0) -> dict:
    if msg is None or depth > 3:
        return {}
    out = {}
    try:
        fields = msg.DESCRIPTOR.fields
    except AttributeError:
        return {"_raw": str(msg)[:200]}
    for field in fields:
        try:
            val = getattr(msg, field.name, None)
            if val is None:
                out[field.name] = None
            elif hasattr(val, "DESCRIPTOR"):
                # nested message
                out[field.name] = _walk(val, depth + 1)
            elif hasattr(val, "__len__") and not isinstance(val, (str, bytes)):
                # repeated field — show up to 5 items, scalars only
                out[field.name] = [_scalar(v) for v in list(val)[:5]]
            else:
                out[field.name] = _scalar(val)
        except Exception as exc:
            out[field.name] = f"<error: {exc}>"
    return out


@router.get("/debug/location")
async def debug_location():
    """Raw get_location response — shows exactly what the dish returns."""
    try:
        raw = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: starlink_grpc.get_location(context=telemetry.get_context()),
        )
        return _walk(raw)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/debug/wan")
async def debug_wan(router_address: str = "192.168.1.1:9000"):
    """
    Step 1: list every field on the router Request message.
    Step 2: try each field that looks network/WAN related and dump its response.
    """
    import grpc
    import yagrc.reflector as reflector

    try:
        with grpc.insecure_channel(router_address) as channel:
            future = grpc.channel_ready_future(channel)
            future.result(timeout=2)

            grclient = reflector.GrpcReflectionClient()
            grclient.load_protocols(channel, symbols=["SpaceX.API.Device.Device"])
            DeviceStub = grclient.service_stub_class("SpaceX.API.Device.Device")
            Request    = grclient.message_class("SpaceX.API.Device.Request")
            stub       = DeviceStub(channel)

            # List every field on the Request message
            all_request_fields = [f.name for f in Request.DESCRIPTOR.fields]

            # Try the ones that look relevant
            keywords = ("network", "wan", "wifi", "status", "ip", "dns", "dhcp", "diag")
            candidates = [
                f for f in all_request_fields
                if any(k in f.lower() for k in keywords)
            ]

            results = {}
            for req_name in candidates:
                try:
                    resp = stub.Handle(Request(**{req_name: {}}), timeout=5)
                    inner = getattr(resp, req_name, None)
                    results[req_name] = _walk(inner) if inner is not None else None
                except Exception as exc:
                    results[req_name] = f"<error: {exc}>"

        return {
            "all_request_fields": all_request_fields,
            "network_related_responses": results,
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/debug/devices")
async def debug_devices(router_address: str = "192.168.1.1:9000"):
    """
    Dump every field on the first wifi client returned by the router so
    we can see which field name actually holds the IP address.
    """
    import grpc
    import yagrc.reflector as reflector

    try:
        with grpc.insecure_channel(router_address) as channel:
            future = grpc.channel_ready_future(channel)
            future.result(timeout=2)

            grclient = reflector.GrpcReflectionClient()
            grclient.load_protocols(channel, symbols=["SpaceX.API.Device.Device"])
            DeviceStub = grclient.service_stub_class("SpaceX.API.Device.Device")
            Request    = grclient.message_class("SpaceX.API.Device.Request")

            stub = DeviceStub(channel)
            response = stub.Handle(Request(wifi_get_clients={}), timeout=5)
            clients_resp = getattr(response, "wifi_get_clients", None)
            clients = list(getattr(clients_resp, "clients", []) or [])

        if not clients:
            return {"clients_found": 0}

        return {
            "clients_found": len(clients),
            "first_client_fields": _walk(clients[0]),
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/debug/temps")
async def debug_temps():
    """
    Dump every field in the raw DishGetStatusResponse so we can find
    where temperature data lives on this specific firmware version.
    """
    try:
        raw = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: starlink_grpc.get_status(context=telemetry.get_context()),
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return _walk(raw)
