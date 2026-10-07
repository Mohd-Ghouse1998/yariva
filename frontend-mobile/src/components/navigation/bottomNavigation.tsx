import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const BOTTOM_NAV_VISUAL_HEIGHT = 56;
export const BOTTOM_NAV_MIN_EDGE_GAP = 14;
export const BOTTOM_NAV_CONTENT_GAP = 12;
const BOTTOM_NAV_SAFE_AREA_GAP = 6;

export const getBottomNavigationMetrics = (bottomInset: number) => {
  const edgeOffset = Math.max(
    bottomInset + BOTTOM_NAV_SAFE_AREA_GAP,
    BOTTOM_NAV_MIN_EDGE_GAP,
  );
  return {
    edgeOffset,
    visualHeight: BOTTOM_NAV_VISUAL_HEIGHT,
    reservedInset: edgeOffset + BOTTOM_NAV_VISUAL_HEIGHT + BOTTOM_NAV_CONTENT_GAP,
  } as const;
};

interface BottomNavigationContextValue {
  reservedInset: number;
  setReservedInset: (value: number) => void;
}

const BottomNavigationContext = createContext<BottomNavigationContextValue | null>(null);

export const BottomNavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reservedInset, setReservedInsetState] = useState(0);
  const setReservedInset = useCallback((value: number) => {
    setReservedInsetState((current) => (current === value ? current : value));
  }, []);
  const value = useMemo(
    () => ({ reservedInset, setReservedInset }),
    [reservedInset, setReservedInset],
  );

  return (
    <BottomNavigationContext.Provider value={value}>
      {children}
    </BottomNavigationContext.Provider>
  );
};

/** Returns the measured space that tab content and overlays must avoid. */
export const useBottomNavigationInset = (): number =>
  useContext(BottomNavigationContext)?.reservedInset ?? 0;

/** Internal registration used by the shared tab bar. */
export const useRegisterBottomNavigationInset = (reservedInset: number, visible = true): void => {
  const context = useContext(BottomNavigationContext);
  const setReservedInset = context?.setReservedInset;

  useEffect(() => {
    if (!setReservedInset) return undefined;
    setReservedInset(visible ? reservedInset : 0);
    return () => setReservedInset(0);
  }, [reservedInset, setReservedInset, visible]);
};
