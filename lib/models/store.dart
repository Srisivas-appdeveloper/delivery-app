class StoreItem {
  final String id;
  final String name;
  final String description;
  final double price;
  final String emoji;

  const StoreItem({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.emoji,
  });
}

class Store {
  final String id;
  final String name;
  final String category;
  final String emoji;
  final double lat;
  final double lng;
  final double rating;
  final String deliveryTime;
  final List<StoreItem> items;
  final double distanceMeters;

  const Store({
    required this.id,
    required this.name,
    required this.category,
    required this.emoji,
    required this.lat,
    required this.lng,
    required this.rating,
    required this.deliveryTime,
    required this.items,
    this.distanceMeters = 0.0,
  });

  String get formattedDistance {
    if (distanceMeters >= 1000) {
      return '${(distanceMeters / 1000).toStringAsFixed(1)} km';
    }
    return '${distanceMeters.toStringAsFixed(0)} m';
  }

  Store copyWith({
    String? id,
    String? name,
    String? category,
    String? emoji,
    double? lat,
    double? lng,
    double? rating,
    String? deliveryTime,
    List<StoreItem>? items,
    double? distanceMeters,
  }) {
    return Store(
      id: id ?? this.id,
      name: name ?? this.name,
      category: category ?? this.category,
      emoji: emoji ?? this.emoji,
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
      rating: rating ?? this.rating,
      deliveryTime: deliveryTime ?? this.deliveryTime,
      items: items ?? this.items,
      distanceMeters: distanceMeters ?? this.distanceMeters,
    );
  }
}
