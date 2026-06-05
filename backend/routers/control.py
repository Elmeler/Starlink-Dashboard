"""Dish control endpoints — reboot, stow, unstow, backend restart."""

import asyncio
import logging
import os
import sys

import grpc
import starlink_grpc
from fastapi import APIRouter, HTTPException

from dish import telemetry

router = APIRouter()
logger = logging.getLogger(__name__)


async def _run(fn):
    """Run a blocking gRPC call in the executor, surfacing errors as 503."""
    try:
        await asyncio.get_event_loop().run_in_executor(None, fn)
        return {"ok": True}
    except (starlink_grpc.GrpcError, grpc.RpcError, AttributeError, ValueError) as exc:
        logger.warning("dish control failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/control/reboot")
async def reboot():
    """Request a dish reboot. The dish will disconnect briefly."""
    logger.info("Dish reboot requested via UI")
    return await _run(lambda: starlink_grpc.reboot(context=telemetry.get_context()))


@router.post("/control/stow")
async def stow():
    """Move the dish to its stow (travel) position."""
    logger.info("Dish stow requested via UI")
    return await _run(lambda: starlink_grpc.set_stow_state(unstow=False, context=telemetry.get_context()))


@router.post("/control/unstow")
async def unstow():
    """Take the dish out of stow and resume normal operation."""
    logger.info("Dish unstow requested via UI")
    return await _run(lambda: starlink_grpc.set_stow_state(unstow=True, context=telemetry.get_context()))


@router.post("/control/restart-backend")
async def restart_backend():
    """
    Restart the backend process by re-executing it via os.execv.
    A short delay lets the HTTP response reach the client first.
    The frontend WebSocket will drop and reconnect automatically.
    """
    logger.info("Backend restart requested via UI")

    async def _restart():
        await asyncio.sleep(0.4)
        print("\n" + "─" * 60, flush=True)
        print("  Starlink Monitor  ·  restarting (requested via dashboard UI)", flush=True)
        print("─" * 60 + "\n", flush=True)
        # Pass restart reason through to the new process via env var
        os.environ["SLMONITOR_RESTART_REASON"] = "ui"
        # Re-run as "python -m uvicorn <args>" so Python doesn't add the
        # uvicorn package directory to sys.path[0], which would cause
        # uvicorn/logging.py to shadow stdlib logging (circular import).
        os.execv(sys.executable, [sys.executable, '-m', 'uvicorn'] + sys.argv[1:])

    asyncio.create_task(_restart())
    return {"ok": True}


@router.post("/control/gps/enable")
async def gps_enable():
    """Authorise the dish to report GPS location data."""
    logger.info("GPS enable requested via UI")
    try:
        enabled = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: starlink_grpc.set_gps_config(True, context=telemetry.get_context()),
        )
        return {"ok": True, "gps_enabled": enabled}
    except (starlink_grpc.GrpcError, grpc.RpcError, AttributeError, ValueError) as exc:
        logger.warning("GPS enable failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/control/gps/disable")
async def gps_disable():
    """Revoke GPS location reporting from the dish."""
    logger.info("GPS disable requested via UI")
    try:
        enabled = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: starlink_grpc.set_gps_config(False, context=telemetry.get_context()),
        )
        return {"ok": True, "gps_enabled": enabled}
    except (starlink_grpc.GrpcError, grpc.RpcError, AttributeError, ValueError) as exc:
        logger.warning("GPS disable failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))
