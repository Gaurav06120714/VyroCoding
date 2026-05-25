'use client';

import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import type { PresenceUser, WsStatus } from '@/hooks/useRoomWebSocket';
import { LANGUAGE_NAMES } from '@vyro/types';

interface PresenceBarProps {
  users: PresenceUser[];
  currentUserId: string;
  currentUsername: string;
  currentColor: string;
  wsStatus: WsStatus;
}

function StatusDot({ status }: { status: WsStatus }) {
  if (status === 'connected')
    return <span className="w-1.5 h-1.5 rounded-full bg-[#27a644] shadow-[0_0_4px_rgba(39,166,68,0.8)]" />;
  if (status === 'connecting')
    return <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />;
  return <WifiOff className="w-3 h-3 text-[#e5534b]" />;
}

export function PresenceBar({
  users, currentUserId, currentUsername, currentColor, wsStatus,
}: PresenceBarProps) {
  const allUsers = [
    { userId: currentUserId, username: currentUsername, color: currentColor, isTyping: false, language: 93, lastSeen: Date.now() },
    ...users,
  ];

  return (
    <div className="flex items-center gap-2 px-2">
      <StatusDot status={wsStatus} />

      {/* Avatar stack */}
      <div className="flex items-center -space-x-1.5">
        {allUsers.slice(0, 5).map((u, i) => (
          <div
            key={u.userId}
            title={`${u.username}${u.isTyping ? ' (typing…)' : ''}`}
            style={{ borderColor: u.color, zIndex: 10 - i }}
            className="relative w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-bold text-white select-none"
            // eslint-disable-next-line react/no-unknown-property
          >
            <span
              className="w-full h-full rounded-full flex items-center justify-center"
              style={{ backgroundColor: u.color + '33' }}
            >
              <span style={{ color: u.color }}>
                {u.username.charAt(0).toUpperCase()}
              </span>
            </span>
            {u.isTyping && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#828fff] border border-[#161b22] flex items-center justify-center">
                <span className="w-0.5 h-0.5 rounded-full bg-white animate-bounce" />
              </span>
            )}
          </div>
        ))}
        {allUsers.length > 5 && (
          <div className="w-6 h-6 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-[9px] text-white/50">
            +{allUsers.length - 5}
          </div>
        )}
      </div>

      {/* Live language badges for first 3 remote users */}
      <div className="hidden lg:flex items-center gap-1">
        {users.slice(0, 2).map((u) => (
          <span
            key={u.userId}
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: u.color + '22', color: u.color }}
          >
            {u.username.split(' ')[0]} · {LANGUAGE_NAMES[u.language as keyof typeof LANGUAGE_NAMES] ?? 'JS'}
          </span>
        ))}
      </div>

      {wsStatus !== 'connected' && (
        <span className="text-[10px] text-white/30 hidden sm:inline">
          {wsStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
        </span>
      )}
    </div>
  );
}
