class ApiConstants {
  // Default to 127.0.0.1 for adb reverse and local emulator/desktop
  static String defaultHost = '127.0.0.1';

  static int port = 8000;
  static String customHost = '';

  static String get host => customHost.isNotEmpty ? customHost : defaultHost;

  static String get httpBaseUrl => 'http://$host:$port';
  static String get wsBaseUrl => 'ws://$host:$port';

  // REST Endpoints
  static String get orders => '$httpBaseUrl/api/orders';
  static String orderById(String id) => '$httpBaseUrl/api/orders/$id';
  static String orderLocation(String id) => '$httpBaseUrl/api/orders/$id/location';
  static String orderStatus(String id) => '$httpBaseUrl/api/orders/$id/status';
  static String orderTracking(String id) => '$httpBaseUrl/api/orders/$id/tracking';
  static String orderStats(String id) => '$httpBaseUrl/api/orders/$id/stats';

  // WebSocket Endpoint
  static String orderWs(String id) => '$wsBaseUrl/ws/orders/$id';
}
