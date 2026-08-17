class Order {
  final String id;
  final String driverId;
  final String driverName;
  final String driverPhone;
  final String driverAvatar;
  final String customerId;
  final String customerName;
  final String status;
  final String storeName;
  final double storeLat;
  final double storeLng;
  final String destinationAddress;
  final double destinationLat;
  final double destinationLng;
  final double? currentLat;
  final double? currentLng;
  final double currentHeading;
  final double currentSpeed;
  final double currentAccuracy;
  final double remainingDistanceMeters;
  final double smoothedEtaMinutes;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Order({
    required this.id,
    required this.driverId,
    required this.driverName,
    required this.driverPhone,
    required this.driverAvatar,
    required this.customerId,
    required this.customerName,
    required this.status,
    required this.storeName,
    required this.storeLat,
    required this.storeLng,
    required this.destinationAddress,
    required this.destinationLat,
    required this.destinationLng,
    this.currentLat,
    this.currentLng,
    this.currentHeading = 0.0,
    this.currentSpeed = 0.0,
    this.currentAccuracy = 5.0,
    this.remainingDistanceMeters = 0.0,
    this.smoothedEtaMinutes = 0.0,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    // Parse coordinates with support for both naming schemes
    final sLat = (json['store_latitude'] as num?)?.toDouble() ??
        (json['store_lat'] as num?)?.toDouble() ??
        11.0168;
    final sLng = (json['store_longitude'] as num?)?.toDouble() ??
        (json['store_lng'] as num?)?.toDouble() ??
        76.9558;

    final dLat = (json['destination_latitude'] as num?)?.toDouble() ??
        (json['destination_lat'] as num?)?.toDouble() ??
        11.0250;
    final dLng = (json['destination_longitude'] as num?)?.toDouble() ??
        (json['destination_lng'] as num?)?.toDouble() ??
        76.9680;

    final cLat = (json['current_latitude'] as num?)?.toDouble() ??
        (json['current_lat'] as num?)?.toDouble() ??
        sLat;
    final cLng = (json['current_longitude'] as num?)?.toDouble() ??
        (json['current_lng'] as num?)?.toDouble() ??
        sLng;

    // Parse ETA (support both seconds from backend and minutes)
    double etaMinutes = 0.0;
    if (json['smoothed_eta_seconds'] != null) {
      etaMinutes = (json['smoothed_eta_seconds'] as num).toDouble() / 60.0;
    } else if (json['smoothed_eta_minutes'] != null) {
      etaMinutes = (json['smoothed_eta_minutes'] as num).toDouble();
    } else if (json['eta_seconds'] != null) {
      etaMinutes = (json['eta_seconds'] as num).toDouble() / 60.0;
    }

    return Order(
      id: json['id'] as String? ?? 'ORD-DEMO',
      driverId: json['driver_id'] as String? ?? 'DRIVER001',
      driverName: json['driver_name'] as String? ?? 'Arun Kumar',
      driverPhone: json['driver_phone'] as String? ?? '+91 98765 43210',
      driverAvatar: json['driver_avatar'] as String? ?? '🛵',
      customerId: json['customer_id'] as String? ?? 'CUSTOMER001',
      customerName: json['customer_name'] as String? ?? 'Alex Johnson',
      status: json['status'] as String? ?? 'on_the_way',
      storeName: json['store_name'] as String? ?? 'Artisan Bakery & Cafe',
      storeLat: sLat,
      storeLng: sLng,
      destinationAddress: json['destination_address'] as String? ?? '742 Evergreen Terrace',
      destinationLat: dLat,
      destinationLng: dLng,
      currentLat: cLat,
      currentLng: cLng,
      currentHeading: (json['current_heading'] as num?)?.toDouble() ?? (json['heading'] as num?)?.toDouble() ?? 0.0,
      currentSpeed: (json['current_speed'] as num?)?.toDouble() ?? (json['speed'] as num?)?.toDouble() ?? 0.0,
      currentAccuracy: (json['current_accuracy'] as num?)?.toDouble() ?? (json['accuracy'] as num?)?.toDouble() ?? 5.0,
      remainingDistanceMeters: (json['remaining_distance_meters'] as num?)?.toDouble() ??
          (json['distance_remaining'] as num?)?.toDouble() ??
          0.0,
      smoothedEtaMinutes: etaMinutes,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Order copyWith({
    String? status,
    double? currentLat,
    double? currentLng,
    double? currentHeading,
    double? currentSpeed,
    double? currentAccuracy,
    double? remainingDistanceMeters,
    double? smoothedEtaMinutes,
    DateTime? updatedAt,
  }) {
    return Order(
      id: id,
      driverId: driverId,
      driverName: driverName,
      driverPhone: driverPhone,
      driverAvatar: driverAvatar,
      customerId: customerId,
      customerName: customerName,
      status: status ?? this.status,
      storeName: storeName,
      storeLat: storeLat,
      storeLng: storeLng,
      destinationAddress: destinationAddress,
      destinationLat: destinationLat,
      destinationLng: destinationLng,
      currentLat: currentLat ?? this.currentLat,
      currentLng: currentLng ?? this.currentLng,
      currentHeading: currentHeading ?? this.currentHeading,
      currentSpeed: currentSpeed ?? this.currentSpeed,
      currentAccuracy: currentAccuracy ?? this.currentAccuracy,
      remainingDistanceMeters: remainingDistanceMeters ?? this.remainingDistanceMeters,
      smoothedEtaMinutes: smoothedEtaMinutes ?? this.smoothedEtaMinutes,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
