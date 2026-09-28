"""Speed test endpoints — measures throughput from the client through this terminal."""

import os
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter()

# 256 KB random chunk re-used across stream iterations (generated once at import time)
_CHUNK = os.urandom(256 * 1024)

# Total download payload: 100 × 256 KB = 25 MB
_DOWNLOAD_CHUNKS = 100


def _download_stream():
    for _ in range(_DOWNLOAD_CHUNKS):
        yield _CHUNK


@router.get("/speedtest/download")
def speedtest_download():
    """
    Stream 25 MB of incompressible random bytes.
    Content-Encoding: identity prevents the GZip middleware from touching this.
    """
    total = len(_CHUNK) * _DOWNLOAD_CHUNKS
    return StreamingResponse(
        _download_stream(),
        media_type="application/octet-stream",
        headers={
            "Content-Length":   str(total),
            "Content-Encoding": "identity",   # skip GZip middleware
            "Cache-Control":    "no-store",
        },
    )


@router.post("/speedtest/upload")
async def speedtest_upload(request: Request):
    """Consume and discard the uploaded body; return byte count for verification."""
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
    return {"bytes_received": total}
