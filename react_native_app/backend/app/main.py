import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.api import health_router, orders_router, tracking_router, places_router
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
app.include_router(places_router)

@app.websocket("/ws/orders/{order_id}")
async def websocket_tracking_endpoint(websocket: WebSocket, order_id: str):
    """Realtime WebSocket gateway for order tracking subscribers."""
    await ws_manager.connect(order_id, websocket)
    try:
        while True:
            # Receive client heartbeats or messages
            raw_data = await websocket.receive_text()
            logger.debug(f"Received from client on {order_id}: {raw_data}")
            try:
                message = json.loads(raw_data)
            except json.JSONDecodeError:
                await ws_manager.send_personal_message(
                    {"type": "error", "order_id": order_id, "data": {"message": "Invalid JSON"}},
                    websocket,
                )
                continue

            message_type = message.get("type")
            if message_type == "ping":
                await ws_manager.send_personal_message(
                    {"type": "pong", "order_id": order_id, "data": {}}, websocket
                )
                continue

            if message_type == "location_update":
                try:
                    location = {
                        "latitude": float(message["latitude"]),
                        "longitude": float(message["longitude"]),
                        "heading": float(message.get("heading") or 0),
                        "speed": float(message.get("speed") or 0),
                        "accuracy": float(message.get("accuracy") or 0),
                        "client_timestamp": message.get("timestamp"),
                    }
                except (KeyError, TypeError, ValueError):
                    await ws_manager.send_personal_message(
                        {"type": "error", "order_id": order_id, "data": {"message": "Invalid location payload"}},
                        websocket,
                    )
                    continue

                if not (-90 <= location["latitude"] <= 90 and -180 <= location["longitude"] <= 180):
                    await ws_manager.send_personal_message(
                        {"type": "error", "order_id": order_id, "data": {"message": "Location out of range"}},
                        websocket,
                    )
                    continue
                await ws_manager.broadcast(order_id, "location_update", location)
    except WebSocketDisconnect:
        ws_manager.disconnect(order_id, websocket)
    except Exception as e:
        logger.warning(f"WebSocket client error on {order_id}: {e}")
        ws_manager.disconnect(order_id, websocket)
