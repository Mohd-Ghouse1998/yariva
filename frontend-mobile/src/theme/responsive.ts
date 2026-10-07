import { useWindowDimensions } from "react-native";

/**
 * Shared layout decisions derived from logical viewport size and font scale.
 * React Native already normalises device density, so model- or pixel-specific
 * branches would make the same interface behave differently across phones.
 */
export const responsiveLayout = ({
  width,
  height,
  fontScale = 1,
}: {
  width: number;
  height: number;
  fontScale?: number;
}) => {
  const compact = width < 360;
  const landscape = width > height;
  const wide = width >= 600;

  return {
    compact,
    landscape,
    wide,
    shortViewport: landscape || (!wide && height < 760),
    accessibilityLayout: fontScale > 1.2,
    screenPadding: compact ? 16 : 20,
    headerPadding: compact ? 8 : 12,
    buttonHeight: compact ? 42 : 44,
    buttonSmallHeight: 34,
    buttonHorizontalPadding: compact ? 14 : 16,
    buttonLabelSize: compact ? 13.5 : 14,
    buttonRowGap: compact ? 8 : 10,
    stackButtonRow: width < 340 || (fontScale > 1.35 && width < 600),
    actionMaxWidth: 560,
    contentMaxWidth: 720,
  } as const;
};

export const useResponsiveLayout = () => responsiveLayout(useWindowDimensions());
