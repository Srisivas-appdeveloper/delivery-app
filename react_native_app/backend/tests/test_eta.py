from app.services.eta_service import eta_service

def test_eta_zero_distance():
    eta = eta_service.calculate_eta_seconds(10.0, 5.0)
    assert eta == 0.0

def test_eta_fallback_speed_when_stationary():
    # 1000m at fallback 5.56 m/s (~20 km/h) -> ~180s
    eta = eta_service.calculate_eta_seconds(1000.0, 0.0)
    assert 170.0 <= eta <= 190.0

def test_eta_smoothing():
    # Previous ETA: 200s
    # Raw new ETA: 100s
    # With alpha=0.3: 0.3 * 100 + 0.7 * 200 = 30 + 140 = 170s
    smoothed = eta_service.calculate_eta_seconds(
        remaining_distance_meters=556.0,  # ~100s at 5.56 m/s
        current_speed_mps=0.0,
        previous_eta_seconds=200.0
    )
    assert 160.0 <= smoothed <= 180.0
