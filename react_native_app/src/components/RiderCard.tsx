import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { AppColors } from '../constants/theme';
import { GlassCard } from './GlassCard';

interface RiderCardProps {
  name: string;
  phone: string;
  avatar?: string;
  storeName: string;
}

export const RiderCard: React.FC<RiderCardProps> = ({
  name,
  phone,
  avatar = '🛵',
  storeName,
}) => {
  const handleCall = () => {
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
  };

  const handleMessage = () => {
    Linking.openURL(`sms:${phone.replace(/\s+/g, '')}`);
  };

  return (
    <GlassCard style={styles.container}>
      <View style={styles.content}>
        {/* Avatar badge */}
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{avatar}</Text>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.store} numberOfLines={1}>
            From: <Text style={styles.storeName}>{storeName}</Text>
          </Text>
        </View>

        {/* Quick action buttons */}
        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, styles.callBtn]} onPress={handleCall}>
            <Text style={styles.actionEmoji}>📞</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.msgBtn]} onPress={handleMessage}>
            <Text style={styles.actionEmoji}>💬</Text>
          </Pressable>
        </View>
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.surfaceHighlight,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 22,
  },
  info: {
    flex: 1,
    marginRight: 10,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textPrimary,
    marginBottom: 2,
  },
  store: {
    fontSize: 12,
    color: AppColors.textMuted,
  },
  storeName: {
    color: AppColors.textSecondary,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  callBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  msgBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  actionEmoji: {
    fontSize: 16,
  },
});
