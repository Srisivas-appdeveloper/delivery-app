import axios from 'axios';
import {
  RouteCoordinate,
  TrackingMode,
  calculateHaversineDistance,
} from '../models/Order';

export type RoadRoute = {
  coordinates: RouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
};

export type RoutePosition = {
  distanceMeters: number;
  nearestIndex: number;
  nextTarget: RouteCoordinate | null;
};

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1';

function profileForMode(_mode: TrackingMode): string {
  // Public OSRM supports the driving profile. For this POC it gives an actual
  // road polyline instead of our old fake curve. A private OSRM/Valhalla server
  // can later add dedicated walking/bike profiles.
  return 'driving';
}

function isValidCoordinate(point: RouteCoordinate): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function fallbackDurationSeconds(distanceMeters: number, mode: TrackingMode): number {
  const speedMs = mode === 'walk' ? 1.3 : mode === 'bike' ? 7 : 11;
  return Math.round(distanceMeters / speedMs);
}

function distanceToSegmentMeters(
  point: RouteCoordinate,
  start: RouteCoordinate,
  end: RouteCoordinate,
): number {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng =
    111_320 * Math.cos((point.latitude * Math.PI) / 180);
  const px = 0;
  const py = 0;
  const ax = (start.longitude - point.longitude) * metersPerDegreeLng;
  const ay = (start.latitude - point.latitude) * metersPerDegreeLat;
  const bx = (end.longitude - point.longitude) * metersPerDegreeLng;
  const by = (end.latitude - point.latitude) * metersPerDegreeLat;
  const abx = bx - ax;
  const aby = by - ay;
  const abLengthSquared = abx * abx + aby * aby;

  if (abLengthSquared <= 0.000001) {
    return Math.hypot(ax - px, ay - py);
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / abLengthSquared));
  const closestX = ax + abx * t;
  const closestY = ay + aby * t;
  return Math.hypot(closestX - px, closestY - py);
}

export async function fetchRoadRoutes(
  start: RouteCoordinate,
  destination: RouteCoordinate,
  mode: TrackingMode = 'walk',
): Promise<RoadRoute[]> {
  if (!isValidCoordinate(start) || !isValidCoordinate(destination)) {
    return [];
  }

  const directDistance = calculateHaversineDistance(
    start.latitude,
    start.longitude,
    destination.latitude,
    destination.longitude,
  );
  if (directDistance < 8) {
    return [{
      coordinates: [start, destination],
      distanceMeters: Math.round(directDistance),
      durationSeconds: 0,
    }];
  }

  const profile = profileForMode(mode);
  const url =
    `${OSRM_BASE_URL}/${profile}/` +
    `${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}` +
    '?overview=full&geometries=geojson&alternatives=true&steps=false';

  try {
    const response = await axios.get(url, { timeout: 12000 });
    const routes = response.data?.routes;
    if (!Array.isArray(routes)) {
      return [];
    }

    return routes
      .map((route: any): RoadRoute | null => {
        const rawCoordinates = route?.geometry?.coordinates;
        if (!Array.isArray(rawCoordinates) || rawCoordinates.length < 2) {
          return null;
        }
        const coordinates = rawCoordinates
          .map((point: any[]) => ({
            latitude: Number(point[1]),
            longitude: Number(point[0]),
          }))
          .filter(isValidCoordinate);

        if (coordinates.length < 2) {
          return null;
        }

        const distanceMeters = Math.round(Number(route.distance ?? directDistance));
        return {
          coordinates,
          distanceMeters,
          durationSeconds: Math.round(
            Number(route.duration ?? fallbackDurationSeconds(distanceMeters, mode)),
          ),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.distanceMeters - b!.distanceMeters) as RoadRoute[];
  } catch (error) {
    console.warn('[RouteService] Road routing failed', error);
    return [];
  }
}

export async function fetchBestRoadRoute(
  start: RouteCoordinate,
  destination: RouteCoordinate,
  mode: TrackingMode = 'walk',
): Promise<RoadRoute | null> {
  const routes = await fetchRoadRoutes(start, destination, mode);
  return routes[0] ?? null;
}

export function getRoutePosition(
  point: RouteCoordinate,
  route: RouteCoordinate[] = [],
): RoutePosition {
  if (!isValidCoordinate(point) || route.length === 0) {
    return {
      distanceMeters: Number.POSITIVE_INFINITY,
      nearestIndex: -1,
      nextTarget: null,
    };
  }

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  route.forEach((routePoint, index) => {
    const pointDistance = calculateHaversineDistance(
      point.latitude,
      point.longitude,
      routePoint.latitude,
      routePoint.longitude,
    );
    const segmentDistance =
      index < route.length - 1
        ? distanceToSegmentMeters(point, routePoint, route[index + 1])
        : pointDistance;
    const distance = Math.min(pointDistance, segmentDistance);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  let nextTarget: RouteCoordinate | null = null;
  for (let index = nearestIndex + 1; index < route.length; index += 1) {
    const candidate = route[index];
    if (
      calculateHaversineDistance(
        point.latitude,
        point.longitude,
        candidate.latitude,
        candidate.longitude,
      ) >= 12
    ) {
      nextTarget = candidate;
      break;
    }
  }

  return {
    distanceMeters: nearestDistance,
    nearestIndex,
    nextTarget,
  };
}
