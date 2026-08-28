from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.utils.datetime_utils import utc_now

class LocationRecord(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    order_id = Column(String(50), ForeignKey("orders.id"), index=True, nullable=False)

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    accuracy = Column(Float, default=5.0)
    speed = Column(Float, default=0.0)
    heading = Column(Float, default=0.0)

    distance_to_destination = Column(Float, default=0.0)
    estimated_eta_seconds = Column(Float, default=0.0)

    client_timestamp = Column(DateTime, default=utc_now)
    server_timestamp = Column(DateTime, default=utc_now, index=True)

    order = relationship("Order", back_populates="locations")
