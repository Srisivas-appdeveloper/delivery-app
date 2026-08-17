import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

enum TrackingWidgetVisualMode {
  compact,
  medium,
  expanded,
}

enum TrackingConnectionStatus {
  live,
  updating,
  reconnecting,
  disconnected,
  stale,
}

class TrackingWidgetState {
  final String orderId;
  final String status;
  final String storeName;
  final String destinationAddress;
  final Duration eta;
  final double remainingDistanceMeters;
  final double initialDistanceMeters;
  final String riderName;
  final String riderAvatar;
  final double currentSpeed;
  final DateTime lastUpdated;
  final TrackingConnectionStatus connectionStatus;
  final TrackingWidgetVisualMode visualMode;
  final bool isVisible;

  const TrackingWidgetState({
    required this.orderId,
    required this.status,
    required this.storeName,
    required this.destinationAddress,
    required this.eta,
    required this.remainingDistanceMeters,
    this.initialDistanceMeters = 2000.0,
    this.riderName = 'Arun Kumar',
    this.riderAvatar = '🛵',
    this.currentSpeed = 0.0,
    required this.lastUpdated,
    this.connectionStatus = TrackingConnectionStatus.live,
    this.visualMode = TrackingWidgetVisualMode.compact,
    this.isVisible = true,
  });

  /// Progress clamped between 0.0 and 1.0 based on real remaining distance
  double get progress {
    if (status == 'delivered') return 1.0;
    if (initialDistanceMeters <= 0) return 0.5;
    final clampedRem = remainingDistanceMeters.clamp(0.0, initialDistanceMeters);
    final calculated = 1.0 - (clampedRem / initialDistanceMeters);
    return calculated.clamp(0.05, 0.98);
  }

  bool get isDelivered => status.toLowerCase() == 'delivered';
  bool get isCancelled => status.toLowerCase() == 'cancelled';

  String get formattedEta {
    if (isDelivered) return 'Delivered';
    if (isCancelled) return 'Cancelled';
    final seconds = eta.inSeconds;
    if (seconds < 60 || status == 'arriving') return '< 1 min';
    if (seconds < 120) return '~1 min';
    final mins = (seconds / 60).round();
    return '~$mins min';
  }

  String get formattedDistance {
    if (remainingDistanceMeters >= 1000) {
      return '${(remainingDistanceMeters / 1000).toStringAsFixed(1)} km';
    }
    return '${remainingDistanceMeters.toStringAsFixed(0)} m';
  }

  String get statusLabel {
    switch (status.toLowerCase()) {
      case 'assigned':
        return 'Rider assigned';
      case 'preparing':
        return 'Preparing your order';
      case 'picked_up':
        return 'Order picked up';
      case 'on_the_way':
        return 'On the way';
      case 'nearby':
        return 'Rider is nearby';
      case 'arriving':
        return 'Arriving shortly';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Delivery cancelled';
      default:
        return status.replaceAll('_', ' ');
    }
  }

  Color get statusColor => AppColors.forStatus(status);

  String get connectionLabel {
    switch (connectionStatus) {
      case TrackingConnectionStatus.live:
        return 'Live';
      case TrackingConnectionStatus.updating:
        return 'Updating…';
      case TrackingConnectionStatus.reconnecting:
        return 'Reconnecting…';
      case TrackingConnectionStatus.stale:
        final ageSec = DateTime.now().difference(lastUpdated).inSeconds;
        return 'Updated ${ageSec}s ago';
      case TrackingConnectionStatus.disconnected:
        return 'Offline';
    }
  }

  Color get connectionColor {
    switch (connectionStatus) {
      case TrackingConnectionStatus.live:
        return AppColors.success;
      case TrackingConnectionStatus.updating:
      case TrackingConnectionStatus.stale:
        return AppColors.warning;
      case TrackingConnectionStatus.reconnecting:
      case TrackingConnectionStatus.disconnected:
        return AppColors.error;
    }
  }

  TrackingWidgetState copyWith({
    String? orderId,
    String? status,
    String? storeName,
    String? destinationAddress,
    Duration? eta,
    double? remainingDistanceMeters,
    double? initialDistanceMeters,
    String? riderName,
    String? riderAvatar,
    double? currentSpeed,
    DateTime? lastUpdated,
    TrackingConnectionStatus? connectionStatus,
    TrackingWidgetVisualMode? visualMode,
    bool? isVisible,
  }) {
    return TrackingWidgetState(
      orderId: orderId ?? this.orderId,
      status: status ?? this.status,
      storeName: storeName ?? this.storeName,
      destinationAddress: destinationAddress ?? this.destinationAddress,
      eta: eta ?? this.eta,
      remainingDistanceMeters: remainingDistanceMeters ?? this.remainingDistanceMeters,
      initialDistanceMeters: initialDistanceMeters ?? this.initialDistanceMeters,
      riderName: riderName ?? this.riderName,
      riderAvatar: riderAvatar ?? this.riderAvatar,
      currentSpeed: currentSpeed ?? this.currentSpeed,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      connectionStatus: connectionStatus ?? this.connectionStatus,
      visualMode: visualMode ?? this.visualMode,
      isVisible: isVisible ?? this.isVisible,
    );
  }
}
