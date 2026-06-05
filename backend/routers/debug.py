"""Diagnostic endpoints — not mounted in production (SERVE_STATIC=1)."""

import asyncio
import logging

import starlink_grpc
from fastapi import APIRouter, HTTPException

from dish import telemetry

router = APIRouter()
logger = logging.getLogger(__name__)


def _walk(msg, depth=0) -> dict:
    """
    Recursively dump a protobuf message into a plain dict.
    Sub-messages are expanded one level; scalars are returned as-is.
    Stops at depth 3 to avoid unbounded recursion on repeated fields.
    """
    if msg is None or depth > 3:
        return {}
    try:
        out = {}
        for field in msg.DESCRIPTOR.fields:
            val = getattr(msg, field.name, None)
            # Sub-message: recurse
            if hasattr(val, "DESCRIPTOR"):
                out[field.name] = _walk(val, depth + 1)
            # Repeated field: summarise as list of first few
            elif hasattr(val, "__iter__") and not isinstance(val, (str, bytes)):
                items = list(val)[:5]
                out[field.name] = items if items else []
            else:
                out[field.name] = val
        return out
    except AttributeError:
        return {"_raw": str(msg)}


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
