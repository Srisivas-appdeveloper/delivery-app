import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class OrderCreate(BaseModel):
    id: Optional[str] = Field(None, description="Optional custom Order ID")
    driver_id: str = Field("DRIVER001", description="ID of delivery partner")
    customer_id: str = Field("CUSTOMER001", description="ID of customer")
    store_name: str = Field("Demo Store", description="Name of store")
    store_latitude: float = Field(..., ge=-90.0, le=90.0)
    store_longitude: float = Field(..., ge=-180.0, le=180.0)
    destination_latitude: float = Field(..., ge=-90.0, le=90.0)
    destination_longitude: float = Field(..., ge=-180.0, le=180.0)

class OrderStatusUpdate(BaseModel):
    status: str = Field(..., description="Target delivery status (e.g. picked_up, on_the_way, delivered)")
    note: Optional[str] = None

class OrderResponse(BaseModel):
    id: str
    driver_id: str
    customer_id: str
    status: str
    store_name: str
    store_latitude: float
    store_longitude: float
    destination_latitude: float
    destination_longitude: float
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    current_heading: float = 0.0
    current_speed: float = 0.0
    current_accuracy: float = 5.0
    remaining_distance_meters: float = 0.0
    smoothed_eta_seconds: float = 0.0
    created_at: datetime.datetime
    updated_at: datetime.datetime
    picked_up_at: Optional[datetime.datetime] = None
    delivered_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)
