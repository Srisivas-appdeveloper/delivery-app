import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import '../core/networking/api_client.dart';
import '../core/networking/websocket_client.dart';
import '../models/order.dart';
import '../models/location_point.dart';
import '../models/telemetry_stats.dart';
import '../models/store.dart';
import 'adaptive_location_engine.dart';
import 'geolocation_service.dart';
import 'home_screen_widget_service.dart';

// Basic service singletons
final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());
final webSocketServiceProvider = Provider<TrackingWebSocketService>((ref) {
  final ws = TrackingWebSocketService();
  ref.onDispose(() => ws.dispose());
  return ws;
});
final adaptiveEngineProvider = Provider<AdaptiveLocationEngine>((ref) => AdaptiveLocationEngine());
final geolocationServiceProvider = Provider<GeolocationService>((ref) => GeolocationService());

// Active Order ID (Starts null until user places a real order)
final activeOrderIdProvider = StateProvider<String?>((ref) => null);

// WebSocket status stream
final webSocketStatusProvider = StreamProvider<WebSocketStatus>((ref) {
  final ws = ref.watch(webSocketServiceProvider);
  return ws.statusStream;
});

// Orders List Notifier
class OrdersListNotifier extends StateNotifier<AsyncValue<List<Order>>> {
  final ApiClient _apiClient;
  final Ref _ref;

  OrdersListNotifier(this._apiClient, this._ref) : super(const AsyncValue.loading()) {
    refresh();
  }

  Future<void> refresh() async {
    try {
      state = const AsyncValue.loading();
      final orders = await _apiClient.getOrders();
      state = AsyncValue.data(orders);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<Order?> createNewOrder() async {
    final userLoc = _ref.read(userLocationProvider);
    final orderId = 'ORD-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
    final order = await _apiClient.createOrder(
      orderId: orderId,
      storeName: 'Artisan Bakery',
      storeLat: userLoc.position.latitude + 0.004,
      storeLng: userLoc.position.longitude + 0.003,
      destinationAddress: userLoc.addressName,
      destLat: userLoc.position.latitude,
      destLng: userLoc.position.longitude,
    );
    if (order != null) {
      await refresh();
      _ref.read(activeOrderIdProvider.notifier).state = order.id;
    }
    return order;
  }

  Future<Order?> createOrder({
    String? orderId,
    String? customerName,
    String storeName = 'Artisan Bakery',
    double storeLat = 12.7449,
    double storeLng = 77.8283,
    String destinationAddress = 'Live Location',
    double destinationLat = 12.7409,
    double destinationLng = 77.8253,
  }) async {
    final effectiveId = orderId ?? 'ORD-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
    final order = await _apiClient.createOrder(
      orderId: effectiveId,
      storeName: storeName,
      storeLat: storeLat,
      storeLng: storeLng,
      destinationAddress: destinationAddress,
      destLat: destinationLat,
      destLng: destinationLng,
    );
    if (order != null) {
      await refresh();
      _ref.read(activeOrderIdProvider.notifier).state = order.id;
    }
    return order;
  }
}

final ordersListProvider = StateNotifierProvider<OrdersListNotifier, AsyncValue<List<Order>>>((ref) {
  final api = ref.watch(apiClientProvider);
  return OrdersListNotifier(api, ref);
});

// Active Order State Notifier (null until order is placed)
class ActiveOrderNotifier extends StateNotifier<Order?> {
  final ApiClient _apiClient;
  final TrackingWebSocketService _wsService;
  final Ref _ref;
  StreamSubscription? _wsEventsSub;
  String? _connectedOrderId;

  ActiveOrderNotifier(this._apiClient, this._wsService, this._ref) : super(null) {
    _ref.listen<String?>(activeOrderIdProvider, (previous, next) {
      if (next != null && next != _connectedOrderId) {
        loadOrder(next);
      } else if (next == null) {
        _connectedOrderId = null;
        _wsService.disconnect();
        _wsEventsSub?.cancel();
        state = null;
      }
    });

    final currentId = _ref.read(activeOrderIdProvider);
    if (currentId != null) {
      loadOrder(currentId);
    }
  }

  Future<void> loadOrder(String orderId) async {
    _connectedOrderId = orderId;
    final order = await _apiClient.getOrderById(orderId);
    if (order != null) {
      state = order;
      HomeScreenWidgetService.updateWidget(order: order);
    }

    _wsService.connect(orderId);
    _wsEventsSub?.cancel();
    _wsEventsSub = _wsService.eventStream.listen((event) {
      _handleEvent(event);
    });
  }

  void _handleEvent(Map<String, dynamic> event) {
    final type = event['type'] as String?;
    final data = event['data'] as Map<String, dynamic>? ?? {};

    if (state == null) return;

    if (type == 'location_update') {
      final lat = (data['latitude'] as num?)?.toDouble() ?? state!.currentLat;
      final lng = (data['longitude'] as num?)?.toDouble() ?? state!.currentLng;
      final heading = (data['heading'] as num?)?.toDouble() ?? state!.currentHeading;
      final speed = (data['speed'] as num?)?.toDouble() ?? state!.currentSpeed;
      final accuracy = (data['accuracy'] as num?)?.toDouble() ?? state!.currentAccuracy;

      final dist = (data['distance_remaining'] as num?)?.toDouble() ??
          (data['remaining_distance_meters'] as num?)?.toDouble() ??
          state!.remainingDistanceMeters;

      double eta = state!.smoothedEtaMinutes;
      if (data['eta_seconds'] != null) {
        eta = (data['eta_seconds'] as num).toDouble() / 60.0;
      } else if (data['smoothed_eta_minutes'] != null) {
        eta = (data['smoothed_eta_minutes'] as num).toDouble();
      }

      final status = data['status'] as String? ?? state!.status;

      state = state!.copyWith(
        currentLat: lat,
        currentLng: lng,
        currentHeading: heading,
        currentSpeed: speed,
        currentAccuracy: accuracy,
        remainingDistanceMeters: dist,
        smoothedEtaMinutes: eta,
        status: status,
        updatedAt: DateTime.now(),
      );
      HomeScreenWidgetService.updateWidget(order: state!);
    } else if (type == 'status_update') {
      final newStatus = data['status'] as String? ?? data['new_status'] as String?;
      if (newStatus != null) {
        state = state!.copyWith(
          status: newStatus,
          updatedAt: DateTime.now(),
        );
        HomeScreenWidgetService.updateWidget(order: state!);
      }
    } else if (type == 'eta_update') {
      if (data['eta_seconds'] != null) {
        state = state!.copyWith(
          smoothedEtaMinutes: (data['eta_seconds'] as num).toDouble() / 60.0,
          updatedAt: DateTime.now(),
        );
        HomeScreenWidgetService.updateWidget(order: state!);
      }
    } else if (type == 'delivery_completed') {
      state = state!.copyWith(
        status: 'delivered',
        remainingDistanceMeters: 0.0,
        smoothedEtaMinutes: 0.0,
        updatedAt: DateTime.now(),
      );
      HomeScreenWidgetService.updateWidget(order: state!);
    }
  }

  void updateLocalPosition({
    required double lat,
    required double lng,
    required double heading,
    required double speed,
    required double remainingDistance,
    String? status,
  }) {
    if (state == null) return;
    state = state!.copyWith(
      currentLat: lat,
      currentLng: lng,
      currentHeading: heading,
      currentSpeed: speed,
      remainingDistanceMeters: remainingDistance,
      smoothedEtaMinutes: remainingDistance > 0 ? (remainingDistance / 5.56) / 60.0 : 0.0,
      status: status ?? state!.status,
      updatedAt: DateTime.now(),
    );
    HomeScreenWidgetService.updateWidget(order: state!);
  }

  Future<void> updateStatus(String newStatus) async {
    if (state == null) return;
    final updated = await _apiClient.updateOrderStatus(state!.id, newStatus);
    if (updated != null) {
      state = updated;
      HomeScreenWidgetService.updateWidget(order: state!);
    }
  }

  @override
  void dispose() {
    _wsEventsSub?.cancel();
    super.dispose();
  }
}

final activeOrderProvider = StateNotifierProvider<ActiveOrderNotifier, Order?>((ref) {
  final api = ref.watch(apiClientProvider);
  final ws = ref.watch(webSocketServiceProvider);
  return ActiveOrderNotifier(api, ws, ref);
});

// Driver Simulation State Model
class DriverSimulationState {
  final bool isSimulating;
  final bool isPaused;
  final int speedMultiplier;
  final int stepIndex;
  final bool useRealGps;
  final String gpsStatus;
  final TelemetryStats telemetry;

  const DriverSimulationState({
    this.isSimulating = false,
    this.isPaused = false,
    this.speedMultiplier = 1,
    this.stepIndex = 0,
    this.useRealGps = false,
    this.gpsStatus = 'Ready',
    this.telemetry = const TelemetryStats(),
  });

  DriverSimulationState copyWith({
    bool? isSimulating,
    bool? isPaused,
    int? speedMultiplier,
    int? stepIndex,
    bool? useRealGps,
    String? gpsStatus,
    TelemetryStats? telemetry,
  }) {
    return DriverSimulationState(
      isSimulating: isSimulating ?? this.isSimulating,
      isPaused: isPaused ?? this.isPaused,
      speedMultiplier: speedMultiplier ?? this.speedMultiplier,
      stepIndex: stepIndex ?? this.stepIndex,
      useRealGps: useRealGps ?? this.useRealGps,
      gpsStatus: gpsStatus ?? this.gpsStatus,
      telemetry: telemetry ?? this.telemetry,
    );
  }
}

// Driver Simulation Notifier
class DriverSimulationNotifier extends StateNotifier<DriverSimulationState> {
  final Ref _ref;
  final AdaptiveLocationEngine _engine;
  final GeolocationService _geoService;
  Timer? _timer;
  StreamSubscription? _gpsSub;
  final List<LatLng> _routePoints = [];
  LocationPoint? _lastSentPoint;
  DateTime? _lastSentTime;

  DriverSimulationNotifier(this._ref, this._engine, this._geoService)
      : super(const DriverSimulationState());

  void setSpeed(int speed) {
    state = state.copyWith(speedMultiplier: speed);
    if (state.isSimulating && !state.isPaused) {
      _startTimer();
    }
  }

  List<LatLng> generateRouteWaypoints(Order order) {
    _routePoints.clear();
    final start = LatLng(order.storeLat, order.storeLng);
    final end = LatLng(order.destinationLat, order.destinationLng);

    final latDelta = end.latitude - start.latitude;
    final lngDelta = end.longitude - start.longitude;

    final keyPoints = [
      start,
      LatLng(start.latitude + latDelta * 0.20, start.longitude + lngDelta * 0.05),
      LatLng(start.latitude + latDelta * 0.35, start.longitude + lngDelta * 0.40),
      LatLng(start.latitude + latDelta * 0.60, start.longitude + lngDelta * 0.55),
      LatLng(start.latitude + latDelta * 0.80, start.longitude + lngDelta * 0.85),
      LatLng(start.latitude + latDelta * 0.95, start.longitude + lngDelta * 0.95),
      end,
    ];

    const distCalc = Distance();
    for (int i = 0; i < keyPoints.length - 1; i++) {
      final p1 = keyPoints[i];
      final p2 = keyPoints[i + 1];
      final segmentMeters = distCalc.as(LengthUnit.Meter, p1, p2);
      final steps = (segmentMeters / 35.0).clamp(2, 30).toInt();
      for (int s = 0; s < steps; s++) {
        final t = s / steps;
        _routePoints.add(LatLng(
          p1.latitude + (p2.latitude - p1.latitude) * t,
          p1.longitude + (p2.longitude - p1.longitude) * t,
        ));
      }
    }
    _routePoints.add(end);
    return _routePoints;
  }

  List<LatLng> get currentRoutePoints => _routePoints;

  void startSimulation({Order? order}) {
    final targetOrder = order ?? _ref.read(activeOrderProvider);
    if (targetOrder == null) return;

    generateRouteWaypoints(targetOrder);
    _engine.reset();
    _lastSentPoint = null;
    _lastSentTime = null;

    state = state.copyWith(
      isSimulating: true,
      isPaused: false,
      stepIndex: 0,
      telemetry: _engine.telemetry,
    );

    _startTimer();
  }

  void pause() {
    _timer?.cancel();
    state = state.copyWith(isPaused: true);
  }

  void resume() {
    if (!state.isSimulating) {
      startSimulation();
      return;
    }
    state = state.copyWith(isPaused: false);
    _startTimer();
  }

  void stop() {
    _timer?.cancel();
    state = state.copyWith(isSimulating: false, isPaused: false);
  }

  Future<void> stepForward() async {
    final order = _ref.read(activeOrderProvider);
    if (order == null) return;
    if (_routePoints.isEmpty) {
      generateRouteWaypoints(order);
    }
    if (!state.isSimulating) {
      state = state.copyWith(isSimulating: true, isPaused: true);
    }
    await _tick();
  }

  void reset() {
    stop();
    _engine.reset();
    _lastSentPoint = null;
    _lastSentTime = null;
    state = state.copyWith(
      stepIndex: 0,
      telemetry: _engine.telemetry,
    );
    final activeNotifier = _ref.read(activeOrderProvider.notifier);
    activeNotifier.updateStatus('on_the_way');
  }

  void _startTimer() {
    _timer?.cancel();
    final intervalMs = (1000 / state.speedMultiplier).round();
    _timer = Timer.periodic(Duration(milliseconds: intervalMs), (_) => _tick());
  }

  Future<void> _tick() async {
    final order = _ref.read(activeOrderProvider);
    if (order == null || _routePoints.isEmpty) return;

    if (state.stepIndex >= _routePoints.length) {
      stop();
      await _ref.read(activeOrderProvider.notifier).updateStatus('delivered');
      return;
    }

    final currentCoord = _routePoints[state.stepIndex];
    final nextIdx = state.stepIndex + 1;
    state = state.copyWith(stepIndex: nextIdx);

    // Calculate heading
    double heading = 0.0;
    if (nextIdx < _routePoints.length) {
      const dist = Distance();
      heading = dist.bearing(currentCoord, _routePoints[nextIdx]);
    }

    final speedMps = 7.0 * state.speedMultiplier;
    final locPoint = LocationPoint(
      latitude: currentCoord.latitude,
      longitude: currentCoord.longitude,
      accuracy: 4.0,
      speed: speedMps,
      heading: (heading + 360.0) % 360.0,
      timestamp: DateTime.now(),
    );

    final dest = LatLng(order.destinationLat, order.destinationLng);
    final decision = _engine.evaluate(
      previousPoint: _lastSentPoint,
      currentPoint: locPoint,
      destination: dest,
      lastSendTime: _lastSentTime,
    );

    const distCalc = Distance();
    final remDist = distCalc.as(LengthUnit.Meter, currentCoord, dest);
    String autoStatus = order.status;
    if (remDist <= 300.0) {
      autoStatus = 'arriving';
    } else if (remDist <= 1000.0) {
      autoStatus = 'nearby';
    } else if (order.status == 'assigned' || order.status == 'preparing') {
      autoStatus = 'on_the_way';
    }

    _ref.read(activeOrderProvider.notifier).updateLocalPosition(
          lat: currentCoord.latitude,
          lng: currentCoord.longitude,
          heading: (heading + 360.0) % 360.0,
          speed: speedMps,
          remainingDistance: remDist,
          status: autoStatus,
        );

    if (decision.shouldSend) {
      _lastSentPoint = locPoint;
      _lastSentTime = DateTime.now();

      await _ref.read(apiClientProvider).sendLocationUpdate(
            order.id,
            LocationPoint(
              latitude: locPoint.latitude,
              longitude: locPoint.longitude,
              accuracy: locPoint.accuracy,
              speed: locPoint.speed,
              heading: locPoint.heading,
              timestamp: locPoint.timestamp,
              reason: decision.reason,
            ),
          );
    }

    state = state.copyWith(telemetry: _engine.telemetry);
  }

  Future<void> toggleRealGps(bool enable) async {
    if (enable) {
      stop();
      state = state.copyWith(useRealGps: true, gpsStatus: 'Requesting permission...');
      final perm = await _geoService.checkAndRequestPermission();
      if (perm != GpsPermissionStatus.granted) {
        state = state.copyWith(gpsStatus: 'Permission: $perm');
        return;
      }

      state = state.copyWith(gpsStatus: 'Streaming live GPS...');
      final stream = _geoService.startPositionStream();
      _gpsSub?.cancel();
      _gpsSub = stream?.listen((position) {
        final order = _ref.read(activeOrderProvider);
        if (order == null) return;

        final locPoint = LocationPoint(
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
          speed: position.speed,
          heading: position.heading,
          timestamp: position.timestamp,
        );

        final dest = LatLng(order.destinationLat, order.destinationLng);
        final decision = _engine.evaluate(
          previousPoint: _lastSentPoint,
          currentPoint: locPoint,
          destination: dest,
          lastSendTime: _lastSentTime,
        );

        if (decision.shouldSend) {
          _lastSentPoint = locPoint;
          _lastSentTime = DateTime.now();
          _ref.read(apiClientProvider).sendLocationUpdate(order.id, locPoint);
        }

        state = state.copyWith(
          gpsStatus: 'Live (${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)})',
          telemetry: _engine.telemetry,
        );
      });
    } else {
      _gpsSub?.cancel();
      _gpsSub = null;
      state = state.copyWith(useRealGps: false, gpsStatus: 'Sim ready');
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _gpsSub?.cancel();
    super.dispose();
  }
}

final driverSimulationProvider =
    StateNotifierProvider<DriverSimulationNotifier, DriverSimulationState>((ref) {
  final engine = ref.watch(adaptiveEngineProvider);
  final geo = ref.watch(geolocationServiceProvider);
  return DriverSimulationNotifier(ref, engine, geo);
});

// User Live Location State
class UserLocationState {
  final LatLng position;
  final String addressName;
  final bool hasPermission;
  final bool isLoading;
  final String? errorMessage;

  const UserLocationState({
    required this.position,
    this.addressName = '742 Evergreen Terrace',
    this.hasPermission = false,
    this.isLoading = false,
    this.errorMessage,
  });

  UserLocationState copyWith({
    LatLng? position,
    String? addressName,
    bool? hasPermission,
    bool? isLoading,
    String? errorMessage,
  }) {
    return UserLocationState(
      position: position ?? this.position,
      addressName: addressName ?? this.addressName,
      hasPermission: hasPermission ?? this.hasPermission,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

class UserLocationNotifier extends StateNotifier<UserLocationState> {
  final GeolocationService _geoService;
  StreamSubscription<Position>? _posSub;

  UserLocationNotifier(this._geoService)
      : super(
          const UserLocationState(
            position: LatLng(12.7409, 77.8253), // Default fallback
            addressName: 'Fetching your live GPS location...',
            isLoading: true,
          ),
        ) {
    requestLiveLocation();
  }

  Future<void> openSettings() async {
    await _geoService.openAppSettings();
  }

  Future<void> openGpsSettings() async {
    await _geoService.openLocationSettings();
  }

  Future<void> requestLiveLocation({bool openSettingsIfDenied = false}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final perm = await _geoService.checkAndRequestPermission();

      if (perm == GpsPermissionStatus.permanentlyDenied) {
        if (openSettingsIfDenied) {
          await _geoService.openAppSettings();
        }
        state = state.copyWith(
          hasPermission: false,
          isLoading: false,
          errorMessage: 'Location permission permanently denied. Tap to open Settings.',
        );
        return;
      }

      if (perm == GpsPermissionStatus.serviceDisabled) {
        if (openSettingsIfDenied) {
          await _geoService.openLocationSettings();
        }
        state = state.copyWith(
          hasPermission: false,
          isLoading: false,
          errorMessage: 'Device GPS is turned off. Tap to enable Location in Settings.',
        );
        return;
      }

      if (perm == GpsPermissionStatus.granted) {
        final pos = await _geoService.getCurrentPosition();
        if (pos != null) {
          final address = await _geoService.reverseGeocode(pos.latitude, pos.longitude);
          state = state.copyWith(
            position: LatLng(pos.latitude, pos.longitude),
            addressName: address ?? 'Live (${pos.latitude.toStringAsFixed(4)}, ${pos.longitude.toStringAsFixed(4)})',
            hasPermission: true,
            isLoading: false,
            errorMessage: null,
          );
        } else {
          state = state.copyWith(hasPermission: true, isLoading: false);
        }

        _posSub?.cancel();
        _posSub = _geoService.startPositionStream(distanceFilter: 3)?.listen((p) async {
          final newPos = LatLng(p.latitude, p.longitude);
          const distCalc = Distance();
          final diff = distCalc.as(LengthUnit.Meter, state.position, newPos);
          if (diff > 5) {
            final addr = await _geoService.reverseGeocode(p.latitude, p.longitude);
            state = state.copyWith(
              position: newPos,
              addressName: addr ?? state.addressName,
              hasPermission: true,
            );
          }
        });
      } else {
        state = state.copyWith(
          hasPermission: false,
          isLoading: false,
          addressName: 'Location permission required',
          errorMessage: 'Grant GPS permission to discover real stores near you',
        );
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
    }
  }

  @override
  void dispose() {
    _posSub?.cancel();
    super.dispose();
  }
}

final userLocationProvider =
    StateNotifierProvider<UserLocationNotifier, UserLocationState>((ref) {
  final geo = ref.watch(geolocationServiceProvider);
  return UserLocationNotifier(geo);
});

// Dynamic Real-Time Nearby Stores Provider fetching from OpenStreetMap & live GPS
final nearbyStoresProvider = FutureProvider<List<Store>>((ref) async {
  final userLoc = ref.watch(userLocationProvider);
  final geo = ref.watch(geolocationServiceProvider);
  return await geo.fetchNearbyPlacesFromOSM(
    userLoc.position.latitude,
    userLoc.position.longitude,
  );
});

