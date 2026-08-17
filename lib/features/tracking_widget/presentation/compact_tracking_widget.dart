import 'package:flutter/material.dart';
import '../models/tracking_widget_state.dart';
import '../widgets/delivery_progress_line.dart';
import '../widgets/eta_text.dart';
import '../widgets/glass_tracking_card.dart';
import '../widgets/tracking_status_indicator.dart';

class CompactTrackingWidget extends StatelessWidget {
  final TrackingWidgetState state;
  final VoidCallback onExpand;
  final VoidCallback onOpenFullMap;

  const CompactTrackingWidget({
    super.key,
    required this.state,
    required this.onExpand,
    required this.onOpenFullMap,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = state.statusColor;

    return GlassTrackingCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      borderRadius: 22,
      borderColor: statusColor.withValues(alpha: 0.35),
      onTap: onExpand,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row 1: Avatar + Status Info + ETA & Expand Arrow
          Row(
            children: [
              // Rider Avatar
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: statusColor.withValues(alpha: 0.4),
                    width: 1.5,
                  ),
                ),
                child: Center(
                  child: Text(
                    state.riderAvatar,
                    style: const TextStyle(fontSize: 18),
                  ),
                ),
              ),
              const SizedBox(width: 10),

              // Status & Subtitle
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            state.statusLabel,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              letterSpacing: -0.2,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        TrackingStatusIndicator(
                          status: state.connectionStatus,
                          lastUpdated: state.lastUpdated,
                          compact: true,
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${state.storeName} • ${state.formattedDistance} away',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.white.withValues(alpha: 0.65),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),

              // ETA & Chevron
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  EtaText(
                    formattedEta: state.formattedEta,
                    fontSize: 17,
                  ),
                  const SizedBox(width: 4),
                  const Icon(
                    Icons.keyboard_arrow_up,
                    color: Colors.white60,
                    size: 20,
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Row 2: Mini Progress Line
          DeliveryProgressLine(
            progress: state.progress,
            activeColor: statusColor,
            riderAvatar: state.riderAvatar,
          ),
        ],
      ),
    );
  }
}
