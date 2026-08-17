#!/usr/bin/env python3
import sys
import logging
from app.database import SessionLocal, init_db
from app.models.order import Order
from app.services.distance_service import distance_service
from app.services.eta_service import eta_service
from app.utils.datetime_utils import utc_now

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_demo")

def seed_demo_order():
    init_db()
    db = SessionLocal()
    try:
        demo_id = "ORD001"
        existing = db.query(Order).filter(Order.id == demo_id).first()
        if existing:
            logger.info(f"Demo order {demo_id} already exists (status: {existing.status}). Resetting for demo...")
            existing.status = "on_the_way"
            existing.current_latitude = existing.store_latitude
            existing.current_longitude = existing.store_longitude
            existing.current_speed = 0.0
            existing.current_heading = 45.0
            existing.updated_at = utc_now()
            db.commit()
            logger.info(f"Reset {demo_id} successfully.")
            return

        # Coordinates for San Francisco demo (Artisan Bakery -> 742 Evergreen Terrace)
        store_lat, store_lng = 11.0168, 76.9558
        dest_lat, dest_lng = 11.0250, 76.9680

        initial_dist = distance_service.calculate_distance(store_lat, store_lng, dest_lat, dest_lng)
        initial_eta = eta_service.calculate_eta_seconds(initial_dist, 0.0, 0.0)

        demo_order = Order(
            id=demo_id,
            driver_id="DRIVER001",
            customer_id="CUSTOMER001",
            status="on_the_way",
            store_name="Artisan Bakery & Cafe",
            store_latitude=store_lat,
            store_longitude=store_lng,
            destination_latitude=dest_lat,
            destination_longitude=dest_lng,
            current_latitude=store_lat,
            current_longitude=store_lng,
            current_heading=45.0,
            current_speed=0.0,
            current_accuracy=5.0,
            remaining_distance_meters=initial_dist,
            smoothed_eta_seconds=initial_eta,
            created_at=utc_now(),
            updated_at=utc_now()
        )
        db.add(demo_order)
        db.commit()
        logger.info(f"✨ Seeded demo order: {demo_id} (Distance: {initial_dist:.0f}m, ETA: {initial_eta:.0f}s)")
    finally:
        db.close()

if __name__ == "__main__":
    seed_demo_order()
