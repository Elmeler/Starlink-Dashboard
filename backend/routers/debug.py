"""Diagnostic endpoints — not mounted in production (SERVE_STATIC=1)."""

import asyncio
import logging

import starlink_grpc
from fastapi import APIRouter, HTTPException

from dish import telemetry

router = APIRouter()
logger = logging.getLogger(__name__)


def _describe(msg) -> dict:
    """Return all field names and values from a protobuf message."""
    if msg is None:
        return {}
    try:
        return {f.name: getattr(msg, f.name, None) for f in msg.DESCRIPTOR.fields}
    except AttributeError:
        return {"error": "DESCRIPTOR not available on this object"}


@router.get("/debug/temps")
async def debug_temps():
    """
    Dump every field in dish_thermal_control (and device_state temperature
    fields) so you can see which field names your firmware actually uses.
    """
    try:
        raw = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: starlink_grpc.get_status(context=telemetry.get_context()),
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    result = {}

    thermal = getattr(raw, "dish_thermal_control", None)
    result["dish_thermal_control_present"] = thermal is not None
    result["dish_thermal_control_fields"]  = _describe(thermal)

    state = getattr(raw, "device_state", None)
    if state is not None:
        all_state = _describe(state)
        result["device_state_temp_fields"] = {
            k: v for k, v in all_state.items() if "temp" in k.lower()
        }

    return result
