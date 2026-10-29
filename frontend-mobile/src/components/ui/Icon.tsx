import { Ionicons } from "@expo/vector-icons";
import React from "react";
import type { ColorValue, StyleProp, TextStyle } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

// One icon family for the entire app. The mapping intentionally follows the
// shared Ionicons approach used in mobile_app_v3: each semantic icon has a
// matched outline and filled form so screens cannot drift into mixed styles.
export type IconName =
  | "bookmark"
  | "arrowLeft"
  | "user"
  | "personAdd"
  | "people"
  | "mail"
  | "lock"
  | "eye"
  | "eyeOff"
  | "calendar"
  | "chevronDown"
  | "chevronRight"
  | "heart"
  | "heartFill"
  | "spark"
  | "sparkle"
  | "shield"
  | "compass"
  | "chat"
  | "bell"
  | "profile"
  | "check"
  | "settings"
  | "search"
  | "cafe"
  | "restaurant"
  | "send"
  | "plus"
  | "close"
  | "x"
  | "phone"
  | "video"
  | "location"
  | "pin"
  | "filter"
  | "rewind"
  | "star"
  | "more"
  | "flag"
  | "block"
  | "globe"
  | "phoneOff"
  | "micOff"
  | "mic"
  | "speaker"
  | "paperclip"
  | "smile"
  | "clock"
  | "warning"
  | "edit"
  | "image"
  | "camera"
  | "wifi"
  | "device"
  | "logout"
  | "leaf"
  | "moon"
  | "bolt"
  | "wine"
  | "cigarette"
  | "dumbbell"
  | "paw"
  | "trash"
  | "arrowUp"
  | "arrowDown"
  | "music"
  | "cameraReverse"
  | "play"
  | "pause";

type IoniconName = keyof typeof Ionicons.glyphMap;

type IconSpec = {
  outline: IoniconName;
  solid?: IoniconName;
};

const ICONS: Record<IconName, IconSpec> = {
  bookmark: { outline: "bookmark-outline", solid: "bookmark" },
  arrowLeft: { outline: "arrow-back" },
  user: { outline: "person-outline", solid: "person" },
  personAdd: { outline: "person-add-outline", solid: "person-add" },
  people: { outline: "people-outline", solid: "people" },
  mail: { outline: "mail-outline", solid: "mail" },
  lock: { outline: "lock-closed-outline", solid: "lock-closed" },
  eye: { outline: "eye-outline", solid: "eye" },
  eyeOff: { outline: "eye-off-outline" },
  calendar: { outline: "calendar-outline", solid: "calendar" },
  chevronDown: { outline: "chevron-down" },
  chevronRight: { outline: "chevron-forward" },
  heart: { outline: "heart-outline", solid: "heart" },
  heartFill: { outline: "heart", solid: "heart" },
  spark: { outline: "sparkles-outline", solid: "sparkles" },
  sparkle: { outline: "sparkles-outline", solid: "sparkles" },
  shield: { outline: "shield-outline", solid: "shield" },
  compass: { outline: "compass-outline", solid: "compass" },
  chat: { outline: "chatbubble-outline", solid: "chatbubble" },
  bell: { outline: "notifications-outline", solid: "notifications" },
  profile: { outline: "person-outline", solid: "person" },
  check: { outline: "checkmark" },
  settings: { outline: "settings-outline", solid: "settings" },
  search: { outline: "search-outline" },
  cafe: { outline: "cafe-outline", solid: "cafe" },
  restaurant: { outline: "restaurant-outline", solid: "restaurant" },
  send: { outline: "send-outline", solid: "send" },
  plus: { outline: "add" },
  close: { outline: "close" },
  x: { outline: "close" },
  phone: { outline: "call-outline", solid: "call" },
  video: { outline: "videocam-outline", solid: "videocam" },
  location: { outline: "location-outline", solid: "location" },
  pin: { outline: "location-outline", solid: "location" },
  filter: { outline: "options-outline" },
  rewind: { outline: "arrow-undo-outline" },
  star: { outline: "star-outline", solid: "star" },
  more: { outline: "ellipsis-horizontal" },
  flag: { outline: "flag-outline", solid: "flag" },
  block: { outline: "ban-outline", solid: "ban" },
  globe: { outline: "globe-outline", solid: "globe" },
  phoneOff: { outline: "call-outline" },
  micOff: { outline: "mic-off-outline" },
  mic: { outline: "mic-outline", solid: "mic" },
  speaker: { outline: "volume-high-outline", solid: "volume-high" },
  paperclip: { outline: "attach-outline" },
  smile: { outline: "happy-outline", solid: "happy" },
  clock: { outline: "time-outline", solid: "time" },
  warning: { outline: "warning-outline", solid: "warning" },
  edit: { outline: "create-outline", solid: "create" },
  image: { outline: "image-outline", solid: "image" },
  camera: { outline: "camera-outline", solid: "camera" },
  wifi: { outline: "wifi-outline" },
  device: { outline: "phone-portrait-outline", solid: "phone-portrait" },
  logout: { outline: "log-out-outline" },
  leaf: { outline: "leaf-outline", solid: "leaf" },
  moon: { outline: "moon-outline", solid: "moon" },
  bolt: { outline: "flash-outline", solid: "flash" },
  wine: { outline: "wine-outline", solid: "wine" },
  cigarette: { outline: "flame-outline" },
  dumbbell: { outline: "barbell-outline", solid: "barbell" },
  paw: { outline: "paw-outline", solid: "paw" },
  trash: { outline: "trash-outline", solid: "trash" },
  arrowUp: { outline: "arrow-up" },
  arrowDown: { outline: "arrow-down" },
  music: { outline: "musical-notes-outline", solid: "musical-notes" },
  cameraReverse: { outline: "camera-reverse-outline", solid: "camera-reverse" },
  play: { outline: "play", solid: "play" },
  pause: { outline: "pause", solid: "pause" },
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
  /** Kept for source compatibility; Ionicons supplies the optical weight. */
  strokeWidth?: number;
  /** Select the matched solid glyph for tabs and selected controls. */
  filled?: boolean;
  style?: StyleProp<TextStyle>;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 22,
  color,
  strokeWidth: _strokeWidth,
  filled = false,
  style,
}) => {
  const { palette } = useTheme();
  const spec = ICONS[name];
  const shouldFill = filled || name === "heartFill";
  const glyph = shouldFill && spec.solid ? spec.solid : spec.outline;

  return <Ionicons name={glyph} size={size} color={color ?? palette.textPrimary} style={style} />;
};
