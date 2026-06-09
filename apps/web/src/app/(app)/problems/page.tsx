'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, CheckCircle2, Zap } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Badge } from '@/components/ui/Badge';
import { problemsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type Difficulty = 'all' | 'easy' | 'medium' | 'hard';

interface ProblemRow {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  acceptanceRate: number;
  solved?: boolean;
}

interface DifficultyCounts {
  easy: number;
  medium: number;
  hard: number;
}

const DIFFICULTY_FILTERS: { value: Difficulty; label: string }[] = [
  { value: 'all',    label: 'All'    },
  { value: 'easy',   label: 'Easy'   },
  { value: 'medium', label: 'Medium' },
  { value: 'hard',   label: 'Hard'   },
];

const DIFF_COLORS: Record<string, string> = {
  easy:   'text-emerald-400',
  medium: 'text-yellow-400',
  hard:   'text-red-400',
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.04]">
      <div className="w-8 h-4 bg-white/[0.06] rounded animate-pulse" />
      <div className="w-5 h-5 bg-white/[0.06] rounded-full animate-pulse shrink-0" />
      <div className="flex-1 h-4 bg-white/[0.06] rounded animate-pulse max-w-sm" />
      <div className="w-16 h-5 bg-white/[0.06] rounded-full animate-pulse" />
      <div className="hidden md:flex gap-1.5">
        <div className="w-16 h-5 bg-white/[0.06] rounded animate-pulse" />
        <div className="w-16 h-5 bg-white/[0.06] rounded animate-pulse" />
      </div>
      <div className="w-10 h-4 bg-white/[0.06] rounded animate-pulse ml-auto" />
    </div>
  );
}

function StatsBar({ counts }: { counts: DifficultyCounts }) {
  const { easy, medium, hard } = counts;

  return (
    <div className="flex items-center gap-5 text-xs text-white/40">
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400/70" />
        <span>{easy} Easy</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-yellow-400/70" />
        <span>{medium} Medium</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-red-400/70" />
        <span>{hard} Hard</span>
      </span>
    </div>
  );
}

export default function ProblemsPage() {
  const [problems, setProblems]         = useState<ProblemRow[]>([]);
  const [total, setTotal]               = useState(0);
  const [difficulty, setDifficulty]     = useState<Difficulty>('all');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const [loading, setLoading]           = useState(true);
  const [difficultyCounts, setDifficultyCounts] = useState<DifficultyCounts>({ easy: 0, medium: 0, hard: 0 });

  useEffect(() => {
    Promise.all([
      problemsApi.list({ difficulty: 'easy',   pageSize: 1 }),
      problemsApi.list({ difficulty: 'medium', pageSize: 1 }),
      problemsApi.list({ difficulty: 'hard',   pageSize: 1 }),
    ]).then(([e, m, h]) => {
      setDifficultyCounts({ easy: e.data.total, medium: m.data.total, hard: h.data.total });
    }).catch(console.error);
  }, []);

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await problemsApi.list({
        difficulty: difficulty === 'all' ? undefined : difficulty,
        search: search || undefined,
        page,
        pageSize: 50,
      });
      setProblems(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [difficulty, search, page]);

  useEffect(() => {
    const t = setTimeout(fetchProblems, 250);
    return () => clearTimeout(t);
  }, [fetchProblems]);

  useEffect(() => { setPage(1); }, [difficulty, search]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-10">

        {}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Problems</h1>
            <p className="text-sm text-white/40">{total > 0 ? `${total} problems` : 'Loading…'}</p>
          </div>
          {!loading && <StatsBar counts={difficultyCounts} />}
        </div>

        {}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
            <input
              type="text"
              placeholder="Search by title or tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.14] focus:border-[#00d4ff]/50 focus:outline-none rounded-xl text-sm text-white placeholder:text-white/20 transition-colors"
            />
          </div>

          {}
          <div className="flex items-center gap-1.5">
            {DIFFICULTY_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setDifficulty(value)}
                className={cn(
                  'h-9 px-4 rounded-xl text-sm font-medium transition-all border',
                  difficulty === value
                    ? 'bg-[#00d4ff]/15 border-[#00d4ff]/35 text-white font-semibold'
                    : 'bg-transparent border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {}
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden bg-surface1/80">

          {}
          <div className="grid grid-cols-[40px_32px_1fr_90px_auto_70px] items-center gap-4 px-6 py-3 border-b border-white/[0.07] bg-white/[0.02]">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">#</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25"></span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Title</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Difficulty</span>
            <span className="hidden md:block text-[10px] font-semibold uppercase tracking-widest text-white/25">Tags</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25 text-right">Acceptance</span>
          </div>

          {}
          {loading ? (
            Array.from({ length: 12 }).map((_, i) => <SkeletonRow key={i} />)
          ) : problems.length === 0 ? (
            <div className="py-20 text-center">
              <Zap className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-white/30">No problems found.</p>
              {search && (
                <button onClick={() => setSearch('')} className="mt-2 text-xs text-[#00d4ff] hover:underline">
                  Clear search
                </button>
              )}
            </div>
          ) : (
            problems.map((p, idx) => (
              <Link
                key={p.id}
                href={`/problems/${p.slug}`}
                className="grid grid-cols-[40px_32px_1fr_90px_auto_70px] items-center gap-4 px-6 py-3.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors group"
              >
                {}
                <span className="text-[12px] text-white/25 font-mono tabular-nums">
                  {(page - 1) * 50 + idx + 1}
                </span>

                {}
                <div className="flex items-center justify-center">
                  {p.solved ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500/70" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-white/[0.1] group-hover:border-white/20 transition-colors" />
                  )}
                </div>

                {}
                <span className="text-[13px] font-medium text-white/85 group-hover:text-white transition-colors truncate">
                  {p.title}
                </span>

                {}
                <span className={`text-[12px] font-semibold ${DIFF_COLORS[p.difficulty] ?? 'text-white/50'}`}>
                  {p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1)}
                </span>

                {}
                <div className="hidden md:flex gap-1.5 flex-wrap max-w-[240px]">
                  {p.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.07] text-white/40 font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                  {p.tags.length > 2 && (
                    <span className="text-[10px] text-white/20">+{p.tags.length - 2}</span>
                  )}
                </div>

                {}
                <span className="text-[12px] text-white/35 font-mono tabular-nums text-right">
                  {p.acceptanceRate.toFixed(0)}%
                </span>
              </Link>
            ))
          )}
        </div>

        {}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 px-4 rounded-xl text-xs font-medium bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <span className="text-xs text-white/30 px-2 tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-8 px-4 rounded-xl text-xs font-medium bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
