/**
 * 🎡 Regret Roulette — the premium, room-synchronised victim wheel.
 *
 * Every client renders the exact same spin: the controller (host or imposter)
 * writes a `spin` payload onto the party row and all clients animate towards
 * the same segment, so nobody can desync or fake a result.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useAnimation } from "motion/react";
import { confetti, crowdCheer, sfx, suspense, vibrate } from "./fx";

export interface RoulettePlayer {
  id: string;
  name: string;
  emoji: string;
}

export interface SpinPayload {
  /** index into the ordered player list */
  index: number;
  /** ms timestamp — also the de-dupe key so a spin never replays twice */
  at: number;
  /** who triggered it */
  by: string;
  ids: string[];
}

const SEGMENT_COLORS = ["var(--neon)", "var(--accent)", "var(--dare)", "var(--truth)"];
export const SPIN_MS = 4600;

export function RegretRoulette({
  players,
  spin,
  canSpin,
  onSpin,
  onSettled,
  sound = true,
  haptics = true,
}: {
  players: RoulettePlayer[];
  spin: SpinPayload | null;
  canSpin: boolean;
  onSpin: () => void;
  /** Only the controller should commit the result. */
  onSettled?: ((playerId: string) => void) | undefined;
  sound?: boolean;
  haptics?: boolean;
}) {
  const controls = useAnimation();
  const [spinning, setSpinning] = useState(false);
  const angleRef = useRef(0);
  const lastSpin = useRef<number>(0);
  const n = Math.max(players.length, 1);
  const seg = 360 / n;

  const gradient = `conic-gradient(${players
    .map(
      (_, i) => `${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} ${i * seg}deg ${(i + 1) * seg}deg`,
    )
    .join(", ")})`;

  useEffect(() => {
    if (!spin || spin.at === lastSpin.current) return;
    lastSpin.current = spin.at;
    const index = Math.min(Math.max(spin.index, 0), n - 1);
    const target = angleRef.current + 360 * 6 + (360 - (index * seg + seg / 2)) - (angleRef.current % 360);
    angleRef.current = target;
    setSpinning(true);
    sfx("spin", sound);
    suspense(true);
    vibrate([10, 40, 10, 40, 10], haptics);

    void controls
      .start({ rotate: target, transition: { duration: SPIN_MS / 1000, ease: [0.12, 0.72, 0.08, 1] } })
      .then(() => {
        setSpinning(false);
        suspense(false);
        crowdCheer(sound);
        confetti(90);
        vibrate(80, haptics);
        const picked = players[index];
        if (picked && onSettled) onSettled(picked.id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin?.at]);

  return (
    <div className="flex flex-col items-center gap-5">
      <motion.div
        animate={{ scale: spinning ? 1.06 : 1 }}
        transition={{ duration: 0.8 }}
        className="relative"
      >
        {/* spotlight + glow */}
        <div
          className={`pointer-events-none absolute -inset-16 rounded-full bg-[radial-gradient(circle,var(--neon)_0%,transparent_65%)] transition-opacity duration-700 ${
            spinning ? "opacity-45" : "opacity-15"
          }`}
        />
        {/* orbiting particles */}
        {spinning &&
          Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="portal-spin pointer-events-none absolute left-1/2 top-1/2 size-1.5 rounded-full bg-primary"
              style={{
                transform: `rotate(${i * 36}deg) translateX(${140 + (i % 3) * 12}px)`,
                animationDuration: `${1.4 + (i % 4) * 0.25}s`,
              }}
            />
          ))}

        <div className="absolute -top-2 left-1/2 z-10 size-0 -translate-x-1/2 border-x-[11px] border-t-[20px] border-x-transparent border-t-primary drop-shadow-[0_0_12px_var(--neon)]" />
        <motion.div
          animate={controls}
          className="size-64 rounded-full border-4 border-glass-border neon-glow sm:size-80"
          style={{ background: gradient }}
        >
          {players.map((p, i) => (
            <span
              key={p.id}
              className="absolute left-1/2 top-1/2 origin-left truncate text-[11px] font-black text-background"
              style={{ transform: `rotate(${i * seg + seg / 2}deg) translateX(48px)`, maxWidth: 90 }}
            >
              {p.emoji} {p.name}
            </span>
          ))}
        </motion.div>
        <div className="glass-strong absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-2xl">
          🎡
        </div>
      </motion.div>

      <p className="font-display text-sm font-black uppercase tracking-[0.28em] text-primary neon-text">
        {spinning ? "Regret Roulette spinning…" : "🎡 Regret Roulette"}
      </p>

      {canSpin ? (
        <button
          onClick={onSpin}
          disabled={spinning || players.length < 2}
          className="press-3d neon-glow rounded-2xl bg-primary px-8 py-3 font-display text-sm font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-60"
        >
          {spinning ? "Spinning…" : "Spin the roulette"}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">
          {spinning ? "Hold your breath…" : "Waiting for the spin…"}
        </p>
      )}
    </div>
  );
}