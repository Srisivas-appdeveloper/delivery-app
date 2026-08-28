import math
import logging
import time
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("places_service")

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# Use precise categories instead of querying every named amenity/office object.
# It is materially faster and gives the discovery experience people expect:
# shops, food, health, hotels, malls, banks and everyday services.
OVERPASS_PLACE_FILTERS = (
    'nwr["shop"]',
    'nwr["healthcare"]',
    'nwr["amenity"~"^(hospital|clinic|doctors|dentist|pharmacy|veterinary|restaurant|cafe|fast_food|food_court|fuel|atm|bank|marketplace|school|college|cinema|theatre)$"]',
    'nwr["tourism"~"^(hotel|guest_house|hostel|motel|apartment)$"]',
    'nwr["leisure"~"^(park|fitness_centre|sports_centre|playground)$"]',
    'nwr["office"~"^(insurance|lawyer|telecommunication|government|travel_agent)$"]',
    'nwr["craft"]',
)

_CACHE_TTL_SECONDS = 45
_nearby_cache: dict[tuple[float, float, int], tuple[float, list[dict[str, Any]]]] = {}
_overpass_blocked_until = 0.0


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _element_point(element: dict[str, Any]) -> tuple[float, float] | None:
    if "lat" in element and "lon" in element:
        return float(element["lat"]), float(element["lon"])
    center = element.get("center") or {}
    if "lat" in center and "lon" in center:
        return float(center["lat"]), float(center["lon"])
    return None


def _address(tags: dict[str, Any]) -> str:
    if tags.get("addr:full"):
        return str(tags["addr:full"])
    parts = [
        tags.get("addr:housenumber"),
        tags.get("addr:street"),
        tags.get("addr:suburb") or tags.get("addr:neighbourhood"),
        tags.get("addr:city"),
    ]
    return ", ".join(part for part in parts if part) or "Nearby"


def _category(tags: dict[str, Any]) -> str:
    for key in (
        "shop",
        "healthcare",
        "amenity",
        "tourism",
        "leisure",
        "office",
        "craft",
        "public_transport",
        "railway",
        "aeroway",
    ):
        value = tags.get(key)
        if value:
            return str(value).replace("_", " ").title()
    return "Place"


import re

CATEGORY_CHECKS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("Temple", re.compile(r"\b(temple|kovil|koil|mandir|mariamman|amman kovil|murugan|vinayagar|ganapathi|perumal|devasthanam|sannidhi|sivan kovil|krishna temple|tirupati|hindu temple)\b", re.I)),
    ("Church", re.compile(r"\b(church|chapel|cathedral|basilica|jesus|christ|mary church)\b", re.I)),
    ("Mosque", re.compile(r"\b(mosque|masjid|dargah|eidgah|jumma|islamic centre)\b", re.I)),
    ("IceCream", re.compile(r"\b(pep\s*(and|&|'n'|\s)?\s*lip|pepncup|ibaco|polar bear|ice\s*cream|dessert|gelato|kulfi|falooda|baskin|waffle|thick\s*shake)\b", re.I)),
    ("Silks", re.compile(r"\b(chennai silks|the chennai silks|pothys|rmkv|kalyan silks|nalli|kumaran silks|ganapathy silks|saree|sarees|textile|textiles|silks|menswear|trends|pantaloons)\b", re.I)),
    ("Supermarket", re.compile(r"\b(d\s*mart|dmart|spencer|reliance|more super|nilgiris|pazhamudhir|supermarket|hypermarket|grocery|provision)\b", re.I)),
    ("SouthIndianVeg", re.compile(r"\b(adyar ananda bhavan|a2b|annapoorna|anandha bhavan|saravana bhavan|sree annapoorna|veg|vegetarian|tiffin|dosa|idli|sweets|mithai)\b", re.I)),
    ("BiryaniNonVeg", re.compile(r"\b(junior kuppanna|kuppanna|thalappakatti|hari bhavanam|biryani|briyani|mutton|chettinad|non\s*veg|barbeque|bbq|grill|kebab)\b", re.I)),
    ("Jewelry", re.compile(r"\b(kalyan jewellers|malabar gold|tanishq|joyalukkas|jos alukkas|grt|lalitha|jewellers|jewellery|gold|diamond)\b", re.I)),
    ("Pharmacy", re.compile(r"\b(pharmacy|chemist|medicals|drugstore|apollo pharmacy|medplus)\b", re.I)),
    ("Hospital", re.compile(r"\b(ganga hospital|kmch|psg hospital|ramakrishna hospital|apollo hospital|hospital|clinic|nursing home|healthcare|eye care|dental)\b", re.I)),
    ("Hotel", re.compile(r"\b(hotel|motel|hostel|guest house|lodge|residency|inn|resort|suites)\b", re.I)),
    ("Apartment", re.compile(r"\b(apartment|apartments|flat|residential|residence|villas|enclave|colony|nagar|layout)\b", re.I)),
    ("Fuel", re.compile(r"\b(fuel|petrol|diesel|gas station|bunk|indian oil|bharat petroleum|hp petrol|shell)\b", re.I)),
    ("Atm", re.compile(r"\b(atm|cash point)\b", re.I)),
    ("Bank", re.compile(r"\b(bank|finance|financial|sbi|hdfc|icici|axis)\b", re.I)),
    ("Cafe", re.compile(r"\b(cafe|coffee|tea|chai|bakery|bakes|bakers|filter coffee|starbucks|ccd)\b", re.I)),
    ("Restaurant", re.compile(r"\b(restaurant|food|diner|kitchen|eatery|fast food|canteen|dhaba|mess)\b", re.I)),
    ("Mall", re.compile(r"\b(mall|shopping centre|shopping center|marketplace|department store|complex)\b", re.I)),
    ("Transit", re.compile(r"\b(bus|station|stop|railway|metro|terminal|transport|airport)\b", re.I)),
    ("School", re.compile(r"\b(school|college|university|academy|polytechnic|institute)\b", re.I)),
    ("Park", re.compile(r"\b(park|playground|garden|lake|stadium)\b", re.I)),
    ("Office", re.compile(r"\b(office|agency|insurance|lawyer|government|foundation|technologies|company|service|it park)\b", re.I)),
)


def _infer_category_from_text(name: str, fallback: str = "Place") -> str:
    text = f"{fallback} {name}".replace("_", " ")
    for category, pattern in CATEGORY_CHECKS:
        if pattern.search(text):
            return category
    return fallback if fallback and fallback != "Poi" else "Place"


async def _query_overpass(lat: float, lng: float, radius_m: int) -> list[dict[str, Any]]:
    filters = "\n".join(
        f'      {place_filter}["name"](around:{radius_m},{lat},{lng});'
        for place_filter in OVERPASS_PLACE_FILTERS
    )
    query = f"""
    [out:json][timeout:4];
    (
{filters}
    );
    out center tags 200;
    """
    # The app must receive the fallback response promptly when a public
    # Overpass instance is overloaded. A healthy small-radius OSM query
    # normally completes in well under this limit.
    async with httpx.AsyncClient(timeout=5.0, headers={"User-Agent": "VeloxDelivery/1.0"}) as client:
        last_error: Exception | None = None
        for url in OVERPASS_ENDPOINTS:
            try:
                response = await client.post(url, data={"data": query})
                response.raise_for_status()
                payload = response.json()
                return payload.get("elements") or []
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                logger.warning("Overpass failed at %s: %s", url, exc)
        if last_error:
            raise last_error
    return []


async def _query_stadia(lat: float, lng: float, radius_m: int) -> list[dict[str, Any]]:
    if not settings.STADIA_MAPS_API_KEY:
        return []
    # Despite the public docs describing a float, the live v2 endpoint accepts
    # only whole-kilometre radius strings ("2", not "2.0"). Results are still
    # filtered to the exact requested radius below.
    radius_km = max(1, math.ceil(radius_m / 1000.0))
    params = {
        "point.lat": lat,
        "point.lon": lng,
        "boundary.circle.radius": radius_km,
        "layers": "poi",
        # Stadia v2 rejects values above 25 with HTTP 400.
        "size": 25,
        "api_key": settings.STADIA_MAPS_API_KEY,
    }
    url = "https://api.stadiamaps.com/geocoding/v2/reverse"
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
            return payload.get("features") or []
    except Exception as exc:  # noqa: BLE001
        logger.warning("Stadia reverse search failed: %s", exc)
        return []


CATEGORY_METADATA: dict[str, dict[str, Any]] = {
    "Temple": {
        "icon": "🛕",
        "color": "#f59e0b",
        "image_url": "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=900&q=75",
        "rating": 4.9,
    },
    "Church": {
        "icon": "⛪",
        "color": "#3b82f6",
        "image_url": "https://images.unsplash.com/photo-1548625361-16a7e08922c0?auto=format&fit=crop&w=900&q=75",
        "rating": 4.8,
    },
    "Mosque": {
        "icon": "🕌",
        "color": "#10b981",
        "image_url": "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=900&q=75",
        "rating": 4.8,
    },
    "IceCream": {
        "icon": "🍨",
        "color": "#f43f5e",
        "image_url": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=75",
        "rating": 4.7,
    },
    "Silks": {
        "icon": "🥻",
        "color": "#ec4899",
        "image_url": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=75",
        "rating": 4.8,
    },
    "Supermarket": {
        "icon": "🛒",
        "color": "#10b981",
        "image_url": "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=900&q=75",
        "rating": 4.6,
    },
    "SouthIndianVeg": {
        "icon": "🥞",
        "color": "#f97316",
        "image_url": "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=900&q=75",
        "rating": 4.8,
    },
    "BiryaniNonVeg": {
        "icon": "🍗",
        "color": "#ea580c",
        "image_url": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=75",
        "rating": 4.7,
    },
    "Hotel": {
        "icon": "🏨",
        "color": "#8b5cf6",
        "image_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=75",
        "rating": 4.6,
    },
    "Apartment": {
        "icon": "🏢",
        "color": "#6366f1",
        "image_url": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=75",
        "rating": 4.5,
    },
    "Fuel": {
        "icon": "⛽",
        "color": "#f59e0b",
        "image_url": "https://images.unsplash.com/photo-1545558014-8692077e9b5c?auto=format&fit=crop&w=900&q=75",
        "rating": 4.3,
    },
    "Atm": {
        "icon": "🏧",
        "color": "#3b82f6",
        "image_url": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=75",
        "rating": 4.2,
    },
    "Bank": {
        "icon": "🏦",
        "color": "#3b82f6",
        "image_url": "https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?auto=format&fit=crop&w=900&q=75",
        "rating": 4.4,
    },
    "Hospital": {
        "icon": "🏥",
        "color": "#ef4444",
        "image_url": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=75",
        "rating": 4.7,
    },
    "Pharmacy": {
        "icon": "💊",
        "color": "#ef4444",
        "image_url": "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=75",
        "rating": 4.8,
    },
    "Restaurant": {
        "icon": "🍽️",
        "color": "#f97316",
        "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=75",
        "rating": 4.6,
    },
    "Cafe": {
        "icon": "☕",
        "color": "#d97706",
        "image_url": "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=900&q=75",
        "rating": 4.7,
    },
    "Mall": {
        "icon": "🏬",
        "color": "#ec4899",
        "image_url": "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?auto=format&fit=crop&w=900&q=75",
        "rating": 4.5,
    },
    "Jewelry": {
        "icon": "💎",
        "color": "#eab308",
        "image_url": "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=75",
        "rating": 4.8,
    },
    "Transit": {
        "icon": "🚆",
        "color": "#0ea5e9",
        "image_url": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=900&q=75",
        "rating": 4.2,
    },
    "School": {
        "icon": "🎓",
        "color": "#6366f1",
        "image_url": "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=900&q=75",
        "rating": 4.5,
    },
    "Park": {
        "icon": "🌳",
        "color": "#22c55e",
        "image_url": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=75",
        "rating": 4.8,
    },
    "Office": {
        "icon": "🏢",
        "color": "#64748b",
        "image_url": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=75",
        "rating": 4.4,
    },
    "Store": {
        "icon": "🛒",
        "color": "#10b981",
        "image_url": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=75",
        "rating": 4.5,
    },
    "Place": {
        "icon": "📍",
        "color": "#0ea5e9",
        "image_url": "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1f?auto=format&fit=crop&w=900&q=75",
        "rating": 4.4,
    },
}


def _get_category_meta(category_name: str, place_name: str) -> dict[str, Any]:
    inferred = _infer_category_from_text(place_name, category_name)
    return CATEGORY_METADATA.get(inferred) or CATEGORY_METADATA["Place"]


def _from_overpass(elements: list[dict[str, Any]], lat: float, lng: float, radius_m: int) -> list[dict[str, Any]]:
    places: list[dict[str, Any]] = []
    for element in elements:
        point = _element_point(element)
        if not point:
            continue
        plat, plng = point
        distance = round(haversine_meters(lat, lng, plat, plng))
        if distance > radius_m:
            continue
        tags = element.get("tags") or {}
        category = _category(tags)
        name = tags.get("name") or tags.get("name:en") or tags.get("brand") or category
        if not name:
            continue
        meta = _get_category_meta(category, name)
        walk_mins = max(1, round(distance / (1.3 * 60)))
        bike_mins = max(1, round(distance / (7.0 * 60)))
        places.append(
            {
                "id": f"osm:{element.get('type')}:{element.get('id')}",
                "name": name,
                "category": category,
                "category_group": _infer_category_from_text(name, category),
                "latitude": plat,
                "longitude": plng,
                "address": _address(tags),
                "distance_meters": distance,
                "walking_minutes": walk_mins,
                "bike_minutes": bike_mins,
                "image_url": meta["image_url"],
                "icon": meta["icon"],
                "color": meta["color"],
                "rating": meta["rating"],
                "source": "overpass",
            }
        )
    return places


def _from_stadia(features: list[dict[str, Any]], lat: float, lng: float, radius_m: int) -> list[dict[str, Any]]:
    places: list[dict[str, Any]] = []
    for feature in features:
        geometry = feature.get("geometry") or {}
        coords = geometry.get("coordinates") or []
        if len(coords) < 2:
            continue
        plng, plat = float(coords[0]), float(coords[1])
        distance = round(haversine_meters(lat, lng, plat, plng))
        if distance > radius_m:
            continue
        props = feature.get("properties") or {}
        name = props.get("name") or props.get("label")
        if not name:
            continue
        raw_category = str(props.get("category") or props.get("layer") or "Place").replace("_", " ").title()
        category_group = _infer_category_from_text(str(name), raw_category)
        meta = CATEGORY_METADATA.get(category_group) or CATEGORY_METADATA["Place"]
        walk_mins = max(1, round(distance / (1.3 * 60)))
        bike_mins = max(1, round(distance / (7.0 * 60)))
        places.append(
            {
                "id": str(props.get("gid") or f"stadia:{plat}:{plng}"),
                "name": name,
                "category": category_group,
                "category_group": category_group,
                "latitude": plat,
                "longitude": plng,
                "address": props.get("label") or name,
                "distance_meters": distance,
                "walking_minutes": walk_mins,
                "bike_minutes": bike_mins,
                "image_url": meta["image_url"],
                "icon": meta["icon"],
                "color": meta["color"],
                "rating": meta["rating"],
                "source": "stadia",
            }
        )
    return places


async def search_nearby(lat: float, lng: float, radius_m: int = 2000) -> list[dict[str, Any]]:
    global _overpass_blocked_until
    radius_m = max(200, min(int(radius_m), 2000))
    cache_key = (round(lat, 4), round(lng, 4), radius_m)
    cached = _nearby_cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    # OpenStreetMap is the primary place database. Stadia remains the base-map
    # provider and a compact fallback if the public OSM service is unavailable.
    overpass_places: list[dict[str, Any]] = []
    if time.monotonic() >= _overpass_blocked_until:
        try:
            overpass_places = _from_overpass(await _query_overpass(lat, lng, radius_m), lat, lng, radius_m)
        except Exception as exc:  # noqa: BLE001
            # Do not continuously retry a rate-limited public service while GPS
            # is streaming. Stadia provides the temporary fallback result.
            _overpass_blocked_until = time.monotonic() + 45
            logger.warning("Nearby Overpass lookup failed; pausing retries for 45s: %s", exc)

    if overpass_places:
        ranked = sorted(overpass_places, key=lambda item: item["distance_meters"])[:200]
        _nearby_cache[cache_key] = (time.monotonic(), ranked)
        return ranked

    stadia_places = _from_stadia(await _query_stadia(lat, lng, radius_m), lat, lng, radius_m)

    merged: dict[str, dict[str, Any]] = {}
    for place in stadia_places:
        key = f"{round(place['latitude'], 5)}:{round(place['longitude'], 5)}:{place['name'].lower()}"
        existing = merged.get(key)
        if not existing or place["distance_meters"] < existing["distance_meters"]:
            merged[key] = place

    ranked = sorted(merged.values(), key=lambda item: item["distance_meters"])
    result = ranked[:250]
    _nearby_cache[cache_key] = (time.monotonic(), result)
    return result
