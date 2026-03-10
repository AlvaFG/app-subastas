export const fonts = {
  display: 'PlayfairDisplay_700Bold',
  heading: 'DMSans_700Bold',
  headingSemibold: 'DMSans_600SemiBold',
  headingMedium: 'DMSans_500Medium',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemibold: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 36,
  hero: 48,
} as const;

export const lineHeights = {
  xs: 16.8,
  sm: 21,
  base: 25.6,
  lg: 27,
  xl: 28.6,
  '2xl': 33.6,
  '3xl': 39.6,
  hero: 48,
} as const;

export type FontSize = keyof typeof fontSizes;
