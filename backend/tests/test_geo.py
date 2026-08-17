import pytest
from app.utils.geo import haversine_distance, calculate_bearing

def test_haversine_same_point():
    assert haversine_distance(11.0168, 76.9558, 11.0168, 76.9558) == 0.0

def test_haversine_known_distance():
    # Coimbatore store to destination approx ~1600m
    dist = haversine_distance(11.0168, 76.9558, 11.0250, 76.9680)
    assert 1500.0 < dist < 1700.0

def test_bearing():
    bearing = calculate_bearing(11.0168, 76.9558, 11.0250, 76.9680)
    assert 0.0 <= bearing <= 360.0
    assert 40.0 < bearing < 70.0  # North-East quadrant
