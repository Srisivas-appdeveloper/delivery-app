import datetime
from dataclasses import dataclass
from typing import Optional
from app.config import settings
from app.models.location import LocationRecord
from app.schemas.location import LocationInput
from app.utils.geo import haversine_distance
from app.utils.datetime_utils import utc_now, ensure_utc

@dataclass
class ValidationResult:
    is_valid: bool
    reason: Optional[str] = None

class LocationValidator:
    def __init__(
        self,
        max_accuracy: float = settings.GPS_MAX_ACCURACY,
        max_speed: float = settings.MAX_REASONABLE_SPEED,
    ):
        self.max_accuracy = max_accuracy
        self.max_speed = max_speed

    def validate(
        self,
        location: LocationInput,
        previous_record: Optional[LocationRecord] = None
    ) -> ValidationResult:
        # 1. Coordinate boundary checks
        if not (-90.0 <= location.latitude <= 90.0):
            return ValidationResult(False, "INVALID_LATITUDE")

        if not (-180.0 <= location.longitude <= 180.0):
            return ValidationResult(False, "INVALID_LONGITUDE")

        # 2. GPS Accuracy threshold check
        if location.accuracy > self.max_accuracy:
            return ValidationResult(
                False,
                f"EXCESSIVE_GPS_ERROR: Accuracy {location.accuracy:.1f}m exceeds limit of {self.max_accuracy}m"
            )

        # 3. Timestamp temporal sanity check
        now = utc_now()
        client_time = ensure_utc(location.timestamp) if location.timestamp else now

        # Prevent timestamps in the far future (> 5 mins)
        if (client_time - now).total_seconds() > 300:
            return ValidationResult(False, "FUTURE_TIMESTAMP")

        # 4. Impossible jump / speed check against previous location
        if previous_record is not None:
            prev_time = ensure_utc(previous_record.client_timestamp or previous_record.server_timestamp)
            delta_seconds = (client_time - prev_time).total_seconds()

            # If sequential reading has elapsed time
            if delta_seconds > 0.5:
                displacement = haversine_distance(
                    previous_record.latitude, previous_record.longitude,
                    location.latitude, location.longitude
                )
                calculated_speed_mps = displacement / delta_seconds

                if calculated_speed_mps > self.max_speed:
                    return ValidationResult(
                        False,
                        f"IMPOSSIBLE_SPEED: Moved {displacement:.0f}m in {delta_seconds:.1f}s ({calculated_speed_mps * 3.6:.1f} km/h)"
                    )

        return ValidationResult(True, None)

location_validator = LocationValidator()
