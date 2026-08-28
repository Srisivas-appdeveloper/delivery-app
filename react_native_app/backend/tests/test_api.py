import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, SessionLocal
from app.models.order import Order
from app.models.location import LocationRecord
from app.models.delivery_event import DeliveryEvent

@pytest.fixture(autouse=True)
def clean_test_data():
    init_db()
    db = SessionLocal()
    try:
        db.query(DeliveryEvent).filter(DeliveryEvent.order_id == "ORD-TEST-001").delete()
        db.query(LocationRecord).filter(LocationRecord.order_id == "ORD-TEST-001").delete()
        db.query(Order).filter(Order.id == "ORD-TEST-001").delete()
        db.commit()
    finally:
        db.close()
    yield

def test_health_check():
    with TestClient(app) as client:
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}

def test_full_order_flow_and_telemetry():
    with TestClient(app) as client:
        # 1. Create order
        create_payload = {
            "id": "ORD-TEST-001",
            "driver_id": "DRIVER001",
            "customer_id": "CUSTOMER001",
            "store_name": "Demo Store",
            "store_latitude": 11.0168,
            "store_longitude": 76.9558,
            "destination_latitude": 11.0250,
            "destination_longitude": 76.9680
        }
        res = client.post("/api/orders", json=create_payload)
        assert res.status_code == 201
        order_data = res.json()
        assert order_data["id"] == "ORD-TEST-001"
        assert order_data["status"] == "assigned"

        # 2. Update status to picked_up
        status_res = client.patch("/api/orders/ORD-TEST-001/status", json={"status": "picked_up"})
        assert status_res.status_code == 200
        assert status_res.json()["status"] == "picked_up"

        # 3. Invalid status transition
        invalid_res = client.patch("/api/orders/ORD-TEST-001/status", json={"status": "flying"})
        assert invalid_res.status_code == 409

        # 4. Ingest driver location (mid-point, nearby ~800m)
        loc_res = client.post("/api/orders/ORD-TEST-001/location", json={
            "latitude": 11.0200,
            "longitude": 76.9620,
            "accuracy": 4.5,
            "speed": 6.8,
            "heading": 132.0
        })
        assert loc_res.status_code == 200
        loc_data = loc_res.json()
        assert loc_data["accepted"] is True
        assert loc_data["distance_to_destination_meters"] > 0
        assert loc_data["status"] == "nearby"  # Proximity trigger auto state change

        # 5. Tracking snapshot endpoint
        snapshot_res = client.get("/api/orders/ORD-TEST-001/tracking")
        assert snapshot_res.status_code == 200
        snapshot = snapshot_res.json()
        assert snapshot["order_id"] == "ORD-TEST-001"
        assert snapshot["status"] == "nearby"
        assert snapshot["latest_location"] is not None

        # 6. Statistics endpoint
        stats_res = client.get("/api/orders/ORD-TEST-001/stats")
        assert stats_res.status_code == 200
        stats = stats_res.json()
        assert stats["location_updates_received"] == 1
        assert stats["accepted_updates"] == 1
        assert stats["rejected_updates"] == 0

def test_websocket_broadcast():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/orders/ORD-TEST-001") as websocket:
            conn_ack = websocket.receive_json()
            assert conn_ack["type"] == "connection"
            assert conn_ack["order_id"] == "ORD-TEST-001"
            websocket.send_json({
                "type": "location_update",
                "latitude": 11.0191,
                "longitude": 76.9602,
                "accuracy": 5.0,
                "speed": 1.3,
                "heading": 90.0,
            })
            update = websocket.receive_json()
            assert update["type"] == "location_update"
            assert update["data"]["latitude"] == 11.0191
            assert update["data"]["longitude"] == 76.9602
