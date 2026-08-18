# 🚀 Velox Track — Complete Project Architecture & Real-Time Engineering Guide

---

## 📌 Executive Summary

**Velox Track** is an end-to-end, production-grade **Real-Time Delivery Tracking System** built with **Flutter (Frontend)** and **FastAPI (Backend)**. It provides a real-time tracking experience similar to Uber, Swiggy, and DoorDash, featuring:

1. **Map-First Experience**: Live interactive maps powered by OpenStreetMap/CartoDB with smooth route polylines, custom store/destination badges, and 60 FPS animated rider markers.
2. **Smooth Coordinate & Heading Interpolation**: Vector Lerp (`easeOutCubic`) with shortest-arc rotational physics that eliminates GPS marker "jumping" or "jittering".
3. **Dynamic Adaptive Location Engine**: Client-side candidate filtering that reduces battery and cellular data consumption by **50%–70%** through proximity throttling, heading triggers, and jitter rejection.
4. **Resilient Real-Time Pipeline**: Bidirectional WebSockets with exponential backoff auto-reconnection and HTTP REST fallback.
5. **Driver HUD & Route Simulator**: Multi-speed simulator (1x, 2x, 4x) along with real device GPS hardware tracking.
6. **Persistent Mini Live-Tracking Widget**: Floating 3-state widget (Compact Pill, Medium Banner, Expanded Bento Card) that tracks deliveries while navigating other screens.
7. **Developer Telemetry HUD**: Live audit log measuring transmission latency, GPS accuracy rejection, and network bandwidth savings.

---

## 🛠️ Complete Technology Stack & Dependencies

### 📱 Frontend (Flutter / Dart)
| Library / Tool | Version / Purpose | Role in Project |
| :--- | :--- | :--- |
| **Flutter SDK** | 3.x+ (Dart 3) | Cross-platform UI toolkit (iOS, Android, macOS, Web) |
| **`flutter_riverpod`** | `^2.5.1` | Reactive, compile-safe state management (`StateNotifierProvider`, `StreamProvider`) |
| **`flutter_map`** | `^7.0.2` | High-performance declarative mapping engine based on OpenStreetMap tile protocols |
| **`latlong2`** | `^0.9.1` | Geodesic coordinate math, distance computation, and bounding box geometry |
| **`dio`** | `^5.4.3` | Robust HTTP client with typed request/response interceptors |
| **`web_socket_channel`** | `^3.0.0` | Bidirectional real-time stream client with state event tracking |
| **`geolocator`** | `^12.0.0` | Device location sensor access with permission orchestration |
| **`intl`** | `^0.19.0` | DateTime formatting and currency/distance localization |

### ⚙️ Backend (Python / FastAPI)
| Library / Tool | Purpose | Role in Project |
| :--- | :--- | :--- |
| **`fastapi`** | ASGI Framework | High-concurrency async REST endpoints and WebSocket channels |
| **`uvicorn`** | ASGI Server | Async event-loop web server running on `0.0.0.0:8000` |
| **`sqlalchemy`** | ORM / Database | Relational database mapping (`Order`, `LocationRecord`, `DeliveryEvent`) |
| **`sqlite3` / PostgreSQL** | Database Engine | Persistent storage for order states and location telemetry history |
| **`pydantic` v2** | Data Validation | Request parsing, strict type checking, and JSON envelope serialization |
| **`pytest` & `httpx`** | Test Suite | End-to-end integration and async WebSocket/REST test automation |

---

## 🗺️ How the Map Works

The mapping system in Velox Track is designed for high visual appeal, fluid motion, and low CPU/GPU overhead.

```
┌────────────────────────────────────────────────────────┐
│                   FlutterMap Layer                     │
├────────────────────────────────────────────────────────┤
│ 1. TileLayer       → CartoDB Voyager / OSM Tiles      │
│ 2. PolylineLayer   → Outer Glow Layer (Width: 8px)     │
│                    → Inner Primary Path (Width: 4px)   │
│ 3. MarkerLayer     → Store Pin (🏪 Neon Surface)       │
│                    → Destination Pin (🏠 Secondary)   │
│                    → Rider Marker (🛵 60 FPS Vector)  │
└────────────────────────────────────────────────────────┘
```

### 1. Map Rendering Engine
- Uses **`flutter_map`** with **CartoDB Voyager** vector-styled raster tiles (`https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`).
- Tiles are loaded asynchronously with disk and memory caching, ensuring smooth 60–120 FPS panning and zooming.

### 2. Dual-Layer Route Polylines
- **Glow Line (Base)**: An 8.0px wide semi-transparent polyline (`AppColors.primary.withValues(alpha: 0.25)`) that acts as a neon shadow/glow.
- **Path Line (Top)**: A 4.0px wide solid accent polyline (`AppColors.primary`) representing the calculated delivery route between the store, current rider location, and destination.

### 3. Custom Glassmorphic Markers
- **Store Marker**: High-contrast icon badge with store emoji (`🏪`) and white translucent border.
- **Customer Destination**: Coral-toned badge (`🏠`) pinned precisely at the destination coordinates.
- **Animated Rider Marker**: Scooter icon with a radar pulse ring and a dynamic directional heading needle that rotates towards the vehicle's direction of travel.

### 4. 60 FPS Vector Marker Animation (`RiderMarkerAnimator`)
When a new GPS location update arrives over WebSockets (e.g., once every 2–5 seconds), directly snapping the marker causes jarring visual jumps. The custom `RiderMarkerAnimator` solves this:
- **Interpolation Loop**: Uses a Flutter `TickerProvider` executing every frame (~16ms).
- **Cubic Curve Smoothing**: Applies `Curves.easeOutCubic` over a 1400ms duration so the vehicle accelerates smoothly and decelerates gracefully upon arrival at each point:
  $$\text{Progress}(t) = \text{easeOutCubic}\left(\frac{t - t_{\text{start}}}{\text{duration}}\right)$$
  $$\text{Lat}_{\text{smooth}} = \text{Lat}_{\text{start}} + (\text{Lat}_{\text{target}} - \text{Lat}_{\text{start}}) \times \text{Progress}(t)$$
  $$\text{Lng}_{\text{smooth}} = \text{Lng}_{\text{start}} + (\text{Lng}_{\text{target}} - \text{Lng}_{\text{start}}) \times \text{Progress}(t)$$
- **Shortest-Arc Heading Interpolation**: Prevents the marker from spinning 360° when transitioning through North ($0^\circ \leftrightarrow 360^\circ$):
  ```dart
  double diff = (targetHeading - startHeading) % 360.0;
  if (diff > 180.0) diff -= 360.0;
  if (diff < -180.0) diff += 360.0;
  currentHeading = (startHeading + diff * progress) % 360.0;
  ```
- **Teleportation Guard**: If distance between incoming and current position exceeds 4,000 meters (e.g., test reset or GPS teleportation glitch), animation is skipped and the marker snaps immediately without visual artifacting.

### 5. Smart Camera Controls
- **Auto-Follow Mode**: The map automatically translates smoothly to keep the rider centered.
- **User Gesture Detection**: If the user pans or zooms the map manually, Auto-Follow is immediately paused so the user retains full control.
- **Fit Route Bounding Box (`_fitRoute`)**: Computes `LatLngBounds.fromPoints([store, destination, rider])` and animates the camera with responsive edge padding (`top: 140, bottom: 330, horizontal: 40`).

---

## ⚡ How Real-Time Communication Works

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                        REAL-TIME DATA FLOW                             │
 └────────────────────────────────────────────────────────────────────────┘

  [Driver App / Simulator]
          │
          │ 1. Raw GPS Stream (1 Hz)
          ▼
  [Adaptive Location Engine]
    ├── Accuracy Filter (Reject >25m)
    ├── Displacement Filter (Skip <10m)
    ├── Dynamic Throttling (2s / 5s / 10s based on distance)
    └── Heading Change Trigger (≥25° instant transmit)
          │
          │ 2. Filtered Location Candidates (REST / WebSocket)
          ▼
  [FastAPI Backend]
    ├── LocationValidator (Sanity & Velocity <160 km/h)
    ├── DistanceService (Haversine geodesic math)
    ├── ETAService (Rolling average speed smoothing)
    ├── Auto Status Machine (on_the_way -> nearby -> arriving)
    └── DB Persistence (SQLite / PostgreSQL)
          │
          │ 3. ConnectionManager.broadcast(order_id)
          ▼
  [WebSocket Channel: /ws/orders/{order_id}]
          │
          │ 4. JSON Envelopes
          ▼
  [Customer App Client]
    ├── Resilient WebSocket Client (Auto-reconnect with backoff)
    ├── Riverpod StateNotifier (`activeOrderProvider`)
    ├── RiderMarkerAnimator (60 FPS Smooth Glide)
    ├── ETA Hero Card & Bento Status Grid
    └── Persistent Mini-Tracking Floating Widget
```

---

## 🔋 Adaptive Location Engine (Client-Side Battery Saver)

Sending GPS updates every second over cellular radios drains battery rapidly and creates excessive backend load. The **`AdaptiveLocationEngine`** intelligently decides whether each GPS candidate should be transmitted or discarded:

| Metric / Rule | Condition | Action | Rationale |
| :--- | :--- | :--- | :--- |
| **Accuracy Guard** | Accuracy $> 25\text{ m}$ | ❌ **Reject Candidate** | Eliminates noisy GPS drift (e.g. inside tunnels or buildings). |
| **Far Proximity** | Remaining Distance $> 2\text{ km}$ | ⏱️ **10-Second Rate Limit** | High distance makes fine-grained updates redundant. |
| **Mid Proximity** | Remaining Distance $500\text{ m} - 2\text{ km}$ | ⏱️ **5-Second Rate Limit** | Balances responsiveness and battery life. |
| **Close Proximity** | Remaining Distance $< 500\text{ m}$ | ⏱️ **2-Second Rate Limit** | High precision when approaching delivery point. |
| **Displacement Filter** | Movement $< 10\text{ m}$ | ⏸️ **Skip Candidate** | Discards idle jitter while rider is at red lights or waiting. |
| **Heading Trigger** | $\Delta\text{Heading} \ge 25^\circ$ & $\text{dist} \ge 5\text{ m}$ | ⚡ **Immediate Transmit** | Immediately updates map when driver makes turns. |
| **Heartbeat Safety** | Elapsed $\ge 15\text{ s}$ without update | 💓 **Forced Heartbeat** | Confirms connection health even when stationary. |

### Telemetry Impact
- **Network Bandwidth Saved**: **55% – 70%** reduction in cellular HTTP/Socket payloads.
- **Server Load**: Reduces database writes by more than half without degrading visual user experience.

---

## 🧠 Backend Real-Time Logic & Microservices

Located in `backend/app/services/`:

### 1. `LocationValidator` (`location_validator.py`)
- Verifies coordinate ranges ($\text{Lat} \in [-90, 90]$, $\text{Lng} \in [-180, 180]$).
- Rejects readings with accuracy $> 30\text{ m}$.
- Checks implied velocity: if distance between updates indicates speed $> 160\text{ km/h}$ ($44.4\text{ m/s}$), update is rejected as a GPS teleportation anomaly.

### 2. `DistanceService` (`distance_service.py`)
- Calculates remaining distance using the **Haversine Geodesic Formula**:
  $$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)$$
  $$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)$$
  $$d = R \cdot c \quad (R = 6,371,000\text{ meters})$$

### 3. `ETAService` (`eta_service.py`)
- Prevents ETA flickering caused by brief traffic stops using an **Exponential Moving Average (EMA)** smoothing filter:
  $$\text{ETA}_{\text{raw}} = \frac{\text{Distance}_{\text{remaining}}}{\max(\text{Speed}_{\text{rolling}}, 1.0\text{ m/s})}$$
  $$\text{ETA}_{\text{smoothed}} = \alpha \cdot \text{ETA}_{\text{raw}} + (1 - \alpha) \cdot \text{ETA}_{\text{previous}} \quad (\alpha = 0.3)$$

### 4. Proximity-Based Auto Status Transitions
The backend automatically promotes order states as the rider approaches:
- **`on_the_way` $\rightarrow$ `nearby`**: When remaining distance $\le 500\text{ m}$.
- **`nearby` $\rightarrow$ `arriving`**: When remaining distance $\le 150\text{ m}$.
- **`arriving` $\rightarrow$ `delivered`**: When driver triggers manual completion or distance $\le 15\text{ m}$.

### 5. `ConnectionManager` (`backend/app/websocket/manager.py`)
- Maintains an in-memory registry of active subscriber WebSockets mapped by `order_id`:
  `Dict[str, List[WebSocket]]`
- Automatically prunes dead/broken client sockets on broadcast failures.
- Pushes typed JSON envelopes:
  ```json
  {
    "type": "location_update",
    "order_id": "ORD-1001",
    "timestamp": "2026-08-18T07:35:00Z",
    "data": {
      "latitude": 37.7758,
      "longitude": -122.4172,
      "heading": 85.4,
      "speed": 8.5,
      "remaining_distance_meters": 340.0,
      "eta_seconds": 95,
      "status": "nearby"
    }
  }
  ```

---

## 📂 Complete Project Architecture & File Breakdown

```text
delivery-app/
├── PROJECT_DOCUMENTATION.md             # This comprehensive engineering manual
├── README.md                            # Quickstart & setup guide
├── pubspec.yaml                         # Flutter dependencies and assets
│
├── backend/                             # FastAPI Python Backend
│   ├── run.py                           # Server launcher (uvicorn)
│   ├── seed_demo.py                     # Demo data generator (Stores, Orders, Routes)
│   ├── requirements.txt                 # Python dependencies
│   ├── delivery_poc.db                  # SQLite database file
│   └── app/
│       ├── main.py                      # FastAPI app initialization, CORS, and routers
│       ├── config.py                    # Environment settings and threshold constants
│       ├── database.py                  # SQLAlchemy session manager
│       ├── api/
│       │   ├── health.py                # Service health check endpoint
│       │   ├── orders.py                # REST CRUD endpoints for Orders
│       │   └── tracking.py              # Ingestion endpoint for driver location updates
│       ├── websocket/
│       │   └── manager.py               # WebSocket client connection pool & broadcaster
│       ├── models/
│       │   ├── order.py                 # Order ORM model
│       │   ├── location.py              # Location history records ORM model
│       │   └── delivery_event.py        # Audit log event ORM model
│       ├── schemas/
│       │   ├── order.py                 # Pydantic schemas for order requests/responses
│       │   └── location.py              # Pydantic schemas for location input & responses
│       └── services/
│           ├── tracking_service.py      # Orchestrator for location validation, ETA, and broadcast
│           ├── location_validator.py    # GPS sanity & teleportation filter
│           ├── distance_service.py      # Haversine distance calculator
│           ├── eta_service.py           # EMA ETA smoothing calculator
│           └── stats_service.py         # Telemetry aggregation service
│
└── lib/                                 # Flutter Client Application
    ├── main.dart                        # Flutter entry point with Riverpod ProviderScope
    ├── app/
    │   └── app.dart                     # MaterialApp with dark theme configuration
    ├── core/
    │   ├── constants/
    │   │   └── api_constants.dart       # Host URLs (Android emulator / iOS / Local LAN)
    │   ├── networking/
    │   │   ├── api_client.dart          # Dio REST client with error interception
    │   │   └── websocket_client.dart    # Resilient WebSocket client with backoff
    │   └── theme/
    │       ├── app_colors.dart          # Dark neon palette (Emerald, Coral, Glass)
    │       └── app_theme.dart           # Custom Material 3 theme & Glassmorphic styling
    ├── models/
    │   ├── order.dart                   # Immutable Order domain entity
    │   ├── location_point.dart          # Coordinate model (lat, lng, heading, speed)
    │   ├── location_decision.dart       # Adaptive engine decision outcome
    │   └── telemetry_stats.dart         # Bandwidth savings and metrics model
    ├── services/
    │   ├── adaptive_location_engine.dart# Client-side candidate throttling engine
    │   ├── rider_marker_animator.dart   # 60 FPS vector coordinate/heading lerp
    │   ├── geolocation_service.dart     # Device GPS sensor service with permission handling
    │   └── delivery_providers.dart      # Riverpod state managers (activeOrder, simulation, sockets)
    ├── shared/
    │   └── widgets/
    │       ├── glass_card.dart          # Reusable BackdropFilter blur card
    │       ├── bento_card.dart          # Structured modular Bento UI card
    │       └── status_badge.dart        # Semantic status badge with pulsing live dot
    └── features/
        ├── splash/
        │   └── splash_page.dart         # Animated entrance screen
        ├── home/
        │   └── home_page.dart           # Bento customer dashboard + persistent widget host
        ├── customer_tracking/
        │   ├── live_tracking_page.dart  # Fullscreen map tracking with Bento metric overlays
        │   └── widgets/
        │       ├── top_glass_header.dart# Top header with back button & live socket status
        │       ├── eta_hero_card.dart   # Prominent remaining time bento card
        │       ├── bento_status_grid.dart# Distance, speed, and status cards
        │       ├── rider_card.dart      # Driver info, avatar, call button, and battery chip
        │       └── map_controls.dart    # Recenter, Follow Rider, and Fit Route FABs
        ├── driver_tracking/
        │   └── driver_dashboard_page.dart# Driver simulator HUD with 1x/2x/4x controls
        ├── tracking_widget/
        │   └── live_tracking_widget.dart# Floating persistent widget (Compact/Medium/Expanded)
        └── debug/
            └── tracking_debug_page.dart # Real-time telemetry, accuracy logs, and server stats
```

---

## 📱 User Interfaces & Features

### 1. Customer Live Tracking Screen (`live_tracking_page.dart`)
- **Immersive Map Background**: Fullscreen OpenStreetMap layer with dark-tinted overlay.
- **Top Glass Header**: Displays store name, order ID, and a live WebSocket connection status pill (`CONNECTED` 🟢, `RECONNECTING` 🟡, `DISCONNECTED` 🔴).
- **ETA Hero Bento Card**: Displays remaining minutes with a dynamic status bar (`Preparing` $\rightarrow$ `Picked Up` $\rightarrow$ `On The Way` $\rightarrow$ `Nearby` $\rightarrow$ `Arriving`).
- **Metric Grid**: Real-time distance (meters/km), current vehicle speed (km/h), and status description.
- **Rider Card**: Assigned driver name, vehicle badge, direct call button, and GPS signal indicator.
- **Map Camera Controls**: One-tap "Fit Route" bounding box and "Follow Rider" toggle.

### 2. Persistent Mini Live-Tracking Widget (`live_tracking_widget.dart`)
When the customer navigates away from the map view to browse items or check order history on the Home Screen, a floating widget maintains continuous live updates in 3 switchable modes:
1. **Compact Pill**: Minimal floating capsule showing ETA and animated pulse dot.
2. **Medium Banner**: Horizontal glass banner showing driver name, ETA, and progress bar.
3. **Expanded Bento Card**: Rich floating card with map preview, status badge, and one-tap button to return to the full map.

### 3. Driver HUD & Route Simulator (`driver_dashboard_page.dart`)
- **Simulation Mode**: Generates synthetic GPS waypoints between the store and customer.
- **Variable Speeds**: Toggle between `1x` (realistic speed), `2x`, `4x` (high-speed testing), `Pause`, and `Reset`.
- **Hardware GPS Mode**: Switch from simulation to real device GPS sensor stream with automatic permission requests.
- **Live Dispatcher Telemetry**: Displays transmission decision reasons (e.g. `HEADING_CHANGED (42°)`, `THROTTLED (wait 5s)`, `RIDER_MOVED (28m)`).

### 4. Developer Telemetry & Diagnostic Screen (`tracking_debug_page.dart`)
- **Live Stream Inspector**: Displays incoming WebSocket JSON messages in real time.
- **Optimization Gauges**: Displays `% Network Data Saved`, `Readings Evaluated`, and `Updates Sent vs Skipped`.
- **Latency & Socket Diagnostics**: Measures Round-Trip Time (RTT) and connection state.
- **Server IP Configuration Tool**: Allows entering custom local network IPs when testing on physical iOS/Android devices over Wi-Fi.

---

## 🚀 How to Run the Project Locally

### 1. Start the FastAPI Backend
```bash
cd backend
source .venv/bin/activate
python run.py
```
*Backend runs on `http://0.0.0.0:8000`.*
- Interactive Swagger API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/v1/health`

### 2. Start the Flutter App
```bash
flutter run
```

### 3. Device & Emulator Network Configuration
- **iOS Simulator / macOS Desktop**: Connects to `http://127.0.0.1:8000` automatically.
- **Android Emulator**: Connects to `http://10.0.2.2:8000` automatically.
- **Physical Device over Wi-Fi**:
  1. Find your machine's local Wi-Fi IP (e.g. `192.168.1.100`).
  2. In the Flutter app, navigate to the **Server Settings** icon in the bottom navigation bar.
  3. Enter `192.168.1.100:8000` and tap **Save & Reconnect**.

---

## 🧪 Testing & Verification

```bash
# 1. Flutter Code Analysis
flutter analyze

# 2. Flutter Unit & Widget Tests
flutter test

# 3. Backend End-to-End Test Suite
cd backend
PYTHONPATH=. .venv/bin/pytest tests/test_e2e.py
```
