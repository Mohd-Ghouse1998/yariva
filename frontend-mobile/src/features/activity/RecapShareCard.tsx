import React, { forwardRef } from "react";
import Svg, { G, Image as SvgImage, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../theme/ThemeContext";
import { fontFamilies } from "../../theme/typography";
import { useLocalization } from "../../localization/LocalizationContext";
import type { WeeklyRecap } from "../../types/activity";
import { RECAP_EXPORT, recapShareModel } from "./recapLogic";

/** The same actual SVG is previewed and rendered by native toDataURL as PNG. */
export const RecapShareCard = forwardRef<Svg, { recap: WeeklyRecap; includeMetrics: boolean }>(
  ({ recap, includeMetrics }, ref) => {
    const { palette, resolved } = useTheme();
    const { t } = useLocalization();
    const model = recapShareModel(recap, includeMetrics, t);
    // Reuse the exact supplied wordmark in the exported recap too.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const wordmark = resolved === "dark" ? require("../../../assets/brand/wordmark-dark.png") : require("../../../assets/brand/wordmark-light.png");
    const hasMetrics = model.metrics.length > 0;
    return (
      <Svg
        ref={ref}
        width="100%"
        height="100%"
        viewBox={`0 0 ${RECAP_EXPORT.width} ${RECAP_EXPORT.height}`}
        accessible={false}
      >
        <Rect width={RECAP_EXPORT.width} height={RECAP_EXPORT.height} fill={palette.background} />
        <SvgImage x={RECAP_EXPORT.margin} y={128} width={280} height={88} href={wordmark} />
        <SvgText
          x={RECAP_EXPORT.width - RECAP_EXPORT.margin}
          y={190}
          textAnchor="end"
          fontFamily={fontFamilies.regular}
          fontSize={28}
          fill={palette.textSecondary}
        >
          {t("activity.title")}
        </SvgText>
        <Rect
          x={RECAP_EXPORT.margin}
          y={hasMetrics ? 330 : 490}
          width={110}
          height={8}
          rx={4}
          fill={palette.secondary}
        />
        {model.title.map((line, index) => (
          <SvgText
            key={line}
            x={RECAP_EXPORT.margin}
            y={(hasMetrics ? 485 : 650) + index * 130}
            fontFamily={fontFamilies.display}
            fontSize={112}
            fill={palette.textPrimary}
          >
            {line}
          </SvgText>
        ))}
        {model.subtitle.map((line, index) => (
          <SvgText
            key={line}
            x={RECAP_EXPORT.margin}
            y={(hasMetrics ? 745 : 945) + index * 58}
            fontFamily={fontFamilies.regular}
            fontSize={42}
            fill={palette.textSecondary}
          >
            {line}
          </SvgText>
        ))}
        {model.metrics.map((metric, index) => {
          const x = RECAP_EXPORT.margin + (index % 2) * 456;
          const y = 1020 + Math.floor(index / 2) * 228;
          return (
            <G key={metric.label}>
              <SvgText
                x={x}
                y={y}
                fontFamily={fontFamilies.display}
                fontSize={84}
                fill={palette.textPrimary}
              >
                {metric.value}
              </SvgText>
              <SvgText
                x={x}
                y={y + 64}
                fontFamily={fontFamilies.regular}
                fontSize={40}
                fill={palette.textSecondary}
              >
                {metric.label}
              </SvgText>
            </G>
          );
        })}
        {model.partial ? (
          <SvgText
            x={RECAP_EXPORT.margin}
            y={1460}
            fontFamily={fontFamilies.regular}
            fontSize={30}
            fill={palette.textSecondary}
          >
            {t("activity.partial")}
          </SvgText>
        ) : null}
        <Rect
          x={RECAP_EXPORT.margin}
          y={1580}
          width={RECAP_EXPORT.width - RECAP_EXPORT.margin * 2}
          height={2}
          fill={palette.borderStrong}
        />
        <SvgText
          x={RECAP_EXPORT.margin}
          y={1690}
          fontFamily={fontFamilies.regular}
          fontSize={36}
          fill={palette.textSecondary}
        >
          {model.period.start}
        </SvgText>
        <SvgText
          x={RECAP_EXPORT.margin}
          y={1750}
          fontFamily={fontFamilies.regular}
          fontSize={36}
          fill={palette.textSecondary}
        >
          to {model.period.end} IST
        </SvgText>
        <SvgText
          x={RECAP_EXPORT.margin}
          y={1810}
          fontFamily={fontFamilies.regular}
          fontSize={32}
          fill={palette.textSecondary}
        >
          Sunday 8pm cutoff · end exclusive
        </SvgText>
      </Svg>
    );
  },
);
RecapShareCard.displayName = "RecapShareCard";
