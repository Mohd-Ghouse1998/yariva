import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Svg from "react-native-svg";

const state = vi.hoisted(() => ({
  available: true,
  availability: vi.fn(),
  share: vi.fn(),
  created: [] as string[],
  written: [] as string[],
  deleted: [] as string[],
  entries: [] as string[],
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: state.availability,
  shareAsync: state.share,
}));
vi.mock("expo-file-system", () => {
  class File {
    uri: string;
    name: string;
    constructor(directory: { uri: string }, name: string) {
      this.name = name;
      this.uri = `${directory.uri}/${name}`;
    }
    create() {
      state.created.push(this.uri);
    }
    write(value: string) {
      state.written.push(value);
    }
    delete() {
      state.deleted.push(this.name);
    }
  }
  class Directory {
    uri = "file:///private-cache/yariva-recap-exports";
    exists = true;
    create() {}
    list() {
      return state.entries.map((name) => new File(this, name));
    }
  }
  return { File, Directory, Paths: { cache: "file:///private-cache" } };
});
import { clearExpiredRecapExports, shareRecapCard } from "./exportRecap";

const header = (width: number, height: number) => {
  const bigEndian = (value: number) => [
    value >>> 24,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ];
  return btoa(
    String.fromCharCode(
      ...[
        137,
        80,
        78,
        71,
        13,
        10,
        26,
        10,
        0,
        0,
        0,
        13,
        73,
        72,
        68,
        82,
        ...bigEndian(width),
        ...bigEndian(height),
      ],
    ),
  );
};
const card = (width = 1080, height = 1920) => ({
  toDataURL: vi.fn((callback: (value: string) => void) => callback(header(width, height))),
});
beforeEach(() => {
  state.available = true;
  state.availability.mockReset().mockImplementation(async () => state.available);
  state.share.mockReset();
  state.created = [];
  state.written = [];
  state.deleted = [];
  state.entries = [];
});
afterEach(() => vi.useRealTimers());
describe("manual export boundary (mock native IO, no bitmap capture)", () => {
  it("does not render or write when platform sharing is unavailable", async () => {
    state.available = false;
    const svg = card();
    await expect(shareRecapCard(svg as unknown as Svg)).rejects.toThrow("Sharing unavailable");
    expect(svg.toDataURL).not.toHaveBeenCalled();
    expect(state.created).toEqual([]);
  });
  it("verifies actual PNG geometry before sharing an account-neutral local URI", async () => {
    const svg = card();
    await shareRecapCard(svg as unknown as Svg);
    expect(svg.toDataURL).toHaveBeenCalledWith(expect.any(Function), { width: 1080, height: 1920 });
    expect(state.share).toHaveBeenCalledWith(
      expect.stringMatching(
        /^file:\/\/\/private-cache\/yariva-recap-exports\/yariva-week-\d+\.png$/,
      ),
      expect.objectContaining({ mimeType: "image/png" }),
    );
    expect(state.written).toHaveLength(1);
  });
  it("rejects a wrongly sized native response without creating a file", async () => {
    await expect(shareRecapCard(card(260, 462) as unknown as Svg)).rejects.toThrow(
      "Unexpected export dimensions",
    );
    expect(state.created).toEqual([]);
    expect(state.share).not.toHaveBeenCalled();
  });
  it("cleans only expired generated filenames, leaving unrelated/recent files alone", () => {
    const now = 200_000_000;
    state.entries = ["yariva-week-100.png", `yariva-week-${now}.png`, "personal-photo.png"];
    clearExpiredRecapExports(now);
    expect(state.deleted).toEqual(["yariva-week-100.png"]);
  });

  it("does not render or open a chooser if cancelled during the availability check", async () => {
    const controller = new AbortController();
    let finish!: (available: boolean) => void;
    state.availability.mockReturnValueOnce(new Promise<boolean>(resolve => { finish = resolve; }));
    const svg = card();
    const result = shareRecapCard(svg as unknown as Svg, controller.signal);
    controller.abort();
    finish(true);
    await result;
    expect(svg.toDataURL).not.toHaveBeenCalled();
    expect(state.created).toEqual([]);
    expect(state.share).not.toHaveBeenCalled();
  });

  it("discards a delayed render after cancellation without writing private metrics", async () => {
    const controller = new AbortController();
    let finish!: (base64: string) => void;
    const svg = { toDataURL: vi.fn((callback: (value: string) => void) => { finish = callback; }) };
    const result = shareRecapCard(svg as unknown as Svg, controller.signal);
    await Promise.resolve();
    expect(svg.toDataURL).toHaveBeenCalledOnce();
    controller.abort();
    await result;
    finish(header(1080, 1920));
    expect(state.created).toEqual([]);
    expect(state.written).toEqual([]);
    expect(state.share).not.toHaveBeenCalled();
  });

  it("keeps a handed-off file readable when the native chooser backgrounds the app", async () => {
    const controller = new AbortController();
    state.share.mockImplementationOnce(async () => controller.abort());
    await shareRecapCard(card() as unknown as Svg, controller.signal);
    expect(state.share).toHaveBeenCalledOnce();
    expect(state.deleted).toEqual([]);
  });

  it("rechecks cancellation after the native render callback, before writing", async () => {
    const controller = new AbortController();
    const svg = { toDataURL: (callback: (base64: string) => void) => {
      callback(header(1080, 1920));
      controller.abort();
    } };
    await shareRecapCard(svg as unknown as Svg, controller.signal);
    expect(state.created).toEqual([]);
    expect(state.share).not.toHaveBeenCalled();
  });

  it("times out an unresponsive native renderer without leaving pending timers", async () => {
    vi.useFakeTimers();
    const result = shareRecapCard({ toDataURL: vi.fn() } as unknown as Svg);
    const rejection = expect(result).rejects.toThrow("Card render timed out");
    await vi.advanceTimersByTimeAsync(15_000);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
    expect(state.created).toEqual([]);
    expect(state.share).not.toHaveBeenCalled();
  });

  it("cleans the timeout when the native renderer throws immediately", async () => {
    vi.useFakeTimers();
    const svg = { toDataURL: () => { throw new Error("Native renderer unavailable"); } };
    await expect(shareRecapCard(svg as unknown as Svg)).rejects.toThrow("Native renderer unavailable");
    expect(vi.getTimerCount()).toBe(0);
    expect(state.share).not.toHaveBeenCalled();
  });
});
