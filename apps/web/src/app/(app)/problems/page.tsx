'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
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
}

const DIFFICULTY_FILTERS: { value: Difficulty; label: string }[] = [
  { value: 'all',    label: 'All'    },
  { value: 'easy',   label: 'Easy'   },
  { value: 'medium', label: 'Medium' },
  { value: 'hard',   label: 'Hard'   },
];

export default function ProblemsPage() {
  const [problems, setProblems]   = useState<ProblemRow[]>([]);
  const [total, setTotal]         = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('all');
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);

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
    const timer = setTimeout(fetchProblems, 300);
    return () => clearTimeout(timer);
  }, [fetchProblems]);

  useEffect(() => { setPage(1); }, [difficulty, search]);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <div className="p-8 max-w-6xl mx-auto">

        {/* Header */}
        <h1 className="text-[40px] font-semibold tracking-[-1px] text-white mb-2 leading-none">Problems</h1>
        <p className="text-sm text-white/50 mb-8">{total} problems available</p>

        {/* Filter row */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search problems..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="lg-input h-10 pl-9 pr-4 text-sm"
            />
          </div>

          {/* Difficulty pills */}
          <div className="flex items-center gap-2">
            {DIFFICULTY_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setDifficulty(value)}
                className={cn(
                  'text-sm font-medium transition-colors',
                  difficulty === value
                    ? 'lg-pill text-white px-4 py-1.5'
                    : 'rounded-full px-4 py-1.5 text-white/40 border border-white/[0.08] hover:text-white hover:bg-white/[0.06]'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="lg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 px-6 py-3 w-16">#</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 px-6 py-3">Title</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 px-6 py-3">Difficulty</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 px-6 py-3 hidden md:table-cell">Tags</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 px-6 py-3">Acceptance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.05]">
                    <td className="px-6 py-4"><div className="h-4 w-6 bg-white/10 rounded animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-48 bg-white/10 rounded animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 bg-white/10 rounded animate-pulse" /></td>
                    <td className="px-6 py-4 hidden md:table-cell"><div className="h-4 w-32 bg-white/10 rounded animate-pulse" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-10 bg-white/10 rounded animate-pulse ml-auto" /></td>
                  </tr>
                ))
              ) : problems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-white/40 text-sm">
                    No problems found.
                  </td>
                </tr>
              ) : (
                problems.map((p, idx) => (
                  <tr
                    key={p.id}
                    className="border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 text-sm text-white/30 w-12">
                      {(page - 1) * 20 + idx + 1}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/problems/${p.slug}`}
                        className="text-sm font-medium text-white hover:text-[#828fff] transition-colors"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={p.difficulty as 'easy' | 'medium' | 'hard'}>
                        {p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="flex gap-1.5 flex-wrap">
                        {p.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="lg-pill text-xs text-white/50 px-2.5 py-0.5"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-white/40">
                      {p.acceptanceRate.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-center gap-3 p-4 border-t border-white/[0.08]">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="lg-btn-secondary text-sm px-4 !h-8 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-white/40">Page {page} of {Math.ceil(total / 50)}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 50 >= total}
                className="lg-btn-secondary text-sm px-4 !h-8 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
