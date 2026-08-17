import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/glass_card.dart';

class MapControls extends StatelessWidget {
  final bool isFollowing;
  final VoidCallback onToggleFollow;
  final VoidCallback onFitRoute;

  const MapControls({
    super.key,
    required this.isFollowing,
    required this.onToggleFollow,
    required this.onFitRoute,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GlassCard(
          padding: EdgeInsets.zero,
          borderRadius: 14,
          backgroundColor: isFollowing
              ? AppColors.primary.withValues(alpha: 0.9)
              : AppColors.surface.withValues(alpha: 0.8),
          borderColor: isFollowing ? Colors.white : AppColors.glassBorder,
          child: IconButton(
            icon: Icon(
              Icons.my_location,
              size: 20,
              color: isFollowing ? Colors.black : Colors.white,
            ),
            tooltip: 'Follow Rider',
            onPressed: onToggleFollow,
          ),
        ),
        const SizedBox(height: 8),
        GlassCard(
          padding: EdgeInsets.zero,
          borderRadius: 14,
          backgroundColor: AppColors.surface.withValues(alpha: 0.8),
          child: IconButton(
            icon: const Icon(Icons.zoom_out_map, size: 20, color: Colors.white),
            tooltip: 'Fit Full Route',
            onPressed: onFitRoute,
          ),
        ),
      ],
    );
  }
}
