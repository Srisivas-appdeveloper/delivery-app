import axios from 'axios';
import { ApiConstants } from '../constants/apiConstants';
import { calculateHaversineDistance } from '../models/Order';
import { NearbyPlace } from '../models/Store';

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const SEARCH_RADIUS_M = 2000;

function toPlaceFromOsm(element: any, lat: number, lng: number): NearbyPlace | null {
  const plat = element.lat ?? element.center?.lat;
  const plng = element.lon ?? element.center?.lon;
  const tags = element.tags || {};
  if (plat == null || plng == null) {
    return null;
  }
  const distanceMeters = Math.round(calculateHaversineDistance(lat, lng, plat, plng));
  if (distanceMeters > SEARCH_RADIUS_M) {
    return null;
  }
  const rawCategory = tags.shop || tags.healthcare || tags.amenity || tags.tourism || 'place';
  const category = String(rawCategory).replace(/_/g, ' ');
  const prettyCategory = category.charAt(0).toUpperCase() + category.slice(1);
  const name = tags.name || tags['name:en'] || tags.brand || prettyCategory;
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const address = tags['addr:full'] || [street, tags['addr:city']].filter(Boolean).join(', ') || 'Nearby';
  return {
    id: `osm:${element.type}:${element.id}`,
    name,
    category: prettyCategory,
    latitude: Number(plat),
    longitude: Number(plng),
    address,
    distanceMeters,
    source: 'overpass',
  };
}

async function fetchFromBackend(lat: number, lng: number, radiusM: number): Promise<NearbyPlace[]> {
  const response = await axios.get(ApiConstants.nearbyPlaces(lat, lng, radiusM), { timeout: 20000 });
  const raw = response.data?.places;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item: any) => ({
    id: String(item.id),
    name: String(item.name),
    category: String(item.category || 'Place'),
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
    address: String(item.address || 'Nearby'),
    distanceMeters: Number(item.distance_meters ?? item.distanceMeters ?? 0),
    source: item.source,
  }));
}

async function fetchFromOverpass(lat: number, lng: number, radiusM: number): Promise<NearbyPlace[]> {
  const query = `
    [out:json][timeout:12];
    (
      nwr["shop"]["name"](around:${radiusM},${lat},${lng});
      nwr["healthcare"]["name"](around:${radiusM},${lat},${lng});
      nwr["amenity"~"^(hospital|clinic|doctors|dentist|pharmacy|veterinary|restaurant|cafe|fast_food|food_court|fuel|atm|bank|marketplace|school|college|cinema|theatre)$"]["name"](around:${radiusM},${lat},${lng});
      nwr["tourism"~"^(hotel|guest_house|hostel|motel|apartment)$"]["name"](around:${radiusM},${lat},${lng});
      nwr["leisure"~"^(park|fitness_centre|sports_centre|playground)$"]["name"](around:${radiusM},${lat},${lng});
      nwr["office"~"^(insurance|lawyer|telecommunication|government|travel_agent)$"]["name"](around:${radiusM},${lat},${lng});
      nwr["craft"]["name"](around:${radiusM},${lat},${lng});
      nwr["public_transport"]["name"](around:${radiusM},${lat},${lng});
      nwr["railway"~"^(station|halt|tram_stop|subway_entrance)$"]["name"](around:${radiusM},${lat},${lng});
      nwr["aeroway"~"^(aerodrome|terminal)$"]["name"](around:${radiusM},${lat},${lng});
    );
    out center tags 300;
  `;
  let lastError: unknown;
  for (const url of OVERPASS_URLS) {
    try {
      const response = await axios.post(url, `data=${encodeURIComponent(query)}`, {
        timeout: 20000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const elements = response.data?.elements || [];
      return elements
        .map((element: any) => toPlaceFromOsm(element, lat, lng))
        .filter(Boolean) as NearbyPlace[];
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export const SEARCH_RADIUS_METERS = SEARCH_RADIUS_M;

export async function searchNearbyPlaces(
  lat: number,
  lng: number,
  radiusM = SEARCH_RADIUS_M,
): Promise<NearbyPlace[]> {
  try {
    const fromApi = await fetchFromBackend(lat, lng, radiusM);
    if (fromApi.length > 0) {
      return fromApi.sort((a, b) => a.distanceMeters - b.distanceMeters);
    }
  } catch {
    // Fall through to OSM if the local backend is offline.
  }
  const fromOsm = await fetchFromOverpass(lat, lng, radiusM);
  return fromOsm.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 250);
}
