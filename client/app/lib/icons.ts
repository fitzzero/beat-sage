/**
 * Icon enum for all available icons in the application.
 * Maps icon names to their public asset paths.
 */
export const Icons = {
  ALBUM: "/icons/album.svg",
  BOOK_SPARKLES: "/icons/book-sparkles.svg",
  CARET_DOWN: "/icons/caret-down.svg",
  CARET_LEFT: "/icons/caret-left.svg",
  CARET_RIGHT: "/icons/caret-right.svg",
  CARET_UP: "/icons/caret-up.svg",
  CAULDRON: "/icons/cauldron.svg",
  CHEVRON_RIGHT: "/icons/chevron-right.svg",
  DIAL_HIGH: "/icons/dial-high.svg",
  DIAL_LOW: "/icons/dial-low.svg",
  DIAL_MAX: "/icons/dial-max.svg",
  DIAL_MED: "/icons/dial-med.svg",
  DIAL_MED_LOW: "/icons/dial-med-low.svg",
  DIAL_MIN: "/icons/dial-min.svg",
  DIAL_OFF: "/icons/dial-off.svg",
  DOWN: "/icons/down.svg",
  DRUM: "/icons/drum.svg",
  FLASK_ROUND_POTION: "/icons/flask-round-potion.svg",
  GUITAR: "/icons/guitar.svg",
  HAT_WIZARD: "/icons/hat-wizard.svg",
  HEART: "/icons/heart.svg",
  LEFT: "/icons/left.svg",
  LOCATION_DOT: "/icons/location-dot.svg",
  MAP: "/icons/map.svg",
  MUSIC: "/icons/music.svg",
  PIANO: "/icons/piano.svg",
  PLAY: "/icons/play.svg",
  RIGHT: "/icons/right.svg",
  SAXOPHONE: "/icons/saxophone.svg",
  SCROLL: "/icons/scroll.svg",
  SLIDERS: "/icons/sliders.svg",
  SPARKLE: "/icons/sparkle.svg",
  STAR: "/icons/star.svg",
  SWORD: "/icons/sword.svg",
  TRUMPET: "/icons/trumpet.svg",
  UP: "/icons/up.svg",
  WAND_MAGIC: "/icons/wand-magic.svg",
  WAVEFORM: "/icons/waveform.svg",
} as const;

/**
 * Type for icon keys
 */
export type IconKey = keyof typeof Icons;

/**
 * Helper function to get icon path by key
 */
export function getIconPath(key: IconKey): string {
  return Icons[key];
}

/**
 * Helper function to get all available icons
 */
export function getAllIcons(): Record<IconKey, string> {
  return Icons;
}
