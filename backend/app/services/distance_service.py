from typing import List, Tuple
from app.utils.geo import haversine_distance

class DistanceService:
    @staticmethod
    def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate direct distance between two points in meters."""
        return haversine_distance(lat1, lon1, lat2, lon2)

    @staticmethod
    def calculate_total_travelled(coordinates: List[Tuple[float, float]]) -> float:
        """
        Calculate total distance travelled along a sequence of (latitude, longitude) coordinates.
        """
        if len(coordinates) < 2:
            return 0.0

        total_meters = 0.0
        for i in range(len(coordinates) - 1):
            p1 = coordinates[i]
            p2 = coordinates[i + 1]
            total_meters += haversine_distance(p1[0], p1[1], p2[0], p2[1])

        return round(total_meters, 2)

distance_service = DistanceService()
