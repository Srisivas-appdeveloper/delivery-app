export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export type TrackingMode = 'walk' | 'bike' | 'drive';

export interface Order {
  id: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  driverAvatar: string;
  customerId: string;
  customerName: string;
  status: string;
  trackingMode?: TrackingMode;
  storeName: string;
  storeAddress?: string;
  storeLat: number;
  storeLng: number;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  currentLat?: number;
  currentLng?: number;
  currentHeading: number;
  currentSpeed: number;
  currentAccuracy: number;
  remainingDistanceMeters: number;
  smoothedEtaMinutes: number;
  routePoints?: RouteCoordinate[];
  traveledRoutePoints?: RouteCoordinate[];
  orderItems?: string[];
  totalAmount?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TelemetryStats {
  accuracy: number;
  speed: number;
  heading: number;
  batteryLevel?: number;
  isMoving: boolean;
  distanceRemainingMeters: number;
  etaSeconds: number;
  lastUpdated: string;
}

/**
 * Calculates distance in meters between two lat/lng coordinates (Haversine formula).
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates bearing in degrees from point 1 to point 2.
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360;
}

export function normalizeHeading(heading: number | null | undefined): number | null {
  if (heading == null || !Number.isFinite(heading) || heading < 0) {
    return null;
  }
  return ((heading % 360) + 360) % 360;
}

export function headingDelta(fromHeading: number, toBearing: number): number {
  return ((((toBearing - fromHeading) % 360) + 540) % 360) - 180;
}

export function getTurnInstruction(currentHeading: number, targetBearing: number): string {
  const delta = headingDelta(currentHeading, targetBearing);
  const absDelta = Math.abs(delta);
  if (absDelta < 12) {
    return 'Continue straight';
  }
  if (absDelta < 35) {
    return delta > 0 ? 'Slight right' : 'Slight left';
  }
  if (absDelta < 110) {
    return delta > 0 ? 'Turn right' : 'Turn left';
  }
  return 'Turn around';
}

export function formatNavigationDistance(distanceMeters: number): string {
  const safeMeters = Math.max(0, Math.round(distanceMeters || 0));
  if (safeMeters >= 1000) {
    const km = safeMeters / 1000;
    return `${km >= 10 ? Math.round(km).toString() : km.toFixed(1)} km`;
  }
  return `${safeMeters} m`;
}

export function isManeuverInstruction(instruction: string): boolean {
  const text = instruction.toLowerCase();
  return text.includes('left') || text.includes('right') || text.includes('around');
}

export function getRouteSegmentLabel(distanceMeters: number, mode: TrackingMode = 'walk'): string | null {
  if (distanceMeters < 1200) {
    return null;
  }
  if (mode === 'drive' && distanceMeters >= 3000) {
    return 'Highway / main road segment ahead';
  }
  if (mode === 'bike' && distanceMeters >= 2000) {
    return 'Main road segment ahead';
  }
  if (distanceMeters >= 1500) {
    return 'Continue on main route';
  }
  return null;
}

/**
 * Generates realistic route coordinates between start and destination coordinates.
 */
export function generateRouteWaypoints(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number,
  numSegments = 24,
): RouteCoordinate[] {
  const points: RouteCoordinate[] = [{ latitude: startLat, longitude: startLng }];

  // Midpoints with realistic city-grid turns and slight street curvatures
  for (let i = 1; i < numSegments; i++) {
    const t = i / numSegments;
    const curveOffset = Math.sin(t * Math.PI) * 0.0016;
    const lat = startLat + (destLat - startLat) * t + curveOffset * 0.4;
    const lng = startLng + (destLng - startLng) * t - curveOffset;
    points.push({ latitude: lat, longitude: lng });
  }

  points.push({ latitude: destLat, longitude: destLng });
  return points;
}

export function parseOrder(json: any): Order {
  const sLat = Number(json.store_latitude ?? json.store_lat ?? 11.0168);
  const sLng = Number(json.store_longitude ?? json.store_lng ?? 76.9558);
  const dLat = Number(json.destination_latitude ?? json.destination_lat ?? 11.025);
  const dLng = Number(json.destination_longitude ?? json.destination_lng ?? 76.968);
  const cLat = Number(json.current_latitude ?? json.current_lat ?? sLat);
  const cLng = Number(json.current_longitude ?? json.current_lng ?? sLng);

  let etaMinutes = 0;
  if (json.smoothed_eta_seconds != null) {
    etaMinutes = Number(json.smoothed_eta_seconds) / 60.0;
  } else if (json.smoothed_eta_minutes != null) {
    etaMinutes = Number(json.smoothed_eta_minutes);
  } else if (json.eta_seconds != null) {
    etaMinutes = Number(json.eta_seconds) / 60.0;
  } else {
    const dist = calculateHaversineDistance(cLat, cLng, dLat, dLng);
    etaMinutes = Math.max(1, Math.round(dist / (8.33 * 60)));
  }

  const distMeters = Number(
    json.remaining_distance_meters ??
      json.distance_remaining ??
      calculateHaversineDistance(cLat, cLng, dLat, dLng),
  );

  return {
    id: json.id,
    driverId: json.driver_id || '',
    driverName: json.driver_name || '',
    driverPhone: json.driver_phone || '',
    driverAvatar: json.driver_avatar || 'walk',
    customerId: json.customer_id || '',
    customerName: json.customer_name || '',
    status: json.status || 'assigned',
    trackingMode: json.tracking_mode || json.trackingMode || 'walk',
    storeName: json.store_name || '',
    storeAddress: json.store_address || '',
    storeLat: sLat,
    storeLng: sLng,
    destinationAddress: json.destination_address || '',
    destinationLat: dLat,
    destinationLng: dLng,
    currentLat: cLat,
    currentLng: cLng,
    currentHeading: Number(json.current_heading ?? json.heading ?? calculateBearing(cLat, cLng, dLat, dLng)),
    currentSpeed: Number(json.current_speed ?? json.speed ?? 0),
    currentAccuracy: Number(json.current_accuracy ?? json.accuracy ?? 4),
    remainingDistanceMeters: Math.round(distMeters),
    smoothedEtaMinutes: etaMinutes,
    routePoints: json.route_points || generateRouteWaypoints(sLat, sLng, dLat, dLng, 25),
    traveledRoutePoints: json.traveled_route_points || json.traveledRoutePoints || [],
    orderItems: json.items || [],
    totalAmount: json.total_amount,
    createdAt: json.created_at || new Date().toISOString(),
    updatedAt: json.updated_at || new Date().toISOString(),
  };
}
