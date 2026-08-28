import { create } from 'zustand';
import {
  Order,
  TelemetryStats,
  TrackingMode,
  parseOrder,
  calculateHaversineDistance,
  calculateBearing,
  getTurnInstruction,
  normalizeHeading,
  generateRouteWaypoints,
  RouteCoordinate,
} from '../models/Order';
import { nearbyPlaceToStore, Store } from '../models/Store';
import { apiClient } from '../services/apiClient';
import { wsService, WebSocketStatus } from '../services/websocketClient';
import { ApiConstants } from '../constants/apiConstants';
import { LocationService } from '../services/locationService';
import { searchNearbyPlaces } from '../services/placesService';
import { fetchBestRoadRoute, getRoutePosition } from '../services/routeService';
import {
  clearTrackingWidget,
  clearSelectedWidgetPlaceId,
  getBackendBaseUrl,
  getLastCompletedTrip,
  getNearbyPlacesWidgetJson,
  getTrackingState,
  getSelectedWidgetPlaceId,
  saveBackendBaseUrl,
  saveLastCompletedTrip,
  saveTrackingState,
  updateTrackingWidget,
  updateNearbyPlacesWidget,
} from '../services/trackingWidget';

interface OrderState {
  orders: Order[];
  activeOrder: Order | null;
  activeOrderId: string | null;
  lastCompletedOrder: Order | null;
  isLoading: boolean;
  wsStatus: WebSocketStatus;
  telemetry: TelemetryStats | null;
  serverHost: string;
  backendBaseUrl: string;

  // Nearby Discovery & User Location State
  userLocation: RouteCoordinate;
  selectedStore: Store | null;
  selectedTrackingMode: TrackingMode;
  nearbyPlaces: Store[];
  isFetchingPlaces: boolean;
  placesError: string | null;
  searchCenter: RouteCoordinate | null;
  pendingWidgetPlaceId: string | null;
  isRerouting: boolean;

  // Route Simulation State
  isSimulating: boolean;
  simulationProgress: number; // 0.0 to 1.0
  simulationSpeedMultiplier: number; // 1, 2, 5

  // Actions
  fetchOrders: () => Promise<void>;
  selectOrder: (orderId: string) => Promise<void>;
  setServerHost: (host: string) => void;
  setBackendBaseUrl: (url: string) => void;
  restoreBackendConfig: () => Promise<void>;
  setUserLocation: (coords: RouteCoordinate) => void;
  setSelectedStore: (store: Store | null) => void;
  clearTransientSelection: () => void;
  resetNavigationSession: () => void;
  completeActiveTrip: () => void;
  cancelActiveTrip: () => void;
  setSelectedTrackingMode: (mode: TrackingMode) => void;
  syncUserGpsLocation: () => Promise<boolean>;
  updateOrderStatus: (status: string) => Promise<void>;
  updateDriverLocation: (lat: number, lng: number, heading?: number, speed?: number, accuracy?: number) => void;
  setLiveTelemetry: (data: any) => void;

  // Simulator controls
  startSimulation: (speedMultiplier?: number) => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
  setSimulationSpeed: (speed: number) => void;
  createNewOrder: (orderData: Partial<Order>) => Order;
  startStoreTracking: (store: Store, mode?: TrackingMode, startLoc?: RouteCoordinate) => Order;
  findNearbyPlace: (id: string) => Store | undefined;
  fetchNearbyPlaces: (lat: number, lng: number) => Promise<void>;
  restoreCachedNearbyPlaces: () => Promise<boolean>;
  restorePersistedTracking: () => Promise<boolean>;
  restoreLastCompletedTrip: () => Promise<boolean>;
  consumeSelectedWidgetPlaceId: () => Promise<string | null>;
  setPendingWidgetPlaceId: (placeId: string | null) => void;
}

let placesRequestId = 0;
let routeRequestId = 0;
let lastRoadRouteRefresh:
  | { orderId: string; latitude: number; longitude: number; at: number }
  | null = null;
let isRoadRouteRequestInFlight = false;

let simTimer: ReturnType<typeof setInterval> | null = null;

function widgetPayloadForOrder(order: Order, latitude = order.currentLat ?? order.storeLat, longitude = order.currentLng ?? order.storeLng) {
  const routeTarget =
    getRoutePosition({ latitude, longitude }, order.routePoints || []).nextTarget ||
    { latitude: order.destinationLat, longitude: order.destinationLng };
  const targetBearing = calculateBearing(latitude, longitude, routeTarget.latitude, routeTarget.longitude);
  return {
    destination: order.storeName,
    distanceMeters: order.remainingDistanceMeters,
    etaMinutes: Math.max(1, Math.round(order.smoothedEtaMinutes || 1)),
    latitude,
    longitude,
    destinationLatitude: order.destinationLat,
    destinationLongitude: order.destinationLng,
    heading: order.currentHeading,
    turnInstruction: getTurnInstruction(order.currentHeading, targetBearing),
    isActive: true,
    routeCoordinates: order.routePoints || [],
  };
}

function appendTravelPoint(order: Order, point: RouteCoordinate): RouteCoordinate[] {
  const existing = order.traveledRoutePoints || [];
  const last = existing[existing.length - 1];
  if (!last) {
    return [point];
  }

  const movedMeters = calculateHaversineDistance(
    last.latitude,
    last.longitude,
    point.latitude,
    point.longitude,
  );
  if (movedMeters < 3) {
    return existing;
  }

  const next = [...existing, point];
  return next.length > 1200 ? next.slice(next.length - 1200) : next;
}

function shouldRefreshRoadRoute(order: Order, point: RouteCoordinate, accuracy = 4): boolean {
  if (isRoadRouteRequestInFlight) {
    return false;
  }
  const last = lastRoadRouteRefresh;
  const routePosition = getRoutePosition(point, order.routePoints || []);
  const offRouteThreshold = Math.max(25, Math.min(60, accuracy * 2));
  const canRerouteNow = !last || Date.now() - last.at >= 3000;
  if (routePosition.distanceMeters > offRouteThreshold && canRerouteNow) {
    return true;
  }
  if (!last || last.orderId !== order.id) {
    return true;
  }
  const movedMeters = calculateHaversineDistance(
    last.latitude,
    last.longitude,
    point.latitude,
    point.longitude,
  );
  return movedMeters >= 50 || Date.now() - last.at >= 20000;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  activeOrder: null,
  activeOrderId: null,
  lastCompletedOrder: null,
  isLoading: false,
  wsStatus: 'disconnected',
  telemetry: null,
  serverHost: ApiConstants.host,
  backendBaseUrl: ApiConstants.httpBaseUrl,
  userLocation: { latitude: 11.0180, longitude: 76.9580 },
  selectedStore: null,
  selectedTrackingMode: 'walk',
  nearbyPlaces: [],
  isFetchingPlaces: false,
  placesError: null,
  searchCenter: null,
  pendingWidgetPlaceId: null,
  isRerouting: false,
  isSimulating: false,
  simulationProgress: 0,
  simulationSpeedMultiplier: 1,

  setServerHost: (host: string) => {
    get().setBackendBaseUrl(host);
    get().fetchOrders();
    const activeId = get().activeOrderId;
    if (activeId) {
      get().selectOrder(activeId);
    }
  },

  setBackendBaseUrl: (url: string) => {
    ApiConstants.baseUrl = url;
    saveBackendBaseUrl(ApiConstants.httpBaseUrl);
    wsService.disconnect();
    set({
      serverHost: ApiConstants.host,
      backendBaseUrl: ApiConstants.httpBaseUrl,
      wsStatus: 'disconnected',
    });
  },

  restoreBackendConfig: async () => {
    try {
      const saved = await getBackendBaseUrl();
      if (saved) {
        ApiConstants.baseUrl = saved;
        set({
          serverHost: ApiConstants.host,
          backendBaseUrl: ApiConstants.httpBaseUrl,
        });
      }
    } catch (error) {
      console.warn('[OrderStore] Backend URL restore skipped', error);
    }
  },

  setUserLocation: (coords: RouteCoordinate) => {
    set({ userLocation: coords });
  },

  findNearbyPlace: (id: string) => {
    return get().nearbyPlaces.find((place) => place.id === id);
  },

  fetchNearbyPlaces: async (lat: number, lng: number) => {
    const requestId = ++placesRequestId;
    set({
      isFetchingPlaces: true,
      placesError: null,
      searchCenter: { latitude: lat, longitude: lng },
    });
    try {
      const results = await searchNearbyPlaces(lat, lng, 2000);
      if (requestId !== placesRequestId) {
        return;
      }
      const stores = results.map(nearbyPlaceToStore);
      try {
        updateNearbyPlacesWidget(
          stores.slice(0, 50).map((place) => ({
            id: place.id,
            name: place.name,
            category: place.category,
            address: place.address,
            distanceMeters: Number(place.tag?.replace(/\D/g, '') || 0),
            latitude: place.latitude,
            longitude: place.longitude,
          })),
        );
      } catch (error) {
        console.warn('[OrderStore] Nearby places widget update skipped', error);
      }
      set({
        nearbyPlaces: stores,
        placesError: stores.length ? null : 'No nearby place data was returned. Try again in a moment.',
      });
    } catch (error) {
      console.warn('[OrderStore] Nearby places failed', error);
      if (requestId === placesRequestId) {
        const restored = await get().restoreCachedNearbyPlaces();
        set({
          placesError: restored
            ? 'Showing saved nearby places. Connect internet/backend to refresh.'
            : 'Could not load nearby places. Check the backend connection and try again.',
        });
      }
    } finally {
      if (requestId === placesRequestId) {
        set({ isFetchingPlaces: false });
      }
    }
  },

  setSelectedStore: (store: Store | null) => {
    set({ selectedStore: store });
  },

  clearTransientSelection: () => {
    if (get().activeOrder) {
      return;
    }
    set({
      selectedStore: null,
    });
  },

  resetNavigationSession: () => {
    get().pauseSimulation();
    wsService.disconnect();
    clearTrackingWidget();
    set({
      activeOrder: null,
      activeOrderId: null,
      selectedStore: null,
      telemetry: null,
      wsStatus: 'disconnected',
      isSimulating: false,
      simulationProgress: 0,
    });
  },

  consumeSelectedWidgetPlaceId: async () => {
    try {
      const placeId = await getSelectedWidgetPlaceId();
      if (placeId) {
        clearSelectedWidgetPlaceId();
        let selectedFromWidget: Store | undefined;
        try {
          const rawWidgetPlaces = await getNearbyPlacesWidgetJson();
          const widgetPlaces = rawWidgetPlaces ? JSON.parse(rawWidgetPlaces) : [];
          const widgetPlace = Array.isArray(widgetPlaces)
            ? widgetPlaces.find((place: any) => String(place?.id) === placeId)
            : undefined;
          if (
            widgetPlace &&
            Number.isFinite(Number(widgetPlace.latitude)) &&
            Number.isFinite(Number(widgetPlace.longitude))
          ) {
            selectedFromWidget = nearbyPlaceToStore({
              id: String(widgetPlace.id),
              name: String(widgetPlace.name || 'Nearby place'),
              category: String(widgetPlace.category || 'Place'),
              latitude: Number(widgetPlace.latitude),
              longitude: Number(widgetPlace.longitude),
              address: String(widgetPlace.address || 'Nearby'),
              distanceMeters: Number(widgetPlace.distanceMeters || 0),
            });
          }
        } catch (error) {
          console.warn('[OrderStore] Widget nearby place restore skipped', error);
        }

        set((state) => ({
          pendingWidgetPlaceId: placeId,
          nearbyPlaces:
            selectedFromWidget && !state.nearbyPlaces.some((place) => place.id === selectedFromWidget?.id)
              ? [selectedFromWidget, ...state.nearbyPlaces]
              : state.nearbyPlaces,
        }));
      }
      return placeId;
    } catch (error) {
      console.warn('[OrderStore] Widget selected place read skipped', error);
      return null;
    }
  },

  setPendingWidgetPlaceId: (placeId: string | null) => {
    set({ pendingWidgetPlaceId: placeId });
  },

  restoreCachedNearbyPlaces: async () => {
    try {
      const rawWidgetPlaces = await getNearbyPlacesWidgetJson();
      const widgetPlaces = rawWidgetPlaces ? JSON.parse(rawWidgetPlaces) : [];
      if (!Array.isArray(widgetPlaces) || widgetPlaces.length === 0) {
        return false;
      }

      const stores = widgetPlaces
        .map((place: any) => {
          if (
            !place?.id ||
            !Number.isFinite(Number(place.latitude)) ||
            !Number.isFinite(Number(place.longitude))
          ) {
            return null;
          }
          return nearbyPlaceToStore({
            id: String(place.id),
            name: String(place.name || 'Nearby place'),
            category: String(place.category || 'Place'),
            latitude: Number(place.latitude),
            longitude: Number(place.longitude),
            address: String(place.address || 'Nearby'),
            distanceMeters: Number(place.distanceMeters || 0),
          });
        })
        .filter(Boolean) as Store[];

      if (stores.length === 0) {
        return false;
      }

      set({
        nearbyPlaces: stores,
        placesError: null,
      });
      return true;
    } catch (error) {
      console.warn('[OrderStore] Cached nearby places restore skipped', error);
      return false;
    }
  },

  restorePersistedTracking: async () => {
    try {
      const saved = await getTrackingState();
      if (!saved) {
        return false;
      }
      const parsed = JSON.parse(saved);
      const activeOrder = parsed.activeOrder as Order | null;
      if (!parsed.isActiveTracking || !activeOrder?.id) {
        clearTrackingWidget();
        return false;
      }
      const selectedStore = (parsed.selectedStore as Store | null) ?? null;
      const userLocation = (parsed.userLocation as RouteCoordinate | null) ?? {
        latitude: activeOrder.currentLat ?? activeOrder.storeLat,
        longitude: activeOrder.currentLng ?? activeOrder.storeLng,
      };

      set((state) => ({
        activeOrder,
      activeOrderId: activeOrder.id,
        lastCompletedOrder: null,
        selectedStore,
        userLocation,
        orders: [activeOrder, ...state.orders.filter((order) => order.id !== activeOrder.id)],
        telemetry: {
          accuracy: activeOrder.currentAccuracy,
          speed: activeOrder.currentSpeed,
          heading: activeOrder.currentHeading,
          isMoving: activeOrder.currentSpeed > 0.2,
          distanceRemainingMeters: activeOrder.remainingDistanceMeters,
          etaSeconds: Math.round(activeOrder.smoothedEtaMinutes * 60),
          lastUpdated: activeOrder.updatedAt,
        },
      }));
      wsService.connect(activeOrder.id);
      updateTrackingWidget(widgetPayloadForOrder(activeOrder));
      return true;
    } catch (error) {
      console.warn('[OrderStore] Failed to restore tracking state', error);
      return false;
    }
  },

  restoreLastCompletedTrip: async () => {
    try {
      const saved = await getLastCompletedTrip();
      if (!saved) {
        return false;
      }
      const parsed = JSON.parse(saved);
      const lastCompletedOrder = parsed.lastCompletedOrder as Order | null;
      if (!lastCompletedOrder?.id) {
        return false;
      }
      set((state) => ({
        lastCompletedOrder,
        selectedStore: (parsed.selectedStore as Store | null) ?? state.selectedStore,
        orders: [lastCompletedOrder, ...state.orders.filter((order) => order.id !== lastCompletedOrder.id)],
      }));
      return true;
    } catch (error) {
      console.warn('[OrderStore] Last completed trip restore skipped', error);
      return false;
    }
  },

  setSelectedTrackingMode: (mode: TrackingMode) => {
    set({ selectedTrackingMode: mode });
  },

  completeActiveTrip: () => {
    const active = get().activeOrder;
    if (!active) {
      return;
    }
    const completed: Order = {
      ...active,
      status: 'delivered',
      remainingDistanceMeters: 0,
      smoothedEtaMinutes: 0,
      currentSpeed: 0,
      updatedAt: new Date().toISOString(),
    };
    get().pauseSimulation();
    wsService.disconnect();
    clearTrackingWidget();
    saveLastCompletedTrip(JSON.stringify({
      lastCompletedOrder: completed,
      selectedStore: get().selectedStore,
    }));
    set((state) => ({
      orders: [completed, ...state.orders.filter((order) => order.id !== completed.id)],
      activeOrder: null,
      activeOrderId: null,
      lastCompletedOrder: completed,
      telemetry: null,
      wsStatus: 'disconnected',
    }));
  },

  cancelActiveTrip: () => {
    if (!get().activeOrder) {
      return;
    }
    get().pauseSimulation();
    wsService.disconnect();
    clearTrackingWidget();
    set({
      activeOrder: null,
      activeOrderId: null,
      lastCompletedOrder: null,
      telemetry: null,
      selectedStore: null,
      wsStatus: 'disconnected',
    });
  },

  syncUserGpsLocation: async (): Promise<boolean> => {
    const hasPermission = await LocationService.requestPermissions();
    if (!hasPermission) return false;

    return new Promise((resolve) => {
      LocationService.getCurrentLocation(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          set({ userLocation: coords });
          resolve(true);
        },
        () => {
          resolve(false);
        },
      );
    });
  },

  fetchOrders: async () => {
    set({ isLoading: true });
    try {
      const serverOrders = await apiClient.getOrders();
      const localIds = new Set(get().orders.map((order) => order.id));
      if (get().activeOrderId) {
        localIds.add(get().activeOrderId as string);
      }
      const mine = (serverOrders || []).filter((order) => localIds.has(order.id));
      if (mine.length > 0) {
        set((state) => ({
          orders: state.orders.map(
            (local) => mine.find((remote) => remote.id === local.id) || local,
          ),
        }));
      }
    } catch {
      // Keep the local session if the backend is empty or unreachable.
    } finally {
      set({ isLoading: false });
    }
  },

  selectOrder: async (orderId: string) => {
    const found = get().orders.find((o) => o.id === orderId);
    if (found) {
      set({ activeOrder: found, activeOrderId: orderId });
    }

    try {
      const serverOrder = await apiClient.getOrderById(orderId);
      if (serverOrder) {
        set({ activeOrder: serverOrder });
      }
    } catch {}

    wsService.connect(orderId);

    wsService.subscribeStatus((status) => {
      set({ wsStatus: status });
    });

    wsService.subscribeEvents((data) => {
      if (!data) return;

      // Backend WebSocket events use an envelope (`{ type, data: {...} }`).
      // Keep compatibility with older flat messages as well.
      const payload = data.data && typeof data.data === 'object' ? data.data : data;

      if (data.type === 'location_update' || payload.latitude) {
        const cLat = Number(payload.latitude ?? payload.current_latitude);
        const cLng = Number(payload.longitude ?? payload.current_longitude);
        const heading = Number(payload.heading ?? payload.current_heading ?? 0);
        const speed = Number(payload.speed ?? payload.current_speed ?? 0);
        const accuracy = Number(payload.accuracy ?? 4);
        const active = get().activeOrder;
        if (!active || !Number.isFinite(cLat) || !Number.isFinite(cLng)) {
          return;
        }
        const calculatedDistance = Math.round(
          calculateHaversineDistance(cLat, cLng, active.destinationLat, active.destinationLng),
        );
        const dist = Number(
          payload.distance_remaining_meters ?? payload.remaining_distance_meters ?? calculatedDistance,
        );
        const fallbackSpeed = active.trackingMode === 'walk' ? 1.3 : 6;
        const etaSec = Number(
          payload.eta_seconds ??
            (payload.smoothed_eta_minutes
              ? payload.smoothed_eta_minutes * 60
              : Math.round(dist / Math.max(speed, fallbackSpeed))),
        );
        const nextRoute = generateRouteWaypoints(
          cLat,
          cLng,
          active.destinationLat,
          active.destinationLng,
          16,
        );
        const traveledRoutePoints = appendTravelPoint(active, { latitude: cLat, longitude: cLng });

        set((state) => ({
          activeOrder: state.activeOrder
            ? {
                ...state.activeOrder,
                currentLat: cLat,
                currentLng: cLng,
                currentHeading: heading,
                currentSpeed: speed,
                currentAccuracy: accuracy,
                remainingDistanceMeters: dist,
                smoothedEtaMinutes: etaSec / 60.0,
                routePoints: nextRoute,
                traveledRoutePoints,
              }
            : null,
          telemetry: {
            accuracy,
            speed,
            heading,
            isMoving: speed > 0.2,
            distanceRemainingMeters: dist,
            etaSeconds: etaSec,
            lastUpdated: new Date().toISOString(),
          },
        }));
      }

      if (data.type === 'order_status_update' || payload.status) {
        const newStatus = payload.status;
        set((state) => ({
          activeOrder: state.activeOrder ? { ...state.activeOrder, status: newStatus } : null,
          orders: state.orders.map((o) => (o.id === state.activeOrderId ? { ...o, status: newStatus } : o)),
        }));
      }
    });
  },

  updateOrderStatus: async (status: string) => {
    const active = get().activeOrder;
    if (!active) return;

    set((state) => ({
      activeOrder: state.activeOrder ? { ...state.activeOrder, status } : null,
      orders: state.orders.map((o) => (o.id === active.id ? { ...o, status } : o)),
    }));

    try {
      await apiClient.updateOrderStatus(active.id, status);
    } catch {}
  },

  updateDriverLocation: (lat: number, lng: number, heading = 0, speed = 0, accuracy = 4) => {
    const active = get().activeOrder;
    if (!active) return;

    const distMeters = Math.round(
      calculateHaversineDistance(lat, lng, active.destinationLat, active.destinationLng),
    );
    const speedMs = Math.max(speed, active.trackingMode === 'walk' ? 1.3 : 6.0);
    const etaSec = Math.round(distMeters / speedMs);
    const etaMins = Math.max(1, Math.round(etaSec / 60.0));
    const routeTarget =
      getRoutePosition({ latitude: lat, longitude: lng }, active.routePoints || []).nextTarget ||
      { latitude: active.destinationLat, longitude: active.destinationLng };
    const targetBearing = calculateBearing(lat, lng, routeTarget.latitude, routeTarget.longitude);
    const currentHeading = normalizeHeading(heading) ?? targetBearing;

    wsService.sendLocation(lat, lng, currentHeading, speed, accuracy);

    const traveledRoutePoints = appendTravelPoint(active, { latitude: lat, longitude: lng });
    const shouldRefreshRoute = shouldRefreshRoadRoute(active, { latitude: lat, longitude: lng }, accuracy);
    const nextRoute = shouldRefreshRoute
      ? active.routePoints || generateRouteWaypoints(
          lat,
          lng,
          active.destinationLat,
          active.destinationLng,
          16,
        )
      : active.routePoints;

    const updatedOrder: Order = {
      ...active,
      currentLat: lat,
      currentLng: lng,
      currentHeading,
      currentSpeed: speed,
      currentAccuracy: accuracy,
      remainingDistanceMeters: distMeters,
      smoothedEtaMinutes: etaMins,
      routePoints: nextRoute,
      traveledRoutePoints,
      updatedAt: new Date().toISOString(),
    };
    updateTrackingWidget(widgetPayloadForOrder(updatedOrder, lat, lng));
    saveTrackingState(JSON.stringify({
      isActiveTracking: true,
      activeOrder: updatedOrder,
      selectedStore: get().selectedStore,
      userLocation: { latitude: lat, longitude: lng },
    }));

    set((state) => ({
      activeOrder: state.activeOrder
        ? {
            ...state.activeOrder,
            ...updatedOrder,
          }
        : null,
      orders: state.orders.map((o) =>
        o.id === active.id
          ? {
              ...o,
              ...updatedOrder,
            }
          : o,
      ),
      telemetry: {
        accuracy,
        speed,
        heading: currentHeading,
        isMoving: speed > 0.2,
        distanceRemainingMeters: distMeters,
        etaSeconds: etaSec,
        lastUpdated: new Date().toISOString(),
      },
    }));

    if (shouldRefreshRoute) {
      lastRoadRouteRefresh = {
        orderId: active.id,
        latitude: lat,
        longitude: lng,
        at: Date.now(),
      };
      const currentRouteRequest = ++routeRequestId;
      isRoadRouteRequestInFlight = true;
      set({ isRerouting: true });
      fetchBestRoadRoute(
        { latitude: lat, longitude: lng },
        { latitude: active.destinationLat, longitude: active.destinationLng },
        active.trackingMode ?? 'walk',
      ).then((roadRoute) => {
        if (!roadRoute || currentRouteRequest !== routeRequestId) {
          return;
        }
        const current = get().activeOrder;
        if (!current || current.id !== active.id) {
          return;
        }
        const roadUpdatedOrder: Order = {
          ...current,
          routePoints: roadRoute.coordinates,
          remainingDistanceMeters: roadRoute.distanceMeters,
          smoothedEtaMinutes: Math.max(1, Math.round(roadRoute.durationSeconds / 60)),
        };
        set((state) => ({
          activeOrder: roadUpdatedOrder,
          orders: state.orders.map((order) => (order.id === roadUpdatedOrder.id ? roadUpdatedOrder : order)),
          telemetry: state.telemetry
            ? {
                ...state.telemetry,
                distanceRemainingMeters: roadRoute.distanceMeters,
                etaSeconds: roadRoute.durationSeconds,
              }
            : state.telemetry,
        }));
        saveTrackingState(JSON.stringify({
          isActiveTracking: true,
          activeOrder: roadUpdatedOrder,
          selectedStore: get().selectedStore,
          userLocation: { latitude: lat, longitude: lng },
        }));
        updateTrackingWidget(widgetPayloadForOrder(roadUpdatedOrder, lat, lng));
      }).finally(() => {
        if (currentRouteRequest === routeRequestId) {
          isRoadRouteRequestInFlight = false;
          set({ isRerouting: false });
        }
      });
    }
  },

  setLiveTelemetry: (data: any) => {
    set({ telemetry: data });
  },

  // -------------------------------------------------------------
  // SIMULATOR ENGINE (Fully Working Real-Time Route Movement)
  // -------------------------------------------------------------
  startSimulation: (speedMultiplier) => {
    const currentMultiplier = speedMultiplier ?? get().simulationSpeedMultiplier;
    set({ isSimulating: true, simulationSpeedMultiplier: currentMultiplier });

    if (simTimer) clearInterval(simTimer);

    simTimer = setInterval(() => {
      const state = get();
      const active = state.activeOrder;
      if (!active || !active.routePoints || active.routePoints.length === 0) return;

      const points = active.routePoints;
      const isWalking = active.trackingMode === 'walk';
      
      // Step increment adjusted for walking (~5 km/h) or bike (~25 km/h)
      const baseIncrement = isWalking ? 0.005 : 0.012;
      const stepIncrement = baseIncrement * state.simulationSpeedMultiplier;
      let nextProgress = state.simulationProgress + stepIncrement;

      if (nextProgress >= 1.0) {
        nextProgress = 1.0;
        get().pauseSimulation();
        get().updateOrderStatus('delivered');
      }

      // Calculate current position along polyline
      const totalSegments = points.length - 1;
      const exactIndex = nextProgress * totalSegments;
      const lowerIndex = Math.min(Math.floor(exactIndex), totalSegments - 1);
      const upperIndex = Math.min(lowerIndex + 1, totalSegments);
      const segmentRatio = exactIndex - lowerIndex;

      const p1 = points[lowerIndex];
      const p2 = points[upperIndex];

      const currentLat = p1.latitude + (p2.latitude - p1.latitude) * segmentRatio;
      const currentLng = p1.longitude + (p2.longitude - p1.longitude) * segmentRatio;

      const heading = calculateBearing(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
      const speedKmh = (isWalking ? 4.8 : 26) * state.simulationSpeedMultiplier;
      const speedMs = (speedKmh * 1000) / 3600;

      // Auto update status based on progress
      if (nextProgress > 0.05 && nextProgress < 0.88 && active.status !== 'on_the_way') {
        get().updateOrderStatus('on_the_way');
      } else if (nextProgress >= 0.88 && nextProgress < 1.0 && active.status !== 'nearby') {
        get().updateOrderStatus('nearby');
      }

      set({ simulationProgress: nextProgress });
      get().updateDriverLocation(currentLat, currentLng, Math.round(heading), speedMs, isWalking ? 2.5 : 4.0);
    }, 500);
  },

  pauseSimulation: () => {
    if (simTimer) {
      clearInterval(simTimer);
      simTimer = null;
    }
    set({ isSimulating: false });
  },

  resetSimulation: () => {
    get().pauseSimulation();
    const active = get().activeOrder;
    if (active && active.routePoints && active.routePoints.length > 0) {
      const p0 = active.routePoints[0];
      set({ simulationProgress: 0.0 });
      get().updateOrderStatus('picked_up');
      get().updateDriverLocation(p0.latitude, p0.longitude, 0, 0, 3.0);
    }
  },

  setSimulationSpeed: (speedMultiplier: number) => {
    set({ simulationSpeedMultiplier: speedMultiplier });
    if (get().isSimulating) {
      get().startSimulation(speedMultiplier);
    }
  },

  startStoreTracking: (store: Store, mode: TrackingMode = 'walk', startLoc?: RouteCoordinate): Order => {
    const sLoc = startLoc || get().userLocation;
    const waypoints = generateRouteWaypoints(sLoc.latitude, sLoc.longitude, store.latitude, store.longitude, 28);
    const distMeters = Math.round(
      calculateHaversineDistance(sLoc.latitude, sLoc.longitude, store.latitude, store.longitude),
    );
    const isWalking = mode === 'walk';
    const initialSpeed = isWalking ? 1.3 : 7.0; // m/s
    const etaMinutes = isWalking ? Math.max(1, Math.round(distMeters / (1.3 * 60))) : Math.max(1, Math.round(distMeters / (7.0 * 60)));

    const trackingId = `TRK-${Math.floor(1000 + Math.random() * 9000)}`;
    const avatar = isWalking ? 'walk' : mode === 'bike' ? 'bike' : 'drive';
    const driverTitle = isWalking ? 'On foot' : mode === 'bike' ? 'Bike' : 'Drive';

    const newOrder: Order = {
      id: trackingId,
      driverId: `NAV-${Math.floor(100 + Math.random() * 900)}`,
      driverName: driverTitle,
      driverPhone: '+91 98450 77889',
      driverAvatar: avatar,
      customerId: 'USER-CURRENT',
      customerName: 'You',
      status: 'on_the_way',
      trackingMode: mode,
      storeName: store.name,
      storeAddress: store.address,
      storeLat: sLoc.latitude,
      storeLng: sLoc.longitude,
      destinationAddress: store.address,
      destinationLat: store.latitude,
      destinationLng: store.longitude,
      currentLat: sLoc.latitude,
      currentLng: sLoc.longitude,
      currentHeading: calculateBearing(sLoc.latitude, sLoc.longitude, store.latitude, store.longitude),
      currentSpeed: initialSpeed,
      currentAccuracy: 3.5,
      remainingDistanceMeters: distMeters,
      smoothedEtaMinutes: etaMinutes,
      routePoints: waypoints,
      traveledRoutePoints: [sLoc],
      orderItems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set({
      activeOrder: newOrder,
      activeOrderId: newOrder.id,
      lastCompletedOrder: null,
      selectedStore: store,
      selectedTrackingMode: mode,
      simulationProgress: 0,
      telemetry: {
        accuracy: 3.5,
        speed: initialSpeed,
        heading: newOrder.currentHeading,
        isMoving: false,
        distanceRemainingMeters: distMeters,
        etaSeconds: etaMinutes * 60,
        lastUpdated: new Date().toISOString(),
      },
    });
    saveTrackingState(JSON.stringify({
      isActiveTracking: true,
      activeOrder: newOrder,
      selectedStore: store,
      userLocation: sLoc,
    }));
    updateTrackingWidget(widgetPayloadForOrder(newOrder));
    lastRoadRouteRefresh = {
      orderId: newOrder.id,
      latitude: sLoc.latitude,
      longitude: sLoc.longitude,
      at: Date.now(),
    };
    const currentRouteRequest = ++routeRequestId;
    isRoadRouteRequestInFlight = true;
    set({ isRerouting: true });
    fetchBestRoadRoute(
      sLoc,
      { latitude: store.latitude, longitude: store.longitude },
      mode,
    ).then((roadRoute) => {
      if (!roadRoute || currentRouteRequest !== routeRequestId) {
        return;
      }
      const active = get().activeOrder;
      if (!active || active.id !== newOrder.id) {
        return;
      }
      const updatedOrder: Order = {
        ...active,
        routePoints: roadRoute.coordinates,
        remainingDistanceMeters: roadRoute.distanceMeters,
        smoothedEtaMinutes: Math.max(1, Math.round(roadRoute.durationSeconds / 60)),
      };
      set((state) => ({
        activeOrder: updatedOrder,
        orders: state.orders.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)),
      }));
      saveTrackingState(JSON.stringify({
        isActiveTracking: true,
        activeOrder: updatedOrder,
        selectedStore: get().selectedStore,
        userLocation: sLoc,
      }));
      updateTrackingWidget(widgetPayloadForOrder(updatedOrder));
    }).finally(() => {
      if (currentRouteRequest === routeRequestId) {
        isRoadRouteRequestInFlight = false;
        set({ isRerouting: false });
      }
    });

    // Connect WebSocket
    wsService.connect(newOrder.id);

    return newOrder;
  },

  createNewOrder: (orderData: Partial<Order>) => {
    const newId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const sLat = orderData.storeLat ?? 11.0168;
    const sLng = orderData.storeLng ?? 76.9558;
    const dLat = orderData.destinationLat ?? 11.025;
    const dLng = orderData.destinationLng ?? 76.968;

    const newOrder = parseOrder({
      id: newId,
      driver_id: 'DRV-101',
      driver_name: orderData.driverName || 'Karthik Raja',
      driver_phone: orderData.driverPhone || '+91 98450 11223',
      driver_avatar: orderData.driverAvatar || 'bike',
      customer_id: 'CUST-999',
      customer_name: orderData.customerName || 'Deepak Raj',
      status: 'on_the_way',
      tracking_mode: orderData.trackingMode || 'bike',
      store_name: orderData.storeName || 'Green Leaf Supermarket',
      store_address: orderData.storeAddress || 'Cross Cut Road',
      store_lat: sLat,
      store_lng: sLng,
      destination_address: orderData.destinationAddress || 'Trichy Road, Ramanathapuram',
      destination_lat: dLat,
      destination_lng: dLng,
      current_lat: sLat,
      current_lng: sLng,
      items: orderData.orderItems || [],
      total_amount: orderData.totalAmount,
    });

    set((state) => ({
      orders: [newOrder, ...state.orders],
      activeOrder: newOrder,
      activeOrderId: newOrder.id,
      simulationProgress: 0.0,
    }));

    return newOrder;
  },
}));
