import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../services/home_screen_widget_service.dart';
import '../../../shared/widgets/bento_card.dart';
import '../models/tracking_widget_state.dart';
import '../widgets/delivery_progress_line.dart';
import '../widgets/eta_text.dart';
import '../widgets/glass_tracking_card.dart';
import '../widgets/tracking_status_indicator.dart';

class MediumTrackingWidget extends StatelessWidget {
  final TrackingWidgetState state;
  final VoidCallback onCollapse;
  final VoidCallback onOpenFullMap;

  const MediumTrackingWidget({
    super.key,
    required this.state,
    required this.onCollapse,
    required this.onOpenFullMap,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = state.statusColor;
    final speedKmh = (state.currentSpeed * 3.6).clamp(0.0, 99.0);

    return GlassTrackingCard(
      padding: const EdgeInsets.all(18),
      borderRadius: 26,
      borderColor: statusColor.withValues(alpha: 0.4),
      backgroundColor: const Color(0xFF0D1527).withValues(alpha: 0.92),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Top Bar: ETA Hero + Collapse Button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'ESTIMATED ARRIVAL',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                      color: Colors.white.withValues(alpha: 0.5),
                    ),
                  ),
                  const SizedBox(height: 2),
                  EtaText(
                    formattedEta: state.formattedEta,
                    fontSize: 26,
                  ),
                ],
              ),
              Row(
                children: [
                  TrackingStatusIndicator(
                    status: state.connectionStatus,
                    lastUpdated: state.lastUpdated,
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.keyboard_arrow_down, color: Colors.white70),
                    tooltip: 'Collapse',
                    onPressed: onCollapse,
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 14),

          // 2. Progress Line with Endpoint Labels
          DeliveryProgressLine(
            progress: state.progress,
            activeColor: statusColor,
            riderAvatar: state.riderAvatar,
            showEndpointLabels: true,
          ),

          const SizedBox(height: 16),

          // 3. Mini Bento Grid (Distance & Status)
          Row(
            children: [
              // Bento 1: Distance
              Expanded(
                child: BentoCard(
                  title: 'Distance',
                  value: state.formattedDistance,
                  subtitle: speedKmh > 0 ? '${speedKmh.toStringAsFixed(0)} km/h • Moving' : 'Stopped',
                  valueColor: AppColors.primary,
                  trailing: const Icon(Icons.route_outlined, size: 16, color: AppColors.primary),
                ),
              ),
              const SizedBox(width: 10),

              // Bento 2: Delivery Status
              Expanded(
                child: BentoCard(
                  title: 'Status',
                  value: state.statusLabel,
                  subtitle: state.storeName,
                  valueColor: statusColor,
                  trailing: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: statusColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // 4. Rider Info & Action Button Row
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                  border: Border.all(color: statusColor.withValues(alpha: 0.35)),
                ),
                child: Center(
                  child: Text(state.riderAvatar, style: const TextStyle(fontSize: 18)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      state.riderName,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      'Assigned Rider',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.white.withValues(alpha: 0.55),
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                style: IconButton.styleFrom(
                  backgroundColor: Colors.white.withValues(alpha: 0.1),
                  foregroundColor: AppColors.primary,
                  padding: const EdgeInsets.all(8),
                ),
                icon: const Icon(Icons.widgets_outlined, size: 18),
                tooltip: 'Pin Widget to Phone Home Screen',
                onPressed: () async {
                  await HomeScreenWidgetService.requestPinWidget();
                },
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                icon: const Icon(Icons.map_outlined, size: 16),
                label: const Text(
                  'Track',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
                ),
                onPressed: onOpenFullMap,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
