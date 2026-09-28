from fastapi import APIRouter, Query
from dish import telemetry
from dish.client import dish_client

router = APIRouter()


@router.get("/health")
def health(live: bool = Query(default=False)):
    """
    Check backend health and dish reachability.

    By default returns the cached status from the telemetry poller (instant).
    Pass ?live=true to force a real gRPC probe (adds ~220ms, used by Settings
    "Test connection" button where fresh state is important).
    """
    if live:
        reachable = dish_client.probe()
        error     = dish_client.last_error
    else:
        reachable = telemetry._dish_ok
        error     = None if reachable else "Dish not responding to telemetry polls"

    return {
        "backend":        "ok",
        "dish_reachable": reachable,
        "dish_address":   dish_client.address,
        "error":          error,
    }
