import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/networking/websocket_client.dart';
import '../../../services/delivery_providers.dart';
import '../models/tracking_widget_state.dart';

final trackingWidgetVisualModeProvider =
    StateProvider<TrackingWidgetVisualMode>((ref) => TrackingWidgetVisualMode.compact);

final trackingWidgetProvider = Provider<TrackingWidgetState>((ref) {
  final order = ref.watch(activeOrderProvider);
  final wsStatus = ref.watch(webSocketStatusProvider).value ?? WebSocketStatus.disconnected;
  final visualMode = ref.watch(trackingWidgetVisualModeProvider);

  final currentStatus = order?.status ?? 'idle';
  final storeName = order?.storeName ?? 'No Active Order';
  final destAddr = order?.destinationAddress ?? 'Ready to deliver';
  final etaMins = order?.smoothedEtaMinutes ?? 0.0;
  final remDist = order?.remainingDistanceMeters ?? 0.0;
  final rider = order?.driverName ?? 'Driver';
  final avatar = order?.driverAvatar ?? '🛵';
  final speed = order?.currentSpeed ?? 0.0;
  final updated = order?.updatedAt ?? DateTime.now();

  // Map WebSocket status to tracking connection status
  TrackingConnectionStatus connStatus;
  if (order == null) {
    connStatus = TrackingConnectionStatus.disconnected;
  } else {
    switch (wsStatus) {
      case WebSocketStatus.connected:
        final age = DateTime.now().difference(updated).inSeconds;
        if (age > 30) {
          connStatus = TrackingConnectionStatus.stale;
        } else if (age > 10) {
          connStatus = TrackingConnectionStatus.updating;
        } else {
          connStatus = TrackingConnectionStatus.live;
        }
        break;
      case WebSocketStatus.reconnecting:
        connStatus = TrackingConnectionStatus.reconnecting;
        break;
      case WebSocketStatus.disconnected:
        connStatus = TrackingConnectionStatus.disconnected;
        break;
    }
  }

  // Calculate ETA duration
  final etaSeconds = (etaMins * 60).round();

  return TrackingWidgetState(
    orderId: order?.id ?? '',
    status: currentStatus,
    storeName: storeName,
    destinationAddress: destAddr,
    eta: Duration(seconds: etaSeconds),
    remainingDistanceMeters: remDist,
    initialDistanceMeters: remDist > 0 ? remDist : 1000.0,
    riderName: rider,
    riderAvatar: avatar,
    currentSpeed: speed,
    lastUpdated: updated,
    connectionStatus: connStatus,
    visualMode: visualMode,
    isVisible: order != null,
  );
});

// Granular sub-providers for lightweight subscriptions
final trackingStatusProvider = Provider<String>((ref) {
  return ref.watch(trackingWidgetProvider).status;
});

final etaProvider = Provider<Duration>((ref) {
  return ref.watch(trackingWidgetProvider).eta;
});

final distanceProvider = Provider<double>((ref) {
  return ref.watch(trackingWidgetProvider).remainingDistanceMeters;
});

final riderLocationProvider = Provider<LatLng?>((ref) {
  final order = ref.watch(activeOrderProvider);
  if (order == null || order.currentLat == null || order.currentLng == null) {
    return null;
  }
  return LatLng(order.currentLat!, order.currentLng!);
});

final connectionStatusProvider = Provider<TrackingConnectionStatus>((ref) {
  return ref.watch(trackingWidgetProvider).connectionStatus;
});
