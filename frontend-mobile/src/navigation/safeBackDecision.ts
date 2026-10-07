export type SafeBackAction = "back" | "replace";

export const chooseSafeBackAction = (canGoBack: boolean): SafeBackAction =>
  canGoBack ? "back" : "replace";
