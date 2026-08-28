import json
import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.config import settings
from app.models.order import Order
from app.models.location import LocationRecord
from app.models.delivery_event import DeliveryEvent
from app.schemas.location import LocationInput, LocationProcessingResponse
from app.services.location_validator import location_validator
from app.services.distance_service import distance_service
from app.services.eta_service import eta_service
from app.websocket.manager import ws_manager
from app.utils.geo import calculate_bearing
from app.utils.datetime_utils import utc_now, ensure_utc

logger = logging.getLogger("tracking_service")

class TrackingService:
    async def process_location_update(
        self,
        db: Session,
        order: Order,
        loc_input: LocationInput
    ) -> LocationProcessingResponse:
        # Fetch previous location record
        prev_record = db.query(LocationRecord)\
                        .filter(LocationRecord.order_id == order.id)\
                        .order_by(desc(LocationRecord.server_timestamp))\
                        .first()

        # 1. Validate incoming candidate location
        validation = location_validator.validate(loc_input, prev_record)
        if not validation.is_valid:
            logger.warning(f"Location update rejected for order {order.id}: {validation.reason}")
            # Record rejection event
            reject_event = DeliveryEvent(
                order_id=order.id,
                event_type="location_rejected",
                event_data=json.dumps({
                    "reason": validation.reason,
                    "latitude": loc_input.latitude,
                    "longitude": loc_input.longitude,
                    "accuracy": loc_input.accuracy
                }),
                created_at=utc_now()
            )
            db.add(reject_event)
            db.commit()

            return LocationProcessingResponse(
                accepted=False,
                distance_to_destination_meters=order.remaining_distance_meters or 0.0,
                eta_seconds=order.smoothed_eta_seconds or 0.0,
                status=order.status,
                reason=validation.reason
            )

        # 2. Calculate remaining distance to destination
        remaining_dist = distance_service.calculate_distance(
            loc_input.latitude, loc_input.longitude,
            order.destination_latitude, order.destination_longitude
        )

        # Calculate bearing if not set
        heading = loc_input.heading
        if heading == 0.0 and prev_record is not None:
            heading = calculate_bearing(
                prev_record.latitude, prev_record.longitude,
                loc_input.latitude, loc_input.longitude
            )

        # 3. Calculate smoothed ETA
        eta_seconds = eta_service.calculate_eta_seconds(
            remaining_distance_meters=remaining_dist,
            current_speed_mps=loc_input.speed,
            previous_eta_seconds=order.smoothed_eta_seconds or 0.0,
            rolling_avg_speed_mps=prev_record.speed if prev_record else loc_input.speed
        )

        # 4. Proximity-assisted automated status transitions
        old_status = order.status
        new_status = old_status

        if order.status not in ["delivered", "cancelled"]:
            if remaining_dist <= settings.ARRIVING_DISTANCE and order.status in ["on_the_way", "nearby", "picked_up"]:
                new_status = "arriving"
            elif remaining_dist <= settings.NEARBY_DISTANCE and order.status in ["on_the_way", "picked_up"]:
                new_status = "nearby"

        # 5. Persist Location Record
        client_time = ensure_utc(loc_input.timestamp) if loc_input.timestamp else utc_now()
        loc_record = LocationRecord(
            order_id=order.id,
            latitude=loc_input.latitude,
            longitude=loc_input.longitude,
            accuracy=loc_input.accuracy,
            speed=loc_input.speed,
            heading=heading,
            distance_to_destination=remaining_dist,
            estimated_eta_seconds=eta_seconds,
            client_timestamp=client_time,
            server_timestamp=utc_now()
        )
        db.add(loc_record)

        # Update order snapshot
        order.current_latitude = loc_input.latitude
        order.current_longitude = loc_input.longitude
        order.current_heading = heading
        order.current_speed = loc_input.speed
        order.current_accuracy = loc_input.accuracy
        order.remaining_distance_meters = remaining_dist
        order.smoothed_eta_seconds = eta_seconds
        order.status = new_status
        order.updated_at = utc_now()

        if new_status != old_status:
            status_event = DeliveryEvent(
                order_id=order.id,
                event_type="status_update",
                event_data=json.dumps({"old_status": old_status, "new_status": new_status, "distance_meters": remaining_dist}),
                created_at=utc_now()
            )
            db.add(status_event)

        db.commit()
        db.refresh(order)

        logger.info(f"Driver location accepted for order {order.id}: dist={remaining_dist:.0f}m, eta={eta_seconds:.0f}s, status={order.status}")

        # 6. Broadcast Real-Time WebSocket Events
        await ws_manager.broadcast(
            order_id=order.id,
            event_type="location_update",
            data={
                "latitude": loc_input.latitude,
                "longitude": loc_input.longitude,
                "speed": loc_input.speed,
                "heading": heading,
                "accuracy": loc_input.accuracy,
                "distance_remaining": remaining_dist,
                "eta_seconds": eta_seconds,
                "status": order.status,
            }
        )

        await ws_manager.broadcast(
            order_id=order.id,
            event_type="eta_update",
            data={"eta_seconds": eta_seconds}
        )

        if new_status != old_status:
            logger.info(f"Status changed for order {order.id}: {old_status} -> {new_status}")
            await ws_manager.broadcast(
                order_id=order.id,
                event_type="status_update",
                data={"status": new_status, "old_status": old_status}
            )

        return LocationProcessingResponse(
            accepted=True,
            distance_to_destination_meters=remaining_dist,
            eta_seconds=eta_seconds,
            status=order.status,
            reason=None
        )

    async def update_status(self, db: Session, order: Order, new_status: str, note: Optional[str] = None) -> Order:
        old_status = order.status
        order.status = new_status
        order.updated_at = utc_now()

        if new_status == "picked_up" and not order.picked_up_at:
            order.picked_up_at = utc_now()
        elif new_status == "delivered" and not order.delivered_at:
            order.delivered_at = utc_now()
            order.remaining_distance_meters = 0.0
            order.smoothed_eta_seconds = 0.0

        event = DeliveryEvent(
            order_id=order.id,
            event_type="status_update",
            event_data=json.dumps({"old_status": old_status, "new_status": new_status, "note": note}),
            created_at=utc_now()
        )
        db.add(event)
        db.commit()
        db.refresh(order)

        logger.info(f"Manual status change for order {order.id}: {old_status} -> {new_status}")

        await ws_manager.broadcast(
            order_id=order.id,
            event_type="status_update",
            data={"status": new_status, "old_status": old_status, "note": note}
        )

        if new_status == "delivered":
            logger.info(f"Delivery completed for order {order.id}")
            await ws_manager.broadcast(
                order_id=order.id,
                event_type="delivery_completed",
                data={"message": "Order delivered successfully"}
            )

        return order

tracking_service = TrackingService()
