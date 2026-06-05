"""GPS location endpoint."""

import asyncio
import logging

import grpc
import starlink_grpc
from fastapi import APIRouter, HTTPException

from dish import telemetry

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/location")
async def get_location():
    """
    Return the dish GPS position.

    When GPS access has not been authorised on the dish, all coordinate
    fields are null and `enabled` is False — the caller should prompt the
    user to enable GPS in the Starlink app or via POST /api/control/gps/enable.
    """
    try:
        data = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: starlink_grpc.location_data(context=telemetry.get_context()),
        )
    except starlink_grpc.GrpcError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    lat = data.get("latitude")
    lon = data.get("longitude")
    alt = data.get("altitude")
    return {
        "enabled":   lat is not None,
        "latitude":  round(lat, 6) if lat is not None else None,
        "longitude": round(lon, 6) if lon is not None else None,
        "altitude":  round(alt, 1) if alt is not None else None,
    }
