/**
 * Pick a recognizable emoji for a channel, purely for display in pickers.
 * Nothing is stored — this maps a Discord channel name to an icon on the fly.
 *
 * Exact-name overrides win first; otherwise a keyword heuristic keeps new or
 * renamed channels sensible. Falls back to a generic chat bubble.
 */
const EXACT: Record<string, string> = {
  announcements: "📢",
  events: "📅",
  hardware: "🔧",
  "andrei-fun": "🎮",
  "robot-ideas-and-sketches": "💡",
  sustenability: "🌱",
  sustainability: "🌱",
  branding: "🎨",
  printing: "🖨️",
  pagination: "📄",
  resources: "📚",
  documentation: "📖",
  "robot-bobocus": "🤖",
};

// [substring, emoji] — checked in order, first match wins.
const KEYWORDS: [string, string][] = [
  ["announce", "📢"],
  ["event", "📅"],
  ["idea", "💡"],
  ["sketch", "💡"],
  ["robot", "🤖"],
  ["hardware", "🔧"],
  ["print", "🖨️"],
  ["brand", "🎨"],
  ["design", "🎨"],
  ["susten", "🌱"],
  ["sustain", "🌱"],
  ["eco", "🌱"],
  ["doc", "📖"],
  ["resource", "📚"],
  ["fun", "🎮"],
  ["game", "🎮"],
  ["general", "💬"],
  ["chat", "💬"],
  ["voice", "🔊"],
  ["music", "🎵"],
  ["vote", "🗳️"],
  ["rule", "📜"],
];

export function channelEmoji(name: string): string {
  const key = name.toLowerCase();
  if (EXACT[key]) return EXACT[key];
  for (const [needle, emoji] of KEYWORDS) {
    if (key.includes(needle)) return emoji;
  }
  return "💬";
}
