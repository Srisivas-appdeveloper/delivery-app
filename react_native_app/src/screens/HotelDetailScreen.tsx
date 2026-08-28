import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppColors } from '../constants/theme';
import { getHotelById } from '../models/Store';
import { calculateHaversineDistance, formatNavigationDistance } from '../models/Order';
import { useOrderStore } from '../store/orderStore';

export const HotelDetailScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { userLocation, findNearbyPlace } = useOrderStore();
  const hotelId = route.params?.hotelId as string | undefined;
  const hotel = hotelId ? getHotelById(hotelId) || findNearbyPlace(hotelId) : undefined;

  if (!hotel) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Hotel not found</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const meters = Math.round(
    calculateHaversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      hotel.latitude,
      hotel.longitude,
    ),
  );
  const walkMins = Math.max(1, Math.round(meters / (1.3 * 60)));

  const startTracking = () => {
    navigation.navigate('Tabs', {
      screen: 'Map',
      params: { hotelId: hotel.id },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Image source={hotel.image} style={styles.hero} resizeMode="cover" />
        <View style={styles.topBar}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{hotel.name}</Text>
          <Text style={styles.category}>{hotel.category}</Text>
          <Text style={styles.address}>{hotel.address}</Text>
          <Text style={styles.meta}>
            {hotel.rating.toFixed(1)} rating  ·  {formatNavigationDistance(meters)} away  ·  {walkMins} min
          </Text>

          <Pressable style={styles.navBtn} onPress={startTracking}>
            <Text style={styles.navBtnText}>Start from my location</Text>
          </Pressable>

          {hotel.rooms.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Rooms</Text>
              {hotel.rooms.map((room) => (
                <View key={room.id} style={styles.roomCard}>
                  <Image source={room.image} style={styles.roomImage} resizeMode="cover" />
                  <View style={styles.roomCopy}>
                    <Text style={styles.roomName}>{room.name}</Text>
                    <Text style={styles.roomType}>{room.type}</Text>
                    <Text style={styles.roomDetail}>
                      {room.beds}  ·  {room.guests} guests  ·  {room.sizeSqft} sq ft
                    </Text>
                    <Text style={styles.roomPrice}>₹{room.pricePerNight.toLocaleString('en-IN')} / night</Text>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.sectionTitle}>Live listing from nearby map search</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  missing: {
    flex: 1,
    backgroundColor: AppColors.background,
    padding: 24,
    justifyContent: 'center',
  },
  missingText: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  backLink: {
    color: AppColors.primary,
    marginTop: 12,
    fontWeight: '700',
  },
  hero: {
    width: '100%',
    height: 240,
    backgroundColor: AppColors.surface,
  },
  topBar: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  backBtn: {
    backgroundColor: AppColors.glassSurface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  backBtnText: {
    color: AppColors.textPrimary,
    fontWeight: '800',
  },
  body: {
    padding: 16,
    paddingBottom: 40,
  },
  name: {
    color: AppColors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  category: {
    color: AppColors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  address: {
    color: AppColors.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  meta: {
    color: AppColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  navBtn: {
    marginTop: 16,
    backgroundColor: AppColors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  navBtnText: {
    color: AppColors.background,
    fontWeight: '800',
    fontSize: 14,
  },
  sectionTitle: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 12,
  },
  roomCard: {
    backgroundColor: AppColors.glassCard,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
    marginBottom: 12,
  },
  roomImage: {
    width: '100%',
    height: 168,
    backgroundColor: AppColors.surface,
  },
  roomCopy: {
    padding: 14,
  },
  roomName: {
    color: AppColors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  roomType: {
    color: AppColors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  roomDetail: {
    color: AppColors.textSecondary,
    fontSize: 13,
    marginTop: 6,
  },
  roomPrice: {
    color: AppColors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },
});
