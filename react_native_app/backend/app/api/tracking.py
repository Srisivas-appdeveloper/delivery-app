from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.order import Order
from app.models.location import LocationRecord
from app.schemas.location import LocationInput, LocationProcessingResponse, LocationRecordResponse
from app.schemas.tracking import TrackingSnapshotResponse, TrackingStatsResponse
from app.services.tracking_service import tracking_service
from app.services.stats_service import stats_service

router = APIRouter(prefix="/api/orders", tags=["Tracking"])

@router.post("/{order_id}/location", response_model=LocationProcessingResponse)
async def receive_location(
    order_id: str,
    payload: LocationInput,
    db: Session = Depends(get_db)
):
    """
    Ingest delivery partner GPS location, perform validation,
    compute distance/ETA, update delivery status, and broadcast over WebSocket.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return await tracking_service.process_location_update(db, order, payload)

@router.get("/{order_id}/location", response_model=LocationRecordResponse)
def get_latest_location(order_id: str, db: Session = Depends(get_db)):
    """Fetch the latest recorded location for an order."""
    location = db.query(LocationRecord)\
                 .filter(LocationRecord.order_id == order_id)\
                 .order_by(desc(LocationRecord.server_timestamp))\
                 .first()
    if not location:
        raise HTTPException(status_code=404, detail="No locations recorded for this order")
    return location

@router.get("/{order_id}/tracking", response_model=TrackingSnapshotResponse)
def get_tracking_snapshot(order_id: str, db: Session = Depends(get_db)):
    """Fetch real-time tracking snapshot for live map initialization."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    latest_loc = db.query(LocationRecord)\
                   .filter(LocationRecord.order_id == order_id)\
                   .order_by(desc(LocationRecord.server_timestamp))\
                   .first()

    return TrackingSnapshotResponse(
        order_id=order.id,
        status=order.status,
        latest_location=LocationRecordResponse.model_validate(latest_loc) if latest_loc else None,
        distance_remaining=order.remaining_distance_meters or 0.0,
        eta_seconds=order.smoothed_eta_seconds or 0.0,
        last_updated_at=latest_loc.server_timestamp if latest_loc else order.updated_at,
        realtime=True
    )

@router.get("/{order_id}/stats", response_model=TrackingStatsResponse)
def get_order_statistics(order_id: str, db: Session = Depends(get_db)):
    """Retrieve telemetry metrics and optimization statistics for an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return stats_service.get_order_stats(db, order_id)
