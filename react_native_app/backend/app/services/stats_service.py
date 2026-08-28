from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.location import LocationRecord
from app.models.delivery_event import DeliveryEvent
from app.schemas.tracking import TrackingStatsResponse
from app.services.distance_service import distance_service
from app.utils.datetime_utils import ensure_utc

class StatsService:
    @staticmethod
    def get_order_stats(db: Session, order_id: str) -> TrackingStatsResponse:
        locations = db.query(LocationRecord)\
                      .filter(LocationRecord.order_id == order_id)\
                      .order_by(LocationRecord.server_timestamp.asc())\
                      .all()

        rejected_events_count = db.query(DeliveryEvent)\
                                  .filter(
                                      DeliveryEvent.order_id == order_id,
                                      DeliveryEvent.event_type == "location_rejected"
                                  ).count()

        accepted_count = len(locations)
        total_received = accepted_count + rejected_events_count

        if accepted_count == 0:
            return TrackingStatsResponse(
                order_id=order_id,
                location_updates_received=total_received,
                accepted_updates=0,
                rejected_updates=rejected_events_count,
                average_update_interval=0.0,
                distance_travelled_meters=0.0,
                average_gps_accuracy=0.0,
                average_speed_kmh=0.0
            )

        # Calculate distance travelled
        coords = [(loc.latitude, loc.longitude) for loc in locations]
        distance_travelled = distance_service.calculate_total_travelled(coords)

        # Calculate average interval between consecutive updates
        if accepted_count > 1:
            first_time = ensure_utc(locations[0].server_timestamp)
            last_time = ensure_utc(locations[-1].server_timestamp)
            total_duration_sec = (last_time - first_time).total_seconds()
            avg_interval = round(total_duration_sec / (accepted_count - 1), 2)
        else:
            avg_interval = 0.0

        # Calculate averages
        avg_accuracy = round(sum(loc.accuracy for loc in locations) / accepted_count, 1)
        avg_speed_mps = sum(loc.speed for loc in locations) / accepted_count
        avg_speed_kmh = round(avg_speed_mps * 3.6, 1)

        return TrackingStatsResponse(
            order_id=order_id,
            location_updates_received=total_received,
            accepted_updates=accepted_count,
            rejected_updates=rejected_events_count,
            average_update_interval=avg_interval,
            distance_travelled_meters=distance_travelled,
            average_gps_accuracy=avg_accuracy,
            average_speed_kmh=avg_speed_kmh
        )

stats_service = StatsService()
