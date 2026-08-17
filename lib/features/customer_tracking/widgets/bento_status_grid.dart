import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/order.dart';
import '../../../shared/widgets/bento_card.dart';

class BentoStatusGrid extends StatelessWidget {
  final Order order;

  const BentoStatusGrid({super.key, required this.order});

  String _formatDistance() {
    if (order.remainingDistanceMeters >= 1000) {
      return '${(order.remainingDistanceMeters / 1000).toStringAsFixed(1)} km';
    }
    return '${order.remainingDistanceMeters.toStringAsFixed(0)} m';
  }

  String _formatSpeed() {
    final kmh = (order.currentSpeed * 3.6).clamp(0.0, 99.0);
    return '${kmh.toStringAsFixed(0)} km/h';
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = AppColors.forStatus(order.status);
    final statusLabel = AppColors.statusLabel(order.status);

    return Row(
      children: [
        // Bento 1: Distance
        Expanded(
          child: BentoCard(
            title: 'Distance',
            value: _formatDistance(),
            subtitle: 'Remaining',
            valueColor: AppColors.primary,
            trailing: const Icon(Icons.route_outlined, size: 16, color: AppColors.primary),
          ),
        ),
        const SizedBox(width: 10),

        // Bento 2: Delivery Status
        Expanded(
          child: BentoCard(
            title: 'Status',
            value: statusLabel,
            subtitle: 'Speed: ${_formatSpeed()}',
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
    );
  }
}
