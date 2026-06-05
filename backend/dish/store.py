"""SQLite-backed history persistence.

Points are written after every history poll and read back via read_range()
which buckets rows into a fixed number of time-averaged points so the
response size stays manageable regardless of the requested window.
"""

import logging
import pathlib
import sqlite3
import threading
import time
from typing import Optional

logger = logging.getLogger(__name__)

_DB_PATH = pathlib.Path(__file__).parent.parent / "history.db"
_conn: Optional[sqlite3.Connection] = None
_lock = threading.Lock()

_DDL = """
CREATE TABLE IF NOT EXISTS history (
    timestamp     INTEGER PRIMARY KEY,
    download_mbps REAL,
    upload_mbps   REAL,
    latency_ms    REAL,
    drop_rate_pct REAL,
    power_w       REAL
)
"""


def init(db_path: Optional[pathlib.Path] = None) -> None:
    global _conn, _DB_PATH
    if db_path is not None:
        _DB_PATH = db_path
    _conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    _conn.execute("PRAGMA journal_mode=WAL")
    _conn.execute(_DDL)
    _conn.commit()
    logger.info("History DB ready at %s", _DB_PATH)


def write_points(points: list) -> None:
    if not points or _conn is None:
        return
    rows = [
        (
            p.get("timestamp"),
            p.get("download_mbps"),
            p.get("upload_mbps"),
            p.get("latency_ms"),
            p.get("drop_rate_pct"),
            p.get("power_w"),
        )
        for p in points
        if p.get("timestamp") is not None
    ]
    if not rows:
        return
    with _lock:
        _conn.executemany("INSERT OR REPLACE INTO history VALUES (?,?,?,?,?,?)", rows)
        _conn.commit()


def read_range(hours: int = 1, target_points: int = 720) -> list:
    """Return up to ~target_points rows spanning the last `hours` hours.

    Rows are time-bucketed and averaged so the response size is bounded
    regardless of how much data is stored.
    """
    if _conn is None:
        return []
    since = int(time.time()) - hours * 3600
    step = max(1, (hours * 3600) // target_points)
    sql = """
        SELECT
            CAST(round(CAST(timestamp AS REAL) / ?) * ? AS INTEGER) AS ts,
            AVG(download_mbps),
            AVG(upload_mbps),
            AVG(latency_ms),
            AVG(drop_rate_pct),
            AVG(power_w)
        FROM history
        WHERE timestamp >= ?
        GROUP BY ts
        ORDER BY ts ASC
    """
    with _lock:
        rows = _conn.execute(sql, (step, step, since)).fetchall()

    def _r(v, d): return round(v, d) if v is not None else None
    return [
        {
            "timestamp":     r[0],
            "download_mbps": _r(r[1], 2),
            "upload_mbps":   _r(r[2], 2),
            "latency_ms":    _r(r[3], 1),
            "drop_rate_pct": _r(r[4], 3),
            "power_w":       _r(r[5], 1),
        }
        for r in rows
    ]


def prune(keep_days: int = 7) -> int:
    """Delete rows older than keep_days. Returns number of deleted rows."""
    if _conn is None:
        return 0
    cutoff = int(time.time()) - keep_days * 86400
    with _lock:
        cur = _conn.execute("DELETE FROM history WHERE timestamp < ?", (cutoff,))
        deleted = cur.rowcount
        _conn.commit()
    if deleted:
        logger.info("Pruned %d history rows older than %d days", deleted, keep_days)
    return deleted
