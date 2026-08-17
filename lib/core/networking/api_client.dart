import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../../models/order.dart';
import '../../models/location_point.dart';

class ApiClient {
  late final Dio _dio;

  ApiClient({Dio? customDio}) {
    _dio = customDio ??
        Dio(
          BaseOptions(
            baseUrl: ApiConstants.httpBaseUrl,
            connectTimeout: const Duration(seconds: 6),
            receiveTimeout: const Duration(seconds: 6),
            sendTimeout: const Duration(seconds: 6),
            headers: {'Content-Type': 'application/json'},
          ),
        );
  }

  void updateBaseUrl() {
    _dio.options.baseUrl = ApiConstants.httpBaseUrl;
  }

  Future<List<Order>> getOrders() async {
    try {
      updateBaseUrl();
      final response = await _dio.get('/api/orders');
      if (response.statusCode == 200 && response.data is List) {
        return (response.data as List).map((json) => Order.fromJson(json as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<Order?> getOrderById(String orderId) async {
    try {
      updateBaseUrl();
      final response = await _dio.get('/api/orders/$orderId');
      if (response.statusCode == 200 && response.data != null) {
        return Order.fromJson(response.data as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }

  Future<Order?> sendLocationUpdate(String orderId, LocationPoint point) async {
    try {
      updateBaseUrl();
      final response = await _dio.post(
        '/api/orders/$orderId/location',
        data: point.toJson(),
      );
      if (response.statusCode == 200 && response.data != null) {
        return Order.fromJson(response.data as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }

  Future<Order?> updateOrderStatus(String orderId, String status, {String? note}) async {
    try {
      updateBaseUrl();
      final payload = <String, dynamic>{'status': status};
      if (note != null) {
        payload['note'] = note;
      }

      final response = await _dio.patch(
        '/api/orders/$orderId/status',
        data: payload,
      );
      if (response.statusCode == 200 && response.data != null) {
        return Order.fromJson(response.data as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }

  Future<Map<String, dynamic>?> getOrderStats(String orderId) async {
    try {
      updateBaseUrl();
      final response = await _dio.get('/api/orders/$orderId/stats');
      if (response.statusCode == 200) {
        return response.data as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  Future<Order?> createOrder({
    String orderId = 'ORD001',
    String driverName = 'Arun Kumar',
    String storeName = 'Artisan Bakery & Cafe',
    double storeLat = 11.0168,
    double storeLng = 76.9558,
    String destinationAddress = '742 Evergreen Terrace',
    double destLat = 11.0250,
    double destLng = 76.9680,
  }) async {
    try {
      updateBaseUrl();
      final response = await _dio.post(
        '/api/orders',
        data: {
          'id': orderId,
          'driver_id': 'DRIVER001',
          'customer_id': 'CUSTOMER001',
          'store_name': storeName,
          'store_latitude': storeLat,
          'store_longitude': storeLng,
          'destination_latitude': destLat,
          'destination_longitude': destLng,
        },
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        return Order.fromJson(response.data as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }
}
