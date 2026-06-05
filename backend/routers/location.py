"""GPS location endpoint."""

import asyncio
import logging
from typing import Optional

import grpc
import starlink_grpc
from fastapi import APIRouter

from dish import telemetry

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/location")
async def get_location_endpoint():
    """
    Return the dish GPS position plus diagnostic context.

    Fields:
      enabled       — True when coordinates were successfully obtained
      latitude/longitude/altitude — coordinates, or null
      gps_valid     — whether the dish GPS hardware has a satellite fix
      gps_sats      — number of GPS satellites in use
      gps_enabled   — whether inhibit_gps is False (i.e. GPS is not blocked)
      reason        — why coordinates are null:
                        PERMISSION_DENIED  the dish requires Starlink-app authorisation
                        NO_FIX             GPS hardware is working but has no position yet
                        GPS_NOT_VALID      GPS hardware is not ready
                        GRPC_ERROR         unexpected gRPC transport error
    """
    current    = telemetry.get_current()
    gps_valid  = current.get("gps_ready")
    gps_sats   = current.get("gps_sats")
    gps_enabled = current.get("gps_enabled")

    lat: Optional[float] = None
    lon: Optional[float] = None
    alt: Optional[float] = None
    reason: Optional[str] = None

    if gps_valid is False:
        reason = "GPS_NOT_VALID"
    else:
        try:
            raw_loc = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: starlink_grpc.get_location(context=telemetry.get_context()),
            )
            try:
                raw_lat = float(raw_loc.lla.lat)
                raw_lon = float(raw_loc.lla.lon)
                raw_alt = float(getattr(raw_loc.lla, "alt", 0) or 0)
                if raw_lat == 0.0 and raw_lon == 0.0:
                    reason = "NO_FIX"
                else:
                    lat = round(raw_lat, 6)
                    lon = round(raw_lon, 6)
                    alt = round(raw_alt, 1)
            except (AttributeError, TypeError, ValueError):
                reason = "NO_FIX"
        except grpc.RpcError as exc:
            code = exc.code() if isinstance(exc, grpc.Call) else None
            if code is grpc.StatusCode.PERMISSION_DENIED:
                reason = "PERMISSION_DENIED"
                logger.debug("GPS location: PERMISSION_DENIED — app authorisation required")
            else:
                reason = "GRPC_ERROR"
                logger.warning("GPS location gRPC error: %s", exc)
        except starlink_grpc.GrpcError as exc:
            reason = "GRPC_ERROR"
            logger.warning("GPS location error: %s", exc)
        except Exception as exc:
            reason = "GRPC_ERROR"
            logger.warning("GPS location unexpected error: %s", exc)

    return {
        "enabled":      lat is not None,
        "latitude":     lat,
        "longitude":    lon,
        "altitude":     alt,
        "gps_valid":    gps_valid,
        "gps_sats":     gps_sats,
        "gps_enabled":  gps_enabled,
        "reason":       reason,
    }
