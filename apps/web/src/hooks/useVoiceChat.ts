'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface VoiceParticipant {
  userId: string;
  username: string;
  speaking: boolean;
  muted: boolean;
}

interface SignalMessage {
  type: 'voice-offer' | 'voice-answer' | 'voice-ice' | 'voice-join' | 'voice-leave' | 'voice-mute';
  from: string;
  to?: string;
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit | { muted: boolean; username: string };
  username?: string;
}

interface AnalyserEntry {
  analyser: AnalyserNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useVoiceChat(
  roomId: string,
  userId: string,
  username: string,
  signalingWs: WebSocket | null
) {
  const [inVoice, setInVoice]           = useState(false);
  const [micMuted, setMicMuted]         = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [micError, setMicError]         = useState<string | null>(null);

  const localStreamRef  = useRef<MediaStream | null>(null);
  const peersRef        = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const analyserRefs    = useRef<Map<string, AnalyserEntry>>(new Map());
  const speakingTimers  = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const remoteAudios    = useRef<Map<string, HTMLAudioElement>>(new Map());

  // ── Helpers ────────────────────────────────────────────────────────────
  function signal(msg: Omit<SignalMessage, 'from'>) {
    if (!signalingWs || signalingWs.readyState !== WebSocket.OPEN) return;
    signalingWs.send(JSON.stringify({ ...msg, from: userId }));
  }

  function updateParticipant(uid: string, patch: Partial<VoiceParticipant>) {
    setParticipants((prev) => {
      const existing = prev.find((p) => p.userId === uid);
      if (!existing) return [...prev, { userId: uid, username: uid, speaking: false, muted: false, ...patch }];
      return prev.map((p) => (p.userId === uid ? { ...p, ...patch } : p));
    });
  }

  function removeParticipant(uid: string) {
    setParticipants((prev) => prev.filter((p) => p.userId !== uid));
    peersRef.current.get(uid)?.close();
    peersRef.current.delete(uid);
    remoteAudios.current.get(uid)?.remove();
    remoteAudios.current.delete(uid);
    analyserRefs.current.delete(uid);
  }

  // ── Speaking detection ─────────────────────────────────────────────────
  function trackSpeaking(uid: string, stream: MediaStream) {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const buf = new ArrayBuffer(analyser.frequencyBinCount);
    const data = new Uint8Array(buf);
    analyserRefs.current.set(uid, { analyser, data });

    function check() {
      if (!analyserRefs.current.has(uid)) return;
      const { analyser: a, data: d } = analyserRefs.current.get(uid)!;
      a.getByteFrequencyData(d);
      const avg = (d as number[]).reduce((s: number, v: number) => s + v, 0) / d.length;
      const speaking = avg > 12;
      updateParticipant(uid, { speaking });
      requestAnimationFrame(check);
    }
    check();
  }

  // ── Create peer connection ─────────────────────────────────────────────
  function createPeer(remoteId: string, initiator: boolean): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks
    localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));

    // ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        signal({ type: 'voice-ice', to: remoteId, payload: e.candidate.toJSON() });
      }
    };

    // Remote stream → audio element
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      let audio = remoteAudios.current.get(remoteId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        document.body.appendChild(audio);
        remoteAudios.current.set(remoteId, audio);
      }
      audio.srcObject = stream;
      trackSpeaking(remoteId, stream);
    };

    if (initiator) {
      pc.onnegotiationneeded = async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signal({ type: 'voice-offer', to: remoteId, payload: offer });
      };
    }

    peersRef.current.set(remoteId, pc);
    return pc;
  }

  // ── Handle incoming signaling messages ────────────────────────────────
  const handleSignal = useCallback(async (msg: SignalMessage) => {
    if (!['voice-offer','voice-answer','voice-ice','voice-join','voice-leave','voice-mute'].includes(msg.type)) return;
    if (msg.to && msg.to !== userId) return;

    switch (msg.type) {
      case 'voice-join': {
        updateParticipant(msg.from, { username: msg.username ?? msg.from });
        if (inVoice && localStreamRef.current) {
          createPeer(msg.from, true);
        }
        break;
      }
      case 'voice-leave': {
        removeParticipant(msg.from);
        break;
      }
      case 'voice-mute': {
        const p = msg.payload as { muted: boolean };
        updateParticipant(msg.from, { muted: p.muted });
        break;
      }
      case 'voice-offer': {
        if (!localStreamRef.current) return;
        let pc = peersRef.current.get(msg.from);
        if (!pc) pc = createPeer(msg.from, false);
        await pc.setRemoteDescription(msg.payload as RTCSessionDescriptionInit);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signal({ type: 'voice-answer', to: msg.from, payload: answer });
        break;
      }
      case 'voice-answer': {
        const pc = peersRef.current.get(msg.from);
        if (pc) await pc.setRemoteDescription(msg.payload as RTCSessionDescriptionInit);
        break;
      }
      case 'voice-ice': {
        const pc = peersRef.current.get(msg.from);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(msg.payload as RTCIceCandidateInit));
        break;
      }
    }
  }, [inVoice, userId, username]);

  // Wire up WebSocket message handling
  useEffect(() => {
    if (!signalingWs) return;
    const handler = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as SignalMessage;
        handleSignal(msg);
      } catch {
        // ignore non-JSON messages
      }
    };
    signalingWs.addEventListener('message', handler);
    return () => signalingWs.removeEventListener('message', handler);
  }, [signalingWs, handleSignal]);

  // ── Join voice ─────────────────────────────────────────────────────────
  const joinVoice = useCallback(async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      trackSpeaking(userId, stream);
      setInVoice(true);
      updateParticipant(userId, { username, muted: false, speaking: false });
      signal({ type: 'voice-join', username });
    } catch (err) {
      setMicError('Microphone access denied. Please allow mic access in your browser.');
    }
  }, [signalingWs, userId, username]);

  // ── Leave voice ────────────────────────────────────────────────────────
  const leaveVoice = useCallback(() => {
    signal({ type: 'voice-leave' });
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    remoteAudios.current.forEach((a) => { a.srcObject = null; a.remove(); });
    remoteAudios.current.clear();
    analyserRefs.current.clear();
    setInVoice(false);
    setParticipants([]);
  }, [signalingWs]);

  // ── Toggle mute ────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = micMuted; // flip
    const newMuted = !micMuted;
    setMicMuted(newMuted);
    updateParticipant(userId, { muted: newMuted });
    signal({ type: 'voice-mute', payload: { muted: newMuted, username } });
  }, [micMuted, userId, username, signalingWs]);

  // Cleanup on unmount
  useEffect(() => () => { leaveVoice(); }, []);

  return { inVoice, micMuted, participants, micError, joinVoice, leaveVoice, toggleMute };
}
