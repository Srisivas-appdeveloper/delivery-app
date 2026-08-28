export const AppColors = {
  // Base Neutral Palette
  background: '#090D16',
  surface: '#111827',
  surfaceCard: '#182234',
  surfaceHighlight: '#1F2D44',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Accent Palette
  primary: '#00E5FF', // Electric Cyan
  primaryGlow: 'rgba(0, 229, 255, 0.2)',
  secondary: '#38BDF8', // Sky Blue

  // Status & Telemetry
  success: '#10B981', // Emerald Green
  warning: '#F59E0B', // Amber
  error: '#EF4444', // Crimson
  info: '#6366F1', // Indigo

  // Glassmorphism Constants
  glassSurface: 'rgba(17, 24, 39, 0.82)',
  glassCard: 'rgba(24, 34, 52, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassBorderHighlight: 'rgba(0, 229, 255, 0.45)',
};

export const getStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'preparing':
      return AppColors.warning;
    case 'picked_up':
      return AppColors.secondary;
    case 'on_the_way':
      return AppColors.primary;
    case 'nearby':
      return '#A855F7';
    case 'arriving':
      return '#EC4899';
    case 'delivered':
      return AppColors.success;
    case 'cancelled':
      return AppColors.error;
    default:
      return AppColors.textMuted;
  }
};

export const getStatusLabel = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'assigned':
      return 'Driver Assigned';
    case 'preparing':
      return 'Preparing Order';
    case 'picked_up':
      return 'Order Picked Up';
    case 'on_the_way':
      return 'On the Way';
    case 'nearby':
      return 'Rider Nearby (< 1 km)';
    case 'arriving':
      return 'Arriving (< 300 m)';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    default:
      return (status || '').replace(/_/g, ' ').toUpperCase();
  }
};
