import { useResponsiveLayout } from "../../theme/responsive";
import { spacing } from "../../theme/spacing";
export function useProfileFormLayout() {
  const layout = useResponsiveLayout();
  return {
    content: {
      width: "100%" as const,
      maxWidth: layout.contentMaxWidth,
      alignSelf: "center" as const,
      paddingHorizontal: layout.screenPadding,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
      gap: spacing.lg,
    },
  };
}
