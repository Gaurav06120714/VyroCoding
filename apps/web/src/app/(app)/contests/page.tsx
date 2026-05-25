'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Trophy, Clock, Users, Calendar, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { contestsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Contest } from '@vyro/types';

type StatusFilter = 'all' | 'active' | 'upcoming' | 'ended';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all',      label: 'All'      },
  { value: 'active',   label: 'Active'   },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ended',    label: 'Past'     },
];

function formatDuration(start: string, end: string): string {
  const durationMs = new Date(end).getTime() - new Date(start).getTime();
  const hours   = Math.floor(durationMs / 3_600_000);
  const minutes = Math.floor((durationMs % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

function useCountdown(targetDate: string): string {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setRemaining('00:00:00'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setRemaining(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return remaining;
}

function ContestCard({ contest, onJoin }: { contest: Contest; onJoin: (id: string) => void }) {
  const isActive   = contest.status === 'active';
  const isUpcoming = contest.status === 'upcoming';
  const timerTarget = isActive ? contest.endTime : contest.startTime;
  const countdown  = useCountdown(timerTarget);
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    setJoining(true);
    try {
      await onJoin(contest.id);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="lg-card p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-lg font-semibold text-white">{contest.title}</h3>
        <span className={cn(
          'text-xs font-medium rounded-full px-3 py-0.5 ml-3 shrink-0',
          isActive
            ? 'bg-[rgba(39,166,68,0.15)] text-[#27a644] animate-pulse'
            : isUpcoming
            ? 'bg-[rgba(94,106,210,0.15)] text-[#828fff]'
            : 'bg-white/8 text-white/40'
        )}>
          {isActive ? 'Live' : isUpcoming ? 'Upcoming' : 'Ended'}
        </span>
      </div>

      {/* Time info */}
      <div className="flex items-center gap-4 text-xs text-white/40 mb-3 font-mono">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {new Date(contest.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDuration(contest.startTime, contest.endTime)}
        </span>
        {contest.participantCount !== undefined && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {contest.participantCount}
          </span>
        )}
      </div>

      {/* Countdown timer */}
      {(isActive || isUpcoming) && (
        <div className="mb-4 bg-surface2 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            {isActive ? 'Ends in' : 'Starts in'}
          </span>
          <span className={cn('font-mono text-sm font-semibold', isActive ? 'text-[#27a644]' : 'text-[#828fff]')}>
            {countdown}
          </span>
        </div>
      )}

      {/* CTA */}
      <div className="flex gap-2">
        <Link href={`/contests/${contest.id}`} className="flex-1">
          <Button variant="secondary" className="w-full" size="sm">
            {contest.status === 'ended' ? 'View Results' : 'Details'}
          </Button>
        </Link>
        {(isActive || isUpcoming) && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleJoin}
            disabled={joining}
            className="flex-1"
          >
            {joining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {isActive ? 'Join Now' : 'Register'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ContestsPage() {
  const [contests, setContests]   = useState<Contest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<StatusFilter>('all');
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    contestsApi.list().then((res) => {
      setContests(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleJoin = useCallback(async (id: string) => {
    try {
      await contestsApi.join(id);
      // Refresh participant count
      setContests((prev) => prev.map((c) =>
        c.id === id ? { ...c, participantCount: (c.participantCount ?? 0) + 1 } : c
      ));
      setToast({ msg: 'Successfully joined the contest!', ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to join contest';
      setToast({ msg, ok: false });
    }
  }, []);

  const filtered = filter === 'all'
    ? contests
    : contests.filter((c) => c.status === filter);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <div className="p-8 max-w-6xl mx-auto">

        {/* Header */}
        <h1 className="text-[40px] font-semibold tracking-[-1px] text-white leading-none mb-2">
          Contests
        </h1>
        <p className="text-sm text-white/50 mb-8">
          Compete in timed programming challenges and climb the leaderboard.
        </p>

        {/* Filter pills */}
        <div className="flex items-center gap-2 mb-8">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                'text-sm font-medium transition-colors',
                filter === value
                  ? 'lg-pill text-white px-4 py-1.5'
                  : 'rounded-full px-4 py-1.5 text-white/40 border border-white/[0.08] hover:text-white hover:bg-white/[0.06]'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="lg-card p-6 space-y-3">
                <div className="h-5 bg-white/10 rounded animate-pulse w-1/3" />
                <div className="h-4 bg-white/10 rounded animate-pulse w-1/2" />
                <div className="h-9 bg-white/10 rounded animate-pulse w-full mt-4" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="lg-card p-16 text-center">
            <Trophy className="w-10 h-10 text-white/30 mx-auto mb-4" />
            <h3 className="font-semibold text-white mb-1">No contests</h3>
            <p className="text-sm text-white/45">
              {filter === 'all' ? 'Check back soon for upcoming contests.' : `No ${filter} contests right now.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <ContestCard key={c.id} contest={c} onJoin={handleJoin} />
            ))}
          </div>
        )}

      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-50',
          toast.ok ? 'bg-[#27a644] text-white' : 'bg-[#e5534b] text-white'
        )}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
