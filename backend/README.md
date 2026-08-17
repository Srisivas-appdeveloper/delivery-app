# Velox Track - Local-Development Real-Time Delivery Backend

A complete local-first backend for an **optimized real-time delivery tracking Proof of Concept** built with Python, FastAPI, WebSockets, SQLAlchemy, SQLite, and Pydantic.

---

## 🏗️ Architecture & Project Structure

```text
backend/
├── app/
│   ├── main.py                       # FastAPI application & WebSocket router
│   ├── config.py                     # Config settings (Pydantic Settings)
│   ├── database.py                   # SQLite engine & Session factory
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── health.py                 # GET /health
│   │   ├── orders.py                 # Order CRUD & status transitions
│   │   └── tracking.py               # Location ingestion, snapshot & statistics
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── order.py                  # Order table model
│   │   ├── location.py               # Location record telemetry model
│   │   └── delivery_event.py         # Lifecycle and audit log model
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── order.py                  # Pydantic schemas for order payloads
│   │   ├── location.py               # Pydantic schemas for GPS inputs
│   │   └── tracking.py               # Snapshot, stats & WS envelopes
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── distance_service.py       # Haversine distance & cumulative path length
│   │   ├── location_validator.py     # Outlier, jitter, jump & accuracy filter
│   │   ├── eta_service.py            # Exponential smoothed ETA engine
│   │   ├── stats_service.py          # Telemetry aggregator
│   │   └── tracking_service.py       # Core orchestration & state machine
│   │
│   ├── websocket/
│   │   ├── __init__.py
│   │   └── manager.py                # Order subscriber connection manager
│   │
│   └── utils/
│       ├── __init__.py
│       ├── geo.py                    # Haversine & forward azimuth calculations
│       └── datetime_utils.py         # Timezone-aware UTC helpers
│
├── tests/
│   ├── test_api.py                   # REST & WebSocket integration tests
│   ├── test_eta.py                   # ETA speed blending & smoothing tests
│   ├── test_geo.py                   # Haversine & bearing math tests
│   └── test_validation.py            # Location validation rules tests
│
├── seed_demo.py                      # Demo order generator script
├── .env.example                      # Environment variables template
├── requirements.txt                  # Python dependencies
└── README.md
```

---

## ⚡ Key Features

1. **Local Geo Math**:
   - Haversine distance calculation in meters without external paid APIs.
   - Bearing angle calculation (0° - 360° forward azimuth).
2. **Location Validation (`LocationValidator`)**:
   - Rejects coordinates out of bounds ($[-90, 90], [-180, 180]$).
   - Rejects readings exceeding maximum GPS error (`GPS_MAX_ACCURACY = 35.0m`).
   - Prevents temporal anomalies (timestamps $>5\text{m}$ in future).
   - Teleportation check: flags impossible speed jumps (`> 45.0 m/s ≈ 162 km/h`).
3. **Smoothed ETA Engine (`ETAService`)**:
   - Blends current speed, rolling recent speed, and fallback speed ($20\text{ km/h}$).
   - Smoothed via Exponential Moving Average:
     $$\text{ETA}_t = 0.3 \cdot \text{RawETA} + 0.7 \cdot \text{ETA}_{t-1}$$
4. **Proximity-Assisted Auto Status Transitions**:
   - $> 1\text{ km} \rightarrow \text{on\_the\_way}$
   - $\le 1\text{ km} \rightarrow \text{nearby}$
   - $\le 300\text{ m} \rightarrow \text{arriving}$
   - $\le 30\text{ m} \rightarrow \text{eligible for delivered}$
5. **WebSocket Gateway**:
   - Connection manager tracking `order_id -> [WebSocket clients]`.
   - Real-time broadcasts for `location_update`, `eta_update`, `status_update`, and `delivery_completed`.

---

## 🚀 Quickstart & Local Setup

### 1. Create Virtual Environment
```bash
# In backend directory
python3 -m venv .venv

# Activate on macOS / Linux:
source .venv/bin/activate

# Or on Windows:
.venv\Scripts\activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run Backend Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API is running at: `http://localhost:8000`
- Swagger UI documentation: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 4. Seed Demo Order
```bash
python seed_demo.py
```

---

## 📡 REST API Reference

### Health Check
- `GET /health`
  ```json
  { "status": "ok" }
  ```

### Create Order
- `POST /api/orders`
  ```json
  {
    "driver_id": "DRIVER001",
    "customer_id": "CUSTOMER001",
    "store_name": "Demo Store",
    "store_latitude": 11.0168,
    "store_longitude": 76.9558,
    "destination_latitude": 11.0250,
    "destination_longitude": 76.9680
  }
  ```

### Get Order Details
- `GET /api/orders/{order_id}`

### Update Delivery Status
- `PATCH /api/orders/{order_id}/status`
  ```json
  {
    "status": "picked_up"
  }
  ```

### Ingest GPS Location
- `POST /api/orders/{order_id}/location`
  ```json
  {
    "latitude": 11.0191,
    "longitude": 76.9602,
    "accuracy": 7.5,
    "speed": 6.8,
    "heading": 132.0,
    "timestamp": "2026-08-17T16:00:00Z"
  }
  ```
  **Response:**
  ```json
  {
    "accepted": true,
    "distance_to_destination_meters": 820.0,
    "eta_seconds": 210.0,
    "status": "on_the_way",
    "reason": null
  }
  ```

### Latest Location & Tracking Snapshot
- `GET /api/orders/{order_id}/location`
- `GET /api/orders/{order_id}/tracking`

### Telemetry Statistics
- `GET /api/orders/{order_id}/stats`
  ```json
  {
    "order_id": "ORD001",
    "location_updates_received": 42,
    "accepted_updates": 39,
    "rejected_updates": 3,
    "average_update_interval": 5.2,
    "distance_travelled_meters": 3240.0,
    "average_gps_accuracy": 5.8,
    "average_speed_kmh": 24.5
  }
  ```

---

## 🔄 WebSocket Event Protocol

**Endpoint**: `ws://HOST:PORT/ws/orders/{order_id}`

All WebSocket messages use a standardized envelope:
```json
{
  "type": "location_update",
  "order_id": "ORD001",
  "timestamp": "2026-08-17T16:00:00Z",
  "data": {
    "latitude": 11.0191,
    "longitude": 76.9602,
    "speed": 6.8,
    "heading": 132.0,
    "accuracy": 7.5,
    "distance_remaining": 820.0,
    "eta_seconds": 210.0,
    "status": "on_the_way"
  }
}
```

---

## 📱 Testing on Physical Devices & LAN

When testing from a mobile phone connected to the same Wi-Fi:
1. Find your computer's local IP (e.g. `192.168.1.50`).
2. Run backend with `0.0.0.0` binding:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
3. Open `http://192.168.1.50:8000/docs` from the mobile browser or configure Flutter app's server settings.

---

## 🧪 Automated Testing

Run the test suite with `pytest`:
```bash
PYTHONPATH=. .venv/bin/pytest tests/
```
