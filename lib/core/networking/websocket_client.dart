import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../constants/api_constants.dart';

enum WebSocketStatus { connected, reconnecting, disconnected }

class TrackingWebSocketService {
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _reconnectTimer;
  Timer? _heartbeatTimer;

  String? _orderId;
  bool _isDisposed = false;
  int _reconnectAttempts = 0;
  int _messagesReceivedCount = 0;
  DateTime? _lastMessageTime;
  String _lastRawResponse = 'None';

  final _statusController = StreamController<WebSocketStatus>.broadcast();
  final _eventController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<WebSocketStatus> get statusStream => _statusController.stream;
  Stream<Map<String, dynamic>> get eventStream => _eventController.stream;
  int get messagesReceivedCount => _messagesReceivedCount;
  DateTime? get lastMessageTime => _lastMessageTime;
  String get lastRawResponse => _lastRawResponse;

  void connect(String orderId) {
    if (_orderId == orderId && _channel != null) return;
    _orderId = orderId;
    _isDisposed = false;
    _reconnectAttempts = 0;
    _establishConnection();
  }

  void _establishConnection() {
    if (_isDisposed || _orderId == null) return;

    _statusController.add(WebSocketStatus.reconnecting);

    try {
      final wsUrl = Uri.parse(ApiConstants.orderWs(_orderId!));
      final channel = WebSocketChannel.connect(wsUrl);
      _channel = channel;

      // Handle async TCP handshake errors on channel.ready to prevent unhandled exceptions
      channel.ready.then((_) {
        if (!_isDisposed && _channel == channel) {
          _statusController.add(WebSocketStatus.connected);
        }
      }).catchError((_) {
        if (!_isDisposed && _channel == channel) {
          _scheduleReconnect();
        }
      });

      _subscription?.cancel();
      _subscription = channel.stream.listen(
        (message) {
          _lastMessageTime = DateTime.now();
          _messagesReceivedCount++;
          _lastRawResponse = message.toString();
          _reconnectAttempts = 0;
          _statusController.add(WebSocketStatus.connected);

          try {
            final Map<String, dynamic> data = jsonDecode(message.toString());
            _eventController.add(data);
          } catch (_) {}
        },
        onError: (_) {
          _scheduleReconnect();
        },
        onDone: () {
          _scheduleReconnect();
        },
        cancelOnError: true,
      );

      _startHeartbeat();
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    if (_isDisposed) return;
    _statusController.add(WebSocketStatus.reconnecting);
    _cleanupChannel();

    // Exponential delays: 1s, 2s, 4s, 8s (capped)
    final delaySeconds = (1 << _reconnectAttempts).clamp(1, 8);
    _reconnectAttempts++;

    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(Duration(seconds: delaySeconds), () {
      _establishConnection();
    });
  }

  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 15), (timer) {
      if (_channel != null) {
        try {
          _channel!.sink.add(jsonEncode({'type': 'ping', 'timestamp': DateTime.now().toIso8601String()}));
        } catch (_) {}
      }
    });
  }

  void _cleanupChannel() {
    _heartbeatTimer?.cancel();
    _subscription?.cancel();
    _subscription = null;
    try {
      _channel?.sink.close();
    } catch (_) {}
    _channel = null;
  }

  void disconnect() {
    _orderId = null;
    _reconnectTimer?.cancel();
    _cleanupChannel();
    _statusController.add(WebSocketStatus.disconnected);
  }

  void dispose() {
    _isDisposed = true;
    disconnect();
    _statusController.close();
    _eventController.close();
  }
}
