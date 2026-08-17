import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.api import health_router, orders_router, tracking_router
from app.websocket.manager import ws_manager

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("delivery_backend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up Delivery Tracking Backend...")
    logger.info(f"Connecting to database: {settings.DATABASE_URL}")
    init_db()
    yield
    logger.info("Shutting down Delivery Tracking Backend...")

app = FastAPI(
    title="Optimized Real-Time Delivery Tracking API",
    description="Local-first delivery tracking backend with WebSockets, ETA smoothing, and telemetry",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health_router)
app.include_router(orders_router)
app.include_router(tracking_router)

@app.websocket("/ws/orders/{order_id}")
async def websocket_tracking_endpoint(websocket: WebSocket, order_id: str):
    """Realtime WebSocket gateway for order tracking subscribers."""
    await ws_manager.connect(order_id, websocket)
    try:
        while True:
            # Receive client heartbeats or messages
            data = await websocket.receive_text()
            logger.debug(f"Received from client on {order_id}: {data}")
    except WebSocketDisconnect:
        ws_manager.disconnect(order_id, websocket)
    except Exception as e:
        logger.warning(f"WebSocket client error on {order_id}: {e}")
        ws_manager.disconnect(order_id, websocket)
