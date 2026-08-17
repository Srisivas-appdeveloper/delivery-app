import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/order.dart';
import '../../services/delivery_providers.dart';
import '../../shared/widgets/glass_card.dart';
import '../../shared/widgets/status_badge.dart';

class DriverDashboardPage extends ConsumerWidget {
  const DriverDashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final order = ref.watch(activeOrderProvider);
    final simState = ref.watch(driverSimulationProvider);
    final simNotifier = ref.read(driverSimulationProvider.notifier);
    final telemetry = simState.telemetry;
    final ordersAsync = ref.watch(ordersListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Driver Hub (Static PoC)'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Orders',
            onPressed: () => ref.read(ordersListProvider.notifier).refresh(),
          ),
          IconButton(
            icon: const Icon(Icons.add_circle_outline),
            tooltip: 'New Demo Order',
            onPressed: () => ref.read(ordersListProvider.notifier).createNewOrder(),
          ),
        ],
      ),
      body: order == null
          ? _buildEmptyDriverState(context, ref, ordersAsync)
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // 1. Order Header Card
                  GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'ACTIVE ASSIGNMENT #${order.id}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.0,
                                color: AppColors.primary,
                              ),
                            ),
                            StatusBadge(status: order.status),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Store: ${order.storeName}',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Destination: ${order.destinationAddress}',
                          style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.7)),
                        ),
                        const Divider(height: 20, color: Colors.white12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Remaining: ${(order.remainingDistanceMeters / 1000).toStringAsFixed(2)} km',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                            Text(
                              'ETA: ${order.smoothedEtaMinutes.toStringAsFixed(1)} min',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // 2. Static Route Controls & Step-by-Step Simulator
                  GlassCard(
                    borderColor: AppColors.primary.withValues(alpha: 0.35),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              '🛵 STATIC ROUTE SIMULATOR (PoC)',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.0,
                                color: AppColors.primary,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: simState.isSimulating && !simState.isPaused
                                    ? AppColors.success.withValues(alpha: 0.2)
                                    : Colors.white10,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                simState.isSimulating && !simState.isPaused
                                    ? '● Moving (${simState.speedMultiplier}x)'
                                    : (simState.isPaused ? '⏸ Paused' : '⏹ Idle'),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: simState.isSimulating && !simState.isPaused
                                      ? AppColors.success
                                      : Colors.white70,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // Speed Multipliers
                        Row(
                          children: [
                            const Text('Simulation Speed:', style: TextStyle(fontSize: 12, color: Colors.white70)),
                            const Spacer(),
                            for (final speed in [1, 2, 5, 10]) ...[
                              Padding(
                                padding: const EdgeInsets.only(left: 6),
                                child: ChoiceChip(
                                  label: Text('${speed}x'),
                                  selected: simState.speedMultiplier == speed,
                                  onSelected: (selected) {
                                    if (selected) simNotifier.setSpeed(speed);
                                  },
                                ),
                              ),
                            ],
                          ],
                        ),

                        const SizedBox(height: 14),

                        // Play / Pause / Step Controls
                        Row(
                          children: [
                            if (!simState.isSimulating)
                              Expanded(
                                child: ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.success,
                                    foregroundColor: Colors.black,
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                  ),
                                  icon: const Icon(Icons.play_arrow),
                                  label: const Text('Start Route', style: TextStyle(fontWeight: FontWeight.bold)),
                                  onPressed: () => simNotifier.startSimulation(),
                                ),
                              )
                            else if (simState.isPaused)
                              Expanded(
                                child: ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.success,
                                    foregroundColor: Colors.black,
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                  ),
                                  icon: const Icon(Icons.play_arrow),
                                  label: const Text('Resume', style: TextStyle(fontWeight: FontWeight.bold)),
                                  onPressed: () => simNotifier.resume(),
                                ),
                              )
                            else
                              Expanded(
                                child: ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.warning,
                                    foregroundColor: Colors.black,
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                  ),
                                  icon: const Icon(Icons.pause),
                                  label: const Text('Pause', style: TextStyle(fontWeight: FontWeight.bold)),
                                  onPressed: () => simNotifier.pause(),
                                ),
                              ),
                            const SizedBox(width: 8),

                            // Step Forward Button (+35m)
                            OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
                                side: const BorderSide(color: AppColors.primary),
                              ),
                              icon: const Icon(Icons.skip_next, color: AppColors.primary, size: 18),
                              label: const Text('Step (+35m)', style: TextStyle(color: AppColors.primary)),
                              onPressed: () => simNotifier.stepForward(),
                            ),

                            const SizedBox(width: 8),

                            // Reset Button
                            IconButton(
                              icon: const Icon(Icons.restart_alt, color: Colors.white70),
                              tooltip: 'Reset Route',
                              onPressed: () => simNotifier.reset(),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // 3. Adaptive Optimization Telemetry Bento Grid
                  GlassCard(
                    borderColor: AppColors.success.withValues(alpha: 0.4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              '⚡ ADAPTIVE OPTIMIZATION TELEMETRY',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.0,
                                color: AppColors.success,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                'Interval: ${telemetry.currentInterval.inSeconds}s',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            _buildStatItem('GPS Readings', '${telemetry.totalGpsReadings}', Colors.white),
                            _buildStatItem('Updates Sent', '${telemetry.updatesSent}', AppColors.primary),
                            _buildStatItem('Skipped', '${telemetry.updatesSkipped}', AppColors.warning),
                            _buildStatItem(
                              'Saved Network',
                              '${telemetry.savedPercentage.toStringAsFixed(0)}%',
                              AppColors.success,
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.4),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.info_outline, size: 14, color: Colors.white60),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'Engine Decision: ${telemetry.lastReason}',
                                  style: const TextStyle(fontSize: 11, color: Colors.white70),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // 4. Manual Delivery State Overrides
                  GlassCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'MANUAL STATUS OVERRIDES',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.0,
                            color: Colors.white70,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _buildStateButton(ref, 'picked_up', 'Picked Up', order.status),
                            _buildStateButton(ref, 'on_the_way', 'On the Way', order.status),
                            _buildStateButton(ref, 'nearby', 'Nearby (< 1km)', order.status),
                            _buildStateButton(ref, 'arriving', 'Arriving (< 300m)', order.status),
                            _buildStateButton(ref, 'delivered', 'Delivered', order.status),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildEmptyDriverState(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<List<Order>> ordersAsync,
  ) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.15),
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3), width: 2),
              ),
              child: const Icon(Icons.two_wheeler, size: 54, color: AppColors.primary),
            ),
            const SizedBox(height: 20),
            const Text(
              'Static Driver Simulator (PoC)',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            Text(
              'Simulate how delivery partners receive assignments, transmit location checkpoints, step through delivery waypoints, and optimize network data in real-time.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Colors.white.withValues(alpha: 0.7), height: 1.4),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              icon: const Icon(Icons.play_arrow, size: 22),
              label: const Text(
                '⚡ Launch Static Delivery Simulation',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
              ),
              onPressed: () async {
                final newOrder = await ref.read(ordersListProvider.notifier).createNewOrder();
                if (newOrder != null) {
                  ref.read(driverSimulationProvider.notifier).startSimulation(order: newOrder);
                }
              },
            ),
            const SizedBox(height: 24),
            ordersAsync.when(
              data: (orders) {
                if (orders.isEmpty) return const SizedBox.shrink();
                return GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'OR SELECT EXISTING ORDER TO SIMULATE',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white70),
                      ),
                      const SizedBox(height: 10),
                      ...orders.take(3).map((o) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(o.storeName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                            subtitle: Text('Order #${o.id} • ${o.status}', style: const TextStyle(fontSize: 11)),
                            trailing: TextButton(
                              child: const Text('Simulate'),
                              onPressed: () {
                                ref.read(activeOrderIdProvider.notifier).state = o.id;
                              },
                            ),
                          )),
                    ],
                  ),
                );
              },
              loading: () => const SizedBox.shrink(),
              error: (err, stack) => const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(String label, String value, Color valueColor) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: valueColor,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 10,
              color: Colors.white.withValues(alpha: 0.6),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStateButton(WidgetRef ref, String status, String label, String currentStatus) {
    final isCurrent = currentStatus == status;
    return OutlinedButton(
      style: OutlinedButton.styleFrom(
        backgroundColor: isCurrent ? AppColors.primary.withValues(alpha: 0.2) : Colors.transparent,
        side: BorderSide(
          color: isCurrent ? AppColors.primary : Colors.white24,
          width: isCurrent ? 1.5 : 1.0,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
      onPressed: () => ref.read(activeOrderProvider.notifier).updateStatus(status),
      child: Text(
        label,
        style: TextStyle(
          color: isCurrent ? AppColors.primary : Colors.white,
          fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
          fontSize: 12,
        ),
      ),
    );
  }
}
