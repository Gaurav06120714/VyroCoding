'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Trophy, Code2, Target, Flame, ArrowRight, Plus } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/store/auth.store';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

const recentActivity = [
  { slug: 'two-sum',                              title: 'Two Sum',            difficulty: 'easy',   status: 'accepted',     time: '2h ago' },
  { slug: 'valid-parentheses',                    title: 'Valid Parentheses',  difficulty: 'easy',   status: 'accepted',     time: '1d ago' },
  { slug: 'maximum-subarray',                     title: 'Maximum Subarray',   difficulty: 'medium', status: 'wrong_answer', time: '2d ago' },
  { slug: 'longest-substring-without-repeating',  title: 'Longest Substring',  difficulty: 'medium', status: 'accepted',     time: '3d ago' },
];

export default function DashboardPage() {
  const { user, fetchMe } = useAuthStore();
  useScrollAnimation();

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <div className="p-8 max-w-6xl mx-auto space-y-4">

        {/* Row 1 */}
        <div className="grid grid-cols-12 gap-4 fade-up">
          <div className="col-span-12 md:col-span-8 lg-card lg-shimmer p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 mb-2">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-white leading-snug mb-1">
              {greeting}, {user?.username ?? 'Coder'}
            </h1>
            <p className="text-sm text-white/50 mb-5">Keep grinding — consistency beats intensity.</p>
            <div className="flex items-center gap-3">
              <Link href="/rooms" className="lg-btn-primary inline-flex items-center gap-2 px-4 h-9 text-sm">
                <Plus className="w-4 h-4" />Start a Room
              </Link>
              <Link href="/problems" className="lg-btn-secondary inline-flex items-center gap-2 px-4 h-9 text-sm">
                Practice Problems<ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="col-span-12 md:col-span-4 lg-card p-6 flex flex-col justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 mb-3">Current Rating</p>
            <div>
              <span className="gradient-text font-extrabold leading-none" style={{ fontSize: 'var(--text-3xl)' }}>
                {user?.rating ?? 1200}
              </span>
              <span className="text-white/50 text-lg ml-1">pts</span>
            </div>
            <p className="text-xs text-white/30 mt-3 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-white/30" />Global rank #—
            </p>
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-12 gap-4 fade-up fade-up-delay-1">
          {[
            { icon: Code2,  label: 'Problems Solved', value: user?.problemsSolved ?? 0, sub: 'All time'       },
            { icon: Flame,  label: 'Day Streak',       value: '7 🔥',                    sub: 'Keep it going!' },
            { icon: Target, label: 'Acceptance Rate',  value: '72%',                     sub: 'Above average'  },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="col-span-12 md:col-span-4 lg-card lg-shimmer p-6">
              <div className="w-8 h-8 lg rounded-[10px] flex items-center justify-center mb-4">
                <Icon className="w-4 h-4 text-white/60" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 mb-2">{label}</p>
              <p className="gradient-text font-extrabold leading-none" style={{ fontSize: 'var(--text-3xl)' }}>{value}</p>
              <p className="text-xs text-white/30 mt-2">{sub}</p>
            </div>
          ))}
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-12 gap-4 fade-up fade-up-delay-2">
          <div className="col-span-12 md:col-span-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
              <Link href="/problems" className="text-xs text-[#828fff] hover:underline">View all</Link>
            </div>
            <div className="lg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 px-4 py-3">Problem</th>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 px-4 py-3">Difficulty</th>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 px-4 py-3">Status</th>
                    <th className="text-right text-[11px] font-semibold uppercase tracking-[0.88px] text-white/40 px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((item, i) => (
                    <tr key={item.slug} className={`border-b border-white/[0.05] hover:bg-white/[0.04] transition-colors ${i === recentActivity.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-4 py-4">
                        <Link href={`/problems/${item.slug}`} className="text-sm text-white hover:text-[#828fff] transition-colors">{item.title}</Link>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={item.difficulty as 'easy' | 'medium' | 'hard'}>
                          {item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-medium ${item.status === 'accepted' ? 'text-easy' : 'text-hard'}`}>
                          {item.status === 'accepted' ? 'Accepted' : 'Wrong Answer'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-xs text-white/40">{item.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col-span-12 md:col-span-4">
            <h2 className="text-sm font-semibold text-white mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { href: '/rooms',       label: 'Start a Room',      sub: 'Code with friends in real-time', icon: Plus   },
                { href: '/problems',    label: 'Practice Problems',  sub: '10+ problems across all levels', icon: Code2  },
                { href: '/contests',    label: 'Join a Contest',     sub: 'Compete and earn rating',        icon: Trophy },
                { href: '/leaderboard', label: 'View Leaderboard',   sub: 'See how you rank globally',      icon: Target },
              ].map(({ href, label, sub, icon: Icon }) => (
                <Link key={href} href={href} className="lg-card p-4 flex items-center justify-between hover:bg-white/[0.07] transition-all group" style={{ borderRadius: '14px' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 lg rounded-[9px] flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-white/60" />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{label}</p>
                      <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/30 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
