import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/order.dart';
import '../../../models/store.dart';
import '../../../services/delivery_providers.dart';
import '../../../shared/widgets/glass_card.dart';
import '../../customer_tracking/live_tracking_page.dart';

class CreateOrderSheet extends ConsumerStatefulWidget {
  final int initialStoreIndex;
  final Store? store;

  const CreateOrderSheet({super.key, this.initialStoreIndex = 0, this.store});

  static Future<void> show(BuildContext context, {int initialStoreIndex = 0, Store? store}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CreateOrderSheet(initialStoreIndex: initialStoreIndex, store: store),
    );
  }

  @override
  ConsumerState<CreateOrderSheet> createState() => _CreateOrderSheetState();
}

class _CreateOrderSheetState extends ConsumerState<CreateOrderSheet> {
  late final TextEditingController _addressController;
  final _customerController = TextEditingController(text: 'Alex Johnson');

  late int _selectedStoreIndex;
  bool _isSubmitting = false;

  late final List<Map<String, dynamic>> _stores;

  @override
  void initState() {
    super.initState();
    _selectedStoreIndex = widget.initialStoreIndex;
    final userLoc = ref.read(userLocationProvider);
    _addressController = TextEditingController(text: userLoc.addressName);

    _stores = [
      if (widget.store != null)
        {
          'name': widget.store!.name,
          'category': widget.store!.category,
          'emoji': widget.store!.emoji,
          'lat': widget.store!.lat,
          'lng': widget.store!.lng,
          'items': widget.store!.items.map((i) => {
            'name': i.name,
            'price': i.price,
            'qty': 1,
          }).toList(),
        }
      else ...[
        {
          'name': 'Artisan Bakery & Cafe',
          'category': 'Bakery • Coffee',
          'emoji': '🥐',
          'lat': userLoc.position.latitude + 0.0035,
          'lng': userLoc.position.longitude - 0.0028,
          'items': [
            {'name': 'Butter Croissant', 'price': 3.50, 'qty': 2},
            {'name': 'Vanilla Cold Brew', 'price': 4.50, 'qty': 1},
            {'name': 'Sourdough Loaf', 'price': 6.00, 'qty': 0},
          ],
        },
        {
          'name': 'Tokyo Sushi & Bento',
          'category': 'Japanese • Seafood',
          'emoji': '🍱',
          'lat': userLoc.position.latitude - 0.0052,
          'lng': userLoc.position.longitude + 0.0041,
          'items': [
            {'name': 'Salmon Nigiri Set', 'price': 14.00, 'qty': 1},
            {'name': 'Spicy Tuna Roll', 'price': 9.50, 'qty': 1},
            {'name': 'Miso Soup', 'price': 3.00, 'qty': 2},
          ],
        },
        {
          'name': 'Green Garden Salads',
          'category': 'Healthy • Vegan',
          'emoji': '🥗',
          'lat': userLoc.position.latitude - 0.0078,
          'lng': userLoc.position.longitude - 0.0055,
          'items': [
            {'name': 'Avocado Quinoa Bowl', 'price': 11.50, 'qty': 1},
            {'name': 'Cold Pressed Green Juice', 'price': 5.00, 'qty': 1},
          ],
        },
        {
          'name': 'Smash Burgers & Fries',
          'category': 'Burgers • Fast Food',
          'emoji': '🍔',
          'lat': userLoc.position.latitude + 0.0095,
          'lng': userLoc.position.longitude + 0.0082,
          'items': [
            {'name': 'Double Truffle Burger', 'price': 12.00, 'qty': 1},
            {'name': 'Loaded Waffle Fries', 'price': 5.50, 'qty': 1},
          ],
        },
      ],
    ];
  }

  double get _itemsTotal {
    final items = _stores[_selectedStoreIndex]['items'] as List<Map<String, dynamic>>;
    return items.fold<double>(
      0.0,
      (sum, item) => sum + (item['price'] as double) * (item['qty'] as int),
    );
  }

  double get _deliveryFee => 2.50;
  double get _grandTotal => _itemsTotal + _deliveryFee;

  void _updateItemQty(int itemIndex, int delta) {
    setState(() {
      final items = _stores[_selectedStoreIndex]['items'] as List<Map<String, dynamic>>;
      final current = items[itemIndex]['qty'] as int;
      items[itemIndex]['qty'] = (current + delta).clamp(0, 10);
    });
  }

  Future<void> _placeOrder() async {
    if (_itemsTotal <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please add at least one item to your order!'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final store = _stores[_selectedStoreIndex];
      final orderId = 'ORD-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';
      final userLoc = ref.read(userLocationProvider);

      final newOrder = await ref.read(apiClientProvider).createOrder(
            orderId: orderId,
            driverName: 'Arun Kumar',
            storeName: store['name'] as String,
            storeLat: store['lat'] as double,
            storeLng: store['lng'] as double,
            destinationAddress: _addressController.text.trim().isNotEmpty
                ? _addressController.text.trim()
                : userLoc.addressName,
            destLat: userLoc.position.latitude,
            destLng: userLoc.position.longitude,
          );

      final effectiveOrder = newOrder ??
          Order(
            id: orderId,
            driverId: 'DRIVER001',
            driverName: 'Arun Kumar',
            driverPhone: '+91 98765 43210',
            driverAvatar: '🛵',
            customerId: 'CUSTOMER001',
            customerName: _customerController.text,
            status: 'on_the_way',
            storeName: store['name'] as String,
            storeLat: store['lat'] as double,
            storeLng: store['lng'] as double,
            destinationAddress: _addressController.text.trim().isNotEmpty
                ? _addressController.text.trim()
                : userLoc.addressName,
            destinationLat: userLoc.position.latitude,
            destinationLng: userLoc.position.longitude,
            currentLat: store['lat'] as double,
            currentLng: store['lng'] as double,
            currentHeading: 45.0,
            currentSpeed: 6.5,
            currentAccuracy: 4.0,
            remainingDistanceMeters: const Distance().as(
              LengthUnit.Meter,
              LatLng(store['lat'] as double, store['lng'] as double),
              LatLng(userLoc.position.latitude, userLoc.position.longitude),
            ),
            smoothedEtaMinutes: (const Distance().as(
                      LengthUnit.Meter,
                      LatLng(store['lat'] as double, store['lng'] as double),
                      LatLng(userLoc.position.latitude, userLoc.position.longitude),
                    ) /
                    5.56) /
                60.0,
            createdAt: DateTime.now(),
            updatedAt: DateTime.now(),
          );

      ref.read(activeOrderIdProvider.notifier).state = effectiveOrder.id;
      await ref.read(activeOrderProvider.notifier).loadOrder(effectiveOrder.id);
      ref.read(ordersListProvider.notifier).refresh();
      ref.read(driverSimulationProvider.notifier).startSimulation(order: effectiveOrder);

      if (!mounted) return;
      Navigator.of(context).pop();
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const LiveTrackingPage()),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentStore = _stores[_selectedStoreIndex];
    final items = currentStore['items'] as List<Map<String, dynamic>>;

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0D1424),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Sheet Title
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'CREATE NEW ORDER',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                        color: AppColors.primary,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Choose Store & Items',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white60),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // 1. Store Selector Carousel
            const Text(
              'Select Restaurant / Store',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white70),
            ),
            const SizedBox(height: 8),

            SizedBox(
              height: 80,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _stores.length,
                itemBuilder: (ctx, idx) {
                  final s = _stores[idx];
                  final isSelected = idx == _selectedStoreIndex;
                  return Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: GlassCard(
                      onTap: () => setState(() => _selectedStoreIndex = idx),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      borderColor: isSelected ? AppColors.primary : AppColors.glassBorder,
                      backgroundColor: isSelected
                          ? AppColors.primary.withValues(alpha: 0.15)
                          : AppColors.surfaceCard,
                      child: Row(
                        children: [
                          Text(s['emoji'] as String, style: const TextStyle(fontSize: 26)),
                          const SizedBox(width: 10),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                s['name'] as String,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: isSelected ? Colors.white : Colors.white70,
                                ),
                              ),
                              Text(
                                s['category'] as String,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Colors.white.withValues(alpha: 0.5),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

            const SizedBox(height: 20),

            // 2. Menu Items List
            Text(
              'Menu Items (${currentStore['name']})',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white70),
            ),
            const SizedBox(height: 8),

            Column(
              children: List.generate(items.length, (i) {
                final item = items[i];
                final qty = item['qty'] as int;
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.glassBorder),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item['name'] as String,
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                            Text(
                              '\$${(item['price'] as double).toStringAsFixed(2)}',
                              style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                      Row(
                        children: [
                          IconButton.filledTonal(
                            icon: const Icon(Icons.remove, size: 16),
                            style: IconButton.styleFrom(
                              backgroundColor: Colors.white10,
                              foregroundColor: Colors.white,
                              visualDensity: VisualDensity.compact,
                            ),
                            onPressed: () => _updateItemQty(i, -1),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            child: Text(
                              '$qty',
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.white),
                            ),
                          ),
                          IconButton.filledTonal(
                            icon: const Icon(Icons.add, size: 16),
                            style: IconButton.styleFrom(
                              backgroundColor: AppColors.primary.withValues(alpha: 0.2),
                              foregroundColor: AppColors.primary,
                              visualDensity: VisualDensity.compact,
                            ),
                            onPressed: () => _updateItemQty(i, 1),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }),
            ),

            const SizedBox(height: 16),

            // 3. Delivery Destination
            const Text(
              'Delivery Address',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white70),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _addressController,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.location_on, color: AppColors.primary, size: 18),
                filled: true,
                fillColor: AppColors.surface,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: AppColors.glassBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: AppColors.glassBorder),
                ),
              ),
            ),

            const SizedBox(height: 20),

            // 4. Price Breakdown & Order Action Button
            GlassCard(
              padding: const EdgeInsets.all(16),
              borderColor: AppColors.primary.withValues(alpha: 0.3),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Subtotal', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13)),
                      Text('\$${_itemsTotal.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Delivery Fee', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13)),
                      Text('\$${_deliveryFee.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const Divider(height: 20, color: Colors.white12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total Amount', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w900)),
                      Text(
                        '\$${_grandTotal.toStringAsFixed(2)}',
                        style: const TextStyle(color: AppColors.primary, fontSize: 20, fontWeight: FontWeight.w900),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      icon: _isSubmitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                            )
                          : const Icon(Icons.delivery_dining, size: 22),
                      label: Text(
                        _isSubmitting ? 'Placing Order...' : 'Place Order & Track Live 🚀',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
                      ),
                      onPressed: _isSubmitting ? null : _placeOrder,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
