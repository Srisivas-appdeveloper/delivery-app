import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class EtaText extends StatelessWidget {
  final String formattedEta;
  final double fontSize;
  final Color? color;
  final FontWeight fontWeight;
  final bool showLabel;

  const EtaText({
    super.key,
    required this.formattedEta,
    this.fontSize = 18.0,
    this.color,
    this.fontWeight = FontWeight.w900,
    this.showLabel = false,
  });

  @override
  Widget build(BuildContext context) {
    final displayColor = color ?? AppColors.primary;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showLabel) ...[
          Text(
            'ESTIMATED ARRIVAL',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.0,
              color: Colors.white.withValues(alpha: 0.5),
            ),
          ),
          const SizedBox(height: 2),
        ],
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          transitionBuilder: (child, animation) {
            return FadeTransition(
              opacity: animation,
              child: SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0.0, 0.2),
                  end: Offset.zero,
                ).animate(animation),
                child: child,
              ),
            );
          },
          child: Text(
            formattedEta,
            key: ValueKey<String>(formattedEta),
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: fontWeight,
              color: displayColor,
              letterSpacing: -0.3,
            ),
          ),
        ),
      ],
    );
  }
}
