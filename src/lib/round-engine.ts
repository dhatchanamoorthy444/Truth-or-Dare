/**
 * Round engine: host game settings, party presets, question category filters,
 * the secret imposter / mystery box / lucky save / secret mission mechanics.
 *
 * Everything here is pure data + pure functions — the party route drives the
 * state machine and writes results to the shared party row so all clients see
 * exactly the same round.
 */
import { CHALLENGES, type Category, type Challenge, type Difficulty } from "./content";
import type { ThemeId } from "./themes";

/* ------------------------------ settings ------------------------------ */

export type WheelMode = "random" | "imposter" | "host" | "mixed";
export type RepeatMode = "never" | "allow" | "random";
export type DifficultySetting = Difficulty | "mixed";

export interface GameSettings {
  imposter: boolean;
  transfers: boolean;
  wheelMode: WheelMode;
  difficulty: DifficultySetting;
  repeat: RepeatMode;
  /** 0 means unlimited. */
  turnSeconds: number;
  punishments: boolean;
  voting: boolean;
  /** percent 0-50 */
  mysteryChance: number;
  /** percent 0-20 */
  luckyChance: number;
  /** -1 means unlimited skips. */
  skips: number;
  doubleDare: boolean;
  categories: Category[];
}

export const DEFAULT_SETTINGS: GameSettings = {
  imposter: true,
  transfers: true,
  wheelMode: "mixed",
  difficulty: "mixed",
  repeat: "never",
  turnSeconds: 45,
  punishments: true,
  voting: false,
  mysteryChance: 20,
  luckyChance: 10,
  skips: 1,
  doubleDare: true,
  categories: ["friends", "funny", "party"],
};

export const TURN_OPTIONS = [15, 30, 60, 90, 0] as const;
export const SKIP_OPTIONS = [0, 1, 2, -1] as const;
export const MYSTERY_OPTIONS = [0, 10, 20, 30, 50] as const;
export const LUCKY_OPTIONS = [0, 5, 10, 20] as const;
export const WHEEL_MODES: { id: WheelMode; label: string }[] = [
  { id: "random", label: "Random only" },
  { id: "imposter", label: "Imposter chooses" },
  { id: "host", label: "Host chooses" },
  { id: "mixed", label: "Mixed mode" },
];
export const REPEAT_MODES: { id: RepeatMode; label: string }[] = [
  { id: "never", label: "Never repeat" },
  { id: "allow", label: "Allow repeats" },
  { id: "random", label: "Random mode" },
];
export const DIFFICULTY_SETTINGS: { id: DifficultySetting; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
  { id: "crazy", label: "Extreme" },
  { id: "mixed", label: "Mixed" },
];

export function normalizeSettings(raw: unknown): GameSettings {
  const s = (raw ?? {}) as Partial<GameSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    categories:
      Array.isArray(s.categories) && s.categories.length
        ? s.categories
        : DEFAULT_SETTINGS.categories,
  };
}

/* ------------------------------- presets ------------------------------- */

export interface Preset {
  id: string;
  label: string;
  emoji: string;
  theme: ThemeId;
  categories: Category[];
  difficulty: DifficultySetting;
  /** Cinematic accent used for the round intro of this preset. */
  vibe: string;
}

export const PRESETS: Preset[] = [
  { id: "casual", label: "Casual Party", emoji: "🎉", theme: "fantasy", categories: ["friends", "party"], difficulty: "easy", vibe: "Lights up, good vibes only" },
  { id: "funny", label: "Funny Night", emoji: "😂", theme: "fantasy", categories: ["funny", "friends"], difficulty: "medium", vibe: "Comedy hour, no mercy" },
  { id: "couples", label: "Couples", emoji: "❤️", theme: "fantasy", categories: ["couples", "romantic"], difficulty: "medium", vibe: "Just the two of you" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧", theme: "fantasy", categories: ["family", "kids"], difficulty: "easy", vibe: "Living-room safe" },
  { id: "extreme", label: "Extreme", emoji: "🔥", theme: "warfare", categories: ["extreme", "party"], difficulty: "crazy", vibe: "No backing out" },
  { id: "college", label: "College", emoji: "🎓", theme: "cyber", categories: ["party", "friends", "funny"], difficulty: "hard", vibe: "Dorm-room chaos" },
  { id: "horror", label: "Horror Night", emoji: "👻", theme: "horror", categories: ["extreme", "friends"], difficulty: "hard", vibe: "Something is breathing" },
  { id: "fantasy", label: "Fantasy Adventure", emoji: "🧙", theme: "fantasy", categories: ["friends", "party"], difficulty: "medium", vibe: "Quests and dragons" },
  { id: "space", label: "Space Mission", emoji: "🚀", theme: "space", categories: ["friends", "funny"], difficulty: "medium", vibe: "Zero gravity dares" },
  { id: "agent", label: "Secret Agent", emoji: "🕵", theme: "cyber", categories: ["friends", "extreme"], difficulty: "hard", vibe: "Classified missions" },
  { id: "pirate", label: "Pirate Party", emoji: "🏴", theme: "warfare", categories: ["party", "funny"], difficulty: "medium", vibe: "Plunder and punishment" },
  { id: "cyberpunk", label: "Cyberpunk", emoji: "🤖", theme: "cyber", categories: ["party", "extreme"], difficulty: "hard", vibe: "Neon and noise" },
  { id: "beach", label: "Beach Party", emoji: "🏝", theme: "space", categories: ["party", "romantic", "funny"], difficulty: "easy", vibe: "Sun, sand, dares" },
  { id: "christmas", label: "Christmas", emoji: "🎄", theme: "warfare", categories: ["family", "funny"], difficulty: "easy", vibe: "Cosy chaos" },
  { id: "halloween", label: "Halloween", emoji: "🎃", theme: "horror", categories: ["funny", "extreme"], difficulty: "medium", vibe: "Trick or dare" },
  { id: "dragon", label: "Dragon Kingdom", emoji: "🐉", theme: "fantasy", categories: ["party", "extreme"], difficulty: "hard", vibe: "Face the wyrm" },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[0]!;

/* --------------------------- question scenarios --------------------------- */

/** Host-facing scenario chips, each mapped onto the underlying prompt banks. */
export const SCENARIOS: { id: string; label: string; emoji: string; categories: Category[]; adult?: boolean }[] = [
  { id: "funny", label: "Funny", emoji: "😂", categories: ["funny"] },
  { id: "embarrassing", label: "Embarrassing", emoji: "🙈", categories: ["party", "friends"] },
  { id: "romantic", label: "Romantic", emoji: "🌹", categories: ["romantic"] },
  { id: "adventure", label: "Adventure", emoji: "🧭", categories: ["extreme"] },
  { id: "school", label: "School", emoji: "🏫", categories: ["kids", "friends"] },
  { id: "college", label: "College", emoji: "🎓", categories: ["party", "friends"] },
  { id: "office", label: "Office", emoji: "💼", categories: ["friends"] },
  { id: "gaming", label: "Gaming", emoji: "🎮", categories: ["funny", "party"] },
  { id: "movies", label: "Movies", emoji: "🎬", categories: ["funny"] },
  { id: "anime", label: "Anime", emoji: "🍥", categories: ["funny", "kids"] },
  { id: "travel", label: "Travel", emoji: "✈️", categories: ["friends"] },
  { id: "food", label: "Food", emoji: "🍕", categories: ["kids", "funny"] },
  { id: "friendship", label: "Friendship", emoji: "🤝", categories: ["friends"] },
  { id: "personal", label: "Personal", emoji: "🫀", categories: ["friends", "romantic"] },
  { id: "relationship", label: "Relationship", emoji: "💞", categories: ["couples"] },
  { id: "family", label: "Family Friendly", emoji: "🏡", categories: ["family", "kids"] },
  { id: "adult", label: "18+", emoji: "🔞", categories: ["adult"], adult: true },
  { id: "custom", label: "Custom", emoji: "✨", categories: ["custom"] },
];

export function categoriesForScenarios(ids: string[]): Category[] {
  const out = new Set<Category>();
  ids.forEach((id) => SCENARIOS.find((s) => s.id === id)?.categories.forEach((c) => out.add(c)));
  return out.size ? [...out] : ["friends"];
}

/* ------------------------------ challenges ------------------------------ */

export function pickChallenge(
  type: "truth" | "dare",
  settings: GameSettings,
  used: string[],
): Challenge | null {
  const cats = new Set(settings.categories);
  let pool = CHALLENGES.filter((c) => c.type === type && cats.has(c.category));
  if (!pool.length) pool = CHALLENGES.filter((c) => c.type === type);

  if (settings.difficulty !== "mixed") {
    const byDiff = pool.filter((c) => c.difficulty === settings.difficulty);
    if (byDiff.length) pool = byDiff;
  }

  const noRepeat =
    settings.repeat === "never" || (settings.repeat === "random" && Math.random() < 0.5);
  if (noRepeat) {
    const usedSet = new Set(used);
    const fresh = pool.filter((c) => !usedSet.has(c.id));
    if (fresh.length) pool = fresh;
  }

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

/* ------------------------------ mystery box ------------------------------ */

export type MysteryId =
  | "double-dare"
  | "reverse-dare"
  | "truth-for-everyone"
  | "random-punishment"
  | "bonus-coins"
  | "secret-mission"
  | "shield-card"
  | "swap-player"
  | "extra-spin"
  | "golden-reward";

export interface MysteryOutcome {
  id: MysteryId;
  label: string;
  emoji: string;
  blurb: string;
  /** Bonus points added when the challenge is completed. */
  bonus: number;
}

export const MYSTERY_OUTCOMES: MysteryOutcome[] = [
  { id: "double-dare", label: "Double Dare", emoji: "🔥", blurb: "Two dares back to back — double the reward.", bonus: 25 },
  { id: "reverse-dare", label: "Reverse Dare", emoji: "🔄", blurb: "The challenge bounces back to the player who watched you hardest.", bonus: 10 },
  { id: "truth-for-everyone", label: "Truth for Everyone", emoji: "🗣️", blurb: "The whole room answers this truth out loud.", bonus: 15 },
  { id: "random-punishment", label: "Random Punishment", emoji: "⚡", blurb: "Fate picks a punishment — no way out.", bonus: 5 },
  { id: "bonus-coins", label: "Bonus Coins", emoji: "🪙", blurb: "Instant coin drop, no strings attached.", bonus: 20 },
  { id: "secret-mission", label: "Secret Mission", emoji: "🕵", blurb: "A hidden objective only you can see.", bonus: 30 },
  { id: "shield-card", label: "Shield Card", emoji: "🛡️", blurb: "You bank one free skip for later.", bonus: 10 },
  { id: "swap-player", label: "Swap Player", emoji: "🔀", blurb: "Swap the spotlight with a random player.", bonus: 10 },
  { id: "extra-spin", label: "Extra Spin", emoji: "🎡", blurb: "The wheel spins one more time right after this.", bonus: 15 },
  { id: "golden-reward", label: "Golden Reward", emoji: "🏆", blurb: "Complete this and take triple points.", bonus: 50 },
];

export const rollMystery = (chance: number) =>
  Math.random() * 100 < chance
    ? MYSTERY_OUTCOMES[Math.floor(Math.random() * MYSTERY_OUTCOMES.length)]!
    : null;

export const rollLuckySave = (chance: number) => Math.random() * 100 < chance;

/* ----------------------------- secret missions ----------------------------- */

export const SECRET_MISSIONS = [
  "Make someone in the room laugh out loud.",
  "Get another player to vote for you.",
  "Complete your dare without smiling once.",
  "Finish your challenge before the timer hits zero.",
  "Convince another player to skip their turn.",
  "Say the word 'banana' without anyone noticing.",
  "Get two players to react with 🔥 during your turn.",
  "Compliment every player before your next turn.",
  "Speak only in questions for one full round.",
  "Get someone to copy one of your gestures.",
];

export const randomMission = () =>
  SECRET_MISSIONS[Math.floor(Math.random() * SECRET_MISSIONS.length)]!;

/* --------------------------------- phases --------------------------------- */

export type RoundPhase =
  | "idle"
  | "countdown"
  | "imposter"
  | "victim"
  | "challenge"
  | "recap";

export const pickRandom = <T,>(list: T[]): T | null =>
  list.length ? list[Math.floor(Math.random() * list.length)]! : null;