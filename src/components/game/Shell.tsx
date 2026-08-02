/** Shared app chrome: animated backdrop, top bar, bottom nav, theme handling. */
import { Link, useRouterState } from "@tanstack/react-router";
import { Dices, Home, Trophy, Users, User, Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { AnimatedBackground } from "./AnimatedBackground";
import { useGame } from "@/lib/game-store";
import { sfx, toggleMusic } from "./fx";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/play", label: "Play", icon: Dices },
  { to: "/players", label: "Players", icon: Users },
  { to: "/stats", label: "Stats", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const { state, setSettings } = useGame();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, sound, music } = state.settings;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    toggleMusic(music);
    return () => toggleMusic(false);
  }, [music]);

  return (
    <div className="relative flex min-h-screen flex-col">
      <AnimatedBackground />

      <header className="sticky top-0 z-30 px-4 pt-4">
        <div className="glass mx-auto flex max-w-3xl items-center justify-between rounded-2xl px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl">🎲</span>
            <span className="font-display text-sm font-bold tracking-tight gradient-text">
              TRUTH / DARE
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <span className="mr-1 hidden rounded-full border border-border/60 px-2 py-1 font-mono text-[10px] text-muted-foreground sm:inline">
              {state.sampleId}
            </span>
            <button
              aria-label="Toggle sound"
              onClick={() => {
                setSettings({ sound: !sound });
                sfx("tap", !sound);
              }}
              className="rounded-xl p-2 text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
            >
              {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </button>
            <button
              aria-label="Toggle theme"
              onClick={() => setSettings({ theme: theme === "dark" ? "light" : "dark" })}
              className="rounded-xl p-2 text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      <main key={pathname} className="pop-in mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4">
        <div className="glass mx-auto flex max-w-3xl items-center justify-between rounded-2xl p-1.5">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => sfx("tap", sound)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold transition ${
                  active
                    ? "bg-primary/15 text-primary neon-text"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-[18px]" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}