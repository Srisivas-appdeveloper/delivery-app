import 'package:latlong2/latlong.dart';
import '../models/location_point.dart';
import '../models/location_decision.dart';
import '../models/telemetry_stats.dart';

class AdaptiveLocationEngine {
  // Configurable optimization thresholds
  final double minDisplacementMeters;
  final double maxAcceptableAccuracyMeters;
  final double significantHeadingChangeDegrees;
  final Duration heartbeatInterval;
  final double stationarySpeedMps;

  TelemetryStats telemetry = const TelemetryStats();
  final Distance _distance = const Distance();

  AdaptiveLocationEngine({
    this.minDisplacementMeters = 10.0,
    this.maxAcceptableAccuracyMeters = 25.0,
    this.significantHeadingChangeDegrees = 25.0,
    this.heartbeatInterval = const Duration(seconds: 15),
    this.stationarySpeedMps = 0.5,
  });

  Duration getIntervalForDistance(double remainingDistanceMeters) {
    if (remainingDistanceMeters > 2000.0) {
      return const Duration(seconds: 10);
    } else if (remainingDistanceMeters >= 500.0) {
      return const Duration(seconds: 5);
    } else {
      return const Duration(seconds: 2);
    }
  }

  LocationDecision evaluate({
    LocationPoint? previousPoint,
    required LocationPoint currentPoint,
    required LatLng destination,
    DateTime? lastSendTime,
  }) {
    telemetry = telemetry.copyWith(totalGpsReadings: telemetry.totalGpsReadings + 1);

    // 1. Accuracy Filter
    if (currentPoint.accuracy > maxAcceptableAccuracyMeters) {
      final reason = 'REJECTED_POOR_ACCURACY (±${currentPoint.accuracy.toStringAsFixed(1)}m)';
      telemetry = telemetry.copyWith(
        updatesSkipped: telemetry.updatesSkipped + 1,
        lastReason: reason,
      );
      return LocationDecision(
        shouldSend: false,
        reason: reason,
        nextInterval: telemetry.currentInterval,
      );
    }

    // Distance to destination
    final remainingMeters = _distance.as(
      LengthUnit.Meter,
      LatLng(currentPoint.latitude, currentPoint.longitude),
      destination,
    );

    final dynamicInterval = getIntervalForDistance(remainingMeters);
    telemetry = telemetry.copyWith(currentInterval: dynamicInterval);

    // If first point, send immediately
    if (previousPoint == null || lastSendTime == null) {
      const reason = 'INITIAL_LOCATION';
      telemetry = telemetry.copyWith(
        updatesSent: telemetry.updatesSent + 1,
        lastSentTime: DateTime.now(),
        lastReason: reason,
      );
      return LocationDecision(
        shouldSend: true,
        reason: reason,
        nextInterval: dynamicInterval,
      );
    }

    final elapsed = DateTime.now().difference(lastSendTime);

    // Calculate displacement
    final displacement = _distance.as(
      LengthUnit.Meter,
      LatLng(previousPoint.latitude, previousPoint.longitude),
      LatLng(currentPoint.latitude, currentPoint.longitude),
    );

    // 2. Significant Heading Change Check
    final headingDiff = (currentPoint.heading - previousPoint.heading).abs();
    final normalizedDiff = headingDiff > 180 ? 360 - headingDiff : headingDiff;
    if (normalizedDiff >= significantHeadingChangeDegrees && displacement >= 5.0) {
      final reason = 'HEADING_CHANGED (${normalizedDiff.toStringAsFixed(0)}°)';
      telemetry = telemetry.copyWith(
        updatesSent: telemetry.updatesSent + 1,
        lastSentTime: DateTime.now(),
        lastReason: reason,
      );
      return LocationDecision(
        shouldSend: true,
        reason: reason,
        nextInterval: dynamicInterval,
      );
    }

    // 3. Heartbeat Timeout Check
    if (elapsed >= heartbeatInterval) {
      final reason = 'HEARTBEAT_TIMEOUT (${elapsed.inSeconds}s)';
      telemetry = telemetry.copyWith(
        updatesSent: telemetry.updatesSent + 1,
        lastSentTime: DateTime.now(),
        lastReason: reason,
      );
      return LocationDecision(
        shouldSend: true,
        reason: reason,
        nextInterval: dynamicInterval,
      );
    }

    // 4. Movement Threshold Check (< 10m skip)
    if (displacement < minDisplacementMeters) {
      final reason = 'SKIPPED_UNDER_10M (moved ${displacement.toStringAsFixed(1)}m)';
      telemetry = telemetry.copyWith(
        updatesSkipped: telemetry.updatesSkipped + 1,
        lastReason: reason,
      );
      return LocationDecision(
        shouldSend: false,
        reason: reason,
        nextInterval: dynamicInterval,
      );
    }

    // 5. Dynamic Interval Rate Throttling
    if (elapsed < dynamicInterval) {
      final reason = 'THROTTLED (wait ${dynamicInterval.inSeconds}s, elapsed ${elapsed.inSeconds}s)';
      telemetry = telemetry.copyWith(
        updatesSkipped: telemetry.updatesSkipped + 1,
        lastReason: reason,
      );
      return LocationDecision(
        shouldSend: false,
        reason: reason,
        nextInterval: dynamicInterval,
      );
    }

    // 6. Normal Movement Update
    final reason = 'RIDER_MOVED (${displacement.toStringAsFixed(0)}m)';
    telemetry = telemetry.copyWith(
      updatesSent: telemetry.updatesSent + 1,
      lastSentTime: DateTime.now(),
      lastReason: reason,
    );
    return LocationDecision(
      shouldSend: true,
      reason: reason,
      nextInterval: dynamicInterval,
    );
  }

  void reset() {
    telemetry = const TelemetryStats();
  }
}
