import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { type NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import { STADIA_STYLE_URL } from '../constants/stadiaMaps';
import { AppColors } from '../constants/theme';
import { getPlaceColor, getPlaceIcon } from '../models/Store';

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type StadiaMapHandle = {
  fitToCoordinates: (
    coords: LatLng[],
    options?: {
      edgePadding?: { top: number; right: number; bottom: number; left: number };
      animated?: boolean;
    },
  ) => void;
  animateToRegion: (
    region: LatLng & { latitudeDelta: number; longitudeDelta: number },
    duration?: number,
  ) => void;
};

type StadiaMapProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  initialCenter: LatLng;
  initialZoom?: number;
  nestedScroll?: boolean;
  onUserGesture?: () => void;
  onPress?: (coordinate: LatLng) => void;
  onLongPress?: (coordinate: LatLng) => void;
  onMapMoveEnd?: (center: LatLng, userInteraction: boolean) => void;
};

function toLineString(coordinates: LatLng[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: coordinates.map((point) => [point.longitude, point.latitude]),
    },
  };
}

function toCirclePolygon(
  center: LatLng,
  radiusMeters: number,
  steps = 48,
) {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const dLat = dy / 111320;
    const dLng = dx / (111320 * Math.cos((center.latitude * Math.PI) / 180));
    coords.push([center.longitude + dLng, center.latitude + dLat]);
  }
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
  };
}

function deltaToZoom(latitudeDelta: number): number {
  return Math.max(3, Math.min(18, Math.log2(360 / Math.max(latitudeDelta, 0.0005))));
}

export const StadiaMap = forwardRef<StadiaMapHandle, StadiaMapProps>(
  (
    {
      children,
      style,
      initialCenter,
      initialZoom = 13,
      nestedScroll = false,
      onUserGesture,
      onPress,
      onLongPress,
      onMapMoveEnd,
    },
    ref,
  ) => {
    const cameraRef = useRef<CameraRef>(null);

    useImperativeHandle(ref, () => ({
      fitToCoordinates(coords, options) {
        if (!coords.length) {
          return;
        }
        const lats = coords.map((c) => c.latitude);
        const lngs = coords.map((c) => c.longitude);
        const pad = 0.0006;
        cameraRef.current?.fitBounds(
          [
            Math.min(...lngs) - pad,
            Math.min(...lats) - pad,
            Math.max(...lngs) + pad,
            Math.max(...lats) + pad,
          ],
          {
            padding: options?.edgePadding ?? {
              top: 40,
              right: 40,
              bottom: 40,
              left: 40,
            },
            duration: options?.animated === false ? 0 : 600,
            easing: 'ease',
          },
        );
      },
      animateToRegion(region, duration = 400) {
        cameraRef.current?.easeTo({
          center: [region.longitude, region.latitude],
          zoom: deltaToZoom(region.latitudeDelta),
          duration,
          easing: 'ease',
        });
      },
    }));

    return (
      <Map
        style={style}
        mapStyle={STADIA_STYLE_URL}
        androidView={nestedScroll ? 'texture' : 'surface'}
        compass={!nestedScroll}
        scaleBar={false}
        logo={false}
        attribution
        attributionPosition={{ bottom: 4, right: 4 }}
        onPress={
          onPress
            ? (event) => {
                const [lng, lat] = event.nativeEvent.lngLat;
                onPress({ latitude: lat, longitude: lng });
              }
            : undefined
        }
        onLongPress={
          onLongPress
            ? (event) => {
                const [lng, lat] = event.nativeEvent.lngLat;
                onLongPress({ latitude: lat, longitude: lng });
              }
            : undefined
        }
        onRegionWillChange={
          onUserGesture
            ? (event) => {
                if (event.nativeEvent.userInteraction) {
                  onUserGesture();
                }
              }
            : undefined
        }
        onRegionDidChange={
          onMapMoveEnd
            ? (event) => {
                const [lng, lat] = event.nativeEvent.center;
                onMapMoveEnd(
                  { latitude: lat, longitude: lng },
                  Boolean(event.nativeEvent.userInteraction),
                );
              }
            : undefined
        }
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: [initialCenter.longitude, initialCenter.latitude],
            zoom: initialZoom,
          }}
        />
        {children}
      </Map>
    );
  },
);

type MapRouteProps = {
  id: string;
  coordinates: LatLng[];
  color?: string;
};

export const MapRoute: React.FC<MapRouteProps> = ({
  id,
  coordinates,
  color = AppColors.primary,
}) => {
  const data = useMemo(() => {
    if (coordinates.length < 2) {
      return null;
    }
    return toLineString(coordinates);
  }, [coordinates]);

  if (!data) {
    return null;
  }

  return (
    <GeoJSONSource id={id} data={data}>
      <Layer
        type="line"
        id={`${id}-glow`}
        paint={{
          'line-color': color,
          'line-width': 8,
          'line-opacity': 0.35,
        }}
        layout={{
          'line-cap': 'round',
          'line-join': 'round',
        }}
      />
      <Layer
        type="line"
        id={`${id}-line`}
        paint={{
          'line-color': color,
          'line-width': 3.5,
        }}
        layout={{
          'line-cap': 'round',
          'line-join': 'round',
        }}
      />
    </GeoJSONSource>
  );
};

type MapAccuracyCircleProps = {
  id: string;
  center: LatLng;
  radiusMeters: number;
};

export const MapAccuracyCircle: React.FC<MapAccuracyCircleProps> = ({
  id,
  center,
  radiusMeters,
}) => {
  const data = useMemo(
    () => toCirclePolygon(center, Math.max(radiusMeters, 8)),
    [center, radiusMeters],
  );

  return (
    <GeoJSONSource id={id} data={data}>
      <Layer
        type="fill"
        id={`${id}-fill`}
        paint={{
          'fill-color': 'rgba(56, 189, 248, 0.12)',
        }}
      />
      <Layer
        type="line"
        id={`${id}-stroke`}
        paint={{
          'line-color': 'rgba(56, 189, 248, 0.4)',
          'line-width': 1.5,
        }}
      />
    </GeoJSONSource>
  );
};

type MapPlace = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  color?: string;
  icon?: string;
};

type MapPlacesLayerProps = {
  id: string;
  places: MapPlace[];
  selectedId?: string | null;
  onPlacePress?: (placeId: string) => void;
};

export const MapPlacesLayer: React.FC<MapPlacesLayerProps> = ({
  id,
  places,
  selectedId,
  onPlacePress,
}) => {
  const data = useMemo<GeoJSON.FeatureCollection>(() => {
    const features = places
      .filter(
        (place) =>
          Number.isFinite(place.latitude) &&
          Number.isFinite(place.longitude),
      )
      .map<GeoJSON.Feature>((place) => {
        const color = place.color || getPlaceColor(place);
        const icon = place.icon || getPlaceIcon(place);
        return {
          type: 'Feature',
          id: place.id,
          properties: {
            id: place.id,
            name: place.name,
            category: place.category,
            color,
            icon,
            selected: selectedId === place.id,
          },
          geometry: {
            type: 'Point',
            coordinates: [place.longitude, place.latitude],
          },
        };
      });

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [places, selectedId]);

  if (!data.features.length) {
    return null;
  }

  const handlePress = (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const feature = event.nativeEvent.features?.[0];
    const placeId = feature?.properties?.id;
    if (typeof placeId === 'string') {
      event.stopPropagation();
      onPlacePress?.(placeId);
    }
  };

  return (
    <GeoJSONSource
      id={id}
      data={data}
      hitbox={{ top: 20, right: 20, bottom: 20, left: 20 }}
      onPress={onPlacePress ? handlePress : undefined}
    >
      <Layer
        type="circle"
        id={`${id}-halo`}
        paint={{
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.35,
          'circle-radius': ['case', ['get', 'selected'], 18, 12],
          'circle-blur': 0.45,
        }}
      />
      <Layer
        type="circle"
        id={`${id}-dot`}
        paint={{
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['case', ['get', 'selected'], 3, 2],
          'circle-radius': ['case', ['get', 'selected'], 10, 7],
        }}
      />
      <Layer
        type="symbol"
        id={`${id}-label`}
        minzoom={14}
        layout={{
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-max-width': 8,
          'text-optional': true,
        }}
        paint={{
          'text-color': '#f8fafc',
          'text-halo-color': '#0f172a',
          'text-halo-width': 1.8,
          'text-halo-blur': 0.5,
        }}
      />
    </GeoJSONSource>
  );
};

type MapPinProps = {
  id: string;
  coordinate: LatLng;
  onPress?: () => void;
  children: React.ReactElement;
};

export const MapPin: React.FC<MapPinProps> = ({ id, coordinate, onPress, children }) => {
  if (!Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) {
    return null;
  }

  return (
    <Marker
      id={id}
      lngLat={[coordinate.longitude, coordinate.latitude]}
      anchor="center"
      onPress={onPress ? () => onPress() : undefined}
    >
      {children}
    </Marker>
  );
};
