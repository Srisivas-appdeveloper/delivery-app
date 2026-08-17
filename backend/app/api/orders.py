import uuid
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.order import Order
from app.schemas.order import OrderCreate, OrderStatusUpdate, OrderResponse
from app.services.distance_service import distance_service
from app.services.eta_service import eta_service
from app.services.tracking_service import tracking_service

logger = logging.getLogger("api_orders")
router = APIRouter(prefix="/api/orders", tags=["Orders"])

VALID_STATUSES = {
    "assigned", "preparing", "picked_up", "on_the_way",
    "nearby", "arriving", "delivered", "cancelled"
}

@router.get("", response_model=List[OrderResponse])
def list_orders(db: Session = Depends(get_db)):
    """List all orders sorted by newest first."""
    return db.query(Order).order_by(desc(Order.created_at)).all()

@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    """Create a new delivery order."""
    order_id = payload.id or f"ORD-{uuid.uuid4().hex[:6].upper()}"

    existing = db.query(Order).filter(Order.id == order_id).first()
    if existing:
        return existing

    initial_dist = distance_service.calculate_distance(
        payload.store_latitude, payload.store_longitude,
        payload.destination_latitude, payload.destination_longitude
    )
    initial_eta = eta_service.calculate_eta_seconds(initial_dist, 0.0, 0.0)

    db_order = Order(
        id=order_id,
        driver_id=payload.driver_id,
        customer_id=payload.customer_id,
        status="assigned",
        store_name=payload.store_name,
        store_latitude=payload.store_latitude,
        store_longitude=payload.store_longitude,
        destination_latitude=payload.destination_latitude,
        destination_longitude=payload.destination_longitude,
        current_latitude=payload.store_latitude,
        current_longitude=payload.store_longitude,
        remaining_distance_meters=initial_dist,
        smoothed_eta_seconds=initial_eta
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    logger.info(f"Order created: id={order_id}, store={payload.store_name}")
    return db_order

@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: str, db: Session = Depends(get_db)):
    """Retrieve an order by ID."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db)
):
    """Manually update delivery status."""
    if payload.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"Invalid status '{payload.status}'. Must be one of: {sorted(list(VALID_STATUSES))}"
        )

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return await tracking_service.update_status(db, order, payload.status, payload.note)
