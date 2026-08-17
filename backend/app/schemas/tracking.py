import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.schemas.location import LocationRecordResponse

class TrackingSnapshotResponse(BaseModel):
    order_id: str
    status: str
    latest_location: Optional[LocationRecordResponse] = None
    distance_remaining: float
    eta_seconds: float
    last_updated_at: Optional[datetime.datetime] = None
    realtime: bool = True

    model_config = ConfigDict(from_attributes=True)

class TrackingStatsResponse(BaseModel):
    order_id: str
    location_updates_received: int
    accepted_updates: int
    rejected_updates: int
    average_update_interval: float  # In seconds
    distance_travelled_meters: float
    average_gps_accuracy: float = 0.0
    average_speed_kmh: float = 0.0

class WebSocketEventEnvelope(BaseModel):
    type: str  # location_update, eta_update, status_update, delivery_completed, connection
    order_id: str
    timestamp: datetime.datetime
    data: Dict[str, Any]
