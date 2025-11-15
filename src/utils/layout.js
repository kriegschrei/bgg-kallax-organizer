import { DEFAULT_COLLAPSED_BADGE_LIMIT } from '../constants/appDefaults';

export const getCollapsedBadgeLimit = (width) => {
  if (!Number.isFinite(width) || width <= 0) {
    return DEFAULT_COLLAPSED_BADGE_LIMIT;
  }

  if (width >= 1280) {
    return DEFAULT_COLLAPSED_BADGE_LIMIT;
  }
  if (width >= 1080) {
    return 3;
  }
  if (width >= 900) {
    return 2;
  }
  if (width >= 720) {
    return 1;
  }
  return 0;
};

