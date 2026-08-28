from app.config import settings

class ETAService:
    def __init__(
        self,
        fallback_speed_mps: float = settings.ETA_FALLBACK_SPEED,
        smoothing_alpha: float = settings.ETA_SMOOTHING_FACTOR,
    ):
        self.fallback_speed_mps = max(fallback_speed_mps, 1.0)
        self.smoothing_alpha = smoothing_alpha

    def calculate_eta_seconds(
        self,
        remaining_distance_meters: float,
        current_speed_mps: float,
        previous_eta_seconds: float = 0.0,
        rolling_avg_speed_mps: float = 0.0,
    ) -> float:
        """
        Estimates remaining arrival time in seconds using effective speed and EMA smoothing.
        """
        if remaining_distance_meters <= 15.0:
            return 0.0

        # Determine effective speed
        effective_speed = max(current_speed_mps, 0.0)
        
        # Blend current speed with rolling average & fallback speed for stability
        if effective_speed >= 1.5:
            blended_speed = 0.5 * effective_speed + 0.3 * (rolling_avg_speed_mps or effective_speed) + 0.2 * self.fallback_speed_mps
        else:
            blended_speed = self.fallback_speed_mps

        # Calculate raw ETA in seconds
        raw_eta_seconds = remaining_distance_meters / blended_speed

        # If previous ETA was 0 or not initialized, set directly
        if previous_eta_seconds <= 1.0:
            return round(raw_eta_seconds, 1)

        # Exponential Moving Average Smoothing
        smoothed_eta = (self.smoothing_alpha * raw_eta_seconds) + ((1.0 - self.smoothing_alpha) * previous_eta_seconds)

        return round(smoothed_eta, 1)

eta_service = ETAService()
