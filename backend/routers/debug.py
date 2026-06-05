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
