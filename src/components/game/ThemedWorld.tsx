/**
 * Animated themed world backdrop.
 * Layers: palette-tinted gradient mesh, drifting scenery sprites, a weather
 * system (embers / rain / fog / snow / stars), bloom and a depth vignette.
 * Everything is CSS-animated so it stays smooth on mobile.
 */
import { useMemo } from "react";
import { THEMES, type ThemeId } from "@/lib/themes";

function seeded(i: number, mod: number) {
  return (i * 9301 + 49297) % mod;
}

export function ThemedWorld({ theme, dim = false }: { theme: ThemeId; dim?: boolean }) {
  const world = THEMES[theme];
  const [neon, accent, danger, bg] = world.palette;

  const sprites = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        emoji: world.sprites[i % world.sprites.length]!,
        left: seeded(i + 3, 96),
        top: seeded(i + 11, 80),
        size: 18 + seeded(i, 34),
        delay: seeded(i + 5, 90) / 10,
        duration: 18 + seeded(i + 2, 22),
        blur: i % 4 === 0 ? 2.5 : 0,
        opacity: i % 3 === 0 ? 0.18 : 0.32,
      })),
    [world],
  );

  const drops = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        left: seeded(i + 7, 100),
        delay: seeded(i + 13, 40) / 10,
        duration: 0.7 + seeded(i, 14) / 10,
        size: 6 + seeded(i + 1, 16),
      })),
    [],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: bg }}
    >
      {/* volumetric gradient mesh */}
      <div
        className="absolute -left-1/4 -top-1/3 h-[85vh] w-[85vw] rounded-full blur-[110px]"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, ${neon} 70%, transparent), transparent 70%)`,
          opacity: dim ? 0.35 : 0.6,
          animation: "gradient-drift 20s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -right-1/4 top-1/4 h-[75vh] w-[75vw] rounded-full blur-[110px]"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, ${accent} 65%, transparent), transparent 70%)`,
          opacity: dim ? 0.3 : 0.5,
          animation: "gradient-drift 27s ease-in-out infinite reverse",
        }}
      />
      <div
        className="absolute bottom-[-20vh] left-1/5 h-[65vh] w-[65vw] rounded-full blur-[120px]"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, ${danger} 60%, transparent), transparent 70%)`,
          opacity: dim ? 0.25 : 0.45,
          animation: "gradient-drift 34s ease-in-out infinite",
        }}
      />

      {/* day / night cycle sweep */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, transparent 30%, color-mix(in oklab, ${bg} 85%, transparent))`,
          animation: "day-night 46s ease-in-out infinite",
        }}
      />

      {/* drifting scenery */}
      {sprites.map((s, i) => (
        <span
          key={i}
          className="absolute select-none"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            fontSize: s.size,
            opacity: s.opacity,
            filter: s.blur ? `blur(${s.blur}px)` : undefined,
            animation: `world-drift ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        >
          {s.emoji}
        </span>
      ))}

      {/* weather */}
      {world.weather === "rain" &&
        drops.map((d, i) => (
          <span
            key={`r${i}`}
            className="absolute top-[-12vh] w-px"
            style={{
              left: `${d.left}%`,
              height: d.size * 2,
              background: `linear-gradient(${accent}, transparent)`,
              opacity: 0.5,
              animation: `weather-fall ${d.duration}s linear ${d.delay}s infinite`,
            }}
          />
        ))}

      {world.weather === "snow" &&
        drops.slice(0, 34).map((d, i) => (
          <span
            key={`s${i}`}
            className="absolute top-[-10vh] rounded-full bg-foreground"
            style={{
              left: `${d.left}%`,
              width: d.size / 3,
              height: d.size / 3,
              opacity: 0.55,
              animation: `weather-drift-fall ${d.duration * 6}s linear ${d.delay}s infinite`,
            }}
          />
        ))}

      {world.weather === "embers" &&
        drops.slice(0, 30).map((d, i) => (
          <span
            key={`e${i}`}
            className="absolute bottom-[-10vh] rounded-full"
            style={{
              left: `${d.left}%`,
              width: d.size / 3,
              height: d.size / 3,
              background: danger,
              boxShadow: `0 0 12px ${danger}`,
              opacity: 0.7,
              animation: `float-up ${10 + d.size}s linear ${d.delay}s infinite`,
            }}
          />
        ))}

      {world.weather === "stars" &&
        drops.map((d, i) => (
          <span
            key={`t${i}`}
            className="absolute rounded-full bg-foreground"
            style={{
              left: `${d.left}%`,
              top: `${seeded(i + 21, 100)}%`,
              width: d.size / 5,
              height: d.size / 5,
              animation: `twinkle ${2 + d.duration}s ease-in-out ${d.delay}s infinite`,
            }}
          />
        ))}

      {world.weather === "fog" && (
        <>
          <div
            className="absolute inset-x-[-30%] bottom-0 h-[45vh] blur-3xl"
            style={{
              background: `linear-gradient(0deg, color-mix(in oklab, ${accent} 45%, transparent), transparent)`,
              animation: "fog-roll 26s ease-in-out infinite",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 40%, transparent 18%, color-mix(in oklab, ${bg} 92%, transparent) 72%)`,
              animation: "flicker 6s ease-in-out infinite",
            }}
          />
        </>
      )}

      {/* depth vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 45%, transparent 40%, color-mix(in oklab, ${bg} 80%, transparent) 100%)`,
        }}
      />
    </div>
  );
}
