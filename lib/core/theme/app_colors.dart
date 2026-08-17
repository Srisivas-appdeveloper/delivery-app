import 'package:flutter/material.dart';

class AppColors {
  // Base Neutral Palette
  static const Color background = Color(0xFF090D16);
  static const Color surface = Color(0xFF111827);
  static const Color surfaceCard = Color(0xFF182234);
  static const Color surfaceHighlight = Color(0xFF1F2D44);

  // Accent Palette
  static const Color primary = Color(0xFF00E5FF); // Electric Cyan
  static const Color primaryGlow = Color(0x3300E5FF);
  static const Color secondary = Color(0xFF38BDF8); // Sky Blue

  // Status & Telemetry
  static const Color success = Color(0xFF10B981); // Emerald Green
  static const Color warning = Color(0xFFF59E0B); // Amber
  static const Color error = Color(0xFFEF4444); // Crimson
  static const Color info = Color(0xFF6366F1); // Indigo

  // Glassmorphism Constants
  static final Color glassSurface = const Color(0xFF111827).withValues(alpha: 0.75);
  static final Color glassBorder = Colors.white.withValues(alpha: 0.12);
  static final Color glassBorderHighlight = primary.withValues(alpha: 0.45);

  // Status Color Resolver
  static Color forStatus(String status) {
    switch (status.toLowerCase()) {
      case 'preparing':
        return warning;
      case 'picked_up':
        return secondary;
      case 'on_the_way':
        return primary;
      case 'nearby':
        return const Color(0xFFA855F7);
      case 'arriving':
        return const Color(0xFFEC4899);
      case 'delivered':
        return success;
      case 'cancelled':
        return error;
      default:
        return Colors.blueGrey;
    }
  }

  static String statusLabel(String status) {
    switch (status.toLowerCase()) {
      case 'assigned':
        return 'Driver Assigned';
      case 'preparing':
        return 'Preparing Order';
      case 'picked_up':
        return 'Order Picked Up';
      case 'on_the_way':
        return 'On the Way';
      case 'nearby':
        return 'Rider Nearby (< 1 km)';
      case 'arriving':
        return 'Arriving (< 300 m)';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status.replaceAll('_', ' ').toUpperCase();
    }
  }
}
