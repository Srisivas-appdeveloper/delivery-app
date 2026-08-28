import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppColors } from '../constants/theme';
import { GlassCard } from './GlassCard';

interface BentoStatusGridProps {
  speed: number;
  accuracy: number;
  remainingDistanceMeters: number;
  etaMinutes: number;
}

export const BentoStatusGrid: React.FC<BentoStatusGridProps> = ({
  speed,
  accuracy,
  remainingDistanceMeters,
  etaMinutes,
}) => {
  const speedKmh = Math.round(speed * 3.6);
  const distanceKm = (remainingDistanceMeters / 1000).toFixed(1);
  const etaDisplay = etaMinutes < 1 ? '< 1 min' : `${Math.round(etaMinutes)} mins`;

  return (
    <View style={styles.container}>
      {/* ETA Big Card */}
      <GlassCard style={styles.heroCard} highlight>
        <Text style={styles.label}>ESTIMATED ARRIVAL</Text>
        <View style={styles.row}>
          <Text style={styles.heroValue}>{etaDisplay}</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE GPS</Text>
          </View>
        </View>
      </GlassCard>

      {/* 3 Bento Mini Cards */}
      <View style={styles.statsRow}>
        <GlassCard style={styles.miniCard}>
          <Text style={styles.miniLabel}>DISTANCE</Text>
          <Text style={styles.miniValue}>
            {distanceKm} <Text style={styles.unit}>km</Text>
          </Text>
        </GlassCard>

        <GlassCard style={styles.miniCard}>
          <Text style={styles.miniLabel}>SPEED</Text>
          <Text style={styles.miniValue}>
            {speedKmh} <Text style={styles.unit}>km/h</Text>
          </Text>
        </GlassCard>

        <GlassCard style={styles.miniCard}>
          <Text style={styles.miniLabel}>ACCURACY</Text>
          <Text style={styles.miniValue}>
            ±{Math.round(accuracy)} <Text style={styles.unit}>m</Text>
          </Text>
        </GlassCard>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  heroCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '900',
    color: AppColors.primary,
    letterSpacing: 0.5,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AppColors.success,
    marginRight: 6,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: AppColors.success,
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  miniCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  miniLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: AppColors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  miniValue: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  unit: {
    fontSize: 11,
    fontWeight: '500',
    color: AppColors.textSecondary,
  },
});
