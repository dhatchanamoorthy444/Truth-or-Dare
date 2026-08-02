/**
 * Global game state, persisted entirely to Local Storage.
 * No database, no login — the app generates a Sample ID on first visit.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category, ChallengeType, Difficulty } from "./content";

const KEY = "truthordare.state.v1";

export interface Player {
  id: string;
  name: string;
  emoji: string;
  score: number;
  truths: number;
  dares: number;
  skips: number;
}

export interface HistoryEntry {
  id: string;
  player: string;
  type: ChallengeType;
  text: string;
  result: "completed" | "skipped";
  at: number;
}

export interface GameState {
  sampleId: string;
  guest: boolean;
  players: Player[];
  usedChallengeIds: string[];
  history: HistoryEntry[];
  xp: number;
  streak: number;
  lastPlayed: string | null;
  dailyClaimed: string | null;
  achievements: string[];
  customPrompts: { id: string; text: string; type: ChallengeType }[];
  settings: {
    theme: "dark" | "light";
    sound: boolean;
    music: boolean;
    haptics: boolean;
    adult: boolean;
    timer: number;
    category: Category;
    difficulty: Difficulty | "any";
    language: string;
    punishments: boolean;
    rewards: boolean;
  };
}

const EMOJIS = ["🦊", "🐼", "🦄", "🐯", "🐨", "🐸", "🦁", "🐧", "🐺", "🦉"];
const DEFAULT_NAMES = [
  "Alex",
  "Emma",
  "John",
  "Sophia",
  "David",
  "Mia",
  "Ethan",
  "Olivia",
];

export const newSampleId = () =>
  `TD-${Math.floor(100000 + Math.random() * 900000)}`;

export const makePlayer = (name: string, i = 0): Player => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name,
  emoji: EMOJIS[i % EMOJIS.length] ?? "🎲",
  score: 0,
  truths: 0,
  dares: 0,
  skips: 0,
});

export const defaultState = (): GameState => ({
  sampleId: newSampleId(),
  guest: true,
  players: DEFAULT_NAMES.map((n, i) => makePlayer(n, i)),
  usedChallengeIds: [],
  history: [],
  xp: 0,
  streak: 0,
  lastPlayed: null,
  dailyClaimed: null,
  achievements: [],
  customPrompts: [],
  settings: {
    theme: "dark",
    sound: true,
    music: false,
    haptics: true,
    adult: false,
    timer: 30,
    category: "friends",
    difficulty: "any",
    language: "en",
    punishments: true,
    rewards: true,
  },
});

export const ACHIEVEMENTS: { id: string; label: string; emoji: string; hint: string }[] =
  [
    { id: "first", label: "First Blood", emoji: "🎬", hint: "Finish 1 challenge" },
    { id: "ten", label: "Warmed Up", emoji: "🔥", hint: "Finish 10 challenges" },
    { id: "fifty", label: "Unstoppable", emoji: "⚡", hint: "Finish 50 challenges" },
    { id: "truthteller", label: "Truth Teller", emoji: "🗣️", hint: "20 truths" },
    { id: "daredevil", label: "Daredevil", emoji: "😈", hint: "20 dares" },
    { id: "streak3", label: "On A Roll", emoji: "📆", hint: "3-day streak" },
    { id: "xp500", label: "XP Hunter", emoji: "💎", hint: "Reach 500 XP" },
    { id: "crew", label: "Full House", emoji: "👥", hint: "Play with 6+ players" },
  ];

function load(): GameState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as GameState;
    const base = defaultState();
    return { ...base, ...parsed, settings: { ...base.settings, ...parsed.settings } };
  } catch {
    return defaultState();
  }
}

const listeners = new Set<(s: GameState) => void>();
let current: GameState | null = null;

function setState(updater: (s: GameState) => GameState) {
  const next = updater(current ?? load());
  current = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or unavailable — game still works in memory */
  }
  listeners.forEach((l) => l(next));
}

/** Subscribe to the persisted game state. Hydration-safe. */
export function useGame() {
  const [state, setLocal] = useState<GameState | null>(current);

  useEffect(() => {
    if (!current) current = load();
    setLocal(current);
    const l = (s: GameState) => setLocal(s);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const update = useCallback(
    (u: (s: GameState) => GameState) => setState(u),
    [],
  );

  const ready = state !== null;
  const value = state ?? defaultState();

  const api = useMemo(
    () => ({
      addPlayer: (name: string) =>
        update((s) => ({
          ...s,
          players: [...s.players, makePlayer(name, s.players.length)],
        })),
      renamePlayer: (id: string, name: string) =>
        update((s) => ({
          ...s,
          players: s.players.map((p) => (p.id === id ? { ...p, name } : p)),
        })),
      removePlayer: (id: string) =>
        update((s) => ({ ...s, players: s.players.filter((p) => p.id !== id) })),
      resetScores: () =>
        update((s) => ({
          ...s,
          players: s.players.map((p) => ({
            ...p,
            score: 0,
            truths: 0,
            dares: 0,
            skips: 0,
          })),
          history: [],
          usedChallengeIds: [],
        })),
      setSettings: (patch: Partial<GameState["settings"]>) =>
        update((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
      newId: () => update((s) => ({ ...s, sampleId: newSampleId() })),
      claimDaily: () =>
        update((s) => ({
          ...s,
          dailyClaimed: new Date().toDateString(),
          xp: s.xp + 50,
        })),
      record: (
        entry: Omit<HistoryEntry, "id" | "at">,
        challengeId: string,
        playerId: string,
      ) =>
        update((s) => {
          const today = new Date().toDateString();
          const yesterday = new Date(Date.now() - 864e5).toDateString();
          const completed = entry.result === "completed";
          const gain = completed ? (entry.type === "dare" ? 25 : 15) : 0;
          const players = s.players.map((p) =>
            p.id === playerId
              ? {
                  ...p,
                  score: p.score + (completed ? 1 : 0),
                  truths: p.truths + (completed && entry.type === "truth" ? 1 : 0),
                  dares: p.dares + (completed && entry.type === "dare" ? 1 : 0),
                  skips: p.skips + (completed ? 0 : 1),
                }
              : p,
          );
          const history = [
            { ...entry, id: `${Date.now()}`, at: Date.now() },
            ...s.history,
          ].slice(0, 200);
          const streak =
            s.lastPlayed === today
              ? s.streak
              : s.lastPlayed === yesterday
                ? s.streak + 1
                : 1;
          const xp = s.xp + gain;
          const done = history.filter((h) => h.result === "completed").length;
          const truths = history.filter(
            (h) => h.result === "completed" && h.type === "truth",
          ).length;
          const dares = history.filter(
            (h) => h.result === "completed" && h.type === "dare",
          ).length;
          const earned = new Set(s.achievements);
          if (done >= 1) earned.add("first");
          if (done >= 10) earned.add("ten");
          if (done >= 50) earned.add("fifty");
          if (truths >= 20) earned.add("truthteller");
          if (dares >= 20) earned.add("daredevil");
          if (streak >= 3) earned.add("streak3");
          if (xp >= 500) earned.add("xp500");
          if (players.length >= 6) earned.add("crew");
          return {
            ...s,
            players,
            history,
            xp,
            streak,
            lastPlayed: today,
            achievements: [...earned],
            usedChallengeIds: [...s.usedChallengeIds, challengeId],
          };
        }),
      resetUsed: () => update((s) => ({ ...s, usedChallengeIds: [] })),
    }),
    [update],
  );

  return { state: value, ready, update, ...api };
}