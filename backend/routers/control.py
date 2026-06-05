"""Dish control endpoints — reboot, stow, unstow."""

import asyncio
import logging

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
