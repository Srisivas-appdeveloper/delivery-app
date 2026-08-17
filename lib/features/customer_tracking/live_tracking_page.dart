import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../core/networking/websocket_client.dart';
import '../../core/theme/app_colors.dart';
import '../../models/order.dart';
import '../../services/delivery_providers.dart';
import '../../services/rider_marker_animator.dart';
import '../../shared/widgets/glass_card.dart';
import 'widgets/top_glass_header.dart';
import 'widgets/eta_hero_card.dart';
import 'widgets/bento_status_grid.dart';
import 'widgets/rider_card.dart';
import 'widgets/map_controls.dart';

class LiveTrackingPage extends ConsumerStatefulWidget {
  const LiveTrackingPage({super.key});

  @override
  ConsumerState<LiveTrackingPage> createState() => _LiveTrackingPageState();
}

class _LiveTrackingPageState extends ConsumerState<LiveTrackingPage>
    with SingleTickerProviderStateMixin {
  final MapController _mapController = MapController();
  RiderMarkerAnimator? _markerAnimator;

  LatLng? _smoothRiderPos;
  double _smoothRiderHeading = 0.0;
  bool _followRider = true;

  @override
  void initState() {
    super.initState();
    final initialOrder = ref.read(activeOrderProvider);
    if (initialOrder != null) {
      final initialPos = LatLng(
        initialOrder.currentLat ?? initialOrder.storeLat,
        initialOrder.currentLng ?? initialOrder.storeLng,
      );
      _smoothRiderPos = initialPos;
      _smoothRiderHeading = initialOrder.currentHeading;

      _markerAnimator = RiderMarkerAnimator(
        initialPosition: initialPos,
        initialHeading: _smoothRiderHeading,
      );

      _markerAnimator!.attach(this, (pos, heading) {
        if (!mounted) return;
        setState(() {
          _smoothRiderPos = pos;
          _smoothRiderHeading = heading;
        });
        if (_followRider) {
          _mapController.move(pos, _mapController.camera.zoom);
        }
      });
    }
  }

  @override
  void dispose() {
    _markerAnimator?.dispose();
    super.dispose();
  }

  void _fitRoute(Order order) {
    setState(() => _followRider = false);
    final points = <LatLng>[
      LatLng(order.storeLat, order.storeLng),
      LatLng(order.destinationLat, order.destinationLng),
    ];
    if (_smoothRiderPos != null) {
      points.add(_smoothRiderPos!);
    }
    final bounds = LatLngBounds.fromPoints(points);
    _mapController.fitCamera(
      CameraFit.bounds(
        bounds: bounds,
        padding: const EdgeInsets.only(top: 140, bottom: 330, left: 40, right: 40),
      ),
    );
  }

  void _toggleFollow() {
    setState(() {
      _followRider = !_followRider;
      if (_followRider && _smoothRiderPos != null) {
        _mapController.move(_smoothRiderPos!, 15.5);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final liveOrder = ref.watch(activeOrderProvider);
    final socketStatus = ref.watch(webSocketStatusProvider).value ?? WebSocketStatus.connected;
    final simState = ref.watch(driverSimulationProvider);
    final simNotifier = ref.read(driverSimulationProvider.notifier);

    if (liveOrder == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Live Tracking'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Icon(Icons.shopping_bag_outlined, size: 40, color: AppColors.primary),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'No Active Delivery',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white),
                ),
                const SizedBox(height: 8),
                Text(
                  'Select a store on the map and place an order to see live real-time tracking.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, color: Colors.white.withValues(alpha: 0.7)),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  icon: const Icon(Icons.map_outlined),
                  label: const Text('Browse Stores on Map', style: TextStyle(fontWeight: FontWeight.bold)),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final order = liveOrder;

    // Animate marker when order coordinate updates
    ref.listen<Order?>(activeOrderProvider, (prev, next) {
      if (next != null && next.currentLat != null && next.currentLng != null) {
        final target = LatLng(next.currentLat!, next.currentLng!);
        _smoothRiderHeading = next.currentHeading;
        if (_markerAnimator != null) {
          _markerAnimator!.animateTo(target, next.currentHeading);
        } else {
          setState(() {
            _smoothRiderPos = target;
          });
        }
      }
    });

    final storePos = LatLng(order.storeLat, order.storeLng);
    final destPos = LatLng(order.destinationLat, order.destinationLng);
    final riderPos = _smoothRiderPos ??
        (order.currentLat != null
            ? LatLng(order.currentLat!, order.currentLng!)
            : storePos);

    // Guarantee that route polyline waypoints are always generated
    final routePoints = simNotifier.currentRoutePoints.isNotEmpty
        ? simNotifier.currentRoutePoints
        : simNotifier.generateRouteWaypoints(order);

    return Scaffold(
      body: Stack(
        children: [
          // 1. Primary Surface: OpenStreetMap Tiles
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: riderPos,
              initialZoom: 15.0,
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.all,
              ),
              onPositionChanged: (cam, hasGesture) {
                if (hasGesture && _followRider) {
                  setState(() => _followRider = false);
                }
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.delivery_app',
                maxZoom: 19,
              ),

              // Route Polyline
              PolylineLayer(
                polylines: [
                  // Glow Shadow Line
                  Polyline(
                    points: routePoints,
                    strokeWidth: 8.0,
                    color: AppColors.primary.withValues(alpha: 0.25),
                  ),
                  // Primary Path
                  Polyline(
                    points: routePoints,
                    strokeWidth: 4.0,
                    color: AppColors.primary,
                  ),
                ],
              ),

              // Store and Customer Destination Markers
              MarkerLayer(
                markers: [
                  // Store Marker
                  Marker(
                    point: storePos,
                    width: 44,
                    height: 44,
                    child: _buildLocationPin(
                      emoji: '🏪',
                      bgColor: AppColors.surface,
                      borderColor: Colors.white70,
                    ),
                  ),

                  // Destination Marker
                  Marker(
                    point: destPos,
                    width: 44,
                    height: 44,
                    child: _buildLocationPin(
                      emoji: '🏠',
                      bgColor: AppColors.secondary,
                      borderColor: Colors.white,
                    ),
                  ),

                  // Animated Smooth Rider Marker
                  Marker(
                    point: riderPos,
                    width: 58,
                    height: 58,
                    child: _buildRiderMarker(_smoothRiderHeading),
                  ),
                ],
              ),
            ],
          ),

          // 2. Top Header Glass Bar (Safely below status bar)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: TopGlassHeader(
                  orderId: order.id,
                  storeName: order.storeName,
                  socketStatus: socketStatus,
                  onBack: () => Navigator.of(context).pop(),
                ),
              ),
            ),
          ),

          // 3. Floating Map Camera Controls
          Positioned(
            right: 16,
            bottom: 390,
            child: MapControls(
              isFollowing: _followRider,
              onToggleFollow: _toggleFollow,
              onFitRoute: () => _fitRoute(order),
            ),
          ),

          // 4. Bottom Overlays: Quick Simulation Playback Bar + Bento Cards
          Positioned(
            left: 16,
            right: 16,
            bottom: 24,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Floating Quick Simulation Controls Bar
                GlassCard(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  borderRadius: 20,
                  borderColor: AppColors.primary.withValues(alpha: 0.4),
                  backgroundColor: AppColors.surface.withValues(alpha: 0.85),
                  child: Row(
                    children: [
                      // Play / Pause Button
                      InkWell(
                        onTap: () {
                          if (!simState.isSimulating) {
                            simNotifier.startSimulation();
                          } else if (simState.isPaused) {
                            simNotifier.resume();
                          } else {
                            simNotifier.pause();
                          }
                        },
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                !simState.isSimulating || simState.isPaused
                                    ? Icons.play_arrow
                                    : Icons.pause,
                                size: 16,
                                color: Colors.black,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                !simState.isSimulating
                                    ? 'Start Ride'
                                    : simState.isPaused
                                        ? 'Resume'
                                        : 'Simulating',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.black,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),

                      // Speed Chips (1x, 2x, 4x)
                      for (final speed in [1, 2, 4]) ...[
                        InkWell(
                          onTap: () => simNotifier.setSpeed(speed),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            margin: const EdgeInsets.symmetric(horizontal: 2),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: simState.speedMultiplier == speed
                                  ? AppColors.primary.withValues(alpha: 0.25)
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: simState.speedMultiplier == speed
                                    ? AppColors.primary
                                    : Colors.white24,
                              ),
                            ),
                            child: Text(
                              '${speed}x',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: simState.speedMultiplier == speed
                                    ? FontWeight.w900
                                    : FontWeight.w600,
                                color: simState.speedMultiplier == speed
                                    ? AppColors.primary
                                    : Colors.white70,
                              ),
                            ),
                          ),
                        ),
                      ],

                      const Spacer(),

                      // Reset Button
                      IconButton(
                        icon: const Icon(Icons.restart_alt, size: 18, color: Colors.white70),
                        tooltip: 'Restart Route',
                        onPressed: () => simNotifier.reset(),
                        visualDensity: VisualDensity.compact,
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 8),
                EtaHeroCard(order: order),
                const SizedBox(height: 8),
                BentoStatusGrid(order: order),
                const SizedBox(height: 8),
                RiderCard(order: order),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLocationPin({
    required String emoji,
    required Color bgColor,
    required Color borderColor,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: bgColor,
        shape: BoxShape.circle,
        border: Border.all(color: borderColor, width: 2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 10,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Center(
        child: Text(emoji, style: const TextStyle(fontSize: 20)),
      ),
    );
  }

  Widget _buildRiderMarker(double headingDegrees) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Pulse Glow Ring
        Container(
          width: 54,
          height: 54,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.primary.withValues(alpha: 0.2),
          ),
        ),
        // Heading Direction Indicator Arrow
        Transform.rotate(
          angle: (headingDegrees * 3.141592653589793 / 180),
          child: const Column(
            children: [
              Icon(
                Icons.arrow_drop_up,
                color: AppColors.primary,
                size: 18,
              ),
              Spacer(),
            ],
          ),
        ),
        // Rider Vehicle Avatar Disc
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: AppColors.primary,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.6),
                blurRadius: 16,
                spreadRadius: 2,
              ),
            ],
          ),
          child: const Center(
            child: Text('🛵', style: TextStyle(fontSize: 18)),
          ),
        ),
      ],
    );
  }
}
