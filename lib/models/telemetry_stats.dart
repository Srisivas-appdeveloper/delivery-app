class TelemetryStats {
  final int totalGpsReadings;
  final int updatesSent;
  final int updatesSkipped;
  final String lastReason;
  final Duration currentInterval;
  final DateTime? lastSentTime;
  final int messagesReceived;
  final double averageLatencyMs;

  const TelemetryStats({
    this.totalGpsReadings = 0,
    this.updatesSent = 0,
    this.updatesSkipped = 0,
    this.lastReason = 'INITIALIZED',
    this.currentInterval = const Duration(seconds: 5),
    this.lastSentTime,
    this.messagesReceived = 0,
    this.averageLatencyMs = 0.0,
  });

  double get savedPercentage {
    if (totalGpsReadings == 0) return 0.0;
    return (updatesSkipped / totalGpsReadings) * 100.0;
  }

  TelemetryStats copyWith({
    int? totalGpsReadings,
    int? updatesSent,
    int? updatesSkipped,
    String? lastReason,
    Duration? currentInterval,
    DateTime? lastSentTime,
    int? messagesReceived,
    double? averageLatencyMs,
  }) {
    return TelemetryStats(
      totalGpsReadings: totalGpsReadings ?? this.totalGpsReadings,
      updatesSent: updatesSent ?? this.updatesSent,
      updatesSkipped: updatesSkipped ?? this.updatesSkipped,
      lastReason: lastReason ?? this.lastReason,
      currentInterval: currentInterval ?? this.currentInterval,
      lastSentTime: lastSentTime ?? this.lastSentTime,
      messagesReceived: messagesReceived ?? this.messagesReceived,
      averageLatencyMs: averageLatencyMs ?? this.averageLatencyMs,
    );
  }
}
