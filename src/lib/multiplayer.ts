/**
 * Realtime multiplayer client.
 * All reads/writes go straight through the Cloud client with row-level
 * security scoping them; realtime channels keep every screen in sync.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { ThemeId } from "./themes";

export type Profile = Tables<"profiles">;
export type Party = Tables<"parties">;
export type PartyMember = Tables<"party_members">;
export type PartyMessage = Tables<"party_messages">;

export type MemberWithProfile = PartyMember & { profile: Profile | null };

export const GAME_MODES = [
  { id: "solo", label: "Solo", emoji: "🎯", blurb: "Practice on this device" },
  { id: "friends", label: "Friends Party", emoji: "🤝", blurb: "Private code, your crew" },
  { id: "random", label: "Random Party", emoji: "🌍", blurb: "Matched with strangers" },
  { id: "team", label: "Team Battle", emoji: "🚩", blurb: "Red vs Blue for points" },
  { id: "couples", label: "Couples", emoji: "💞", blurb: "Two-player intimacy mode" },
  { id: "tournament", label: "Tournament", emoji: "🏆", blurb: "Bracket of challenges" },
  { id: "ranked", label: "Ranked", emoji: "📈", blurb: "Rank points on the line" },
  { id: "custom", label: "Custom Rules", emoji: "⚙️", blurb: "Your own settings" },
  { id: "daily", label: "Daily Challenge", emoji: "📅", blurb: "One shared task a day" },
  { id: "weekend", label: "Weekend Event", emoji: "🎪", blurb: "Limited-time chaos" },
] as const;
export type GameMode = (typeof GAME_MODES)[number]["id"];

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const NAME_PARTS = ["Neon", "Turbo", "Wild", "Lucky", "Rogue", "Cosmic", "Shadow", "Blaze"];
const NAME_TAILS = ["Fox", "Wolf", "Panda", "Comet", "Ghost", "Tiger", "Nova", "Raven"];
const AVATARS = ["🦊", "🐼", "🦄", "🐯", "🐨", "🐸", "🦁", "🐧", "🐺", "🦉", "🐙", "🐝"];
const FLAGS = ["🌍", "🇺🇸", "🇬🇧", "🇮🇳", "🇧🇷", "🇩🇪", "🇯🇵", "🇳🇬", "🇫🇷", "🇪🇸", "🇦🇺", "🇨🇦"];

export function randomPartyCode() {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function randomName() {
  const a = NAME_PARTS[Math.floor(Math.random() * NAME_PARTS.length)];
  const b = NAME_TAILS[Math.floor(Math.random() * NAME_TAILS.length)];
  return `${a}${b}${Math.floor(10 + Math.random() * 90)}`;
}

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;

export const levelFromXp = (xp: number) => Math.max(1, Math.floor(xp / 300) + 1);

export const RANKS = [
  { name: "Bronze", min: 0, emoji: "🥉" },
  { name: "Silver", min: 300, emoji: "🥈" },
  { name: "Gold", min: 800, emoji: "🥇" },
  { name: "Platinum", min: 1600, emoji: "💠" },
  { name: "Diamond", min: 3000, emoji: "💎" },
  { name: "Legend", min: 5000, emoji: "👑" },
];
export const rankFor = (points: number) =>
  [...RANKS].reverse().find((r) => points >= r.min) ?? RANKS[0]!;

/** Batch-load profiles for a set of user ids (no FK join exists). */
export async function profilesFor(ids: string[]): Promise<Record<string, Profile>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return {};
  const { data } = await supabase.from("profiles").select("*").in("id", unique);
  return Object.fromEntries((data ?? []).map((p) => [p.id, p]));
}

/** Current signed-in user (null while loading is reported separately). */
export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

/** Loads (and lazily creates) the signed-in player's profile. */
export function useProfile() {
  const { user, loading: authLoading } = useAuthUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) {
      setProfile(data);
      setLoading(false);
      return;
    }
    const created = {
      id: user.id,
      username:
        (user.user_metadata?.["full_name"] as string | undefined)?.slice(0, 20) ?? randomName(),
      avatar: pick(AVATARS),
      player_code: `TD-${Math.floor(100000 + Math.random() * 900000)}`,
      country: pick(FLAGS),
    };
    const { data: inserted } = await supabase
      .from("profiles")
      .insert(created)
      .select("*")
      .maybeSingle();
    setProfile(inserted ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  return { user, profile, loading: authLoading || loading, refresh, setProfile };
}

/** Live view of a single party: row, members (+profiles) and chat. */
export function useParty(code: string, userId: string | undefined) {
  const [party, setParty] = useState<Party | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [messages, setMessages] = useState<(PartyMessage & { profile: Profile | null })[]>([]);
  const [online, setOnline] = useState<string[]>([]);
  const [typing, setTyping] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const loadParty = useCallback(async () => {
    let { data } = await supabase
      .from("parties")
      .select("*")
      .eq("code", code.toUpperCase())
      .maybeSingle();
    // Private parties are hidden from non-members, so an invited player arriving via
    // a share link joins through the secured RPC before the row becomes visible.
    if (!data && userId) {
      try {
        data = await joinParty(code, userId);
      } catch {
        data = null;
      }
    }
    setParty(data ?? null);
    setMissing(!data);
    setLoading(false);
    return data ?? null;
  }, [code, userId]);

  const loadMembers = useCallback(async (partyId: string) => {
    const { data } = await supabase
      .from("party_members")
      .select("*")
      .eq("party_id", partyId)
      .order("joined_at");
    const rows = data ?? [];
    const byId = await profilesFor(rows.map((r) => r.user_id));
    setMembers(rows.map((r) => ({ ...r, profile: byId[r.user_id] ?? null })));
  }, []);

  const loadMessages = useCallback(async (partyId: string) => {
    const { data } = await supabase
      .from("party_messages")
      .select("*")
      .eq("party_id", partyId)
      .order("created_at", { ascending: false })
      .limit(60);
    const rows = (data ?? []).reverse();
    const byId = await profilesFor(rows.map((r) => r.user_id));
    setMessages(rows.map((r) => ({ ...r, profile: byId[r.user_id] ?? null })));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await loadParty();
      if (!p || cancelled) return;
      await Promise.all([loadMembers(p.id), loadMessages(p.id)]);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadParty, loadMembers, loadMessages]);

  const partyId = party?.id;

  useEffect(() => {
    if (!partyId) return;
    const channel = supabase
      .channel(`party:${partyId}`, { config: { presence: { key: userId ?? "anon" } } })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parties", filter: `id=eq.${partyId}` },
        (payload) => {
          if (payload.eventType === "DELETE") setMissing(true);
          else setParty(payload.new as Party);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "party_members", filter: `party_id=eq.${partyId}` },
        () => void loadMembers(partyId),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "party_messages", filter: `party_id=eq.${partyId}` },
        () => void loadMessages(partyId),
      )
      .on("presence", { event: "sync" }, () => {
        setOnline(Object.keys(channel.presenceState()));
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const who = (payload as { userId?: string }).userId;
        if (!who || who === userId) return;
        setTyping((t) => (t.includes(who) ? t : [...t, who]));
        window.setTimeout(() => setTyping((t) => t.filter((x) => x !== who)), 2500);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && userId) {
          await channel.track({ at: Date.now() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [partyId, userId, loadMembers, loadMessages]);

  const broadcastTyping = useCallback(() => {
    if (!partyId || !userId) return;
    void supabase.channel(`party:${partyId}`).send({
      type: "broadcast",
      event: "typing",
      payload: { userId },
    });
  }, [partyId, userId]);

  const me = useMemo(
    () => members.find((m) => m.user_id === userId) ?? null,
    [members, userId],
  );

  return {
    party,
    members,
    messages,
    online,
    typing,
    me,
    loading,
    missing,
    reload: loadParty,
    broadcastTyping,
  };
}

/* ------------------------- party actions ------------------------- */

export async function createParty(opts: {
  hostId: string;
  name: string;
  mode: GameMode;
  theme: ThemeId;
  visibility: "public" | "private";
  maxPlayers: number;
}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomPartyCode();
    const { data, error } = await supabase
      .from("parties")
      .insert({
        code,
        name: opts.name.slice(0, 40) || "Party",
        host_id: opts.hostId,
        mode: opts.mode,
        theme: opts.theme,
        visibility: opts.visibility,
        max_players: Math.min(20, Math.max(2, opts.maxPlayers)),
        team_mode: opts.mode === "team",
      })
      .select("*")
      .maybeSingle();
    if (data) {
      await supabase.from("party_members").insert({
        party_id: data.id,
        user_id: opts.hostId,
        ready: true,
        team: opts.mode === "team" ? "red" : "none",
      });
      return data;
    }
    if (error && !error.message.includes("duplicate")) throw error;
  }
  throw new Error("Could not generate a free party code, try again.");
}

export async function joinParty(code: string, userId: string, spectator = false) {
  // Joining runs through a secured database function: it checks bans, capacity and
  // team balance server-side so private parties never need to be readable by outsiders.
  void userId;
  const { data, error } = await supabase.rpc("join_party", {
    _code: code.toUpperCase().trim(),
    _spectator: spectator,
  });
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, "") || "Could not join that party.");
  if (!data) throw new Error("No party found with that code.");
  return data as Party;
}

/** Finds an open public lobby, or spins up a fresh one. */
export async function quickMatch(userId: string, theme: ThemeId) {
  const { data: open } = await supabase
    .from("parties")
    .select("*")
    .eq("visibility", "public")
    .eq("status", "lobby")
    .order("created_at", { ascending: false })
    .limit(10);

  for (const party of open ?? []) {
    try {
      // join_party rejects full or banned parties, so just try the next one.
      return await joinParty(party.code, userId);
    } catch {
      continue;
    }
  }

  return createParty({
    hostId: userId,
    name: "Quick Match",
    mode: "random",
    theme,
    visibility: "public",
    maxPlayers: 20,
  });
}

export async function leaveParty(partyId: string, userId: string, isHost: boolean, members: PartyMember[]) {
  if (isHost) {
    const heir = members.find((m) => m.user_id !== userId && !m.spectator);
    if (heir) await supabase.from("parties").update({ host_id: heir.user_id }).eq("id", partyId);
    else {
      await supabase.from("parties").delete().eq("id", partyId);
      return;
    }
  }
  await supabase.from("party_members").delete().eq("party_id", partyId).eq("user_id", userId);
}

export async function sendMessage(partyId: string, userId: string, body: string, kind = "chat") {
  const trimmed = body.trim().slice(0, 300);
  if (!trimmed) return;
  await supabase.from("party_messages").insert({
    party_id: partyId,
    user_id: userId,
    body: trimmed,
    kind,
  });
}