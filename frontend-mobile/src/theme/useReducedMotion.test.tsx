import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({
  read: vi.fn<() => Promise<boolean>>(),
  remove: vi.fn(),
  listener: undefined as ((enabled: boolean) => void) | undefined,
}));
vi.mock("react-native", () => ({
  AccessibilityInfo: {
    isReduceMotionEnabled: native.read,
    addEventListener: (_: string, callback: (enabled: boolean) => void) => {
      native.listener = callback;
      return { remove: native.remove };
    },
  },
}));
import { useReducedMotion } from "./useReducedMotion";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const Probe = () => <span>{String(useReducedMotion())}</span>;
const value = (renderer: ReactTestRenderer) => renderer.root.findByType("span").children[0];
beforeEach(() => {
  native.read.mockReset();
  native.remove.mockReset();
  native.listener = undefined;
});
describe("system reduced motion", () => {
  it("honors the initial preference and later changes, removing the listener on unmount", async () => {
    native.read.mockResolvedValue(true);
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(value(renderer)).toBe("true");
    await act(async () => native.listener?.(false));
    expect(value(renderer)).toBe("false");
    await act(async () => renderer.unmount());
    expect(native.remove).toHaveBeenCalledOnce();
  });
  it("does not let a delayed initial read overwrite a newer system event", async () => {
    let resolve!: (value: boolean) => void;
    native.read.mockReturnValue(
      new Promise<boolean>((r) => {
        resolve = r;
      }),
    );
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<Probe />);
    });
    await act(async () => native.listener?.(true));
    await act(async () => resolve(false));
    expect(value(renderer)).toBe("true");
    await act(async () => renderer.unmount());
  });
  it("keeps no motion when the native preference is unavailable", async () => {
    native.read.mockRejectedValue(Error("unavailable"));
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(value(renderer)).toBe("true");
    await act(async () => renderer.unmount());
  });
});
