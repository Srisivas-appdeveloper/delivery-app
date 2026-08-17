from sqlalchemy import Column, String, Float, DateTime
from sqlalchemy.orm import relationship
from app.database import Base
from app.utils.datetime_utils import utc_now

class Order(Base):
    __tablename__ = "orders"

    id = Column(String(50), primary_key=True, index=True)
    driver_id = Column(String(50), nullable=False, default="DRIVER001", index=True)
    customer_id = Column(String(50), nullable=False, default="CUSTOMER001", index=True)
    
    # Delivery statuses: assigned, preparing, picked_up, on_the_way, nearby, arriving, delivered, cancelled
    status = Column(String(30), nullable=False, default="assigned", index=True)

    # Store Information
    store_name = Column(String(100), nullable=False, default="Artisan Bakery & Cafe")
    store_latitude = Column(Float, nullable=False)
    store_longitude = Column(Float, nullable=False)

    # Destination Information
    destination_latitude = Column(Float, nullable=False)
    destination_longitude = Column(Float, nullable=False)

    # Latest Telemetry Snapshot
    current_latitude = Column(Float, nullable=True)
    current_longitude = Column(Float, nullable=True)
    current_heading = Column(Float, default=0.0)
    current_speed = Column(Float, default=0.0)
    current_accuracy = Column(Float, default=5.0)

    remaining_distance_meters = Column(Float, default=0.0)
    smoothed_eta_seconds = Column(Float, default=0.0)

    # Timestamps
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    picked_up_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)

    # Relationships
    locations = relationship("LocationRecord", back_populates="order", cascade="all, delete-orphan")
    events = relationship("DeliveryEvent", back_populates="order", cascade="all, delete-orphan")
