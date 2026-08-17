import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/store.dart';

class NearbyStoresMap extends StatefulWidget {
  final LatLng userLocation;
  final List<Store> stores;
  final Store? selectedStore;
  final ValueChanged<Store> onSelectStore;
  final VoidCallback onRecenter;
  final bool isFullScreen;
  final double? height;

  const NearbyStoresMap({
    super.key,
    required this.userLocation,
    required this.stores,
    this.selectedStore,
    required this.onSelectStore,
    required this.onRecenter,
    this.isFullScreen = true,
    this.height,
  });

  @override
  State<NearbyStoresMap> createState() => _NearbyStoresMapState();
}

class _NearbyStoresMapState extends State<NearbyStoresMap> with SingleTickerProviderStateMixin {
  late final MapController _mapController;
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void didUpdateWidget(covariant NearbyStoresMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Only move camera if user explicitly selected a different store from the carousel/list
    if (widget.selectedStore != null && widget.selectedStore != oldWidget.selectedStore) {
      _mapController.move(LatLng(widget.selectedStore!.lat, widget.selectedStore!.lng), 15.4);
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final activeStore = widget.selectedStore;

    // Build route polyline between user and active store
    final routePoints = <LatLng>[];
    if (activeStore != null) {
      routePoints.add(widget.userLocation);
      routePoints.add(LatLng(activeStore.lat, activeStore.lng));
    }

    final mapWidget = FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: widget.userLocation,
        initialZoom: 14.8,
        minZoom: 10.0,
        maxZoom: 18.0,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.example.delivery_app',
        ),

        // Live Route Line to selected store
        if (routePoints.isNotEmpty)
          PolylineLayer(
            polylines: [
              Polyline(
                points: routePoints,
                strokeWidth: 4.0,
                color: AppColors.primary,
                pattern: StrokePattern.dashed(segments: const [8, 6]),
              ),
            ],
          ),

        // Markers Layer
        MarkerLayer(
          markers: [
            // A. User Live GPS Location Marker (Pulsating Blue Beacon)
            Marker(
              point: widget.userLocation,
              width: 50,
              height: 50,
              child: AnimatedBuilder(
                animation: _pulseController,
                builder: (context, child) {
                  final scale = 1.0 + (_pulseController.value * 0.5);
                  final opacity = (1.0 - _pulseController.value).clamp(0.0, 0.7);

                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      Transform.scale(
                        scale: scale,
                        child: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFF38BDF8).withValues(alpha: opacity),
                          ),
                        ),
                      ),
                      Container(
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(
                          color: const Color(0xFF0284C7),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3.0),
                          boxShadow: const [
                            BoxShadow(
                              color: Colors.black45,
                              blurRadius: 8,
                            ),
                          ],
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),

            // B. Store Markers
            ...widget.stores.map((store) {
              final isSelected = activeStore?.id == store.id;

              return Marker(
                point: LatLng(store.lat, store.lng),
                width: isSelected ? 54 : 42,
                height: isSelected ? 54 : 42,
                child: GestureDetector(
                  onTap: () {
                    widget.onSelectStore(store);
                    _mapController.move(LatLng(store.lat, store.lng), 15.5);
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.primary : const Color(0xFF0F172A),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isSelected ? Colors.white : AppColors.primary,
                        width: isSelected ? 2.5 : 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: isSelected
                              ? AppColors.primary.withValues(alpha: 0.6)
                              : Colors.black54,
                          blurRadius: isSelected ? 14 : 6,
                          spreadRadius: isSelected ? 3 : 0,
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        store.emoji,
                        style: TextStyle(fontSize: isSelected ? 24 : 18),
                      ),
                    ),
                  ),
                ),
              );
            }),
          ],
        ),
      ],
    );

    if (widget.isFullScreen) {
      return Stack(
        children: [
          Positioned.fill(child: mapWidget),

          // Floating Recenter Button on Right Edge
          Positioned(
            right: 16,
            bottom: 230,
            child: FloatingActionButton.small(
              heroTag: 'recenter_gps_btn',
              backgroundColor: const Color(0xFF090D16).withValues(alpha: 0.9),
              foregroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: BorderSide(color: AppColors.primary.withValues(alpha: 0.4)),
              ),
              elevation: 4,
              onPressed: () {
                _mapController.move(widget.userLocation, 15.0);
                widget.onRecenter();
              },
              child: const Icon(Icons.my_location, size: 20),
            ),
          ),
        ],
      );
    }

    // Embedded Card Version (fallback)
    return Container(
      height: widget.height ?? 220,
      margin: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.glassBorder, width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          children: [
            mapWidget,
            Positioned(
              top: 10,
              right: 10,
              child: InkWell(
                onTap: () {
                  _mapController.move(widget.userLocation, 15.0);
                  widget.onRecenter();
                },
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF090D16).withValues(alpha: 0.85),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
                  ),
                  child: const Icon(Icons.my_location, size: 16, color: AppColors.primary),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
