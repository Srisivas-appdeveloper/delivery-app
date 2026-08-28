import React, { useEffect, useRef, useState } from 'react';
import {
  NavigationContainer,
  NavigationContainerRef,
  NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ExploreMapScreen } from '../screens/ExploreMapScreen';
import { LiveTrackingScreen } from '../screens/LiveTrackingScreen';
import { HotelsListScreen } from '../screens/HotelsListScreen';
import { HotelDetailScreen } from '../screens/HotelDetailScreen';
import { DriverDashboardScreen } from '../screens/DriverDashboardScreen';
import { TrackingDebugScreen } from '../screens/TrackingDebugScreen';
import { AppColors } from '../constants/theme';
import { getTabBarStyle } from './tabBarStyle';
import { useOrderStore } from '../store/orderStore';

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  HotelDetail: { hotelId: string };
  DriverDashboard: undefined;
  TrackingDebug: undefined;
};

export type TabParamList = {
  Map: { hotelId?: string } | undefined;
  Track: undefined;
  Stays: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, { on: string; off: string }> = {
  Map: { on: 'map', off: 'map-outline' },
  Track: { on: 'navigate', off: 'navigate-outline' },
  Stays: { on: 'bed', off: 'bed-outline' },
};

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      initialRouteName="Map"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: AppColors.primary,
        tabBarInactiveTintColor: AppColors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          return (
            <Ionicons
              name={(focused ? icons.on : icons.off) as never}
              size={size ?? 22}
              color={color}
            />
          );
        },
        tabBarStyle: getTabBarStyle(insets.bottom),
        tabBarSafeAreaInsets: { bottom: 0 },
      })}
    >
      <Tab.Screen name="Map" component={ExploreMapScreen} options={{ tabBarLabel: 'Map' }} />
      <Tab.Screen name="Track" component={LiveTrackingScreen} options={{ tabBarLabel: 'Track' }} />
      <Tab.Screen name="Stays" component={HotelsListScreen} options={{ tabBarLabel: 'Places' }} />
    </Tab.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  const navRef = useRef<NavigationContainerRef<RootStackParamList> | null>(null);
  const [navReady, setNavReady] = useState(false);
  const pendingWidgetPlaceId = useOrderStore((state) => state.pendingWidgetPlaceId);
  const consumeSelectedWidgetPlaceId = useOrderStore((state) => state.consumeSelectedWidgetPlaceId);

  useEffect(() => {
    consumeSelectedWidgetPlaceId().catch((error) => {
      console.warn('[AppNavigator] Widget place handoff skipped', error);
    });
  }, [consumeSelectedWidgetPlaceId]);

  useEffect(() => {
    if (!pendingWidgetPlaceId || !navReady || !navRef.current?.isReady()) {
      return;
    }
    navRef.current.navigate('Tabs', { screen: 'Map' });
  }, [navReady, pendingWidgetPlaceId]);

  return (
    <NavigationContainer ref={navRef} onReady={() => setNavReady(true)}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: AppColors.background },
        }}
      >
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen name="HotelDetail" component={HotelDetailScreen} />
        <Stack.Screen name="DriverDashboard" component={DriverDashboardScreen} />
        <Stack.Screen name="TrackingDebug" component={TrackingDebugScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
