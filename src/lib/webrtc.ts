/**
 * Peer-to-peer voice + video for a party room.
 *
 * A small full-mesh: every player connects directly to every other player and
 * the realtime channel is only used for signalling (offer / answer / ICE).
 * The player with the "lower" id always makes the offer, which keeps
 * negotiation deterministic and avoids glare.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
};

export interface PeerStream {
  userId: string;
  stream: MediaStream;
}

type Signal =
  | { kind: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { kind: "hello"; from: string; to: "*" };

export function useMediaRoom({
  partyId,
  userId,
  enabled,
  wantVideo,
}: {
  partyId: string | undefined;
  userId: string | undefined;
  enabled: boolean;
  wantVideo: boolean;
}) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerStream[]>([]);
  const [speaking, setSpeaking] = useState<string[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(wantVideo);
  const [error, setError] = useState<string | null>(null);

  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const analysers = useRef<Map<string, AnalyserNode>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);

  /* ---------------- local media ---------------- */
  useEffect(() => {
    if (!enabled) {
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      setLocalStream(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: wantVideo ? { width: 320, height: 240, facingMode: "user" } : false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localRef.current = stream;
        setLocalStream(stream);
        setCamOn(wantVideo);
      } catch {
        setError("Microphone/camera permission denied.");
      }
    })();
    return () => {
      cancelled = true;
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      setLocalStream(null);
    };
  }, [enabled, wantVideo]);

  /* ---------------- signalling + mesh ---------------- */
  const createPeer = useCallback(
    (peerId: string, channel: RealtimeChannel, polite: boolean) => {
      const existing = pcs.current.get(peerId);
      if (existing) return existing;
      const pc = new RTCPeerConnection(ICE);
      pcs.current.set(peerId, pc);

      localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!));

      pc.onicecandidate = (e) => {
        if (!e.candidate || !userId) return;
        void channel.send({
          type: "broadcast",
          event: "signal",
          payload: { kind: "ice", from: userId, to: peerId, candidate: e.candidate.toJSON() },
        });
      };
      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (!stream) return;
        setPeers((prev) =>
          prev.some((p) => p.userId === peerId)
            ? prev.map((p) => (p.userId === peerId ? { userId: peerId, stream } : p))
            : [...prev, { userId: peerId, stream }],
        );
      };
      pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          pc.close();
          pcs.current.delete(peerId);
          setPeers((prev) => prev.filter((p) => p.userId !== peerId));
        }
      };

      if (!polite && userId) {
        void (async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          void channel.send({
            type: "broadcast",
            event: "signal",
            payload: { kind: "offer", from: userId, to: peerId, sdp: offer },
          });
        })();
      }
      return pc;
    },
    [userId],
  );

  useEffect(() => {
    if (!enabled || !partyId || !userId || !localStream) return;
    const channel = supabase.channel(`media:${partyId}`, {
      // Private channel: the server checks party membership (and bans) before
      // anyone can subscribe to or publish WebRTC signalling.
      config: { broadcast: { self: false }, private: true },
    });
    channelRef.current = channel;
    void supabase.realtime.setAuth();

    channel
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const msg = payload as Signal;
        if (msg.from === userId) return;
        if (msg.kind === "hello") {
          // The higher id politely waits; the lower id sends the offer.
          createPeer(msg.from, channel, userId > msg.from);
          return;
        }
        if (msg.to !== userId) return;
        const pc = createPeer(msg.from, channel, true);
        if (msg.kind === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          void channel.send({
            type: "broadcast",
            event: "signal",
            payload: { kind: "answer", from: userId, to: msg.from, sdp: answer },
          });
        } else if (msg.kind === "answer") {
          if (pc.signalingState !== "stable") {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          }
        } else if (msg.kind === "ice") {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch {
            /* candidate arrived too early — safe to drop */
          }
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.send({
            type: "broadcast",
            event: "signal",
            payload: { kind: "hello", from: userId, to: "*" },
          });
        }
      });

    const peerMap = pcs.current;
    return () => {
      peerMap.forEach((pc) => pc.close());
      peerMap.clear();
      setPeers([]);
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, partyId, userId, localStream, createPeer]);

  /* ---------------- voice activity detection ---------------- */
  useEffect(() => {
    if (!enabled) {
      setSpeaking([]);
      return;
    }
    const ctx =
      audioCtxRef.current ??
      (audioCtxRef.current = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )());

    const register = (id: string, stream: MediaStream) => {
      if (analysers.current.has(id) || !stream.getAudioTracks().length) return;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      analysers.current.set(id, analyser);
    };
    if (localStream && userId) register(userId, localStream);
    peers.forEach((p) => register(p.userId, p.stream));

    const data = new Uint8Array(256);
    const timer = window.setInterval(() => {
      const loud: string[] = [];
      analysers.current.forEach((analyser, id) => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        if (avg > 18) loud.push(id);
      });
      setSpeaking(loud);
    }, 300);
    return () => window.clearInterval(timer);
  }, [enabled, peers, localStream, userId]);

  /* ---------------- controls ---------------- */
  const toggleMic = useCallback((on?: boolean) => {
    const stream = localRef.current;
    if (!stream) return;
    const next = on ?? !stream.getAudioTracks()[0]?.enabled;
    stream.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, []);

  const toggleCam = useCallback((on?: boolean) => {
    const stream = localRef.current;
    if (!stream) return;
    const next = on ?? !stream.getVideoTracks()[0]?.enabled;
    stream.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
  }, []);

  /** Replace the outgoing video track with a screen share (or restore camera). */
  const shareScreen = useCallback(async () => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      if (!track) return;
      pcs.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        void sender?.replaceTrack(track);
      });
      track.onended = () => {
        const camTrack = localRef.current?.getVideoTracks()[0];
        if (!camTrack) return;
        pcs.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          void sender?.replaceTrack(camTrack);
        });
      };
    } catch {
      /* user cancelled */
    }
  }, []);

  return {
    localStream,
    peers,
    speaking,
    micOn,
    camOn,
    error,
    toggleMic,
    toggleCam,
    shareScreen,
  };
}
