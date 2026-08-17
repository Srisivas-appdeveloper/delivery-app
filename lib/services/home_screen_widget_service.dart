import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import '../models/order.dart';

class HomeScreenWidgetService {
  static const MethodChannel _channel = MethodChannel('com.example.delivery_app/widget');

  /// Synchronizes live order telemetry and status to the Native Android Home Screen Widget
  static Future<bool> updateWidget({
    required Order order,
  }) async {
    try {
      final etaStr = order.status == 'delivered'
          ? 'Delivered'
          : '${order.smoothedEtaMinutes.toStringAsFixed(0)} min';

      final distStr = '${(order.remainingDistanceMeters / 1000).toStringAsFixed(2)} km';

      final Map<String, dynamic> data = {
        'store_name': order.storeName,
        'status': order.status,
        'eta': etaStr,
        'distance': distStr,
        'address': order.destinationAddress,
        'rider': '${order.driverAvatar} ${order.driverName}',
      };

      final result = await _channel.invokeMethod<bool>('updateWidget', data);
      return result ?? false;
    } catch (e) {
      debugPrint('Error updating native home screen widget: $e');
      return false;
    }
  }

  /// Requests the Android OS to pin the Velox Tracking widget to the phone's launcher screen
  static Future<bool> requestPinWidget() async {
    try {
      final result = await _channel.invokeMethod<bool>('requestPinWidget');
      return result ?? false;
    } catch (e) {
      debugPrint('Error requesting to pin native home screen widget: $e');
      return false;
    }
  }
}
