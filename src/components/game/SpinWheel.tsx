/** Random player picker wheel with an easing spin animation. */
import { useState } from "react";
import { motion, useAnimation } from "motion/react";
import type { Player } from "@/lib/game-store";
import { sfx, vibrate } from "./fx";

const SEGMENT_COLORS = [
  "var(--neon)",
  "var(--accent)",
  "var(--dare)",
  "var(--truth)",
];

export function SpinWheel({
  players,
  onPick,
  sound,
  haptics,
}: {
  players: Player[];
  onPick: (p: Player) => void;
  sound: boolean;
  haptics: boolean;
}) {
  const controls = useAnimation();
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const n = Math.max(players.length, 1);
  const seg = 360 / n;

  const gradient = `conic-gradient(${players
    .map(
      (_, i) =>
        `${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} ${i * seg}deg ${(i + 1) * seg}deg`,
    )
    .join(", ")})`;

  async function spin() {
    if (spinning || !players.length) return;
    setSpinning(true);
    sfx("spin", sound);
    vibrate([10, 40, 10], haptics);
    const index = Math.floor(Math.random() * players.length);
    const target = angle + 360 * 5 + (360 - (index * seg + seg / 2));
    setAngle(target);
    await controls.start({
      rotate: target,
      transition: { duration: 3.4, ease: [0.15, 0.85, 0.15, 1] },
    });
    setSpinning(false);
    sfx("win", sound);
    vibrate(60, haptics);
    onPick(players[index]!);
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        <div className="absolute -top-2 left-1/2 z-10 size-0 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-primary drop-shadow-[0_0_10px_var(--neon)]" />
        <motion.div
          animate={controls}
          className="size-64 rounded-full border-4 border-glass-border neon-glow sm:size-72"
          style={{ background: gradient }}
        >
          {players.map((p, i) => (
            <span
              key={p.id}
              className="absolute left-1/2 top-1/2 origin-left text-xs font-bold text-background"
              style={{
                transform: `rotate(${i * seg + seg / 2}deg) translateX(46px)`,
              }}
            >
              {p.emoji} {p.name}
            </span>
          ))}
        </motion.div>
        <div className="glass absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-2xl">
          🎯
        </div>
      </div>
      <button
        onClick={spin}
        disabled={spinning}
        className="press-3d neon-glow rounded-2xl bg-primary px-8 py-3 font-display text-sm font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-60"
      >
        {spinning ? "Spinning…" : "Spin the wheel"}
      </button>
    </div>
  );
}