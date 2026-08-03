import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Clock, Dices, RotateCcw, Share2, SkipForward } from "lucide-react";
import { Shell } from "@/components/game/Shell";
import { SpinWheel } from "@/components/game/SpinWheel";
import { confetti, fireworks, sfx, vibrate } from "@/components/game/fx";
import { useGame, type Player } from "@/lib/game-store";
import {
  CATEGORY_META,
  CHALLENGES,
  PUNISHMENTS,
  REWARDS,
  type Challenge,
  type ChallengeType,
} from "@/lib/content";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Play Truth or Dare — Spin, Reveal, Complete" },
      {
        name: "description",
        content:
          "Spin the player wheel, flip a truth or dare card, beat the timer and rack up XP with confetti and fireworks.",
      },
      { property: "og:title", content: "Play Truth or Dare" },
      {
        property: "og:description",
        content: "Spin the wheel, flip the card, beat the timer and collect XP.",
      },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { state, record, resetUsed } = useGame();
  const { settings, players, usedChallengeIds } = state;
  const [active, setActive] = useState<Player | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);

  const pool = useMemo(() => {
    const custom = state.customPrompts.map<Challenge>((c) => ({
      id: c.id,
      text: c.text,
      type: c.type,
      category: "custom",
      difficulty: "medium",
    }));
    const source = settings.category === "custom" ? custom : CHALLENGES;
    return source.filter(
      (c) =>
        (settings.category === "custom" || c.category === settings.category) &&
        (settings.difficulty === "any" || c.difficulty === settings.difficulty),
    );
  }, [settings.category, settings.difficulty, state.customPrompts]);

  const draw = useCallback(
    (type: ChallengeType) => {
      const used = new Set(usedChallengeIds);
      let candidates = pool.filter((c) => c.type === type && !used.has(c.id));
      if (!candidates.length) {
        resetUsed();
        candidates = pool.filter((c) => c.type === type);
      }
      if (!candidates.length) {
        setBanner("No challenges in this mode yet — add custom prompts on your profile.");
        return;
      }
      const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
      setChallenge(pick);
      setFlipped(true);
      setSeconds(settings.timer);
      setBanner(null);
      sfx("flip", settings.sound);
      vibrate(25, settings.haptics);
    },
    [pool, usedChallengeIds, resetUsed, settings.timer, settings.sound, settings.haptics],
  );

  useEffect(() => {
    if (!flipped || seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [flipped, seconds]);

  function finish(result: "completed" | "skipped") {
    if (!challenge || !active) return;
    record(
      { player: active.name, type: challenge.type, text: challenge.text, result },
      challenge.id,
      active.id,
    );
    if (result === "completed") {
      fireworks(3);
      confetti(110);
      sfx("win", settings.sound);
      vibrate([20, 40, 20], settings.haptics);
      setBanner(
        settings.rewards
          ? `🏆 Reward: ${REWARDS[Math.floor(Math.random() * REWARDS.length)]}`
          : `🏆 +${challenge.type === "dare" ? 25 : 15} XP for ${active.name}`,
      );
    } else {
      sfx("skip", settings.sound);
      vibrate(40, settings.haptics);
      setBanner(
        settings.punishments
          ? `😈 Punishment: ${PUNISHMENTS[Math.floor(Math.random() * PUNISHMENTS.length)]}`
          : `⏭️ ${active.name} skipped`,
      );
    }
    setFlipped(false);
    setChallenge(null);
  }

  async function share() {
    const text = `I'm playing Truth or Dare (${state.sampleId}) — ${state.xp} XP, ${state.streak}-day streak!`;
    try {
      if (navigator.share) await navigator.share({ title: "Truth or Dare", text });
      else {
        await navigator.clipboard.writeText(text);
        setBanner("Result copied to clipboard!");
      }
    } catch {
      /* user dismissed the share sheet */
    }
  }

  const remaining = pool.filter((c) => !usedChallengeIds.includes(c.id)).length;

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            {CATEGORY_META[settings.category].emoji} {CATEGORY_META[settings.category].label} ·{" "}
            {settings.difficulty}
          </p>
          <h1 className="font-display text-2xl font-black">
            {active ? `${active.emoji} ${active.name}'s turn` : "Pick a player"}
          </h1>
        </div>
        <span className="glass rounded-full px-3 py-1 text-[11px] text-muted-foreground">
          {remaining} left
        </span>
      </div>

      <AnimatePresence mode="wait">
        {!active ? (
          <motion.div
            key="wheel"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            className="glass rounded-3xl p-6"
          >
            {players.length ? (
              <SpinWheel
                players={players}
                sound={settings.sound}
                haptics={settings.haptics}
                onPick={(p) => {
                  setActive(p);
                  confetti(60);
                }}
              />
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Add players first on the Players tab.
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
          >
            <div className="[perspective:1400px]">
              <div
                className="flip-3d relative h-72 w-full"
                style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              >
                <div className="glass-strong backface-hidden absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl p-6 text-center">
                  <Dices className="size-10 text-primary" />
                  <p className="font-display text-xl font-bold">Choose your fate</p>
                  <div className="flex w-full gap-3">
                    <button
                      onClick={() => draw("truth")}
                      className="press-3d flex-1 rounded-2xl bg-truth/90 py-4 font-display text-sm font-black uppercase tracking-widest text-background shadow-[0_0_28px_color-mix(in_oklab,var(--truth)_45%,transparent)]"
                    >
                      Truth
                    </button>
                    <button
                      onClick={() => draw("dare")}
                      className="press-3d flex-1 rounded-2xl bg-dare/90 py-4 font-display text-sm font-black uppercase tracking-widest text-background shadow-[0_0_28px_color-mix(in_oklab,var(--dare)_45%,transparent)]"
                    >
                      Dare
                    </button>
                  </div>
                </div>

                <div
                  className="glass-strong backface-hidden absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl p-6 text-center"
                  style={{ transform: "rotateY(180deg)" }}
                >
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] ${
                      challenge?.type === "dare" ? "bg-dare/20 text-dare" : "bg-truth/20 text-truth"
                    }`}
                  >
                    {challenge?.type} · {challenge?.difficulty}
                  </span>
                  <p className="font-display text-lg font-bold leading-snug">
                    {challenge?.text.replace("{p}", active.name)}
                  </p>
                  {settings.timer > 0 && (
                    <p
                      className={`flex items-center gap-1.5 font-mono text-sm ${
                        seconds <= 5 ? "text-dare" : "text-muted-foreground"
                      }`}
                    >
                      <Clock className="size-4" /> {seconds}s
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => finish("completed")}
                disabled={!flipped}
                className="press-3d neon-glow flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-display text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
              >
                <Check className="size-4" /> Complete
              </button>
              <button
                onClick={() => finish("skipped")}
                disabled={!flipped}
                className="glass press-3d flex items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-sm font-black uppercase tracking-widest disabled:opacity-40"
              >
                <SkipForward className="size-4" /> Skip
              </button>
            </div>

            <div className="mt-3 flex gap-3">
              <button
                onClick={() => {
                  setActive(null);
                  setChallenge(null);
                  setFlipped(false);
                }}
                className="glass press-3d flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
              >
                <RotateCcw className="size-4" /> Next player
              </button>
              <button
                onClick={share}
                className="glass press-3d flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
              >
                <Share2 className="size-4" /> Share
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {banner && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass mt-4 rounded-2xl px-4 py-3 text-center text-sm font-semibold"
          >
            {banner}
          </motion.p>
        )}
      </AnimatePresence>

      {state.history.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">Recent rounds</h2>
          <ul className="mt-3 space-y-2">
            {state.history.slice(0, 6).map((h) => (
              <li key={h.id} className="glass rounded-2xl px-4 py-3 text-xs">
                <span className="font-bold">{h.player}</span>{" "}
                <span className={h.result === "completed" ? "text-truth" : "text-muted-foreground"}>
                  {h.result}
                </span>{" "}
                a {h.type}
                <p className="mt-1 text-muted-foreground">{h.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}
