/** Animated gradient mesh + floating particle field (pure CSS, GPU friendly). */
import { useMemo } from "react";

export function AnimatedBackground() {
  const particles = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: (i * 37) % 100,
        size: 4 + ((i * 13) % 14),
        delay: (i * 0.9) % 18,
        duration: 16 + ((i * 7) % 14),
        hue: i % 3,
      })),
    [],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute -left-1/4 -top-1/3 h-[80vh] w-[80vw] rounded-full opacity-60 blur-[90px]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--neon) 60%, transparent), transparent 70%)",
          animation: "gradient-drift 18s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -right-1/4 top-1/4 h-[70vh] w-[70vw] rounded-full opacity-50 blur-[90px]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--accent) 60%, transparent), transparent 70%)",
          animation: "gradient-drift 24s ease-in-out infinite reverse",
        }}
      />
      <div
        className="absolute bottom-0 left-1/4 h-[60vh] w-[60vw] rounded-full opacity-40 blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--dare) 55%, transparent), transparent 70%)",
          animation: "gradient-drift 30s ease-in-out infinite",
        }}
      />
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute bottom-[-10vh] rounded-full"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background:
              p.hue === 0
                ? "var(--neon)"
                : p.hue === 1
                  ? "var(--accent)"
                  : "var(--dare)",
            opacity: 0.5,
            filter: "blur(0.5px)",
            boxShadow: "0 0 12px currentColor",
            animation: `float-up ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}