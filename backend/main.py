import logging
import os
import pathlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dish import telemetry, store
from routers.health      import router as health_router
from routers.status      import router as status_router
from routers.history     import router as history_router
from routers.devices     import router as devices_router
from routers.diagnostics import router as diagnostics_router
from routers.control     import router as control_router
from routers.ws          import router as ws_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

DISH_ADDRESS = os.getenv("DISH_ADDRESS", "192.168.100.1:9200")

# Production: serve the pre-built React app as static files from the same
# process.  Set SERVE_STATIC=1 or run with --prod flag via start.sh.
STATIC_DIR = pathlib.Path(__file__).parent.parent / "frontend" / "dist"
SERVE_STATIC = os.getenv("SERVE_STATIC", "0") == "1" and STATIC_DIR.exists()


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.init()
    store.prune()
    logger.info("Starting telemetry polling -> %s", DISH_ADDRESS)
    await telemetry.start_polling(DISH_ADDRESS)
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="Starlink Monitor",
    version="0.2.0",
    lifespan=lifespan,
    # Hide /docs in production so the root URL serves the React SPA
    docs_url=None if SERVE_STATIC else "/docs",
    redoc_url=None if SERVE_STATIC else "/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes (registered before static mount so /api/* is never caught by SPA)
app.include_router(health_router,      prefix="/api", tags=["health"])
app.include_router(status_router,      prefix="/api", tags=["status"])
app.include_router(history_router,     prefix="/api", tags=["history"])
app.include_router(devices_router,     prefix="/api", tags=["devices"])
app.include_router(diagnostics_router, prefix="/api", tags=["diagnostics"])
app.include_router(control_router,     prefix="/api", tags=["control"])
app.include_router(ws_router,          tags=["websocket"])

# Production static-file mount — must come LAST
if SERVE_STATIC:
    from fastapi.staticfiles import StaticFiles
    logger.info("Serving React build from %s", STATIC_DIR)
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
else:
    @app.get("/")
    def root():
        return {"message": "Starlink Monitor API — see /docs"}
