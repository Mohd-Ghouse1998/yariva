import React from "react";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../theme/ThemeContext";

// Circular progress ring with the percentage label inside (Inter 700 14).
// Used on MyProfile + Completion screens.
export interface CompletionRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
}

export const CompletionRing: React.FC<CompletionRingProps> = ({
  percent,
  size = 64,
  strokeWidth = 6,
}) => {
  const { palette } = useTheme();
  const half = size / 2;
  const radius = half - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * Math.max(0, Math.min(1, percent / 100));
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={half}
        cy={half}
        r={radius}
        stroke={palette.brandTint}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={half}
        cy={half}
        r={radius}
        stroke={palette.brand}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${half} ${half})`}
      />
      <SvgText
        x={half}
        y={half + 5}
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill={palette.textPrimary}
      >
        {Math.round(percent)}%
      </SvgText>
    </Svg>
  );
};
