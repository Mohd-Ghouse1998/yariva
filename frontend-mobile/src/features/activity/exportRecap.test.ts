import { beforeEach, describe, expect, it, vi } from "vitest";
import type Svg from "react-native-svg";

const state = vi.hoisted(() => ({
  available: true,
  share: vi.fn(),
  created: [] as string[],
  written: [] as string[],
  deleted: [] as string[],
  entries: [] as string[],
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: async () => state.available,
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
  state.share.mockReset();
  state.created = [];
  state.written = [];
  state.deleted = [];
  state.entries = [];
});
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
});
