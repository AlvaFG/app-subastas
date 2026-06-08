export const fonts = {
  display: 'Barlow_800ExtraBold',
  heading: 'Barlow_700Bold',
  headingSemibold: 'Barlow_600SemiBold',
  headingMedium: 'Barlow_500Medium',
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodySemibold: 'Barlow_600SemiBold',
  bodyBold: 'Barlow_700Bold',
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
