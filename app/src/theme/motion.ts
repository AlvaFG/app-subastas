import { Easing } from 'react-native-reanimated';

export const duration = {
  fast: 120,
  normal: 200,
  slow: 300,
  crawl: 600,
} as const;

export const easing = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  in: Easing.bezier(0.55, 0.055, 0.675, 0.19),
  bounce: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;
