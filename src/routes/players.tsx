import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2, X, Check } from "lucide-react";
import { Shell } from "@/components/game/Shell";
import { useGame } from "@/lib/game-store";
import { sfx } from "@/components/game/fx";

export const Route = createFileRoute("/players")({
  head: () => ({
    meta: [
      { title: "Players — Truth or Dare Squad Setup" },
      {
        name: "description",
        content:
          "Add unlimited players, rename or remove them, and see live scores. Everything is saved on your device.",
      },
      { property: "og:title", content: "Players — Truth or Dare" },
      {
        property: "og:description",
        content: "Build your squad: add, edit and remove players instantly.",
      },
    ],
  }),
  component: PlayersPage,
});

function PlayersPage() {
  const { state, addPlayer, renamePlayer, removePlayer, resetScores } = useGame();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <Shell>
      <h1 className="font-display text-3xl font-black">
        Your <span className="gradient-text">squad</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {state.players.length} players · saved automatically on this device.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          addPlayer(n);
          setName("");
          sfx("tap", state.settings.sound);
        }}
        className="glass mt-5 flex items-center gap-2 rounded-2xl p-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a player…"
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          className="press-3d neon-glow rounded-xl bg-primary p-2.5 text-primary-foreground"
          aria-label="Add player"
        >
          <Plus className="size-4" />
        </button>
      </form>

      <ul className="mt-4 space-y-2">
        {state.players.map((p) => (
          <li key={p.id} className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
            <span className="text-2xl">{p.emoji}</span>
            {editing === p.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="flex-1 rounded-lg bg-secondary/60 px-2 py-1 text-sm outline-none"
              />
            ) : (
              <span className="flex-1">
                <span className="block text-sm font-bold">{p.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {p.score} done · {p.truths}T / {p.dares}D · {p.skips} skips
                </span>
              </span>
            )}
            {editing === p.id ? (
              <>
                <button
                  onClick={() => {
                    if (draft.trim()) renamePlayer(p.id, draft.trim());
                    setEditing(null);
                  }}
                  className="rounded-lg p-2 text-truth"
                  aria-label="Save name"
                >
                  <Check className="size-4" />
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg p-2 text-muted-foreground"
                  aria-label="Cancel"
                >
                  <X className="size-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setEditing(p.id);
                    setDraft(p.name);
                  }}
                  className="rounded-lg p-2 text-muted-foreground transition hover:text-foreground"
                  aria-label={`Edit ${p.name}`}
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => removePlayer(p.id)}
                  className="rounded-lg p-2 text-muted-foreground transition hover:text-destructive"
                  aria-label={`Remove ${p.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <button
        onClick={resetScores}
        className="glass press-3d mt-5 w-full rounded-2xl py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground"
      >
        Reset scores & history
      </button>
    </Shell>
  );
}