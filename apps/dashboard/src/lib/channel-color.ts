/**
 * Resolve the accent color for a channel. Admins set an explicit color (stored
 * on the Channel row); when none is set we derive a stable, pleasant default
 * from the channel name so bars aren't all identical out of the box.
 */

// A calm, distinct palette that reads well on both light and dark surfaces.
const DEFAULT_PALETTE = [
  "#3B82F6", // blue
  "#22C55E", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#A855F7", // purple
  "#14B8A6", // teal
  "#EC4899", // pink
  "#F97316", // orange
  "#0EA5E9", // sky
  "#84CC16", // lime
];

function hash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Stable default color for a channel that has no explicit color set. */
export function defaultChannelColor(name: string): string {
  return DEFAULT_PALETTE[hash(name.toLowerCase()) % DEFAULT_PALETTE.length];
}

/** The color to display for a channel: explicit if set, else a stable default. */
export function channelColorOf(c: {
  name: string;
  color?: string | null;
}): string {
  return c.color && /^#[0-9a-fA-F]{6}$/.test(c.color)
    ? c.color
    : defaultChannelColor(c.name);
}
