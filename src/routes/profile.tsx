import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, RefreshCw, Share2, Trash2 } from "lucide-react";
import { Shell } from "@/components/game/Shell";
import { useGame } from "@/lib/game-store";
import { confetti, sfx } from "@/components/game/fx";
import type { ChallengeType } from "@/lib/content";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Sample ID — Truth or Dare" },
      {
        name: "description",
        content:
          "Your auto-generated Sample ID, XP level, custom prompts and sharing options. No account needed.",
      },
      { property: "og:title", content: "Profile & Sample ID — Truth or Dare" },
      {
        property: "og:description",
        content: "Your Sample ID, XP level and custom prompt deck, stored on your device.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { state, update, newId } = useGame();
  const [text, setText] = useState("");
  const [type, setType] = useState<ChallengeType>("truth");
  const [msg, setMsg] = useState<string | null>(null);
  const level = Math.floor(state.xp / 200) + 1;
  const progress = ((state.xp % 200) / 200) * 100;

  async function share() {
    const line = `Truth or Dare — ${state.sampleId} · Level ${level} · ${state.xp} XP · ${state.streak}-day streak`;
    try {
      if (navigator.share) await navigator.share({ title: "Truth or Dare", text: line });
      else {
        await navigator.clipboard.writeText(line);
        setMsg("Copied to clipboard!");
      }
    } catch {
      /* dismissed */
    }
  }

  return (
    <Shell>
      <section className="glass-strong rounded-3xl p-6 text-center">
        <span className="text-5xl">🎭</span>
        <p className="mt-3 text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
          Sample ID
        </p>
        <p className="neon-text font-mono text-3xl font-bold">{state.sampleId}</p>
        <p className="mt-1 text-xs text-muted-foreground">Guest mode · no login required</p>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Level {level}</span>
            <span className="text-muted-foreground">{state.xp} XP</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary shadow-[0_0_14px_var(--neon)] transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              void navigator.clipboard.writeText(state.sampleId);
              setMsg("Sample ID copied!");
              sfx("tap", state.settings.sound);
            }}
            className="glass press-3d flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest"
          >
            <Copy className="size-3.5" /> Copy ID
          </button>
          <button
            onClick={() => {
              newId();
              confetti(60);
            }}
            className="glass press-3d flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest"
          >
            <RefreshCw className="size-3.5" /> New ID
          </button>
          <button
            onClick={share}
            className="press-3d neon-glow flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground"
          >
            <Share2 className="size-3.5" /> Share
          </button>
        </div>
        {msg && <p className="mt-3 text-xs text-muted-foreground">{msg}</p>}
      </section>

      <h2 className="mt-8 font-display text-lg font-bold">Custom prompts</h2>
      <p className="text-xs text-muted-foreground">
        Used by the Custom game mode. Stored locally with everything else.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          update((s) => ({
            ...s,
            customPrompts: [
              ...s.customPrompts,
              { id: `custom-${Date.now()}`, text: t, type },
            ],
          }));
          setText("");
        }}
        className="glass mt-3 flex items-center gap-2 rounded-2xl p-2"
      >
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ChallengeType)}
          className="rounded-xl bg-secondary/60 px-2 py-2 text-xs font-bold uppercase"
        >
          <option value="truth">Truth</option>
          <option value="dare">Dare</option>
        </select>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your own challenge…"
          className="flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button className="press-3d neon-glow rounded-xl bg-primary px-3 py-2 text-xs font-bold uppercase text-primary-foreground">
          Add
        </button>
      </form>

      <ul className="mt-3 space-y-2">
        {state.customPrompts.map((c) => (
          <li key={c.id} className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                c.type === "dare" ? "bg-dare/20 text-dare" : "bg-truth/20 text-truth"
              }`}
            >
              {c.type}
            </span>
            <span className="flex-1">{c.text}</span>
            <button
              aria-label="Delete prompt"
              onClick={() =>
                update((s) => ({
                  ...s,
                  customPrompts: s.customPrompts.filter((x) => x.id !== c.id),
                }))
              }
              className="text-muted-foreground transition hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </Shell>
  );
}