from fastapi import APIRouter, Query

from app.services.places_service import search_nearby

router = APIRouter(prefix="/api/places", tags=["places"])


@router.get("/nearby")
async def nearby_places(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_m: int = Query(2000, ge=200, le=2000),
):
    places = await search_nearby(lat, lng, radius_m)
    return {
        "lat": lat,
        "lng": lng,
        "radius_m": radius_m,
        "count": len(places),
        "places": places,
    }
