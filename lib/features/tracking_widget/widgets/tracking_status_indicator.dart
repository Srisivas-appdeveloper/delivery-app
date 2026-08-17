import 'package:flutter/material.dart';
import '../models/tracking_widget_state.dart';

class TrackingStatusIndicator extends StatelessWidget {
  final TrackingConnectionStatus status;
  final DateTime lastUpdated;
  final bool compact;

  const TrackingStatusIndicator({
    super.key,
    required this.status,
    required this.lastUpdated,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    Color dotColor;
    String label;

    switch (status) {
      case TrackingConnectionStatus.live:
        dotColor = const Color(0xFF10B981); // Emerald Green
        label = 'Live';
        break;
      case TrackingConnectionStatus.updating:
        dotColor = const Color(0xFFF59E0B); // Amber
        label = 'Updating…';
        break;
      case TrackingConnectionStatus.reconnecting:
        dotColor = const Color(0xFFF59E0B); // Amber
        label = 'Reconnecting…';
        break;
      case TrackingConnectionStatus.stale:
        dotColor = const Color(0xFF64748B); // Slate
        final ageSec = DateTime.now().difference(lastUpdated).inSeconds;
        label = '${ageSec}s ago';
        break;
      case TrackingConnectionStatus.disconnected:
        dotColor = const Color(0xFFEF4444); // Red
        label = 'Offline';
        break;
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 6 : 8,
        vertical: compact ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: dotColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: dotColor.withValues(alpha: 0.3), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: dotColor,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: dotColor.withValues(alpha: 0.6),
                  blurRadius: 4,
                ),
              ],
            ),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: compact ? 10 : 11,
              fontWeight: FontWeight.w700,
              color: dotColor,
            ),
          ),
        ],
      ),
    );
  }
}
