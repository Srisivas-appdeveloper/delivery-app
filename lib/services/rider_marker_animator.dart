import 'package:flutter/animation.dart';
import 'package:flutter/scheduler.dart';
import 'package:latlong2/latlong.dart';

typedef MarkerUpdateCallback = void Function(LatLng position, double heading);

class RiderMarkerAnimator {
  LatLng _currentPosition;
  double _currentHeading;

  LatLng _targetPosition;
  double _targetHeading;

  LatLng _startPosition;
  double _startHeading;

  DateTime? _startTime;
  Duration _duration = const Duration(milliseconds: 1400);
  Ticker? _ticker;
  MarkerUpdateCallback? _onUpdate;

  RiderMarkerAnimator({
    required LatLng initialPosition,
    double initialHeading = 0.0,
  })  : _currentPosition = initialPosition,
        _startPosition = initialPosition,
        _targetPosition = initialPosition,
        _currentHeading = initialHeading,
        _startHeading = initialHeading,
        _targetHeading = initialHeading;

  LatLng get currentPosition => _currentPosition;
  double get currentHeading => _currentHeading;

  void attach(TickerProvider vsync, MarkerUpdateCallback onUpdate) {
    _onUpdate = onUpdate;
    _ticker?.dispose();
    _ticker = vsync.createTicker(_tick);
  }

  void animateTo(LatLng newPosition, double newHeading, {Duration? duration}) {
    // Filter impossible jumps (> 4000m)
    const Distance dist = Distance();
    final jumpMeters = dist.as(LengthUnit.Meter, _currentPosition, newPosition);
    if (jumpMeters > 4000.0) {
      _currentPosition = newPosition;
      _targetPosition = newPosition;
      _currentHeading = newHeading;
      _onUpdate?.call(_currentPosition, _currentHeading);
      return;
    }

    _startPosition = _currentPosition;
    _startHeading = _currentHeading;
    _targetPosition = newPosition;
    _targetHeading = newHeading;

    _duration = duration ?? const Duration(milliseconds: 1400);
    _startTime = DateTime.now();

    if (_ticker != null && !_ticker!.isActive) {
      _ticker!.start();
    }
  }

  void _tick(Duration elapsed) {
    if (_startTime == null) return;

    final elapsedMs = DateTime.now().difference(_startTime!).inMilliseconds;
    final progress = (elapsedMs / _duration.inMilliseconds).clamp(0.0, 1.0);

    final curveValue = Curves.easeOutCubic.transform(progress);

    // Interpolate coordinates
    final lat = _startPosition.latitude + (_targetPosition.latitude - _startPosition.latitude) * curveValue;
    final lng = _startPosition.longitude + (_targetPosition.longitude - _startPosition.longitude) * curveValue;
    _currentPosition = LatLng(lat, lng);

    // Interpolate heading across 360 circle
    double diff = (_targetHeading - _startHeading) % 360.0;
    if (diff > 180.0) diff -= 360.0;
    if (diff < -180.0) diff += 360.0;
    _currentHeading = (_startHeading + diff * curveValue) % 360.0;

    _onUpdate?.call(_currentPosition, _currentHeading);

    if (progress >= 1.0) {
      _currentPosition = _targetPosition;
      _currentHeading = _targetHeading;
      _ticker?.stop();
    }
  }

  void dispose() {
    _ticker?.dispose();
    _ticker = null;
    _onUpdate = null;
  }
}
