import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { AppColors } from '../constants/theme';
import { WebSocketStatus } from '../services/websocketClient';

interface TopGlassHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  wsStatus?: WebSocketStatus;
  rightAction?: React.ReactNode;
}

export const TopGlassHeader: React.FC<TopGlassHeaderProps> = ({
  title,
  subtitle,
  onBack,
  wsStatus,
  rightAction,
}) => {
  const getWsStatusColor = () => {
    switch (wsStatus) {
      case 'connected':
        return AppColors.success;
      case 'reconnecting':
        return AppColors.warning;
      case 'disconnected':
      default:
        return AppColors.error;
    }
  };

  return (
    <View style={styles.header}>
      {onBack && (
        <Pressable style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
      )}

      <View style={styles.titleContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {wsStatus && (
            <View style={[styles.statusDot, { backgroundColor: getWsStatusColor() }]} />
          )}
        </View>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: AppColors.glassSurface,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.glassBorder,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backText: {
    color: AppColors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.textPrimary,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    color: AppColors.textMuted,
    marginTop: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rightAction: {
    marginLeft: 8,
  },
});
