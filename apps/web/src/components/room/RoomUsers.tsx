'use client';

import type { RoomParticipant } from '@vyro/types';
import { LANGUAGE_NAMES, Language } from '@vyro/types';

interface RoomUsersProps {
  participants: RoomParticipant[];
  hostId: string;
}

export function RoomUsers({ participants, hostId }: RoomUsersProps) {
  return (
    <div className="bg-surface2 h-full">
      <div className="px-4 py-2.5 border-b border-hairline">
        <h3 className="text-[11px] font-semibold text-ink-subtle uppercase tracking-[0.88px]">
          Participants ({participants.length})
        </h3>
      </div>
      <div className="p-3 space-y-0">
        {participants.map((p) => (
          <div
            key={p.userId}
            className="flex items-center gap-3 py-2 border-b border-hairline last:border-b-0"
          >
            {/* Online indicator */}
            <div className="relative shrink-0">
              <div className="w-7 h-7 rounded-full bg-surface1 border border-hairline flex items-center justify-center text-xs font-medium text-ink-muted">
                {(p.user?.username ?? 'U').charAt(0).toUpperCase()}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-easy rounded-full border border-surface2" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-ink-muted font-medium truncate">
                  {p.user?.username ?? 'Unknown'}
                </span>
                {p.userId === hostId && (
                  <span className="text-[9px] bg-medium/15 text-medium border border-medium/25 px-1.5 py-0.5 rounded-pill font-medium shrink-0">
                    Host
                  </span>
                )}
              </div>
              {p.languageId && (
                <p className="text-[10px] text-ink-tertiary">
                  {LANGUAGE_NAMES[p.languageId as Language] ?? 'Unknown'}
                </p>
              )}
            </div>
          </div>
        ))}
        {participants.length === 0 && (
          <p className="text-xs text-ink-tertiary text-center py-4">No participants yet.</p>
        )}
      </div>
    </div>
  );
}
