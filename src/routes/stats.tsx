import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/game/Shell";
import { ACHIEVEMENTS, useGame } from "@/lib/game-store";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Scoreboard & Stats — Truth or Dare" },
      {
        name: "description",
        content:
          "Live scoreboard, XP, streak counter, achievement badges and the full challenge history of your Truth or Dare sessions.",
      },
      { property: "og:title", content: "Scoreboard & Stats — Truth or Dare" },
      {
        property: "og:description",
        content: "Track XP, streaks, badges and every challenge your squad completed.",
      },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  const { state } = useGame();
  const ranked = [...state.players].sort((a, b) => b.score - a.score);
  const completed = state.history.filter((h) => h.result === "completed").length;
  const skipped = state.history.length - completed;

  return (
    <Shell>
      <h1 className="font-display text-3xl font-black">
        Score<span className="gradient-text">board</span>
      </h1>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          ["XP", state.xp],
          ["Streak", `${state.streak}d`],
          ["Done", completed],
          ["Skipped", skipped],
        ].map(([l, v]) => (
          <div key={String(l)} className="glass rounded-2xl px-2 py-3 text-center">
            <p className="font-display text-lg font-bold">{v}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>

      <ul className="mt-5 space-y-2">
        {ranked.map((p, i) => (
          <li key={p.id} className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
            <span
              className={`font-display text-lg font-black ${i === 0 ? "neon-text" : "text-muted-foreground"}`}
            >
              #{i + 1}
            </span>
            <span className="text-xl">{p.emoji}</span>
            <span className="flex-1 text-sm font-bold">{p.name}</span>
            <span className="font-display text-lg font-bold">{p.score}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 font-display text-lg font-bold">Achievements</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = state.achievements.includes(a.id);
          return (
            <div
              key={a.id}
              className={`glass rounded-2xl p-3 text-center ${unlocked ? "neon-glow" : "opacity-45"}`}
            >
              <span className="text-2xl">{a.emoji}</span>
              <p className="mt-1 text-xs font-bold">{a.label}</p>
              <p className="text-[10px] text-muted-foreground">{a.hint}</p>
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 font-display text-lg font-bold">Challenge history</h2>
      {state.history.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing yet — go play a round.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {state.history.map((h) => (
            <li key={h.id} className="glass rounded-2xl px-4 py-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold">
                  {h.player} · {h.type}
                </span>
                <span className={h.result === "completed" ? "text-truth" : "text-dare"}>
                  {h.result}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">{h.text}</p>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}