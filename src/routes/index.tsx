import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Gift, Sparkles, Zap } from "lucide-react";
import { Shell } from "@/components/game/Shell";
import { useGame } from "@/lib/game-store";
import { CATEGORIES, CATEGORY_META, CHALLENGE_COUNTS, DIFFICULTIES } from "@/lib/content";
import { confetti, sfx, vibrate } from "@/components/game/fx";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Truth or Dare — Neon Party Game" },
      {
        name: "description",
        content:
          "A viral-style Truth or Dare game with 2000+ challenges, spin wheel, XP, streaks and neon animations. No login, works offline.",
      },
      { property: "og:title", content: "Truth or Dare — Neon Party Game" },
      {
        property: "og:description",
        content:
          "2000+ truths and dares, spin wheel, streaks, XP and confetti. Play instantly, no login required.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { state, setSettings, claimDaily } = useGame();
  const { settings, xp, streak, dailyClaimed, sampleId } = state;
  const canClaim = dailyClaimed !== new Date().toDateString();

  return (
    <Shell>
      <section className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          {sampleId} · Guest mode
        </p>
        <h1 className="mt-3 font-display text-5xl font-black leading-[0.95] sm:text-6xl">
          <span className="gradient-text">TRUTH</span>
          <span className="block text-foreground/40">or</span>
          <span className="neon-text">DARE</span>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
          {CHALLENGE_COUNTS.truth.toLocaleString()} truths ·{" "}
          {CHALLENGE_COUNTS.dare.toLocaleString()} dares · never repeated until the deck runs dry.
        </p>

        <Link
          to="/play"
          onClick={() => {
            sfx("flip", settings.sound);
            vibrate(20, settings.haptics);
          }}
          className="press-3d neon-glow mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-10 py-4 font-display text-base font-black uppercase tracking-widest text-primary-foreground"
        >
          <Sparkles className="size-5" /> Start playing
        </Link>
      </section>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { icon: Zap, label: "XP", value: xp },
          { icon: Flame, label: "Streak", value: `${streak}d` },
          { icon: Sparkles, label: "Players", value: state.players.length },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass rounded-2xl px-3 py-4 text-center">
            <Icon className="mx-auto size-4 text-primary" />
            <p className="mt-1 font-display text-xl font-bold">{value}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          if (!canClaim) return;
          claimDaily();
          confetti(90);
          sfx("win", settings.sound);
          vibrate([15, 40, 15], settings.haptics);
        }}
        disabled={!canClaim}
        className="glass press-3d mt-3 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left disabled:opacity-60"
      >
        <span className="flex items-center gap-3">
          <Gift className="size-5 text-primary" />
          <span>
            <span className="block text-sm font-semibold">Daily reward</span>
            <span className="block text-xs text-muted-foreground">
              {canClaim ? "+50 XP waiting for you" : "Claimed — come back tomorrow"}
            </span>
          </span>
        </span>
        <span className="font-display text-xs font-bold uppercase tracking-widest text-primary">
          {canClaim ? "Claim" : "Done"}
        </span>
      </button>

      <h2 className="mt-8 font-display text-lg font-bold">Game mode</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CATEGORIES.map((c) => {
          const meta = CATEGORY_META[c];
          const locked = meta.adult && !settings.adult;
          const active = settings.category === c;
          return (
            <button
              key={c}
              onClick={() => {
                if (locked) return;
                setSettings({ category: c });
                sfx("tap", settings.sound);
              }}
              className={`glass press-3d rounded-2xl px-3 py-4 text-left transition ${
                active ? "neon-glow border-primary/50" : ""
              } ${locked ? "opacity-40" : ""}`}
            >
              <span className="text-2xl">{meta.emoji}</span>
              <p className="mt-1 font-display text-sm font-bold">{meta.label}</p>
              <p className="text-[11px] text-muted-foreground">
                {locked ? "Enable 18+ below" : meta.blurb}
              </p>
            </button>
          );
        })}
      </div>

      <h2 className="mt-8 font-display text-lg font-bold">Difficulty</h2>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {(["any", ...DIFFICULTIES] as const).map((d) => (
          <button
            key={d}
            onClick={() => {
              setSettings({ difficulty: d });
              sfx("tap", settings.sound);
            }}
            className={`glass press-3d rounded-xl py-2.5 text-[11px] font-bold uppercase tracking-wider ${
              settings.difficulty === d ? "neon-glow text-primary" : "text-muted-foreground"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="glass mt-8 space-y-3 rounded-2xl p-4">
        {[
          { key: "adult" as const, label: "Adult 18+ content", hint: "Unlocks the spicy deck" },
          { key: "punishments" as const, label: "Punishment mode", hint: "Skipping has a price" },
          { key: "rewards" as const, label: "Reward mode", hint: "Bonus perks on completion" },
          { key: "haptics" as const, label: "Vibration", hint: "Haptic feedback on mobile" },
          { key: "music" as const, label: "Background music", hint: "Soft ambient loop" },
        ].map(({ key, label, hint }) => (
          <label key={key} className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-[11px] text-muted-foreground">{hint}</span>
            </span>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) => setSettings({ [key]: e.target.checked })}
              className="peer sr-only"
            />
            <span className="relative h-6 w-11 shrink-0 rounded-full bg-secondary transition peer-checked:bg-primary peer-checked:shadow-[0_0_16px_var(--neon)]">
              <span
                className={`absolute top-1 size-4 rounded-full bg-background transition-all ${
                  settings[key] ? "left-6" : "left-1"
                }`}
              />
            </span>
          </label>
        ))}

        <label className="flex items-center justify-between gap-3 pt-1">
          <span className="text-sm font-semibold">Timer</span>
          <select
            value={settings.timer}
            onChange={(e) => setSettings({ timer: Number(e.target.value) })}
            className="rounded-xl border border-border bg-secondary/60 px-3 py-1.5 text-sm"
          >
            {[0, 15, 30, 45, 60].map((t) => (
              <option key={t} value={t}>
                {t === 0 ? "Off" : `${t}s`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Language</span>
          <select
            value={settings.language}
            onChange={(e) => setSettings({ language: e.target.value })}
            className="rounded-xl border border-border bg-secondary/60 px-3 py-1.5 text-sm"
          >
            {[
              ["en", "English"],
              ["es", "Español"],
              ["fr", "Français"],
              ["de", "Deutsch"],
              ["hi", "हिन्दी"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Shell>
  );
}
