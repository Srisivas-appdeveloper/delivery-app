class LocationDecision {
  final bool shouldSend;
  final String reason;
  final Duration nextInterval;

  const LocationDecision({
    required this.shouldSend,
    required this.reason,
    required this.nextInterval,
  });

  Map<String, dynamic> toJson() => {
    'should_send': shouldSend,
    'reason': reason,
    'next_interval_ms': nextInterval.inMilliseconds,
  };
}
