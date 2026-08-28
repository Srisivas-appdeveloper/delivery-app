import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class LocationInput(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="WGS84 Latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="WGS84 Longitude")
    accuracy: float = Field(5.0, ge=0.0, description="GPS Accuracy in meters")
    speed: float = Field(0.0, ge=0.0, description="Speed in m/s")
    heading: float = Field(0.0, ge=0.0, le=360.0, description="Bearing angle in degrees")
    timestamp: Optional[datetime.datetime] = Field(None, description="Client device timestamp")

class LocationProcessingResponse(BaseModel):
    accepted: bool
    distance_to_destination_meters: float
    eta_seconds: float
    status: str
    reason: Optional[str] = None

class LocationRecordResponse(BaseModel):
    id: int
    order_id: str
    latitude: float
    longitude: float
    accuracy: float
    speed: float
    heading: float
    distance_to_destination: float
    estimated_eta_seconds: float
    client_timestamp: datetime.datetime
    server_timestamp: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
