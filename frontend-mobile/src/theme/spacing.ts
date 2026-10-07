// 4px base spacing scale, mirrored from the design system.
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  jumbo: 48,
  hero: 64,
} as const;

export type SpacingToken = keyof typeof spacing;

// Aligned with `r: { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 }` from the
// Figma tokens, with a couple of additional steps used in our components.
export const radius = {
  none: 0,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 20,
  xxl: 28,
  pill: 999,
  button: 14,
  control: 12,
  card: 14,
  sheet: 20,
} as const;

export type RadiusToken = keyof typeof radius;

export const layout = {
  contentMaxWidth: 720,
  formMaxWidth: 560,
  screenPadding: 20,
  compactScreenPadding: 16,
  actionMaxWidth: 560,
} as const;

export const controlSize = {
  button: 44,
  buttonCompact: 42,
  buttonSmall: 34,
  input: 46,
  minimumTouchTarget: 48,
  tabBar: 52,
} as const;
