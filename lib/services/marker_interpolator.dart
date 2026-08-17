import 'package:flutter/animation.dart';
import 'package:flutter/scheduler.dart';
import 'package:latlong2/latlong.dart';

class MarkerInterpolator {
  LatLng _currentPosition;
  double _currentHeading;

  LatLng _targetPosition;
  double _targetHeading;

  LatLng _startPosition;
  double _startHeading;

  DateTime? _animationStartTime;
  Duration _animationDuration = const Duration(milliseconds: 1200);
  Ticker? _ticker;
  Function(LatLng position, double heading)? _onUpdate;

  MarkerInterpolator({
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

  void init(TickerProvider vsync, Function(LatLng position, double heading) onUpdate) {
    _onUpdate = onUpdate;
    _ticker?.dispose();
    _ticker = vsync.createTicker(_handleTick);
  }

  void animateTo(LatLng newPosition, double newHeading, {Duration? duration}) {
    // Impossible jump filter (> 5000m single jump ignore)
    const Distance distCalc = Distance();
    final jumpDist = distCalc.as(LengthUnit.Meter, _currentPosition, newPosition);
    if (jumpDist > 5000.0) {
      // Direct snap for huge jumps
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

    _animationDuration = duration ?? const Duration(milliseconds: 1400);
    _animationStartTime = DateTime.now();

    if (_ticker != null && !_ticker!.isActive) {
      _ticker!.start();
    }
  }

  void _handleTick(Duration elapsed) {
    if (_animationStartTime == null) return;

    final timePassed = DateTime.now().difference(_animationStartTime!).inMilliseconds;
    final progress = (timePassed / _animationDuration.inMilliseconds).clamp(0.0, 1.0);

    // Ease-out cubic curve for natural decelerating glide
    final curveValue = Curves.easeOutCubic.transform(progress);

    // Interpolate Latitude & Longitude
    final lat = _startPosition.latitude + (_targetPosition.latitude - _startPosition.latitude) * curveValue;
    final lng = _startPosition.longitude + (_targetPosition.longitude - _startPosition.longitude) * curveValue;
    _currentPosition = LatLng(lat, lng);

    // Interpolate Heading smoothly across 360 degree boundary
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
