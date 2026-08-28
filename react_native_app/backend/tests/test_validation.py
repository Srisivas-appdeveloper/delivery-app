import pytest
import datetime
from pydantic import ValidationError
from app.schemas.location import LocationInput
from app.models.location import LocationRecord
from app.services.location_validator import location_validator

def test_valid_location():
    loc = LocationInput(
        latitude=11.0191,
        longitude=76.9602,
        accuracy=5.0,
        speed=6.0,
        heading=120.0
    )
    result = location_validator.validate(loc)
    assert result.is_valid is True
    assert result.reason is None

def test_invalid_latitude_schema_rejection():
    with pytest.raises(ValidationError):
        LocationInput(
            latitude=95.0,
            longitude=76.9602,
            accuracy=5.0
        )

def test_excessive_gps_error():
    loc = LocationInput(
        latitude=11.0191,
        longitude=76.9602,
        accuracy=80.0  # limit is 35m
    )
    result = location_validator.validate(loc)
    assert result.is_valid is False
    assert "EXCESSIVE_GPS_ERROR" in result.reason

def test_impossible_speed_jump():
    prev_record = LocationRecord(
        order_id="ORD001",
        latitude=11.0168,
        longitude=76.9558,
        server_timestamp=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=2)
    )

    # Candidate 5000m away in 2s (~9000 km/h)
    new_loc = LocationInput(
        latitude=11.0600,
        longitude=76.9900,
        accuracy=5.0,
        timestamp=datetime.datetime.now(datetime.timezone.utc)
    )
    result = location_validator.validate(new_loc, prev_record)
    assert result.is_valid is False
    assert "IMPOSSIBLE_SPEED" in result.reason
