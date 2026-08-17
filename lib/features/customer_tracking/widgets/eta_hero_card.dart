import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/order.dart';
import '../../../shared/widgets/glass_card.dart';

class EtaHeroCard extends StatelessWidget {
  final Order order;

  const EtaHeroCard({super.key, required this.order});

  String _formatEta() {
    if (order.status == 'delivered') return 'Delivered';
    if (order.status == 'arriving') return '< 1 min';
    if (order.smoothedEtaMinutes <= 0.5) return '~1 min';
    return '${order.smoothedEtaMinutes.toStringAsFixed(0)} min';
  }

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      borderColor: AppColors.primary.withValues(alpha: 0.35),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ESTIMATED ARRIVAL',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                  color: Colors.white.withValues(alpha: 0.5),
                ),
              ),
              const SizedBox(height: 4),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child: Text(
                  _formatEta(),
                  key: ValueKey<String>(_formatEta()),
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
            ),
            child: const Icon(Icons.timer_outlined, color: AppColors.primary, size: 24),
          ),
        ],
      ),
    );
  }
}
