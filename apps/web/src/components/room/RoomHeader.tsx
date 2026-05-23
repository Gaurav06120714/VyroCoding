'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, Mic, MicOff, PhoneCall, PhoneOff, Timer, ChevronDown } from 'lucide-react';
import type { Room } from '@vyro/types';
import { Badge } from '@/components/ui/Badge';
import { roomsApi2 } from '@/lib/api';

interface VoiceParticipant {
  userId: string;
  username: string;
  speaking: boolean;
  muted: boolean;
}

interface RoomHeaderProps {
  room: Room;
  participantCount: number;
  isHost?: boolean;
  // Voice
  inVoice: boolean;
  micMuted: boolean;
  micError: string | null;
  voiceParticipants: VoiceParticipant[];
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
  // Timer
  timerEndTime?: string | null;
  onTimerEnd?: () => void;
}

const TIMER_PRESETS = [15, 30, 45, 60];

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function RoomHeader({
  room,
  participantCount,
  isHost = false,
  inVoice,
  micMuted,
  micError,
  voiceParticipants,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  timerEndTime,
  onTimerEnd,
}: RoomHeaderProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!timerEndTime) {
      setRemaining(null);
      setTimerExpired(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const update = () => {
      const ms = new Date(timerEndTime).getTime() - Date.now();
      if (ms <= 0) {
        setRemaining(0);
        setTimerExpired(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
        onTimerEnd?.();
      } else {
        setRemaining(ms);
      }
    };

    update();
    intervalRef.current = setInterval(update, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerEndTime, onTimerEnd]);

  const handleSetTimer = async (minutes: number) => {
    setShowTimerMenu(false);
    try {
      await roomsApi2.setTimer(room.id, minutes);
    } catch (e) {
      console.error('Failed to set timer', e);
    }
  };

  const isLow = remaining !== null && remaining < 5 * 60 * 1000 && remaining > 0;

  return (
    <div className="shrink-0">
      <div className="h-14 bg-surface1 border-b border-hairline flex items-center justify-between px-4">
        {/* Left: back + room info */}
        <div className="flex items-center gap-3">
          <Link href="/rooms" className="p-1.5 rounded-md hover:bg-surface2 text-ink-subtle hover:text-ink transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-ink">{room.name}</h1>
              {room.problem && (
                <Badge variant={room.problem.difficulty as 'easy' | 'medium' | 'hard'}>
                  {room.problem.difficulty.charAt(0).toUpperCase() + room.problem.difficulty.slice(1)}
                </Badge>
              )}
            </div>
            {room.problem && (
              <p className="text-xs text-ink-subtle mt-0.5">{room.problem.title}</p>
            )}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">

          {/* Timer */}
          {remaining !== null && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold border"
              style={{
                background: timerExpired
                  ? 'rgba(207,45,86,0.15)'
                  : isLow
                  ? 'rgba(207,45,86,0.10)'
                  : 'rgba(255,255,255,0.05)',
                borderColor: timerExpired || isLow
                  ? 'rgba(207,45,86,0.3)'
                  : 'rgba(255,255,255,0.1)',
                color: timerExpired || isLow ? '#cf2d56' : '#f7f8f8',
              }}
            >
              <Timer className="w-3.5 h-3.5" />
              {timerExpired ? "Time's Up!" : formatCountdown(remaining)}
            </div>
          )}

          {/* Host: Set Timer button */}
          {isHost && (
            <div className="relative">
              <button
                onClick={() => setShowTimerMenu((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-surface2 border border-hairline text-ink-muted hover:text-ink hover:border-hairline-strong transition-colors"
              >
                <Timer className="w-3.5 h-3.5" />
                Set Timer
                <ChevronDown className="w-3 h-3" />
              </button>
              {showTimerMenu && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-surface1 border border-hairline rounded-lg py-1 z-50 shadow-lg">
                  {TIMER_PRESETS.map((min) => (
                    <button
                      key={min}
                      onClick={() => handleSetTimer(min)}
                      className="w-full text-left px-3 py-2 text-xs text-ink-muted hover:bg-surface2 hover:text-ink transition-colors"
                    >
                      {min} minutes
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Voice controls */}
          {inVoice ? (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 mr-1">
                {voiceParticipants.map((p) => (
                  <div
                    key={p.userId}
                    title={`${p.username}${p.muted ? ' (muted)' : p.speaking ? ' (speaking)' : ''}`}
                    className="relative flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold transition-all"
                    style={{
                      background: p.speaking && !p.muted
                        ? 'rgba(39,166,68,0.25)'
                        : 'rgba(255,255,255,0.07)',
                      border: p.speaking && !p.muted
                        ? '1.5px solid rgba(39,166,68,0.6)'
                        : '1.5px solid rgba(255,255,255,0.12)',
                      color: p.speaking ? '#27a644' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {p.muted ? '🔇' : p.username.charAt(0).toUpperCase()}
                    {p.speaking && !p.muted && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-easy animate-pulse" />
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={onToggleMute}
                title={micMuted ? 'Unmute mic' : 'Mute mic'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] text-xs font-medium transition-all ${
                  micMuted
                    ? 'bg-[rgba(207,45,86,0.15)] text-[#cf2d56] border border-[rgba(207,45,86,0.25)]'
                    : 'bg-[rgba(39,166,68,0.12)] text-easy border border-[rgba(39,166,68,0.2)]'
                }`}
              >
                {micMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                {micMuted ? 'Muted' : 'Live'}
              </button>

              <button
                onClick={onLeaveVoice}
                title="Leave voice"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] text-xs font-medium bg-[rgba(207,45,86,0.12)] text-[#cf2d56] border border-[rgba(207,45,86,0.2)] hover:bg-[rgba(207,45,86,0.2)] transition-colors"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                Leave
              </button>
            </div>
          ) : (
            <button
              onClick={onJoinVoice}
              title="Join voice chat"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] text-xs font-medium bg-white/[0.06] text-white/50 border border-white/[0.1] hover:bg-[rgba(39,166,68,0.12)] hover:text-easy hover:border-[rgba(39,166,68,0.2)] transition-all"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Voice
            </button>
          )}

          {/* Participants */}
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {Array.from({ length: Math.min(participantCount, 4) }).map((_, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full bg-surface2 border border-hairline flex items-center justify-center text-[10px] font-medium text-ink-muted"
                >
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <span className="text-xs text-ink-subtle flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {participantCount} / {room.maxParticipants}
            </span>
          </div>

          {/* Status badge */}
          <span className={`text-xs font-medium rounded-full px-3 py-1 ${
            room.status === 'active'  ? 'bg-easy/15 text-easy'
            : room.status === 'waiting' ? 'bg-[rgba(245,166,35,0.15)] text-[#f5a623]'
            : 'bg-surface2 text-ink-subtle'
          }`}>
            {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Mic error banner */}
      {micError && (
        <div className="px-4 py-2 text-xs text-[#cf2d56] bg-[rgba(207,45,86,0.08)] border-b border-[rgba(207,45,86,0.2)] flex items-center gap-2">
          <MicOff className="w-3.5 h-3.5 shrink-0" />
          {micError}
        </div>
      )}
    </div>
  );
}
