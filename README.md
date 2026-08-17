# Velox Track - Production-Quality Real-Time Delivery Tracking System

An **optimized real-time delivery tracking PoC** featuring:
- **Clean Architecture** (Riverpod + Dio + WebSockets)
- **Map-first + Glassmorphism + Bento Cards** premium interface
- **Adaptive Location Update Engine** with candidate throttling and telemetry
- **Smooth Coordinate Interpolation (`RiderMarkerAnimator`)** with bearing rotation
- **Persistent Minimal Live-Tracking Widget (`LiveTrackingWidget`)** with 3 visual states (Compact, Medium, Expanded)
- **Customer App, Driver Simulator HUD, and Telemetry Debug Screen**

---

## 🏗️ Architecture & Project Structure

```text
lib/
├── app/
│   └── app.dart                         # Main MaterialApp & Theme wrapper
├── core/
│   ├── networking/
│   │   ├── api_client.dart              # Dio REST Client with typed methods
│   │   └── websocket_client.dart        # Resilient WebSocket client with exponential backoff
│   ├── theme/
│   │   ├── app_colors.dart              # Modern dark & glass palette
│   │   └── app_theme.dart               # Material 3 ThemeData with Glassmorphism
│   ├── constants/
│   │   └── api_constants.dart           # Host endpoints (Android / iOS / LAN)
│   └── utils/
├── models/
│   ├── order.dart                       # Immutable Order domain model
│   ├── location_point.dart              # Coordinate point & timestamp
│   ├── location_decision.dart           # Adaptive engine candidate decisions
│   └── telemetry_stats.dart             # Optimization metrics & saved %
├── services/
│   ├── adaptive_location_engine.dart    # Frontend candidate throttling engine
│   ├── rider_marker_animator.dart       # Smooth vector lerp & heading rotation
│   ├── geolocation_service.dart         # Safe Geolocator wrapper with permission handling
│   └── delivery_providers.dart          # Riverpod StateNotifier providers
├── features/
│   ├── splash/
│   │   └── splash_page.dart             # Animated entrance
│   ├── home/
│   │   └── home_page.dart               # Customer Bento dashboard + persistent widget
│   ├── customer_tracking/
│   │   ├── live_tracking_page.dart      # Full map tracking view with custom pins
│   │   └── widgets/
│   │       ├── top_glass_header.dart    # Order # and live connection chip
│   │       ├── eta_hero_card.dart       # Large prominent ETA bento card
│   │       ├── bento_status_grid.dart   # Distance, Status, and Speed cards
│   │       ├── rider_card.dart          # Delivery partner avatar & GPS status
│   │       └── map_controls.dart        # Recenter, Follow, and Fit route buttons
│   ├── driver_tracking/
│   │   └── driver_dashboard_page.dart   # Driver simulation (1x/2x/4x) & real GPS HUD
│   ├── debug/
│   │   └── tracking_debug_page.dart     # Developer telemetry & socket diagnostic tool
│   └── tracking_widget/
│       └── live_tracking_widget.dart    # 3-state floating persistent widget
└── shared/
    └── widgets/
        ├── glass_card.dart              # Reusable BackdropFilter blur card
        ├── bento_card.dart              # Structured metric bento card
        └── status_badge.dart            # Semantic status pill with pulse dot
```

---

## ⚡ Adaptive Location Engine Logic

1. **Distance-Based Throttling**:
   - `> 2 km` $\rightarrow$ 10 seconds interval
   - `500 m – 2 km` $\rightarrow$ 5 seconds interval
   - `< 500 m` $\rightarrow$ 2 seconds interval
2. **Displacement Filter**:
   - Skips minor jitter if movement is `< 10 m` unless heartbeat timeout (15s) is reached.
3. **Significant Heading Change**:
   - Triggers immediate transmission if heading changes by `> 25°` and displacement is `≥ 5 m`.
4. **Accuracy Guard**:
   - Rejects GPS candidate readings with accuracy `> 25 m`.
5. **Telemetry Tracking**:
   - Evaluates `totalGpsReadings`, `updatesSent`, `updatesSkipped`, and `% network bandwidth saved`.

---

## 📱 Permissions Configuration

### Android (`android/app/src/main/AndroidManifest.xml`)
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### iOS (`ios/Runner/Info.plist`)
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app requires location access to track real-time delivery and provide accurate ETA.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app requires location access to simulate and track delivery partner routes in background.</string>
```

---

## 🚀 Running Locally

### 1. Launch FastAPI Backend
```bash
cd backend
source .venv/bin/activate
python run.py
```
*Runs on `http://localhost:8000` (docs at `http://localhost:8000/docs`).*

### 2. Launch Flutter App
```bash
flutter run
```

### 3. Testing on Devices & Emulators
- **iOS Simulator / Desktop / Web**: Connects to `127.0.0.1:8000` automatically.
- **Android Emulator**: Connects to `10.0.2.2:8000` automatically.
- **Physical Device over Wi-Fi**:
  1. Find your computer's local IP (e.g. `192.168.1.100`).
  2. In the app, tap the **Ethernet / Server Settings** icon on the bottom navigation bar.
  3. Enter your IP and tap **Save & Reconnect**.

---

## 🧪 Verification & Automated Tests

```bash
# Flutter Static Analysis
flutter analyze

# Flutter Widget & Navigation Tests
flutter test

# Backend Pytest Suite
cd backend
PYTHONPATH=. .venv/bin/pytest tests/test_e2e.py
```
>>>>>>> e96e8f2 (feat: real-time delivery tracking PoC with Flutter frontend and FastAPI backend)
