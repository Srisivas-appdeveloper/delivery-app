import { AppColors } from '../constants/theme';

export function getTabBarStyle(bottomInset: number, hidden = false) {
  if (hidden) {
    return { display: 'none' as const };
  }
  const pad = Math.max(bottomInset, 10);
  return {
    backgroundColor: AppColors.surface,
    borderTopColor: AppColors.glassBorder,
    borderTopWidth: 1,
    height: 56 + pad,
    paddingTop: 6,
    paddingBottom: pad,
  };
}
