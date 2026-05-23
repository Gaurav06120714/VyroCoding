'use client';

import { useEffect, useState } from 'react';
import { Crown, Medal } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { leaderboardApi } from '@/lib/api';
import type { LeaderboardEntry } from '@vyro/types';
import { useAuthStore } from '@/store/auth.store';

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-4 h-4 text-medium" />;
  if (rank === 2) return <Medal className="w-4 h-4 text-white/50" />;
  if (rank === 3) return <Medal className="w-4 h-4 text-ai-done" />;
  return <span className="text-sm text-white/30">{rank}</span>;
}

export default function LeaderboardPage() {
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    leaderboardApi.global({ page, pageSize: 50 }).then((res) => {
      setEntries(res.data.items);
      setTotal(res.data.total);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [page]);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <div className="p-8 max-w-4xl mx-auto">

        <h1 className="text-[40px] font-semibold tracking-[-1px] text-white leading-none mb-8">
          Leaderboard
        </h1>

        <div className="lg-card overflow-hidden">
          {/* Table header */}
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 px-6 py-3 w-20">Rank</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 px-6 py-3">User</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 px-6 py-3 hidden md:table-cell">Problems Solved</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 px-6 py-3">Score</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 px-6 py-3 hidden lg:table-cell">Contests</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.05]">
                    <td className="px-6 py-4 w-20"><div className="h-4 w-6 bg-white/10 rounded animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-36 bg-white/10 rounded animate-pulse" /></td>
                    <td className="px-6 py-4 text-right hidden md:table-cell"><div className="h-4 w-10 bg-white/10 rounded animate-pulse ml-auto" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-14 bg-white/10 rounded animate-pulse ml-auto" /></td>
                    <td className="px-6 py-4 text-right hidden lg:table-cell"><div className="h-4 w-8 bg-white/10 rounded animate-pulse ml-auto" /></td>
                  </tr>
                ))
              ) : (
                entries.map((entry) => {
                  const isCurrentUser = entry.userId === user?.id;
                  return (
                    <tr
                      key={entry.userId}
                      className={`border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.04] transition-colors ${
                        isCurrentUser ? 'bg-[rgba(94,106,210,0.05)]' : ''
                      }`}
                    >
                      <td className="px-6 py-4 w-20">
                        <div className="flex items-center justify-start">
                          <RankDisplay rank={entry.rank} />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-semibold ${
                            isCurrentUser
                              ? 'bg-[rgba(94,106,210,0.2)] border-[rgba(130,143,255,0.4)] text-[#828fff]'
                              : 'bg-white/8 border-white/12 text-white/50'
                          }`}>
                            {entry.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className={`text-sm font-medium ${
                              entry.rank === 1 ? 'text-[#828fff] font-bold' :
                              entry.rank <= 3  ? 'text-white/70 font-semibold' :
                              'text-white'
                            }`}>
                              {entry.username}
                            </span>
                            {isCurrentUser && (
                              <span className="ml-2 text-[10px] text-[#828fff]">(you)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-white/40 hidden md:table-cell">
                        {entry.problemsSolved}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold text-white">
                          {entry.rating.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-white/40 hidden lg:table-cell">
                        —
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-center gap-3 p-4 border-t border-white/[0.08]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-white/40">Page {page}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 50 >= total}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
