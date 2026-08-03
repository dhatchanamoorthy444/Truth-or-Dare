/**
 * Voice + optional group video for the room.
 * Original layout: a floating "stage strip" of round tiles with grid /
 * speaker views, push-to-talk (hold space), and host mute-all.
 */
import { useEffect, useRef, useState } from "react";
import {
  Grid2x2,
  Maximize2,
  Mic,
  MicOff,
  MonitorUp,
  Radio,
  Video,
  VideoOff,
} from "lucide-react";
import { useMediaRoom } from "@/lib/webrtc";

function Tile({
  stream,
  label,
  emoji,
  speaking,
  muted,
  big,
}: {
  stream: MediaStream | null;
  label: string;
  emoji: string;
  speaking: boolean;
  muted: boolean;
  big?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  const hasVideo = !!stream?.getVideoTracks().some((t) => t.enabled);

  return (
    <div
      className={`glass relative overflow-hidden rounded-2xl ${big ? "aspect-video" : "aspect-square"} ${
        speaking ? "ring-2 ring-primary neon-glow" : ""
      }`}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`size-full object-cover ${hasVideo ? "" : "hidden"}`}
      />
      {!hasVideo && (
        <div className="flex size-full items-center justify-center text-3xl">{emoji}</div>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-background/60 px-2 py-1 text-[10px] font-bold">
        {label}
      </span>
    </div>
  );
}

export function MediaRoom({
  partyId,
  userId,
  names,
  avatars,
  allowVideo,
  isHost,
  forceMuted,
  onMuteAll,
}: {
  partyId: string;
  userId: string;
  names: Record<string, string>;
  avatars: Record<string, string>;
  allowVideo: boolean;
  isHost: boolean;
  forceMuted: boolean;
  onMuteAll: (on: boolean) => void;
}) {
  const [joined, setJoined] = useState(false);
  const [video, setVideo] = useState(false);
  const [ptt, setPtt] = useState(false);
  const [speakerView, setSpeakerView] = useState(false);

  const {
    localStream,
    peers,
    speaking,
    micOn,
    camOn,
    error,
    toggleMic,
    toggleCam,
    shareScreen,
  } = useMediaRoom({ partyId, userId, enabled: joined, wantVideo: video && allowVideo });

  /* host mute-all */
  useEffect(() => {
    if (forceMuted && !isHost) toggleMic(false);
  }, [forceMuted, isHost, toggleMic]);

  /* push-to-talk: hold space */
  useEffect(() => {
    if (!ptt || !joined) return;
    toggleMic(false);
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target as HTMLElement)?.closest("input,textarea")) {
        e.preventDefault();
        toggleMic(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") toggleMic(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [ptt, joined, toggleMic]);

  const loudest = speaking.find((id) => id !== userId) ?? peers[0]?.userId;

  return (
    <section className="glass mt-6 rounded-3xl p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs font-black uppercase tracking-widest text-muted-foreground">
          🎙 Room audio {joined && `· ${peers.length + 1} live`}
        </p>
        {!joined ? (
          <button
            onClick={() => setJoined(true)}
            className="press-3d neon-glow rounded-xl bg-primary px-4 py-2 text-[11px] font-black uppercase tracking-widest text-primary-foreground"
          >
            Join voice
          </button>
        ) : (
          <>
            <button
              onClick={() => toggleMic()}
              aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
              className={`press-3d rounded-xl p-2 ${micOn ? "bg-primary text-primary-foreground" : "bg-secondary/60"}`}
            >
              {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
            </button>
            {allowVideo && (
              <button
                onClick={() => (video ? toggleCam() : setVideo(true))}
                aria-label="Toggle camera"
                className={`press-3d rounded-xl p-2 ${camOn && video ? "bg-primary text-primary-foreground" : "bg-secondary/60"}`}
              >
                {camOn && video ? <Video className="size-4" /> : <VideoOff className="size-4" />}
              </button>
            )}
            {allowVideo && video && (
              <>
                <button onClick={() => void shareScreen()} aria-label="Share screen" className="press-3d rounded-xl bg-secondary/60 p-2">
                  <MonitorUp className="size-4" />
                </button>
                <button
                  onClick={() => setSpeakerView((s) => !s)}
                  aria-label="Switch layout"
                  className="press-3d rounded-xl bg-secondary/60 p-2"
                >
                  {speakerView ? <Grid2x2 className="size-4" /> : <Maximize2 className="size-4" />}
                </button>
              </>
            )}
            <button
              onClick={() => setPtt((p) => !p)}
              className={`press-3d rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
                ptt ? "bg-primary text-primary-foreground" : "bg-secondary/60"
              }`}
            >
              <Radio className="mr-1 inline size-3" /> PTT
            </button>
            <button
              onClick={() => setJoined(false)}
              className="press-3d rounded-xl bg-destructive/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-destructive"
            >
              Leave
            </button>
          </>
        )}
        {isHost && (
          <button
            onClick={() => onMuteAll(!forceMuted)}
            className="press-3d rounded-xl bg-secondary/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest"
          >
            {forceMuted ? "Unmute all" : "Mute all"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
      {ptt && joined && (
        <p className="mt-2 text-[11px] text-muted-foreground">Hold <strong>Space</strong> to talk.</p>
      )}

      {joined && (
        <div
          className={`mt-3 gap-2 ${
            speakerView ? "flex flex-col" : "grid grid-cols-3 sm:grid-cols-5"
          }`}
        >
          {speakerView && loudest && (
            <Tile
              big
              stream={peers.find((p) => p.userId === loudest)?.stream ?? null}
              label={names[loudest] ?? "Player"}
              emoji={avatars[loudest] ?? "🎲"}
              speaking={speaking.includes(loudest)}
              muted={false}
            />
          )}
          <Tile
            stream={localStream}
            label="You"
            emoji={avatars[userId] ?? "🎲"}
            speaking={speaking.includes(userId)}
            muted
          />
          {peers
            .filter((p) => !speakerView || p.userId !== loudest)
            .map((p) => (
              <Tile
                key={p.userId}
                stream={p.stream}
                label={names[p.userId] ?? "Player"}
                emoji={avatars[p.userId] ?? "🎲"}
                speaking={speaking.includes(p.userId)}
                muted={false}
              />
            ))}
        </div>
      )}
    </section>
  );
}