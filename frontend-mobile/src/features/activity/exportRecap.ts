import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type Svg from "react-native-svg";
import { RECAP_EXPORT } from "./recapLogic";
import { recapPngSize } from "./pngHeader";

const exportDirectory = () => new Directory(Paths.cache, "yariva-recap-exports");

/** Only generated files in this dedicated cache are eligible for TTL cleanup. */
export const clearExpiredRecapExports = (now = Date.now()) => {
  const directory = exportDirectory();
  if (!directory.exists) return;
  for (const entry of directory.list()) {
    if (entry instanceof File && /^yariva-week-\d+\.png$/.test(entry.name)) {
      const timestamp = Number(entry.name.match(/\d+/)?.[0]);
      if (timestamp < now - RECAP_EXPORT.cacheLifetimeMs) entry.delete();
    }
  }
};

export const shareRecapCard = async (card: Svg): Promise<void> => {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing unavailable");
  clearExpiredRecapExports();
  const base64 = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Card render timed out")), 15_000);
    card.toDataURL(
      (value) => {
        clearTimeout(timeout);
        value ? resolve(value) : reject(new Error("Empty card render"));
      },
      { width: RECAP_EXPORT.width, height: RECAP_EXPORT.height },
    );
  });
  const actual = recapPngSize(base64);
  if (actual.width !== RECAP_EXPORT.width || actual.height !== RECAP_EXPORT.height)
    throw new Error("Unexpected export dimensions");
  const directory = exportDirectory();
  directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, `yariva-week-${Date.now()}.png`);
  file.create();
  file.write(base64, { encoding: "base64" });
  // Do not delete on chooser dismissal: receiving apps may read asynchronously.
  // App-private export cache is pruned after 24h on the next recap visit/export.
  await Sharing.shareAsync(file.uri, {
    mimeType: "image/png",
    UTI: "public.png",
    dialogTitle: "Share your Yariva week",
  });
};
