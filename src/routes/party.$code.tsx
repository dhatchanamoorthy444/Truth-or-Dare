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
import { RegretRoulette, type SpinPayload } from "@/components/game/RegretRoulette";
import { TruthTellerReveal } from "@/components/game/TruthTeller";
import { ChallengeTimer } from "@/components/game/ChallengeTimer";
import { RoomChat } from "@/components/game/RoomChat";
import { MediaRoom } from "@/components/game/MediaRoom";
import { HostSettings } from "@/components/game/HostSettings";
import {
  CinematicLayer,
  TransferArrow,
  announce,
  useCinematic,
} from "@/components/game/Cinematic";
import { confetti, fireworks, setMusicMood, sfx, vibrate } from "@/components/game/fx";
import { PUNISHMENTS, REWARDS } from "@/lib/content";
import { THEMES, themeFlavour, type ThemeId } from "@/lib/themes";
import {
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
  claimHostIfAbandoned,
  ensureMembership,
  leaveParty,
  sendMessage,
  touchHost,
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

const EMOJIS = ["😂", "🤣", "😱", "🔥", "❤️", "👏", "💀", "🤯", "🎉", "🙈"];

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
  const [countdown, setCountdown] = useState(5);
  const [now, setNow] = useState(() => Date.now());
  const [showSettings, setShowSettings] = useState(false);
  const [scenarios, setScenarios] = useState<string[]>(["funny", "friendship"]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [arrow, setArrow] = useState<{ from: string; to: string } | null>(null);
  const [showWheel, setShowWheel] = useState(false);
  const [voted, setVoted] = useState(false);
  const [showMission, setShowMission] = useState(false);
  const [reveal, setReveal] = useState<MemberWithProfile | null>(null);
  const { event: cine, play } = useCinematic();
  const chatEnd = useRef<HTMLDivElement>(null);
  const revealedFor = useRef<string | null>(null);

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
  const settings = useMemo(() => normalizeSettings(party?.settings), [party?.settings]);
  const phase = (party?.phase ?? "idle") as RoundPhase;
  const preset = presetById(party?.preset ?? "casual");
  const mystery = (party?.mystery ?? null) as MysteryOutcome | null;
  const recap = (party?.recap ?? null) as Recap | null;
  const imposterIsMe = !!profile && party?.imposter_id === profile.id;
  const spin = (party?.spin ?? null) as SpinPayload | null;
  const verdicts = (party?.verdicts ?? {}) as Record<string, boolean>;
  const wheelPlayers = useMemo(
    () =>
      players.map((p) => ({
        id: p.user_id,
        name: p.profile?.username ?? "Player",
        emoji: p.profile?.avatar ?? "🎲",
      })),
    [players],
  );
  /** Only one client is allowed to commit a spin result — no duplicate wheels. */
  const spinController = phase === "imposter" ? imposterIsMe : isHost;
  const secondsLeft =
    party?.turn_ends_at && settings.turnSeconds > 0
      ? Math.max(0, Math.ceil((new Date(party.turn_ends_at).getTime() - now) / 1000))
      : null;

  /* ---------- room atmosphere: music follows the game state ---------- */
  useEffect(() => {
    if (party?.status === "results") setMusicMood("victory");
    else if (party?.status !== "playing") setMusicMood("lobby");
    else if (phase === "imposter" || phase === "victim") setMusicMood("spin");
    else if (challenge?.type === "dare") setMusicMood("dare");
    else if (challenge?.type === "truth") setMusicMood("truth");
    else setMusicMood("lobby");
    return () => setMusicMood("off");
  }, [party?.status, phase, challenge?.type]);

  /* ---------- reconnect: silently restore membership ---------- */
  useEffect(() => {
    if (!party || !profile || loading) return;
    if (members.some((m) => m.user_id === profile.id)) return;
    void ensureMembership(party.code, profile.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party?.id, profile?.id, members.length, loading]);

  /* ---------- host heartbeat + automatic host migration ---------- */
  useEffect(() => {
    if (!party || !profile) return;
    const t = window.setInterval(() => {
      if (isHost) {
        void touchHost(party.id);
        return;
      }
      void claimHostIfAbandoned(party, members, online, profile.id).then((claimed) => {
        if (claimed) toast.success("The host left — you're the new host 👑");
      });
    }, 8000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party?.id, isHost, members, online, profile?.id]);

  /* ---------- 🎭 The Truth Teller reveal, seen by everyone ---------- */
  useEffect(() => {
    if (phase !== "challenge" || !party?.victim_id) return;
    const key = `${party.round}:${party.victim_id}`;
    if (revealedFor.current === key) return;
    revealedFor.current = key;
    const victim = players.find((p) => p.user_id === party.victim_id) ?? null;
    if (victim) setReveal(victim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, party?.victim_id, party?.round, players.length]);

  /* ---------- cinematic round countdown, driven by the host ---------- */
  useEffect(() => {
    if (party?.status !== "intro") {
      setCountdown(5);
      return;
    }
    setCountdown(5);
    sfx("spin", true);
    announce("Preparing round. Selecting the secret imposter.");
    const t = window.setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : c)), 1000);
    const done = window.setTimeout(() => {
      if (isHost) void beginRound();
    }, 6400);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party?.status, party?.round, isHost]);

  /* ---------- local flourishes when shared state changes ---------- */
  useEffect(() => {
    if (phase === "challenge" && party?.victim_id) {
      play("spotlight", "TODAY'S VICTIM");
      sfx("win", true);
      setVoted(false);
    }
    if (phase === "imposter") play("smoke");
    if (phase === "recap") play("confetti-cannon", "ROUND COMPLETE");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, party?.victim_id]);

  useEffect(() => {
    if (mystery) {
      play("portal", `${mystery.emoji} ${mystery.label}`);
      announce(`Mystery box! ${mystery.label}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mystery?.id]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.kind === "reaction") play("emoji-rain", undefined, last.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const patchParty = async (patch: Record<string, unknown>) => {
    if (!party) return;
    await supabase
      .from("parties")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", party.id);
  };

  const saveSettings = async (patch: Partial<GameSettings>) => {
    await patchParty({ settings: { ...settings, ...patch } });
  };

  /**
   * Shared spin: the controller picks the index, everyone animates the same
   * wheel. The previous victim is excluded so nobody gets picked twice in a row.
   */
  const startSpin = async () => {
    if (!party || !spinController || players.length < 2) return;
    const eligible = players.filter(
      (p) => players.length < 3 || p.user_id !== party.victim_id,
    );
    const chosen = pickRandom(eligible);
    if (!chosen) return;
    const index = players.findIndex((p) => p.user_id === chosen.user_id);
    await patchParty({
      spin: { index, at: Date.now(), by: profile?.id ?? "", ids: players.map((p) => p.user_id) },
    });
  };

  /** Kicks off the suspenseful countdown before a brand-new round. */
  const startMatch = async () => {
    if (players.length < 2) {
      toast.error("You need at least 2 players to start.");
      return;
    }
    sfx("win", true);
    // Reset skip cards + hand out fresh secret missions.
    await Promise.all(
      players.map((p) =>
        supabase
          .from("party_members")
          .update({ skips_left: settings.skips, mission: randomMission(), mission_done: false, votes: 0 })
          .eq("id", p.id),
      ),
    );
    await patchParty({
      status: "intro",
      phase: "countdown",
      round: 1,
      recap: null,
      mystery: null,
      current_challenge: null,
      victim_id: null,
      imposter_id: null,
      transfer_used: false,
    });
  };

  /** Host-only: picks the secret imposter and decides how the victim is chosen. */
  const beginRound = async () => {
    if (!party) return;
    const imposter = settings.imposter ? pickRandom(players) : null;
    const mode =
      settings.wheelMode === "mixed"
        ? (pickRandom(["random", "imposter", "host"]) as "random" | "imposter" | "host")
        : settings.wheelMode;
    const chooser = imposter ? mode : mode === "imposter" ? "random" : mode;

    if (chooser === "random") {
      const victim = pickRandom(players);
      await patchParty({
        status: "playing",
        phase: "challenge",
        imposter_id: imposter?.user_id ?? null,
        victim_id: victim?.user_id ?? null,
        current_turn: victim?.user_id ?? null,
        transfer_used: false,
        mystery: null,
        current_challenge: null,
        recap: null,
      });
      return;
    }

    await patchParty({
      status: "playing",
      phase: chooser === "host" ? "victim" : "imposter",
      imposter_id: imposter?.user_id ?? null,
      victim_id: null,
      current_turn: null,
      transfer_used: false,
      mystery: null,
      current_challenge: null,
      recap: null,
    });
  };

  /** Locks in the victim for this round, rolling a lucky save first. */
  const chooseVictim = async (userId: string) => {
    if (!party) return;
    // Anti-cheat: the victim for a round can only ever be committed once.
    if (party.victim_id && party.phase === "challenge") return;
    let target = players.find((p) => p.user_id === userId) ?? null;
    if (target && rollLuckySave(settings.luckyChance)) {
      const others = players.filter((p) => p.user_id !== userId);
      const replacement = pickRandom(others);
      if (replacement) {
        play("banner", `🎁 Lucky Save! ${target.profile?.username} escapes`);
        announce("Lucky save!");
        await sendMessage(
          party.id,
          target.user_id,
          `escaped with a Lucky Save — ${replacement.profile?.username} is up instead!`,
          "system",
        );
        target = replacement;
      }
    }
    if (!target) return;
    setShowWheel(false);
    await patchParty({
      phase: "challenge",
      victim_id: target.user_id,
      current_turn: target.user_id,
      transfer_used: false,
      verdicts: {},
      spin: null,
    });
  };

  const drawChallenge = async (type: "truth" | "dare") => {
    if (!party) return;
    const box = rollMystery(settings.mysteryChance);
    const effectiveType = box?.id === "double-dare" ? "dare" : type;
    const first = pickChallenge(effectiveType, settings, party.used_ids);
    if (!first) return;
    const wantsDouble = !!box && box.id === "double-dare" && settings.doubleDare;
    const second = wantsDouble ? pickChallenge(effectiveType, settings, [...party.used_ids, first.id]) : null;

    sfx("flip", true);
    vibrate(30, true);

    const payload: ChallengePayload = {
      text: first.text,
      type: effectiveType,
      flavour: themeFlavour(theme, Math.floor(Math.random() * 97)),
      ...(second ? { second: second.text } : {}),
      ...(box ? { bonus: box.bonus } : {}),
    };

    await patchParty({
      current_challenge: payload,
      mystery: box,
      used_ids: [...party.used_ids, first.id, ...(second ? [second.id] : [])].slice(-400),
      turn_ends_at:
        settings.turnSeconds > 0
          ? new Date(Date.now() + settings.turnSeconds * 1000).toISOString()
          : null,
    });
  };

  /** The victim hands the challenge to someone else — once per round. */
  const transferTo = async (member: MemberWithProfile) => {
    if (!party || !currentPlayer || party.transfer_used) return;
    setTransferOpen(false);
    setArrow({
      from: currentPlayer.profile?.username ?? "Player",
      to: member.profile?.username ?? "Player",
    });
    window.setTimeout(() => setArrow(null), 1700);
    play("lightning");
    announce(`${currentPlayer.profile?.username} passed the challenge!`);
    await sendMessage(
      party.id,
      currentPlayer.user_id,
      `passed the challenge to ${member.profile?.username}!`,
      "system",
    );
    await patchParty({
      victim_id: member.user_id,
      current_turn: member.user_id,
      transfer_used: true,
      turn_ends_at:
        settings.turnSeconds > 0
          ? new Date(Date.now() + settings.turnSeconds * 1000).toISOString()
          : null,
    });
  };

  const voteFor = async (member: MemberWithProfile) => {
    if (voted) return;
    setVoted(true);
    sfx("tap", true);
    await supabase.from("party_members").update({ votes: member.votes + 1 }).eq("id", member.id);
  };

  const completeMission = async () => {
    if (!me || !party || me.mission_done) return;
    confetti(80);
    await supabase
      .from("party_members")
      .update({ mission_done: true, score: me.score + 30 })
      .eq("id", me.id);
    await sendMessage(party.id, me.user_id, "completed a Secret Mission (+30)", "system");
  };

  const resolveTurn = async (completed: boolean) => {
    if (!party || !currentPlayer || !challenge) return;

    if (!completed && settings.skips !== -1) {
      if (currentPlayer.skips_left <= 0) {
        toast.error("No skip cards left — you have to face it!");
        return;
      }
      await supabase
        .from("party_members")
        .update({ skips_left: currentPlayer.skips_left - 1 })
        .eq("id", currentPlayer.id);
    }

    const base = challenge.type === "dare" ? 25 : 15;
    const bonus = challenge.bonus ?? 0;
    const golden = mystery?.id === "golden-reward";
    const points = completed ? (golden ? base * 3 : base) + bonus : 0;

    if (completed) {
      confetti(90);
      sfx("win", true);
      vibrate([20, 40, 20], true);
      await supabase
        .from("party_members")
        .update({
          score: currentPlayer.score + points,
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
        ? `completed a ${challenge.type} (+${points}) — ${REWARDS[Math.floor(Math.random() * REWARDS.length)]}`
        : settings.punishments
          ? `chickened out — ${PUNISHMENTS[Math.floor(Math.random() * PUNISHMENTS.length)]}`
          : "skipped the challenge",
      "system",
    );

    const funniest = [...players].sort((a, b) => b.votes - a.votes)[0];
    const nextRecap: Recap = {
      winner: currentPlayer.profile?.username ?? "Player",
      completed,
      type: challenge.type,
      points,
      funniest: funniest?.profile?.username ?? "—",
      reaction: pickRandom(EMOJIS) ?? "🔥",
      votes: funniest?.votes ?? 0,
      mission: !!currentPlayer.mission_done,
    };

    await patchParty({
      ...teamPatch,
      phase: "recap",
      recap: nextRecap,
      current_challenge: null,
      turn_ends_at: null,
    });
  };

  /** After the recap the host rolls straight into the next suspenseful round. */
  useEffect(() => {
    if (phase !== "recap" || !isHost || !party) return;
    const t = window.setTimeout(() => {
      const finished = party.round >= players.length * 3;
      if (finished) {
        fireworks(5);
        void patchParty({ status: "results", phase: "idle" });
      } else {
        void patchParty({
          status: "intro",
          phase: "countdown",
          round: party.round + 1,
          recap: null,
          mystery: null,
          victim_id: null,
          current_turn: null,
          imposter_id: null,
          transfer_used: false,
        });
      }
    }, 6000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isHost, party?.round]);

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
      <CinematicLayer event={cine} />
      {arrow && <TransferArrow from={arrow.from} to={arrow.to} />}

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
            {players.map((p, i) => (
              <span
                key={p.id}
                className="glass shuffle-card rounded-2xl px-3 py-2 text-xs font-bold"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                {p.profile?.avatar} {p.profile?.username}
              </span>
            ))}
          </div>
          {settings.imposter && (
            <p className="mt-5 font-display text-sm font-black uppercase tracking-[0.25em] text-primary neon-text">
              Selecting the secret imposter…
            </p>
          )}
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
            {isHost && (
              <>
                <button
                  onClick={() => setShowSettings((s) => !s)}
                  className="press-3d mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary/60 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground"
                >
                  <Settings2 className="size-4" />
                  {showSettings ? "Hide" : "Host"} game settings · {preset.label}
                </button>
                {showSettings && (
                  <div className="glass mt-3 rounded-3xl p-4">
                    <HostSettings
                      settings={settings}
                      scenarios={scenarios}
                      onScenarios={setScenarios}
                      onChange={(patch) => void saveSettings(patch)}
                    />
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {party.status === "playing" && phase === "imposter" && (
          <section className="text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Round {party.round}</p>
            {imposterIsMe ? (
              <>
                <h2 className="mt-2 font-display text-2xl font-black gradient-text">
                  🕵️ You are the Secret Imposter
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick tonight's victim — or let the wheel decide.
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {players.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => void chooseVictim(p.user_id)}
                      className="glass press-3d flex items-center gap-3 rounded-2xl px-4 py-3 text-left"
                    >
                      <span className="text-2xl">{p.profile?.avatar}</span>
                      <span className="text-sm font-bold">{p.profile?.username}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowWheel(true)}
                  className="press-3d neon-glow mt-3 w-full rounded-2xl bg-primary py-3 text-xs font-black uppercase tracking-widest text-primary-foreground"
                >
                  🎡 Spin the wheel of victims
                </button>
                {showWheel && (
                  <div className="mt-6">
                    <SpinWheel
                      players={players.map((p) => ({
                        id: p.user_id,
                        name: p.profile?.username ?? "Player",
                        emoji: p.profile?.avatar ?? "🎲",
                        score: p.score,
                        truths: p.truths,
                        dares: p.dares,
                        skips: 0,
                      }))}
                      onPick={(p) => void chooseVictim(p.id)}
                      sound
                      haptics
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="mt-2 font-display text-2xl font-black">🕵️ An imposter is choosing…</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Someone in this room knows who's next. Stay calm.
                </p>
              </>
            )}
          </section>
        )}

        {party.status === "playing" && phase === "victim" && (
          <section className="text-center">
            <h2 className="font-display text-2xl font-black">🎡 Wheel of Victims</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isHost ? "Spin to reveal who's up." : "The host is spinning the wheel…"}
            </p>
            {isHost && (
              <div className="mt-6">
                <SpinWheel
                  players={players.map((p) => ({
                    id: p.user_id,
                    name: p.profile?.username ?? "Player",
                    emoji: p.profile?.avatar ?? "🎲",
                    score: p.score,
                    truths: p.truths,
                    dares: p.dares,
                    skips: 0,
                  }))}
                  onPick={(p) => void chooseVictim(p.id)}
                  sound
                  haptics
                />
              </div>
            )}
          </section>
        )}

        {party.status === "playing" && phase === "recap" && recap && (
          <section className="pop-in text-center">
            <h2 className="font-display text-3xl font-black gradient-text">Round {party.round} recap</h2>
            <div className="glass-strong mx-auto mt-4 max-w-md space-y-2 rounded-3xl p-5 text-left text-sm">
              <p>
                🏅 <strong>MVP:</strong> {recap.winner}{" "}
                {recap.completed ? `(+${recap.points} for a ${recap.type})` : "(chickened out)"}
              </p>
              <p>
                😂 <strong>Funniest moment:</strong> {recap.funniest} · {recap.votes} votes
              </p>
              <p>
                {recap.reaction} <strong>Crowd reaction of the round</strong>
              </p>
              {recap.mission && <p>🎯 A secret mission was completed!</p>}
            </div>
            <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
              Next round starting…
            </p>
          </section>
        )}

        {party.status === "playing" && phase === "challenge" && (
          <section className="text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {world.questLabel} · Round {party.round}
            </p>
            <p className="mt-1 font-display text-2xl font-black">
              {currentPlayer?.profile?.avatar} {currentPlayer?.profile?.username}
              <span className="text-muted-foreground">{myTurn ? " — your turn!" : "'s turn"}</span>
            </p>
            {imposterIsMe && (
              <p className="mt-1 text-[11px] uppercase tracking-widest text-primary neon-text">
                🕵️ You are the secret imposter
              </p>
            )}
            {mystery && (
              <p className="mt-2 inline-block rounded-full bg-primary/15 px-3 py-1 text-[11px] font-bold text-primary">
                {mystery.emoji} {mystery.label} — {mystery.blurb}
              </p>
            )}

            {secondsLeft !== null && (
              <div className="mx-auto mt-3 h-2 w-56 overflow-hidden rounded-full bg-secondary/60">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${(secondsLeft / settings.turnSeconds) * 100}%` }}
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
                {challenge.second && (
                  <p className="mt-3 rounded-2xl bg-dare/15 p-3 font-display text-lg font-black leading-snug text-dare">
                    ⚡ Double Dare: {challenge.second}
                  </p>
                )}
                <p className="mt-3 text-xs uppercase tracking-widest text-primary">
                  {challenge.type}
                  {secondsLeft !== null ? ` · ${secondsLeft}s left` : " · no timer"}
                </p>
                {myTurn && (
                  <>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <button
                        onClick={() => resolveTurn(true)}
                        className="press-3d rounded-2xl bg-truth py-3 text-sm font-black uppercase tracking-widest text-background"
                      >
                        Completed
                      </button>
                      <button
                        onClick={() => resolveTurn(false)}
                        disabled={settings.skips !== -1 && (me?.skips_left ?? 0) <= 0}
                        className="press-3d rounded-2xl bg-secondary py-3 text-sm font-black uppercase tracking-widest disabled:opacity-40"
                      >
                        Skip{settings.skips === -1 ? "" : ` (${me?.skips_left ?? 0})`}
                      </button>
                    </div>
                    {settings.transfers && !party.transfer_used && (
                      <button
                        onClick={() => setTransferOpen((t) => !t)}
                        className="press-3d mt-2 w-full rounded-2xl bg-primary/15 py-3 text-xs font-black uppercase tracking-widest text-primary"
                      >
                        🔁 Transfer this challenge
                      </button>
                    )}
                    {transferOpen && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {players
                          .filter((p) => p.user_id !== profile?.id)
                          .map((p) => (
                            <button
                              key={p.id}
                              onClick={() => void transferTo(p)}
                              className="glass press-3d rounded-2xl px-4 py-2.5 text-left text-sm font-bold"
                            >
                              {p.profile?.avatar} {p.profile?.username}
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                )}
                {!myTurn && settings.voting && (
                  <button
                    onClick={() => currentPlayer && void voteFor(currentPlayer)}
                    disabled={voted}
                    className="press-3d mt-4 w-full rounded-2xl bg-secondary/60 py-2.5 text-xs font-black uppercase tracking-widest disabled:opacity-40"
                  >
                    {voted ? "Voted ✓" : "😂 Vote: that was hilarious"}
                  </button>
                )}
              </div>
            )}

            {me?.mission && (
              <div className="glass mx-auto mt-4 max-w-xl rounded-2xl p-4 text-left">
                <button
                  onClick={() => setShowMission((s) => !s)}
                  className="text-[11px] font-black uppercase tracking-widest text-muted-foreground"
                >
                  🎯 Secret mission {showMission ? "(hide)" : "(tap to peek)"}
                </button>
                {showMission && (
                  <>
                    <p className="mt-2 text-sm font-bold">{me.mission}</p>
                    <button
                      onClick={() => void completeMission()}
                      disabled={me.mission_done}
                      className="press-3d mt-2 rounded-xl bg-primary px-4 py-2 text-[11px] font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
                    >
                      {me.mission_done ? "Completed ✓" : "I did it (+30)"}
                    </button>
                  </>
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