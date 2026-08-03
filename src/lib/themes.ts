/**
 * Themed animated worlds. Each match happens inside one of these worlds:
 * the palette re-tints the whole UI, sprites drift through the scene and a
 * weather system layers on top. Challenge copy is re-framed per world.
 */
export type ThemeId = "fantasy" | "cyber" | "horror" | "warfare" | "space";

export type Weather = "embers" | "rain" | "fog" | "snow" | "stars";

export interface WorldTheme {
  id: ThemeId;
  label: string;
  emoji: string;
  tagline: string;
  /** How a challenge is announced inside this world. */
  questLabel: string;
  /** Short flavour lines prefixed to a challenge. */
  flavour: string[];
  /** oklch palette: [neon, accent, danger, background] */
  palette: [string, string, string, string];
  /** Drifting scenery emoji. */
  sprites: string[];
  weather: Weather;
  /** Sub-locations shown during the match intro. */
  locations: string[];
}

export const THEMES: Record<ThemeId, WorldTheme> = {
  fantasy: {
    id: "fantasy",
    label: "Fantasy Kingdom",
    emoji: "🐉",
    tagline: "Castles, dragons and floating isles",
    questLabel: "Magical Quest",
    flavour: [
      "The council of elders demands:",
      "A dragon circles overhead and roars:",
      "The wizard's scroll unrolls:",
      "An elf whispers from the floating isle:",
    ],
    palette: [
      "oklch(0.72 0.2 300)",
      "oklch(0.82 0.16 85)",
      "oklch(0.68 0.24 30)",
      "oklch(0.13 0.05 285)",
    ],
    sprites: ["🐉", "🏰", "🧙", "✨", "🗡️", "🧝", "🔮", "🛡️"],
    weather: "embers",
    locations: ["Emberfall Castle", "Floating Isles", "Wyrmspine Peak", "The Moonwell"],
  },
  cyber: {
    id: "cyber",
    label: "Sci-Fi Cyberpunk",
    emoji: "🤖",
    tagline: "Neon city, flying cars, endless rain",
    questLabel: "Hacking Mission",
    flavour: [
      "The mainframe decrypts a task:",
      "A hologram flickers into view:",
      "Your neural implant pings:",
      "The AI broker uploads a contract:",
    ],
    palette: [
      "oklch(0.78 0.2 195)",
      "oklch(0.7 0.28 330)",
      "oklch(0.75 0.22 100)",
      "oklch(0.12 0.05 250)",
    ],
    sprites: ["🤖", "🛸", "🌃", "💾", "📡", "🧬", "⚡", "🕶️"],
    weather: "rain",
    locations: ["Sector 7 Rooftops", "Neon Bazaar", "Data Spire", "The Undergrid"],
  },
  horror: {
    id: "horror",
    label: "Survival Horror",
    emoji: "🧟",
    tagline: "Fog, blood moon and something breathing",
    questLabel: "Survival Mission",
    flavour: [
      "Something shuffles closer. Quick —",
      "The flashlight flickers. You must:",
      "A voice from the vent rasps:",
      "Under the blood moon you are ordered to:",
    ],
    palette: [
      "oklch(0.6 0.24 25)",
      "oklch(0.55 0.12 150)",
      "oklch(0.65 0.2 15)",
      "oklch(0.1 0.02 20)",
    ],
    sprites: ["🧟", "🩸", "🕯️", "🦇", "🚪", "🌕", "⛓️", "🕸️"],
    weather: "fog",
    locations: ["Ward 13", "The Black Forest", "Old Grange House", "Basement Level"],
  },
  warfare: {
    id: "warfare",
    label: "Historical Warfare",
    emoji: "⚔️",
    tagline: "Vikings, samurai and bunker orders",
    questLabel: "Military Mission",
    flavour: [
      "The war council issues orders:",
      "A messenger sprints in with:",
      "Your commander barks:",
      "The battle horn sounds. Your mission:",
    ],
    palette: [
      "oklch(0.7 0.15 60)",
      "oklch(0.6 0.12 145)",
      "oklch(0.62 0.22 30)",
      "oklch(0.14 0.03 70)",
    ],
    sprites: ["⚔️", "🛡️", "🏯", "🐎", "🏹", "🪖", "🔥", "🏰"],
    weather: "snow",
    locations: ["Stonegate Keep", "Fjord Village", "Kyoto Ridge", "Bunker 44"],
  },
  space: {
    id: "space",
    label: "Space Exploration",
    emoji: "🚀",
    tagline: "Mars dust, black holes, zero gravity",
    questLabel: "Zero-G Mission",
    flavour: [
      "Mission control transmits:",
      "The station AI announces:",
      "An alien signal decodes to:",
      "Gravity drops to zero as you must:",
    ],
    palette: [
      "oklch(0.75 0.18 265)",
      "oklch(0.8 0.16 200)",
      "oklch(0.7 0.22 340)",
      "oklch(0.1 0.04 270)",
    ],
    sprites: ["🚀", "🪐", "👽", "🛰️", "🌌", "☄️", "🌑", "🧑‍🚀"],
    weather: "stars",
    locations: ["Tranquility Base", "Olympus Mons", "Kepler-9b", "Event Horizon"],
  },
};

export const THEME_LIST = Object.values(THEMES);

export function themeFlavour(theme: ThemeId, seed: number) {
  const f = THEMES[theme].flavour;
  return f[seed % f.length] ?? f[0]!;
}