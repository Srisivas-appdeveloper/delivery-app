import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../customer_tracking/live_tracking_page.dart';
import '../models/tracking_widget_state.dart';
import '../providers/tracking_widget_provider.dart';
import 'compact_tracking_widget.dart';
import 'medium_tracking_widget.dart';

class LiveTrackingWidget extends ConsumerStatefulWidget {
  final String? orderId;
  final VoidCallback? onOpenTracking;
  final VoidCallback? onOpenFullMap; // Compatibility alias

  const LiveTrackingWidget({
    super.key,
    this.orderId,
    this.onOpenTracking,
    this.onOpenFullMap,
  });

  @override
  ConsumerState<LiveTrackingWidget> createState() => _LiveTrackingWidgetState();
}

class _LiveTrackingWidgetState extends ConsumerState<LiveTrackingWidget> {
  Timer? _dismissTimer;
  bool _hideCompleted = false;

  void _handleOpenMap() {
    if (widget.onOpenTracking != null) {
      widget.onOpenTracking!();
    } else if (widget.onOpenFullMap != null) {
      widget.onOpenFullMap!();
    } else {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const LiveTrackingPage()),
      );
    }
  }

  void _setVisualMode(TrackingWidgetVisualMode mode) {
    ref.read(trackingWidgetVisualModeProvider.notifier).state = mode;
  }

  @override
  void dispose() {
    _dismissTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final trackingState = ref.watch(trackingWidgetProvider);

    if (_hideCompleted) {
      return const SizedBox.shrink();
    }

    // Schedule auto-dismiss when delivery completes or cancels
    if ((trackingState.isDelivered || trackingState.isCancelled) && _dismissTimer == null) {
      _dismissTimer = Timer(const Duration(seconds: 5), () {
        if (mounted) {
          setState(() => _hideCompleted = true);
        }
      });
    } else if (!trackingState.isDelivered && !trackingState.isCancelled && _hideCompleted) {
      _hideCompleted = false;
      _dismissTimer?.cancel();
      _dismissTimer = null;
    }

    final visualMode = trackingState.visualMode;

    return GestureDetector(
      onVerticalDragEnd: (details) {
        if (details.primaryVelocity != null) {
          if (details.primaryVelocity! < -150) {
            // Drag Up -> Medium
            _setVisualMode(TrackingWidgetVisualMode.medium);
          } else if (details.primaryVelocity! > 150) {
            // Drag Down -> Compact
            _setVisualMode(TrackingWidgetVisualMode.compact);
          }
        }
      },
      child: AnimatedSize(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOutCubic,
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          child: visualMode == TrackingWidgetVisualMode.medium
              ? MediumTrackingWidget(
                  key: const ValueKey('medium_tracking_view'),
                  state: trackingState,
                  onCollapse: () => _setVisualMode(TrackingWidgetVisualMode.compact),
                  onOpenFullMap: _handleOpenMap,
                )
              : CompactTrackingWidget(
                  key: const ValueKey('compact_tracking_view'),
                  state: trackingState,
                  onExpand: () => _setVisualMode(TrackingWidgetVisualMode.medium),
                  onOpenFullMap: _handleOpenMap,
                ),
        ),
      ),
    );
  }
}
