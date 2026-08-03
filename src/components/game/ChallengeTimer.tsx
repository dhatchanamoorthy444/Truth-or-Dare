/** Large animated challenge countdown with a progress ring + warning sounds. */
import { useEffect, useRef } from "react";
import { sfx, vibrate } from "./fx";

export function ChallengeTimer({
  secondsLeft,
  totalSeconds,
  sound = true,
}: {
  secondsLeft: number;
  totalSeconds: number;
  sound?: boolean;
}) {
  const warned = useRef<number | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    if (secondsLeft <= 10 && warned.current !== secondsLeft) {
      warned.current = secondsLeft;
      sfx("tap", sound);
      if (secondsLeft <= 3) vibrate(40, true);
    }
  }, [secondsLeft, sound]);

  const pct = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const danger = secondsLeft <= 10;

  return (
    <div className="relative mx-auto mt-4 size-32">
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="8" className="stroke-secondary/50" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className={danger ? "stroke-dare" : "stroke-primary"}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: circumference * (1 - pct),
            transition: "stroke-dashoffset 0.5s linear",
            filter: "drop-shadow(0 0 8px var(--neon))",
          }}
        />
      </svg>
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center font-display font-black ${
          danger ? "text-dare pulse" : ""
        }`}
      >
        <span className="text-2xl tabular-nums">
          {mins}:{secs.toString().padStart(2, "0")}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">left</span>
      </div>
    </div>
  );
}