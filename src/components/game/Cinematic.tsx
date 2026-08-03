/**
 * Cinematic round effects: spotlight, smoke, lightning, magic portal,
 * emoji rain, victory banner + a goofy voice announcer.
 * Effects are fire-and-forget: `useCinematic()` returns `play(kind, text)`
 * and the `<CinematicLayer />` renders whatever is currently playing.
 */
import { useCallback, useState } from "react";
import { confetti, fireworks } from "./fx";

export type CinematicKind =
  | "spotlight"
  | "smoke"
  | "lightning"
  | "portal"
  | "emoji-rain"
  | "banner"
  | "confetti-cannon"
  | "wheel-explosion";

export interface CinematicEvent {
  id: number;
  kind: CinematicKind;
  text?: string;
  emoji?: string;
}

/** Silly text-to-speech announcer — silently no-ops where unsupported. */
export function announce(text: string, enabled = true) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1.5;
    u.volume = 0.7;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function useCinematic() {
  const [event, setEvent] = useState<CinematicEvent | null>(null);

  const play = useCallback((kind: CinematicKind, text?: string, emoji?: string) => {
    const id = Date.now() + Math.random();
    setEvent({ id, kind, text, emoji });
    if (kind === "confetti-cannon") confetti(140);
    if (kind === "wheel-explosion") fireworks(3);
    window.setTimeout(() => {
      setEvent((cur) => (cur && cur.id === id ? null : cur));
    }, 2400);
  }, []);

  return { event, play };
}

const RAIN = ["🔥", "😂", "😱", "👏", "💀", "❤️", "🎉", "⭐"];

export function CinematicLayer({ event }: { event: CinematicEvent | null }) {
  if (!event) return null;
  const { kind, text, emoji } = event;

  return (
    <div key={event.id} className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {kind === "spotlight" && (
        <div className="spotlight-sweep absolute left-1/2 top-1/2 size-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--neon)_0%,transparent_65%)] opacity-70" />
      )}

      {kind === "smoke" &&
        Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="smoke-rise absolute bottom-0 size-40 rounded-full bg-foreground/20"
            style={{ left: `${8 + i * 13}%`, animationDelay: `${i * 0.12}s` }}
          />
        ))}

      {kind === "lightning" && (
        <>
          <div className="lightning-flash absolute inset-0 bg-foreground/70" />
          <div className="lightning-flash absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-primary blur-[2px]" />
        </>
      )}

      {kind === "portal" && (
        <div className="portal-spin absolute left-1/2 top-1/2 size-[55vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border-8 border-dashed border-primary/70 bg-[conic-gradient(var(--neon),transparent,var(--accent),transparent,var(--neon))] opacity-80 blur-[1px]" />
      )}

      {kind === "emoji-rain" &&
        Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="emoji-rain-drop absolute text-3xl"
            style={{
              left: `${(i * 37) % 100}%`,
              animationDuration: `${2 + ((i * 7) % 10) / 10}s`,
              animationDelay: `${(i % 8) * 0.09}s`,
            }}
          >
            {emoji ?? RAIN[i % RAIN.length]}
          </span>
        ))}

      {(kind === "banner" || kind === "wheel-explosion" || kind === "confetti-cannon") && text && (
        <div className="absolute inset-x-0 top-1/3 flex justify-center px-6">
          <p className="banner-slam glass-strong rounded-3xl px-6 py-4 text-center font-display text-2xl font-black gradient-text">
            {text}
          </p>
        </div>
      )}

      {kind === "spotlight" && text && (
        <div className="absolute inset-x-0 top-1/2 flex justify-center px-6">
          <p className="banner-slam font-display text-3xl font-black neon-text">{text}</p>
        </div>
      )}
    </div>
  );
}

/** Arrow flying between two players during a challenge transfer. */
export function TransferArrow({ from, to }: { from: string; to: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="glass-strong transfer-arrow flex items-center gap-3 rounded-3xl px-5 py-4 text-sm font-black">
        <span>{from}</span>
        <span className="text-2xl">➡️🔥➡️</span>
        <span>{to}</span>
      </div>
    </div>
  );
}