import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/api_constants.dart';
import '../../core/theme/app_colors.dart';
import '../../models/store.dart';
import '../../services/delivery_providers.dart';
import '../../services/home_screen_widget_service.dart';
import '../../shared/widgets/glass_card.dart';
import '../../shared/widgets/status_badge.dart';
import '../customer_tracking/live_tracking_page.dart';
import '../driver_tracking/driver_dashboard_page.dart';
import '../debug/tracking_debug_page.dart';
import '../tracking_widget/live_tracking_widget.dart';
import 'widgets/create_order_sheet.dart';
import 'widgets/nearby_stores_map.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  int _tabIndex = 0;
  bool _isListMode = false;
  Store? _selectedNearbyStore;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(userLocationProvider.notifier).requestLiveLocation();
    });
  }

  void _openLiveMap() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const LiveTrackingPage()),
    );
  }

  void _showHostConfigDialog() {
    final controller = TextEditingController(text: ApiConstants.host);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Backend Server Host'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Set IP for Android Emulator (10.0.2.2), iOS/Desktop (127.0.0.1), or physical device Wi-Fi IP.',
              style: TextStyle(fontSize: 12, color: Colors.white70),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'Host IP',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              ApiConstants.customHost = controller.text.trim();
              ref.read(apiClientProvider).updateBaseUrl();
              ref.read(ordersListProvider.notifier).refresh();
              final currentId = ref.read(activeOrderIdProvider);
              if (currentId != null) {
                ref.read(activeOrderProvider.notifier).loadOrder(currentId);
              }
              Navigator.pop(ctx);
            },
            child: const Text('Save & Reconnect'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background Atmosphere
          Container(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(-0.8, -0.6),
                radius: 1.2,
                colors: [
                  Color(0xFF0F253E),
                  Color(0xFF090D16),
                ],
              ),
            ),
          ),

          // Main Tab Stack
          IndexedStack(
            index: _tabIndex,
            children: [
              _buildHomeContent(),
              const DriverDashboardPage(),
              const TrackingDebugPage(),
            ],
          ),
        ],
      ),

      // Bottom Navigation Bar
      bottomNavigationBar: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        color: const Color(0xFF090D16).withValues(alpha: 0.95),
        child: SafeArea(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              Expanded(
                child: _buildNavItem(
                  icon: Icons.map_outlined,
                  activeIcon: Icons.map,
                  label: 'Live Map',
                  index: 0,
                ),
              ),
              Expanded(
                child: _buildNavItem(
                  icon: Icons.two_wheeler_outlined,
                  activeIcon: Icons.two_wheeler,
                  label: 'Driver HUD',
                  index: 1,
                ),
              ),
              Expanded(
                child: _buildNavItem(
                  icon: Icons.terminal_outlined,
                  activeIcon: Icons.terminal,
                  label: 'Telemetry',
                  index: 2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHomeContent() {
    final activeOrder = ref.watch(activeOrderProvider);
    final userLoc = ref.watch(userLocationProvider);
    final nearbyStoresAsync = ref.watch(nearbyStoresProvider);

    if (_isListMode) {
      return _buildScrollableListContent(activeOrder, userLoc, nearbyStoresAsync);
    }

    // Default Full-Screen Map View
    return Stack(
      children: [
        // 1. FULL-SCREEN MAP LAYER (100% of Screen - Kept mounted permanently)
        Positioned.fill(
          child: NearbyStoresMap(
            userLocation: userLoc.position,
            stores: nearbyStoresAsync.value ?? const [],
            selectedStore: _selectedNearbyStore,
            isFullScreen: true,
            onSelectStore: (store) {
              setState(() => _selectedNearbyStore = store);
            },
            onRecenter: () {
              ref.read(userLocationProvider.notifier).requestLiveLocation();
            },
          ),
        ),

        // 2. TOP FLOATING HEADER (Frosted Glass Pill)
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GlassCard(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    borderColor: AppColors.glassBorder,
                    backgroundColor: const Color(0xFF090D16).withValues(alpha: 0.85),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.2),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.location_on, color: AppColors.primary, size: 18),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'DELIVERING TO',
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 1.2,
                                  color: AppColors.primary.withValues(alpha: 0.9),
                                ),
                              ),
                              Text(
                                userLoc.addressName,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),
                        // Refresh GPS button
                        InkWell(
                          onTap: () {
                            ref.read(userLocationProvider.notifier).requestLiveLocation(openSettingsIfDenied: true);
                          },
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: userLoc.isLoading
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                                  )
                                : const Icon(Icons.my_location, size: 16, color: AppColors.primary),
                          ),
                        ),
                        const SizedBox(width: 6),
                        // Add Home Screen Widget button
                        InkWell(
                          onTap: () async {
                            final success = await HomeScreenWidgetService.requestPinWidget();
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  backgroundColor: const Color(0xFF0F172A),
                                  duration: const Duration(seconds: 4),
                                  content: Text(
                                    success
                                        ? '📌 Home Screen Widget prompt opened! Tap "Add to Home screen" to pin it outside the app.'
                                        : '📌 To add widget: Long-press on your phone\'s Home Screen -> Widgets -> Velox Delivery',
                                    style: const TextStyle(color: Colors.white, fontSize: 12),
                                  ),
                                ),
                              );
                            }
                          },
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.widgets_outlined, size: 16, color: AppColors.primary),
                          ),
                        ),
                        const SizedBox(width: 6),
                        // Toggle List Mode button
                        InkWell(
                          onTap: () => setState(() => _isListMode = true),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.view_list_rounded, size: 16, color: Colors.white70),
                          ),
                        ),
                        const SizedBox(width: 6),
                        // Server Host config
                        InkWell(
                          onTap: _showHostConfigDialog,
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.settings_ethernet, size: 16, color: Colors.white70),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Permission Banner (if not granted)
                  if (!userLoc.hasPermission) ...[
                    const SizedBox(height: 8),
                    GlassCard(
                      onTap: () => ref.read(userLocationProvider.notifier).requestLiveLocation(openSettingsIfDenied: true),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      borderColor: AppColors.primary.withValues(alpha: 0.6),
                      backgroundColor: const Color(0xFF090D16).withValues(alpha: 0.9),
                      child: Row(
                        children: [
                          const Icon(Icons.gps_fixed, color: AppColors.primary, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              userLoc.errorMessage ?? 'Enable GPS to find stores near your exact location',
                              style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w600),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              'Allow',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.black),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),

        // 3. PERSISTENT LIVE TRACKING WIDGET (Above Bottom Carousel if order is active)
        if (activeOrder != null)
          Positioned(
            left: 0,
            right: 0,
            bottom: 155,
            child: LiveTrackingWidget(
              orderId: activeOrder.id,
              onOpenTracking: _openLiveMap,
            ),
          ),

        // 4. FLOATING BOTTOM BENTO CAROUSEL OF NEARBY STORES
        Positioned(
          left: 0,
          right: 0,
          bottom: 12,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Horizontal Store Cards
              nearbyStoresAsync.when(
                data: (stores) {
                  if (stores.isEmpty) return const SizedBox.shrink();

                  return SizedBox(
                    height: 135,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      itemCount: stores.length,
                      itemBuilder: (context, index) {
                        final store = stores[index];
                        final isSelected = _selectedNearbyStore?.id == store.id;

                        return Container(
                          width: 260,
                          margin: const EdgeInsets.only(right: 12),
                          child: GlassCard(
                            padding: const EdgeInsets.all(12),
                            borderColor: isSelected ? AppColors.primary : Colors.white.withValues(alpha: 0.15),
                            backgroundColor: const Color(0xFF090D16).withValues(alpha: 0.88),
                            onTap: () {
                              setState(() => _selectedNearbyStore = store);
                            },
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 40,
                                      height: 40,
                                      decoration: BoxDecoration(
                                        color: AppColors.primary.withValues(alpha: 0.18),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                                      ),
                                      child: Center(
                                        child: Text(store.emoji, style: const TextStyle(fontSize: 20)),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            store.name,
                                            style: const TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w800,
                                              color: Colors.white,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          Row(
                                            children: [
                                              Text(
                                                '⭐ ${store.rating.toStringAsFixed(1)}',
                                                style: const TextStyle(fontSize: 10, color: Colors.amber, fontWeight: FontWeight.bold),
                                              ),
                                              const SizedBox(width: 6),
                                              Text(
                                                '• ${store.category}',
                                                style: const TextStyle(fontSize: 10, color: Colors.white60),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const Spacer(),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          '📍 ${store.formattedDistance}',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.primary,
                                          ),
                                        ),
                                        Text(
                                          '⚡ ${store.deliveryTime}',
                                          style: TextStyle(
                                            fontSize: 10,
                                            color: Colors.white.withValues(alpha: 0.7),
                                          ),
                                        ),
                                      ],
                                    ),
                                    ElevatedButton(
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: AppColors.primary,
                                        foregroundColor: Colors.black,
                                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                        minimumSize: Size.zero,
                                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                      ),
                                      onPressed: () {
                                        setState(() => _selectedNearbyStore = store);
                                        CreateOrderSheet.show(context, store: store);
                                      },
                                      child: const Text(
                                        'Order ➔',
                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900),
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
                  );
                },
                loading: () => const SizedBox.shrink(),
                error: (err, _) => const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildScrollableListContent(
    dynamic activeOrder,
    dynamic userLoc,
    AsyncValue<List<Store>> nearbyStoresAsync,
  ) {
    final ordersAsync = ref.watch(ordersListProvider);

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 210),
        children: [
          // Header with switch back to map
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'DELIVERING TO',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.5,
                      color: AppColors.primary.withValues(alpha: 0.9),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    userLoc.addressName,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              IconButton.filledTonal(
                icon: const Icon(Icons.map, color: AppColors.primary),
                tooltip: 'Back to Full-Screen Map',
                onPressed: () => setState(() => _isListMode = false),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Active Order Hero Bento Card
          if (activeOrder != null) ...[
            GlassCard(
              padding: const EdgeInsets.all(18),
              borderColor: AppColors.primary.withValues(alpha: 0.35),
              onTap: _openLiveMap,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      StatusBadge(status: activeOrder.status),
                      const Row(
                        children: [
                          Icon(Icons.touch_app, size: 14, color: AppColors.primary),
                          SizedBox(width: 4),
                          Text(
                            'Track Live',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    activeOrder.storeName,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    activeOrder.destinationAddress,
                    style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.6)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Quick Create Order Action Banner
          GlassCard(
            onTap: () => CreateOrderSheet.show(context),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            borderColor: AppColors.secondary.withValues(alpha: 0.4),
            backgroundColor: AppColors.secondary.withValues(alpha: 0.12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.secondary,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.add_shopping_cart, color: Colors.black, size: 20),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Place a New Delivery Order',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                      Text(
                        'Choose store, pick items & track live on map',
                        style: TextStyle(fontSize: 11, color: Colors.white70),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward_ios, color: AppColors.secondary, size: 14),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Stores Near You List
          const Text(
            'Stores Near You',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.white),
          ),
          const SizedBox(height: 12),

          nearbyStoresAsync.when(
            data: (stores) => Column(
              children: stores.map((store) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: GlassCard(
                    onTap: () {
                      setState(() => _selectedNearbyStore = store);
                      CreateOrderSheet.show(context, store: store);
                    },
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        Text(store.emoji, style: const TextStyle(fontSize: 24)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                store.name,
                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white),
                              ),
                              Text(
                                '${store.category} • 📍 ${store.formattedDistance} • ⚡ ${store.deliveryTime}',
                                style: const TextStyle(fontSize: 11, color: Colors.white70),
                              ),
                            ],
                          ),
                        ),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.black,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            minimumSize: Size.zero,
                          ),
                          onPressed: () {
                            setState(() => _selectedNearbyStore = store);
                            CreateOrderSheet.show(context, store: store);
                          },
                          child: const Text('Order ➔', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => Text('Error: $err'),
          ),

          const SizedBox(height: 20),

          // All Orders
          const Text(
            'All Orders',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white),
          ),
          const SizedBox(height: 10),

          ordersAsync.when(
            data: (orders) {
              if (orders.isEmpty) {
                return const GlassCard(
                  child: Center(
                    child: Text('No active orders found.', style: TextStyle(color: Colors.white60)),
                  ),
                );
              }
              return Column(
                children: orders.map((o) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: GlassCard(
                      onTap: () {
                        ref.read(activeOrderIdProvider.notifier).state = o.id;
                      },
                      child: Row(
                        children: [
                          Text(o.driverAvatar, style: const TextStyle(fontSize: 18)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text('${o.storeName} (#${o.id})', style: const TextStyle(color: Colors.white)),
                          ),
                          Text(AppColors.statusLabel(o.status), style: const TextStyle(color: AppColors.primary, fontSize: 12)),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              );
            },
            loading: () => const SizedBox.shrink(),
            error: (err, _) => Text('Error: $err'),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required IconData activeIcon,
    required String label,
    required int index,
  }) {
    final isSelected = _tabIndex == index;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => setState(() => _tabIndex = index),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isSelected ? activeIcon : icon,
              color: isSelected ? AppColors.primary : Colors.white60,
              size: 20,
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected ? AppColors.primary : Colors.white60,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
