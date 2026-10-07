import { controlSize, spacing } from "../../theme/spacing";

/** Seven days fit on wider layouts; phones reflow instead of shrinking targets. */
export const scheduleDayLayout = (width: number, fontScale = 1) => {
  const minimum = Math.max(
    controlSize.minimumTouchTarget,
    Math.ceil(controlSize.minimumTouchTarget * fontScale),
  );
  const gap = spacing.sm;
  const columns =
    width >= minimum * 7 + gap * 6
      ? 7
      : Math.max(1, Math.min(4, Math.floor((width + gap) / (minimum + gap))));
  return { columns, gap, itemWidth: Math.max(minimum, (width - gap * (columns - 1)) / columns) };
};
