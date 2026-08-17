import 'package:flutter/material.dart';
import '../../../core/networking/websocket_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/glass_card.dart';

class TopGlassHeader extends StatelessWidget {
  final String orderId;
  final String storeName;
  final WebSocketStatus socketStatus;
  final VoidCallback onBack;

  const TopGlassHeader({
    super.key,
    required this.orderId,
    required this.storeName,
    required this.socketStatus,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    Color dotColor;
    String statusText;

    switch (socketStatus) {
      case WebSocketStatus.connected:
        dotColor = AppColors.success;
        statusText = 'Live';
        break;
      case WebSocketStatus.reconnecting:
        dotColor = AppColors.warning;
        statusText = 'Syncing...';
        break;
      case WebSocketStatus.disconnected:
        dotColor = AppColors.error;
        statusText = 'Offline';
        break;
    }

    return GlassCard(
      borderRadius: 18,
      borderColor: AppColors.glassBorder,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Container(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new, size: 16, color: Colors.white),
              onPressed: onBack,
              visualDensity: VisualDensity.compact,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  storeName,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: -0.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  'Order #$orderId',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.white.withValues(alpha: 0.6),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: dotColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: dotColor.withValues(alpha: 0.4), width: 1.2),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: dotColor.withValues(alpha: 0.8),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  statusText,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: dotColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
