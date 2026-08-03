/** 🎭 The Truth Teller — cinematic reveal of the player the roulette landed on. */
import { useEffect } from "react";
import { motion } from "motion/react";
import { fireworks, heartbeat, sfx } from "./fx";
import { announce } from "./Cinematic";

export function TruthTellerReveal({
  avatar,
  name,
  playerCode,
  onDone,
  sound = true,
}: {
  avatar: string;
  name: string;
  playerCode: string;
  onDone?: (() => void) | undefined;
  sound?: boolean;
}) {
  useEffect(() => {
    heartbeat(sound);
    sfx("win", sound);
    fireworks(3);
    announce(`The Truth Teller is ${name}`, sound);
    const t = window.setTimeout(() => onDone?.(), 3200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/75 px-6 backdrop-blur-xl">
      <div className="spotlight-sweep absolute left-1/2 top-1/2 size-[85vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--neon)_0%,transparent_62%)] opacity-60" />
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
        className="glass-strong relative rounded-[2rem] px-8 py-8 text-center"
      >
        <p className="font-display text-sm font-black uppercase tracking-[0.35em] text-primary neon-text">
          🎭 The Truth Teller
        </p>
        <motion.span
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ repeat: Infinity, duration: 1.1 }}
          className="mt-4 block text-7xl"
        >
          {avatar}
        </motion.span>
        <h2 className="mt-3 font-display text-3xl font-black gradient-text">{name}</h2>
        <p className="mt-1 font-mono text-xs tracking-[0.2em] text-muted-foreground">{playerCode}</p>
        <p className="mt-4 text-[11px] uppercase tracking-widest text-muted-foreground">
          Everyone watch closely…
        </p>
      </motion.div>
    </div>
  );
}