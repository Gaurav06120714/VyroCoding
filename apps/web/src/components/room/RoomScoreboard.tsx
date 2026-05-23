'use client';

import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { roomsApi2 } from '@/lib/api';
import { LANGUAGE_NAMES, type Language } from '@vyro/types';

interface ScoreboardEntry {
  id: string;
  status: string;
  time_ms: number | null;
  language_id: number;
  created_at: string;
  username: string;
  user_id: string;
}

interface RoomScoreboardProps {
  roomId: string;
  lastSubmissionResult?: ScoreboardEntry | null;
}

function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

const RANK_COLORS = ['#f5a623', '#8a8f98', '#cd7f32'];

export function RoomScoreboard({ roomId, lastSubmissionResult }: RoomScoreboardProps) {
  const [entries, setEntries] = useState<ScoreboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    roomsApi2.scoreboard(roomId)
      .then((res) => setEntries(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [roomId]);

  // Prepend new accepted submission from WS
  useEffect(() => {
    if (!lastSubmissionResult) return;
    setEntries((prev) => {
      const exists = prev.some((e) => e.id === lastSubmissionResult.id);
      if (exists) return prev;
      return [lastSubmissionResult, ...prev];
    });
  }, [lastSubmissionResult]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs text-ink-tertiary">Loading scoreboard...</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
        <Trophy className="w-8 h-8 text-ink-tertiary opacity-40" />
        <p className="text-xs text-ink-tertiary text-center">No solutions yet. Be the first!</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <ul className="py-1">
        {entries.map((entry, idx) => (
          <li
            key={entry.id}
            className="flex items-center gap-2.5 px-3 py-2.5 border-b border-hairline last:border-0"
          >
            {/* Rank */}
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{
                background: idx < 3 ? `${RANK_COLORS[idx]}22` : 'rgba(255,255,255,0.06)',
                color: idx < 3 ? RANK_COLORS[idx] : '#62666d',
              }}
            >
              {idx + 1}
            </span>

            {/* Username + language */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-ink truncate">{entry.username}</p>
              <p className="text-[10px] text-ink-tertiary">
                {LANGUAGE_NAMES[entry.language_id as Language] ?? `Lang ${entry.language_id}`}
              </p>
            </div>

            {/* Time + relative */}
            <div className="text-right shrink-0">
              <p className="text-xs font-mono text-easy">{formatMs(entry.time_ms)}</p>
              <p className="text-[10px] text-ink-tertiary">{relativeTime(entry.created_at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
