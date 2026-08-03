/**
 * Live multiplayer party room.
 * Phases: lobby (ready-up, host controls) → intro (world reveal countdown)
 * → playing (turn-based truth/dare with a shared timer) → results.
 * Every client stays in sync through realtime rows on the party record.
 */
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Crown, LogOut, Send, Settings2, ShieldBan, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemedWorld } from "@/components/game/ThemedWorld";
import { SpinWheel } from "@/components/game/SpinWheel";
import { HostSettings } from "@/components/game/HostSettings";
import {
  CinematicLayer,
  TransferArrow,
  announce,
  useCinematic,
} from "@/components/game/Cinematic";
import { confetti, fireworks, sfx, vibrate } from "@/components/game/fx";
import { PUNISHMENTS, REWARDS } from "@/lib/content";
import { THEMES, themeFlavour, type ThemeId } from "@/lib/themes";
import {
  MYSTERY_OUTCOMES,
  SCENARIOS,
  categoriesForScenarios,
  normalizeSettings,
  pickChallenge,
  pickRandom,
  presetById,
  randomMission,
  rollLuckySave,
  rollMystery,
  type GameSettings,
  type MysteryOutcome,
  type RoundPhase,
} from "@/lib/round-engine";
import {
  leaveParty,
  sendMessage,
  useParty,
  useProfile,
  type MemberWithProfile,
} from "@/lib/multiplayer";

export const Route = createFileRoute("/party/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Live Party — Truth or Dare Multiplayer Room" },
      {
        name: "description",
        content:
          "You're in a live Truth or Dare party: take turns, beat the timer, chat with the room and climb the scoreboard in an animated world.",
      },
      { property: "og:title", content: "Join my Truth or Dare party" },
      {
        property: "og:description",
        content: "Live turn-based Truth or Dare with friends and strangers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PartyPage,
});

const EMOJIS = ["🔥", "😂", "😱", "👏", "💀", "❤️"];

type ChallengePayload = {
  text: string;
  second?: string;
  type: "truth" | "dare";
  flavour: string;
  bonus?: number;
};

type Recap = {
  winner: string;
  completed: boolean;
  type: string;
  points: number;
  funniest: string;
  reaction: string;
  votes: number;
  mission: boolean;
};

function PartyPage() {
  const { code } = useParams({ from: "/party/$code" });
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useProfile();
  const { party, members, messages, online, typing, me, loading, missing, broadcastTyping } =
    useParty(code, profile?.id);
  const [chat, setChat] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [now, setNow] = useState(() => Date.now());
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const theme = (party?.theme ?? "fantasy") as ThemeId;
  const world = THEMES[theme];
  const isHost = !!party && !!profile && party.host_id === profile.id;
  const players = useMemo(() => members.filter((m) => !m.spectator), [members]);
  const spectators = useMemo(() => members.filter((m) => m.spectator), [members]);
  const currentPlayer = players.find((p) => p.user_id === party?.current_turn) ?? null;
  const myTurn = !!profile && party?.current_turn === profile.id;
  const challenge = (party?.current_challenge ?? null) as ChallengePayload | null;
  const secondsLeft = party?.turn_ends_at
    ? Math.max(0, Math.ceil((new Date(party.turn_ends_at).getTime() - now) / 1000))
    : null;

  /* ---------- intro countdown, driven by the host ---------- */
  useEffect(() => {
    if (party?.status !== "intro") {
      setCountdown(3);
      return;
    }
    sfx("spin", true);
    const t = window.setInterval(() => setCountdown((c) => c - 1), 1000);
    const done = window.setTimeout(() => {
      if (isHost) void beginFirstTurn();
    }, 3400);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party?.status, isHost]);

  const patchParty = async (patch: Record<string, unknown>) => {
    if (!party) return;
    await supabase
      .from("parties")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", party.id);
  };

  const beginFirstTurn = async () => {
    const first = players[0];
    if (!first) return;
    await patchParty({ status: "playing", current_turn: first.user_id, round: 1 });
  };

  const startMatch = async () => {
    if (players.length < 2) {
      toast.error("You need at least 2 players to start.");
      return;
    }
    sfx("win", true);
    await patchParty({ status: "intro" });
  };

  const drawChallenge = async (type: "truth" | "dare") => {
    if (!party) return;
    const pool = CHALLENGES.filter((c) => c.type === type);
    const picked = pool[Math.floor(Math.random() * pool.length)]!;
    sfx("flip", true);
    vibrate(30, true);
    await patchParty({
      current_challenge: {
        text: picked.text,
        type,
        flavour: themeFlavour(theme, Math.floor(Math.random() * 97)),
      },
      turn_ends_at: new Date(Date.now() + TURN_SECONDS * 1000).toISOString(),
    });
  };

  const resolveTurn = async (completed: boolean) => {
    if (!party || !currentPlayer || !challenge) return;
    const idx = players.findIndex((p) => p.user_id === currentPlayer.user_id);
    const next = players[(idx + 1) % players.length]!;

    if (completed) {
      confetti(90);
      sfx("win", true);
      vibrate([20, 40, 20], true);
      await supabase
        .from("party_members")
        .update({
          score: currentPlayer.score + (challenge.type === "dare" ? 25 : 15),
          truths: currentPlayer.truths + (challenge.type === "truth" ? 1 : 0),
          dares: currentPlayer.dares + (challenge.type === "dare" ? 1 : 0),
        })
        .eq("id", currentPlayer.id);
    } else {
      sfx("skip", true);
    }

    const teamPatch =
      party.team_mode && completed
        ? currentPlayer.team === "red"
          ? { red_score: party.red_score + 1 }
          : { blue_score: party.blue_score + 1 }
        : {};

    await sendMessage(
      party.id,
      currentPlayer.user_id,
      completed
        ? `completed a ${challenge.type} — ${REWARDS[Math.floor(Math.random() * REWARDS.length)]}`
        : `chickened out — ${PUNISHMENTS[Math.floor(Math.random() * PUNISHMENTS.length)]}`,
      "system",
    );

    const finished = party.round >= players.length * 3;
    await patchParty({
      ...teamPatch,
      current_challenge: null,
      turn_ends_at: null,
      current_turn: next.user_id,
      round: party.round + 1,
      status: finished ? "results" : "playing",
    });
    if (finished) fireworks(5);
  };

  const kick = async (member: MemberWithProfile, ban: boolean) => {
    if (!party) return;
    if (ban) await supabase.from("party_bans").insert({ party_id: party.id, user_id: member.user_id });
    await supabase.from("party_members").delete().eq("id", member.id);
  };

  const exit = async () => {
    if (party && profile) await leaveParty(party.id, profile.id, isHost, members);
    await navigate({ to: "/lobby" });
  };

  if (loading || profileLoading) {
    return <Center>Connecting to the party…</Center>;
  }
  if (missing || !party) {
    return (
      <Center>
        <p>That party no longer exists.</p>
        <button
          onClick={() => void navigate({ to: "/lobby" })}
          className="press-3d mt-4 rounded-2xl bg-primary px-5 py-2.5 text-xs font-black uppercase tracking-widest text-primary-foreground"
        >
          Back to lobby
        </button>
      </Center>
    );
  }

  return (
    <div className="relative min-h-screen">
      <ThemedWorld theme={theme} dim={party.status === "playing"} />

      {/* ---------- match intro ---------- */}
      {party.status === "intro" && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background/70 px-6 text-center backdrop-blur-xl">
          <span className="text-7xl">{world.emoji}</span>
          <h2 className="mt-3 font-display text-3xl font-black gradient-text">{world.label}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{world.tagline}</p>
          <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            {world.locations[party.round % world.locations.length]}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {players.map((p) => (
              <span key={p.id} className="glass rounded-2xl px-3 py-2 text-xs font-bold">
                {p.profile?.avatar} {p.profile?.username}
              </span>
            ))}
          </div>
          <p key={countdown} className="countdown-pop mt-8 font-display text-8xl font-black">
            {countdown > 0 ? countdown : "GO"}
          </p>
        </div>
      )}

      <header className="sticky top-0 z-30 px-4 pt-4">
        <div className="glass mx-auto flex max-w-4xl items-center gap-3 rounded-2xl px-4 py-2.5">
          <span className="text-xl">{world.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold">{party.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {party.mode} · round {party.round} · {online.length} online
            </p>
          </div>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(
                `${window.location.origin}/party/${party.code}`,
              );
              toast.success("Invite link copied!");
            }}
            className="rounded-xl bg-secondary/60 px-3 py-1.5 font-mono text-xs tracking-[0.2em]"
          >
            {party.code}
          </button>
          <button onClick={exit} aria-label="Leave party" className="rounded-xl p-2 text-muted-foreground">
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 pb-32 pt-5">
        {party.team_mode && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="glass rounded-2xl p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-dare">🔴 Red</p>
              <p className="font-display text-2xl font-black">{party.red_score}</p>
            </div>
            <div className="glass rounded-2xl p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-truth">🔵 Blue</p>
              <p className="font-display text-2xl font-black">{party.blue_score}</p>
            </div>
          </div>
        )}

        {party.status === "lobby" && (
          <section>
            <h1 className="font-display text-2xl font-black">
              Waiting in <span className="gradient-text">{world.label}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Share code <strong className="font-mono">{party.code}</strong> — up to{" "}
              {party.max_players} players.
            </p>
            {me && (
              <button
                onClick={async () => {
                  sfx("tap", true);
                  await supabase
                    .from("party_members")
                    .update({ ready: !me.ready })
                    .eq("id", me.id);
                }}
                className={`press-3d mt-4 w-full rounded-2xl py-3 text-sm font-black uppercase tracking-widest ${
                  me.ready ? "bg-truth/20 text-truth" : "bg-primary text-primary-foreground neon-glow"
                }`}
              >
                {me.ready ? "Ready ✓" : "I'm ready"}
              </button>
            )}
            {isHost && (
              <button
                onClick={startMatch}
                className="press-3d neon-glow mt-2 w-full rounded-2xl bg-secondary py-3 text-sm font-black uppercase tracking-widest"
              >
                Start match
              </button>
            )}
          </section>
        )}

        {party.status === "playing" && (
          <section className="text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {world.questLabel} · Round {party.round}
            </p>
            <p className="mt-1 font-display text-2xl font-black">
              {currentPlayer?.profile?.avatar} {currentPlayer?.profile?.username}
              <span className="text-muted-foreground">{myTurn ? " — your turn!" : "'s turn"}</span>
            </p>

            {secondsLeft !== null && (
              <div className="mx-auto mt-3 h-2 w-56 overflow-hidden rounded-full bg-secondary/60">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${(secondsLeft / TURN_SECONDS) * 100}%` }}
                />
              </div>
            )}

            {!challenge ? (
              myTurn ? (
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => drawChallenge("truth")}
                    className="press-3d neon-glow rounded-3xl bg-truth/20 py-8 font-display text-xl font-black text-truth"
                  >
                    TRUTH
                  </button>
                  <button
                    onClick={() => drawChallenge("dare")}
                    className="press-3d neon-glow rounded-3xl bg-dare/20 py-8 font-display text-xl font-black text-dare"
                  >
                    DARE
                  </button>
                </div>
              ) : (
                <p className="mt-8 text-sm text-muted-foreground">
                  Waiting for {currentPlayer?.profile?.username} to choose…
                </p>
              )
            ) : (
              <div className="glass-strong pop-in mx-auto mt-6 max-w-xl rounded-3xl p-6">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {challenge.flavour}
                </p>
                <p className="mt-3 font-display text-xl font-black leading-snug">{challenge.text}</p>
                <p className="mt-3 text-xs uppercase tracking-widest text-primary">
                  {challenge.type} · {secondsLeft ?? 0}s left
                </p>
                {myTurn && (
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => resolveTurn(true)}
                      className="press-3d rounded-2xl bg-truth py-3 text-sm font-black uppercase tracking-widest text-background"
                    >
                      Completed
                    </button>
                    <button
                      onClick={() => resolveTurn(false)}
                      className="press-3d rounded-2xl bg-secondary py-3 text-sm font-black uppercase tracking-widest"
                    >
                      Skip
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-center gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    if (profile) void sendMessage(party.id, profile.id, e, "reaction");
                    sfx("tap", true);
                  }}
                  className="glass press-3d rounded-xl px-3 py-2 text-lg"
                >
                  {e}
                </button>
              ))}
            </div>
          </section>
        )}

        {party.status === "results" && (
          <section className="text-center">
            <h1 className="font-display text-3xl font-black gradient-text">Match over!</h1>
            <ol className="mt-4 space-y-2 text-left">
              {[...players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => (
                  <li key={p.id} className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
                    <span className="font-display text-lg font-black text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-2xl">{p.profile?.avatar}</span>
                    <span className="flex-1 text-sm font-bold">{p.profile?.username}</span>
                    <span className="font-display font-black">{p.score}</span>
                  </li>
                ))}
            </ol>
            {isHost && (
              <button
                onClick={() =>
                  patchParty({ status: "lobby", round: 1, red_score: 0, blue_score: 0 })
                }
                className="press-3d neon-glow mt-5 w-full rounded-2xl bg-primary py-3 text-sm font-black uppercase tracking-widest text-primary-foreground"
              >
                Play again
              </button>
            )}
          </section>
        )}

        {/* ---------- roster ---------- */}
        <h2 className="mt-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Players ({players.length}/{party.max_players})
        </h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {players.map((p) => (
            <li key={p.id} className="glass flex items-center gap-3 rounded-2xl px-3 py-2.5">
              <span className="text-2xl">{p.profile?.avatar ?? "🎲"}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-sm font-bold">
                  {p.profile?.username ?? "Player"}
                  {party.host_id === p.user_id && <Crown className="size-3.5 text-primary" />}
                  {online.includes(p.user_id) && (
                    <span className="size-1.5 rounded-full bg-truth" aria-label="online" />
                  )}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  {p.profile?.country} · {p.score} pts · {p.truths}T/{p.dares}D
                  {party.team_mode && ` · ${p.team}`}
                </span>
              </span>
              {p.ready && party.status === "lobby" && (
                <span className="text-[10px] font-bold uppercase text-truth">ready</span>
              )}
              {isHost && p.user_id !== profile?.id && (
                <>
                  <button
                    onClick={() => kick(p, false)}
                    aria-label={`Kick ${p.profile?.username}`}
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <UserMinus className="size-4" />
                  </button>
                  <button
                    onClick={() => kick(p, true)}
                    aria-label={`Ban ${p.profile?.username}`}
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <ShieldBan className="size-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {spectators.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            👀 {spectators.length} spectator{spectators.length > 1 ? "s" : ""} watching
          </p>
        )}

        {/* ---------- chat ---------- */}
        <h2 className="mt-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Party chat
        </h2>
        <div className="glass mt-2 max-h-64 space-y-1.5 overflow-y-auto rounded-2xl p-3">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground">Say hi to the room…</p>
          )}
          {messages.map((m) => (
            <p key={m.id} className="text-sm">
              <span className="mr-1">{m.profile?.avatar}</span>
              <span className="font-bold">{m.profile?.username ?? "Player"}</span>{" "}
              <span className={m.kind === "system" ? "text-muted-foreground italic" : ""}>
                {m.body}
              </span>
            </p>
          ))}
          <div ref={chatEnd} />
        </div>
        {typing.length > 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground">someone is typing…</p>
        )}
      </main>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!profile) return;
          void sendMessage(party.id, profile.id, chat);
          setChat("");
        }}
        className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4"
      >
        <div className="glass mx-auto flex max-w-4xl items-center gap-2 rounded-2xl p-2">
          <input
            value={chat}
            onChange={(e) => {
              setChat(e.target.value);
              broadcastTyping();
            }}
            maxLength={300}
            placeholder="Message the party…"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            aria-label="Send message"
            className="press-3d rounded-xl bg-primary p-2.5 text-primary-foreground"
          >
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}