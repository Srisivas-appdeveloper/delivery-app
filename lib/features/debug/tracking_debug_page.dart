import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/networking/websocket_client.dart';
import '../../core/theme/app_colors.dart';
import '../../services/delivery_providers.dart';
import '../../shared/widgets/glass_card.dart';

class TrackingDebugPage extends ConsumerWidget {
  const TrackingDebugPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final order = ref.watch(activeOrderProvider);
    final ws = ref.watch(webSocketServiceProvider);
    final socketStatus = ref.watch(webSocketStatusProvider).value ?? WebSocketStatus.disconnected;
    final simState = ref.watch(driverSimulationProvider);
    final telemetry = simState.telemetry;

    return Scaffold(
      appBar: AppBar(title: const Text('Developer & Telemetry Debug')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 1. WebSocket Diagnostics
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'WEBSOCKET CONNECTION DIAGNOSTICS',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.0,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 12),
                _buildRow('Socket Status', socketStatus.name.toUpperCase(), _statusColor(socketStatus)),
                _buildRow('Active Order ID', order?.id ?? 'None', Colors.white),
                _buildRow('Messages Ingested', '${ws.messagesReceivedCount}', AppColors.primary),
                _buildRow(
                  'Last Message Timestamp',
                  ws.lastMessageTime != null ? '${ws.lastMessageTime!.toIso8601String().substring(11, 19)} UTC' : 'None',
                  Colors.white70,
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // 2. Adaptive Telemetry Engine Stats
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ADAPTIVE LOCATION ENGINE DIAGNOSTICS',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.0,
                    color: AppColors.success,
                  ),
                ),
                const SizedBox(height: 12),
                _buildRow('Total GPS Readings', '${telemetry.totalGpsReadings}', Colors.white),
                _buildRow('Candidate Updates Sent', '${telemetry.updatesSent}', AppColors.primary),
                _buildRow('Candidate Updates Skipped', '${telemetry.updatesSkipped}', AppColors.warning),
                _buildRow('Bandwidth Saved', '${telemetry.savedPercentage.toStringAsFixed(1)}%', AppColors.success),
                _buildRow('Current Dynamic Interval', '${telemetry.currentInterval.inSeconds} seconds', Colors.white),
                _buildRow('Last Decision Reason', telemetry.lastReason, AppColors.secondary),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // 3. Raw Last Payload Inspection
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'LAST RECEIVED SERVER PAYLOAD',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.0,
                    color: Colors.white70,
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: SelectableText(
                    ws.lastRawResponse,
                    style: const TextStyle(
                      fontFamily: 'Courier',
                      fontSize: 12,
                      color: Color(0xFF67E8F9),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value, Color valueColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: Colors.white70)),
          Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: valueColor)),
        ],
      ),
    );
  }

  Color _statusColor(WebSocketStatus status) {
    switch (status) {
      case WebSocketStatus.connected:
        return AppColors.success;
      case WebSocketStatus.reconnecting:
        return AppColors.warning;
      case WebSocketStatus.disconnected:
        return AppColors.error;
    }
  }
}
