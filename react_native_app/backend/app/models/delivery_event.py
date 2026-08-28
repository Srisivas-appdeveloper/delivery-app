from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.utils.datetime_utils import utc_now

class DeliveryEvent(Base):
    __tablename__ = "delivery_events"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    order_id = Column(String(50), ForeignKey("orders.id"), index=True, nullable=False)
    event_type = Column(String(50), nullable=False)  # location_update, status_update, delivery_completed
    event_data = Column(Text, nullable=True)  # JSON serialized payload
    created_at = Column(DateTime, default=utc_now, index=True)

    order = relationship("Order", back_populates="events")
