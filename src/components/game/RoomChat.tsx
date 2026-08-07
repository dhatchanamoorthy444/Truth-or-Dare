/**
 * Live room chat: replies, mentions, per-message reactions, pinned messages,
 * system announcements, typing indicator, unread badge and auto-scroll.
 * GIFs are supported by pasting an image/gif URL — it renders inline.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Pin, Reply, Send, X } from "lucide-react";
import type { Profile, PartyMessage } from "@/lib/multiplayer";
import { pinMessage, reactToMessage, sendMessage } from "@/lib/multiplayer";
import { sfx } from "./fx";

export type ChatMessage = PartyMessage & { profile: Profile | null };

const QUICK = ["😂", "🔥", "😱", "❤️", "👏", "💀"];
const isMedia = (s: string) => /^https?:\/\/\S+\.(gif|png|jpe?g|webp)(\?\S*)?$/i.test(s.trim());

export function RoomChat({
  partyId,
  me,
  isHost,
  messages,
  typing,
  memberNames,
  onTyping,
}: {
  partyId: string;
  me: Profile | null;
  isHost: boolean;
  messages: ChatMessage[];
  typing: string[];
  memberNames: string[];
  onTyping: () => void;
}) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [unread, setUnread] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const seen = useRef(messages.length);

  const pinned = useMemo(() => messages.filter((m) => m.pinned).slice(-1)[0] ?? null, [messages]);
  const byId = useMemo(() => Object.fromEntries(messages.map((m) => [m.id, m])), [messages]);

  useEffect(() => {
    if (messages.length === seen.current) return;
    if (atBottom) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setUnread(0);
    } else {
      setUnread((u) => u + (messages.length - seen.current));
    }
    seen.current = messages.length;
  }, [messages.length, atBottom]);

  const jump = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setUnread(0);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || !text.trim()) return;
    void sendMessage(partyId, me.id, text, "chat", replyTo?.id ?? null);
    sfx("tap", true);
    setText("");
    setReplyTo(null);
  };

  const renderBody = (body: string) => {
    if (isMedia(body)) {
      return (
        <img
          src={body}
          alt="Shared GIF"
          loading="lazy"
          className="mt-1 max-h-40 rounded-xl border border-glass-border"
        />
      );
    }
    return (
      <span>
        {body.split(/(@\S+)/g).map((chunk, i) =>
          chunk.startsWith("@") &&
          memberNames.some((n) => chunk.slice(1).startsWith(n.split(" ")[0] ?? "")) ? (
            <span key={i} className="rounded bg-primary/20 px-1 font-bold text-primary">
              {chunk}
            </span>
          ) : (
            <span key={i}>{chunk}</span>
          ),
        )}
      </span>
    );
  };

  return (
    <div className="mt-2">
      {pinned && (
        <div className="glass-strong mb-2 flex items-start gap-2 rounded-2xl px-3 py-2 text-xs">
          <Pin className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span className="flex-1">
            <strong>{pinned.profile?.username ?? "Player"}:</strong> {pinned.body}
          </span>
          {isHost && (
            <button
              aria-label="Unpin message"
              onClick={() => void pinMessage(partyId, pinned.id, false)}
            >
              <X className="size-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      <div
        ref={boxRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
        }}
        className="glass max-h-72 space-y-2 overflow-y-auto rounded-2xl p-3"
      >
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">Say hi to the room…</p>
        )}
        {messages.map((m) => {
          const reactions = (m.reactions ?? {}) as Record<string, string[]>;
          const parent = m.reply_to ? byId[m.reply_to] : null;
          return (
            <div key={m.id} className="group text-sm">
              {parent && (
                <p className="ml-6 truncate border-l-2 border-primary/40 pl-2 text-[11px] text-muted-foreground">
                  ↩ {parent.profile?.username}: {parent.body}
                </p>
              )}
              <div className="flex items-start gap-1.5">
                <span>{m.kind === "system" ? "📣" : m.profile?.avatar}</span>
                <div className="min-w-0 flex-1">
                  <span className="font-bold">{m.profile?.username ?? "Player"}</span>{" "}
                  <span className={m.kind === "system" ? "italic text-muted-foreground" : ""}>
                    {renderBody(m.body)}
                  </span>
                  {!!Object.keys(reactions).length && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(reactions).map(([emoji, users]) => (
                        <button
                          key={emoji}
                          onClick={() => me && void reactToMessage(m.id, emoji)}
                          className="rounded-full bg-secondary/60 px-2 py-0.5 text-[11px]"
                        >
                          {emoji} {users.length}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  {QUICK.slice(0, 3).map((e) => (
                    <button
                      key={e}
                      aria-label={`React ${e}`}
                      onClick={() => me && void reactToMessage(m.id, e)}
                      className="rounded px-1 text-xs"
                    >
                      {e}
                    </button>
                  ))}
                  <button aria-label="Reply" onClick={() => setReplyTo(m)} className="p-1">
                    <Reply className="size-3.5 text-muted-foreground" />
                  </button>
                  {isHost && (
                    <button
                      aria-label="Pin message"
                      onClick={() => void pinMessage(partyId, m.id, true)}
                      className="p-1"
                    >
                      <Pin className="size-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {unread > 0 && (
        <button
          onClick={jump}
          className="press-3d mt-1 w-full rounded-xl bg-primary/20 py-1.5 text-[11px] font-black uppercase tracking-widest text-primary"
        >
          {unread} new message{unread > 1 ? "s" : ""} — jump to latest
        </button>
      )}
      {typing.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {typing.length === 1 ? "someone is" : `${typing.length} players are`} typing…
        </p>
      )}

      {replyTo && (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-1.5 text-[11px]">
          <Reply className="size-3" /> Replying to <strong>{replyTo.profile?.username}</strong>
          <button aria-label="Cancel reply" onClick={() => setReplyTo(null)} className="ml-auto">
            <X className="size-3" />
          </button>
        </div>
      )}

      <form onSubmit={submit} className="glass mt-2 flex items-center gap-1 rounded-2xl p-2">
        {QUICK.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setText((t) => t + e)}
            className="rounded-lg px-1.5 py-1 text-base"
            aria-label={`Insert ${e}`}
          >
            {e}
          </button>
        ))}
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          maxLength={300}
          placeholder="Message, @mention or paste a GIF link…"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          aria-label="Send message"
          className="press-3d rounded-xl bg-primary p-2.5 text-primary-foreground"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
