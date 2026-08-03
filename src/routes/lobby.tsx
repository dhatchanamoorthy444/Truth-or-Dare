/** Party browser: quick match, create a party, join by code, public list. */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HostSettings } from "@/components/game/HostSettings";
import {
  DEFAULT_SETTINGS,
  PRESETS,
  type GameSettings,
} from "@/lib/round-engine";
import { toast } from "sonner";
import { Globe, Lock, Users, Zap } from "lucide-react";
import { Shell } from "@/components/game/Shell";
import { supabase } from "@/integrations/supabase/client";
import {
  GAME_MODES,
  AVATAR_CHOICES,
  createParty,
  joinParty,
  quickMatch,
  rankFor,
  randomName,
  updateGuestProfile,
  useProfile,
  type GameMode,
  type Party,
} from "@/lib/multiplayer";
import { THEME_LIST, type ThemeId } from "@/lib/themes";
import { sfx } from "@/components/game/fx";

export const Route = createFileRoute("/lobby")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lobby — Join a Live Truth or Dare Party" },
      {
        name: "description",
        content:
          "Quick match with players worldwide, create a private party for friends, or join by 6-letter code. Ten game modes and five animated worlds.",
      },
      { property: "og:title", content: "Truth or Dare Lobby — Play with anyone" },
      {
        property: "og:description",
        content: "Quick match, private codes, team battles and ranked parties.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LobbyPage,
});

function LobbyPage() {
  const navigate = useNavigate();
  const { user, profile, loading, setProfile } = useProfile();
  const [publicParties, setPublicParties] = useState<Party[]>([]);
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<GameMode>("friends");
  const [theme, setTheme] = useState<ThemeId>("fantasy");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [presetId, setPresetId] = useState("casual");
  const [scenarios, setScenarios] = useState<string[]>(["funny", "friendship"]);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    if (profile) setNick(profile.username);
  }, [profile]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("parties")
        .select("*")
        .eq("visibility", "public")
        .in("status", ["lobby", "playing"])
        .order("created_at", { ascending: false })
        .limit(20);
      setPublicParties(data ?? []);
    };
    void load();
    const t = window.setInterval(load, 6000);
    return () => window.clearInterval(t);
  }, []);

  const go = (partyCode: string) => navigate({ to: "/party/$code", params: { code: partyCode } });

  const guard = async (fn: () => Promise<void>) => {
    if (!user) return;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !profile) {
    return (
      <Shell>
        <p className="mt-20 text-center text-sm text-muted-foreground">Loading your player…</p>
      </Shell>
    );
  }

  const rank = rankFor(profile.rank_points);

  const saveNick = async (username: string) => {
    const updated = await updateGuestProfile(profile.id, { username });
    if (updated) {
      setProfile(updated);
      setNick(updated.username);
      toast.success(`You're now ${updated.username}`);
    }
  };

  return (
    <Shell>
      <div className="glass flex items-center gap-3 rounded-3xl p-4">
        <span className="text-3xl">{profile.avatar}</span>
        <div className="flex-1">
          <p className="font-display text-lg font-black leading-tight">{profile.username}</p>
          <p className="text-[11px] text-muted-foreground">
            {profile.country} · Lv {profile.level} · {rank.emoji} {rank.name} · 🪙 {profile.coins}
          </p>
        </div>
        <span className="rounded-full border border-border/60 px-2 py-1 font-mono text-[10px] text-muted-foreground">
          {profile.player_code}
        </span>
      </div>

      <div className="glass mt-3 space-y-3 rounded-3xl p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Your nickname — no account needed
        </p>
        <div className="flex gap-2">
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            maxLength={20}
            placeholder="Pick a nickname"
            className="flex-1 rounded-2xl bg-secondary/60 px-4 py-3 text-sm outline-none"
          />
          <button
            onClick={() => void saveNick(nick)}
            className="press-3d rounded-2xl bg-primary px-4 text-xs font-black uppercase text-primary-foreground"
          >
            Save
          </button>
          <button
            aria-label="Random nickname"
            onClick={() => void saveNick(randomName())}
            className="press-3d rounded-2xl bg-secondary px-4 text-xs font-black uppercase"
          >
            🎲
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {AVATAR_CHOICES.map((a) => (
            <button
              key={a}
              onClick={async () => {
                const updated = await updateGuestProfile(profile.id, { avatar: a });
                if (updated) setProfile(updated);
              }}
              className={`press-3d rounded-xl px-2 py-1 text-xl transition ${
                profile.avatar === a ? "bg-primary/20 ring-2 ring-primary" : "bg-secondary/50"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() =>
          guard(async () => {
            sfx("spin", true);
            const p = await quickMatch(profile.id, theme);
            await go(p.code);
          })
        }
        disabled={busy}
        className="press-3d neon-glow mt-4 flex w-full items-center justify-center gap-2 rounded-3xl bg-primary py-4 font-display text-base font-black uppercase tracking-widest text-primary-foreground disabled:opacity-60"
      >
        <Zap className="size-5" /> Quick match
      </button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void guard(async () => {
            await joinParty(code, profile.id);
            await go(code.toUpperCase().trim());
          });
        }}
        className="glass mt-3 flex items-center gap-2 rounded-2xl p-2"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="ENTER CODE"
          className="flex-1 bg-transparent px-3 py-2 font-mono text-sm tracking-[0.3em] outline-none placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground"
        />
        <button
          disabled={busy || code.length < 4}
          className="press-3d rounded-xl bg-secondary px-4 py-2.5 text-xs font-bold uppercase disabled:opacity-40"
        >
          Join
        </button>
      </form>

      <h2 className="mt-8 font-display text-xl font-black">Create a party</h2>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {GAME_MODES.filter((m) => m.id !== "solo").map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMode(m.id);
              sfx("tap", true);
            }}
            className={`glass press-3d rounded-2xl p-3 text-left transition ${
              mode === m.id ? "ring-2 ring-primary neon-glow" : ""
            }`}
          >
            <span className="text-xl">{m.emoji}</span>
            <p className="mt-1 text-xs font-bold">{m.label}</p>
            <p className="text-[10px] leading-tight text-muted-foreground">{m.blurb}</p>
          </button>
        ))}
      </div>

      <h3 className="mt-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        World
      </h3>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {THEME_LIST.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={`glass press-3d shrink-0 rounded-2xl px-4 py-3 text-center transition ${
              theme === t.id ? "ring-2 ring-primary neon-glow" : ""
            }`}
          >
            <span className="text-2xl">{t.emoji}</span>
            <p className="mt-1 text-[11px] font-bold">{t.label}</p>
          </button>
        ))}
      </div>

      <div className="glass mt-4 space-y-3 rounded-3xl p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder={`${profile.username}'s party`}
          className="w-full rounded-2xl bg-secondary/60 px-4 py-3 text-sm outline-none"
        />
        <div className="flex gap-2">
          {(["private", "public"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVisibility(v)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold uppercase tracking-widest transition ${
                visibility === v ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground"
              }`}
            >
              {v === "private" ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
              {v}
            </button>
          ))}
        </div>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Max players
          </p>
          <div className="flex flex-wrap gap-2">
            {[2, 4, 6, 8, 10, 12, 16, 20].map((n) => (
              <button
                key={n}
                onClick={() => setMaxPlayers(n)}
                className={`press-3d rounded-xl px-3 py-2 text-xs font-bold transition ${
                  maxPlayers === n
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/60 text-muted-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Game preset
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPresetId(p.id);
                  setSettings((s) => ({
                    ...s,
                    categories: p.categories,
                    difficulty: p.difficulty,
                  }));
                  setTheme(p.theme);
                }}
                title={p.vibe}
                className={`press-3d rounded-xl px-3 py-2 text-[11px] font-bold transition ${
                  presetId === p.id
                    ? "bg-primary text-primary-foreground neon-glow"
                    : "bg-secondary/60 text-muted-foreground"
                }`}
              >
                {p.emoji} {p.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setAdvanced((a) => !a)}
          className="press-3d w-full rounded-2xl bg-secondary/60 py-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground"
        >
          {advanced ? "Hide" : "Show"} host game settings
        </button>
        {advanced && (
          <div className="glass rounded-3xl p-4">
            <HostSettings
              settings={settings}
              scenarios={scenarios}
              onScenarios={setScenarios}
              onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            />
          </div>
        )}

        <button
          disabled={busy}
          onClick={() =>
            guard(async () => {
              const p = await createParty({
                hostId: profile.id,
                name: name || `${profile.username}'s party`,
                mode,
                theme,
                visibility,
                maxPlayers: mode === "couples" ? 2 : maxPlayers,
                preset: presetId,
                settings: settings as unknown as Record<string, unknown>,
              });
              await go(p.code);
            })
          }
          className="press-3d neon-glow w-full rounded-2xl bg-primary py-3 text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-60"
        >
          Create party
        </button>
      </div>

      <h2 className="mt-8 font-display text-xl font-black">Public parties</h2>
      {publicParties.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing live right now — start one and friends can join with your code.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {publicParties.map((p) => (
            <li key={p.id}>
              <button
                onClick={() =>
                  guard(async () => {
                    await joinParty(p.code, profile.id);
                    await go(p.code);
                  })
                }
                className="glass press-3d flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
              >
                <span className="text-2xl">{THEME_LIST.find((t) => t.id === p.theme)?.emoji ?? "🎲"}</span>
                <span className="flex-1">
                  <span className="block text-sm font-bold">{p.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {p.mode} · round {p.round} · {p.status}
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Users className="size-3.5" /> {p.max_players}
                </span>
                <span className="font-mono text-[11px]">{p.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}