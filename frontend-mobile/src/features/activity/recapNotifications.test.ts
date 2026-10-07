import { describe, expect, it, vi } from "vitest";
import { changeRecapNotifications } from "./recapNotifications";

describe("recap notification consent", () => {
  it("registers with explicit permission before saving an opt-in", async () => {
    const order: string[] = [];
    const result = await changeRecapNotifications(
      true,
      async (prompt) => {
        expect(prompt).toBe(true);
        order.push("register");
        return "REGISTERED";
      },
      async (enabled) => {
        expect(enabled).toBe(true);
        order.push("save");
        return true;
      },
    );
    expect(result).toBe("SAVED");
    expect(order).toEqual(["register", "save"]);
  });
  it.each(["PERMISSION_DENIED", "NOT_SUPPORTED"] as const)(
    "does not persist opt-in for %s",
    async (result) => {
      const save = vi.fn();
      expect(await changeRecapNotifications(true, async () => result, save)).toBe("UNAVAILABLE");
      expect(save).not.toHaveBeenCalled();
    },
  );
  it("does not save when token registration throws", async () => {
    const save = vi.fn();
    await expect(
      changeRecapNotifications(
        true,
        async () => {
          throw Error("offline");
        },
        save,
      ),
    ).rejects.toThrow("offline");
    expect(save).not.toHaveBeenCalled();
  });
  it("disables without permission or token registration", async () => {
    const register = vi.fn();
    const save = vi.fn().mockResolvedValue(true);
    expect(await changeRecapNotifications(false, register, save)).toBe("SAVED");
    expect(register).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(false);
  });
  it("does not report success if saving fails", async () => {
    expect(await changeRecapNotifications(false, vi.fn(), async () => false)).toBe("SAVE_FAILED");
  });
});
