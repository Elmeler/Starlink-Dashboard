from fastapi import APIRouter, Query
from dish import telemetry, store

router = APIRouter()


@router.get("/history")
def get_history(
    last:  int = Query(default=900, ge=1,  le=900),
    hours: int = Query(default=0,   ge=0,  le=168),
):
    """
    History data.

    Without `hours`: returns the in-memory rolling buffer (last 900 s).
    With `hours=N`:  returns the last N hours from the persistent SQLite DB,
                     time-bucketed to ~720 points regardless of window size.
    """
    if hours > 0:
        points = store.read_range(hours=hours)
        return {"samples": len(points), "data": points}
    points = telemetry.get_history()
    return {"samples": len(points), "data": points[-last:]}
