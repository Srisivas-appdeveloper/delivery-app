import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class DeliveryProgressLine extends StatelessWidget {
  final double progress; // 0.0 to 1.0
  final Color activeColor;
  final String riderAvatar;
  final bool showEndpointLabels;

  const DeliveryProgressLine({
    super.key,
    required this.progress,
    this.activeColor = AppColors.primary,
    this.riderAvatar = '🛵',
    this.showEndpointLabels = false,
  });

  @override
  Widget build(BuildContext context) {
    final clampedProgress = progress.clamp(0.0, 1.0);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final trackWidth = constraints.maxWidth;
            const markerSize = 22.0;
            // Calculate rider position offset
            final riderX = (trackWidth - markerSize) * clampedProgress;

            return SizedBox(
              height: 28,
              child: Stack(
                alignment: Alignment.centerLeft,
                clipBehavior: Clip.none,
                children: [
                  // 1. Background Track
                  Container(
                    height: 4,
                    width: trackWidth,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),

                  // 2. Active Gradient Progress Fill
                  TweenAnimationBuilder<double>(
                    tween: Tween<double>(begin: 0.0, end: clampedProgress),
                    duration: const Duration(milliseconds: 600),
                    curve: Curves.easeOutCubic,
                    builder: (context, val, _) {
                      return Container(
                        height: 4,
                        width: trackWidth * val,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              AppColors.secondary,
                              activeColor,
                            ],
                          ),
                          borderRadius: BorderRadius.circular(4),
                          boxShadow: [
                            BoxShadow(
                              color: activeColor.withValues(alpha: 0.5),
                              blurRadius: 8,
                              spreadRadius: 0,
                            ),
                          ],
                        ),
                      );
                    },
                  ),

                  // 3. Store Dot (Start)
                  Positioned(
                    left: 0,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: AppColors.secondary,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                    ),
                  ),

                  // 4. Customer Destination Pin (End)
                  Positioned(
                    right: 0,
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: activeColor,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: activeColor.withValues(alpha: 0.6),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                    ),
                  ),

                  // 5. Smooth Sliding Rider Marker
                  TweenAnimationBuilder<double>(
                    tween: Tween<double>(begin: 0.0, end: riderX),
                    duration: const Duration(milliseconds: 600),
                    curve: Curves.easeOutCubic,
                    builder: (context, posLeft, _) {
                      return Positioned(
                        left: posLeft.clamp(0.0, trackWidth - markerSize),
                        top: 3,
                        child: Container(
                          width: markerSize,
                          height: markerSize,
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: activeColor,
                              width: 1.5,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: activeColor.withValues(alpha: 0.4),
                                blurRadius: 6,
                                spreadRadius: 1,
                              ),
                            ],
                          ),
                          child: Center(
                            child: Text(
                              riderAvatar,
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            );
          },
        ),
        if (showEndpointLabels) ...[
          const SizedBox(height: 2),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Store',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: Colors.white.withValues(alpha: 0.5),
                ),
              ),
              Text(
                'Destination',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: Colors.white.withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
