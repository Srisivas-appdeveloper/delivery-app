import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/order.dart';
import '../../../shared/widgets/glass_card.dart';

class RiderCard extends StatelessWidget {
  final Order order;
  final VoidCallback? onCallRider;

  const RiderCard({
    super.key,
    required this.order,
    this.onCallRider,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = AppColors.forStatus(order.status);

    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.15),
              shape: BoxShape.circle,
              border: Border.all(color: statusColor.withValues(alpha: 0.4)),
            ),
            child: Center(
              child: Text(
                order.driverAvatar,
                style: const TextStyle(fontSize: 20),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  order.driverName,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Moving • GPS Good (±${order.currentAccuracy.toStringAsFixed(0)}m) • Live',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.white.withValues(alpha: 0.6),
                  ),
                ),
              ],
            ),
          ),
          IconButton.filledTonal(
            icon: const Icon(Icons.phone, size: 18),
            style: IconButton.styleFrom(
              backgroundColor: AppColors.surfaceHighlight,
              foregroundColor: AppColors.primary,
            ),
            onPressed: onCallRider ??
                () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Calling ${order.driverName}: ${order.driverPhone}'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                },
          ),
        ],
      ),
    );
  }
}
