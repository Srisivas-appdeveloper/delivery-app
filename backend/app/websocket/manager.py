import logging
from typing import Dict, List, Any
from fastapi import WebSocket
from app.utils.datetime_utils import utc_now_iso

logger = logging.getLogger("websocket_manager")

class ConnectionManager:
    def __init__(self):
        # Maps order_id -> list of active client WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, order_id: str, websocket: WebSocket):
        await websocket.accept()
        if order_id not in self.active_connections:
            self.active_connections[order_id] = []
        self.active_connections[order_id].append(websocket)
        logger.info(f"WebSocket connected for order {order_id}. Active subscribers: {len(self.active_connections[order_id])}")

        # Send initial connection acknowledgment
        await self.send_personal_message({
            "type": "connection",
            "order_id": order_id,
            "timestamp": utc_now_iso(),
            "data": {
                "status": "connected",
                "message": f"Realtime feed established for order {order_id}"
            }
        }, websocket)

    def disconnect(self, order_id: str, websocket: WebSocket):
        if order_id in self.active_connections:
            if websocket in self.active_connections[order_id]:
                self.active_connections[order_id].remove(websocket)
            if not self.active_connections[order_id]:
                del self.active_connections[order_id]
        logger.info(f"WebSocket disconnected for order {order_id}")

    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.warning(f"Error sending personal message to client: {e}")

    async def broadcast(self, order_id: str, event_type: str, data: Dict[str, Any]):
        if order_id not in self.active_connections:
            return

        envelope = {
            "type": event_type,
            "order_id": order_id,
            "timestamp": utc_now_iso(),
            "data": data
        }

        dead_connections = []
        for connection in self.active_connections[order_id]:
            try:
                await connection.send_json(envelope)
            except Exception as e:
                logger.warning(f"Error broadcasting to client on order {order_id}: {e}")
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(order_id, dead)

ws_manager = ConnectionManager()
