'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Code2, Users, Cpu, Bot } from 'lucide-react';

const navLinks = [
  { href: '/problems',    label: 'Problems'    },
  { href: '/rooms',       label: 'Rooms'       },
  { href: '/contests',    label: 'Contests'    },
  { href: '/leaderboard', label: 'Leaderboard' },
];

const footerLinks = [
  { href: '/problems',    label: 'Problems'    },
  { href: '/rooms',       label: 'Rooms'       },
  { href: '/contests',    label: 'Contests'    },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/login',       label: 'Sign in'     },
  { href: '/register',    label: 'Register'    },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 60); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-white overflow-x-hidden">

      {}
      <nav className={`fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-8 transition-all duration-300 ${scrolled ? 'lg-bar' : 'bg-transparent'}`}>
        <div className="flex items-center gap-2.5">
          <div className="lg-btn-primary flex items-center justify-center w-7 h-7 !px-0 !rounded-[9px]">
            <Code2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-base text-white">Vyro Coding</span>
        </div>
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href} className="text-sm font-medium text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-[10px] hover:bg-white/[0.06]">
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Sign in</Link>
          <Link href="/register" className="lg-btn-primary inline-flex items-center justify-center px-4 h-8 text-sm">Start Free</Link>
        </div>
      </nav>

      {}
      <section className="relative pt-36 pb-24 px-4 text-center overflow-hidden">
        <div className="relative max-w-4xl mx-auto">
          <h1 className="font-extrabold leading-[1.0] tracking-[-0.05em] text-white mb-6" style={{ fontSize: 'var(--text-hero)' }}>
            Practice code.<br />
            <span className="gradient-text">With other people.</span>
          </h1>
          <p className="text-white/55 max-w-lg mx-auto mb-10 leading-relaxed" style={{ fontSize: 'var(--text-lg)' }}>
            Shared coding rooms, an AI interviewer that gives real feedback, code execution in 7 languages, and live contests. All in one place.
          </p>
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <Link href="/register" className="lg-btn-primary inline-flex items-center justify-center px-6 h-10 text-sm">Start Coding</Link>
              <Link href="/problems" className="lg-btn-secondary inline-flex items-center justify-center px-6 h-10 text-sm">Browse Problems</Link>
            </div>
            <p className="text-xs text-white/30">No credit card required</p>
          </div>
        </div>
      </section>

      {}
      <div className="max-w-5xl mx-auto px-4 pb-20">
        <div className="lg p-5">
          <div className="flex items-center gap-1.5 mb-4">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-[11px] text-white/30 font-mono">two-sum.js — Vyro Coding</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-[rgba(16,185,129,0.15)] text-easy text-[11px] font-semibold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-easy" />Live
              </span>
              <div className="flex -space-x-1.5">
                {['A','B','C'].map((c) => (
                  <div key={c} className="w-6 h-6 rounded-full bg-[rgba(0,212,255,0.2)] border border-white/10 flex items-center justify-center text-[9px] font-bold text-[#00d4ff]">{c}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg-card overflow-hidden" style={{ borderRadius: '12px' }}>
            <div className="flex">
              <div className="select-none px-3 py-4 text-right font-mono text-[12px] text-white/20 leading-6 bg-white/[0.02] border-r border-white/[0.06] min-w-[3rem]">
                {[1,2,3,4,5,6,7,8,9,10].map((n) => <div key={n}>{n}</div>)}
              </div>
              <div className="px-4 py-4 font-mono text-[12px] leading-6 overflow-x-auto flex-1">
                <div><span className="text-[#00d4ff]">function</span> <span className="text-[#c0a8dd]">twoSum</span><span className="text-white/50">(nums, target) {'{'}</span></div>
                <div className="ml-4"><span className="text-[#00d4ff]">const</span> <span className="text-white">map</span><span className="text-white/50"> = </span><span className="text-[#00d4ff]">new</span> <span className="text-[#c0a8dd]">Map</span><span className="text-white/50">();</span></div>
                <div className="ml-4"><span className="text-[#00d4ff]">for</span><span className="text-white/50"> (</span><span className="text-[#00d4ff]">let</span><span className="text-white"> i</span><span className="text-white/50"> = 0; i &lt; nums.length; i++) {'{'}</span></div>
                <div className="ml-8"><span className="text-[#00d4ff]">const</span><span className="text-white"> comp</span><span className="text-white/50"> = target - nums[i];</span></div>
                <div className="ml-8"><span className="text-[#00d4ff]">if</span><span className="text-white/50"> (map.</span><span className="text-[#c0a8dd]">has</span><span className="text-white/50">(comp))</span></div>
                <div className="ml-12"><span className="text-[#00d4ff]">return</span><span className="text-white/50"> [map.</span><span className="text-[#c0a8dd]">get</span><span className="text-white/50">(comp), i];</span></div>
                <div className="ml-8"><span className="text-white/50">map.</span><span className="text-[#c0a8dd]">set</span><span className="text-white/50">(nums[i], i);</span></div>
                <div className="ml-4"><span className="text-white/50">{'}'}</span></div>
                <div><span className="text-white/50">{'}'}</span></div>
                <div className="mt-1 text-white/25">{'// Runtime: 56ms · Memory: 42.4MB'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="mx-4 max-w-5xl md:mx-auto mb-0">
        <div className="lg-card rounded-[18px] overflow-hidden">
          {}
          <div className="flex items-center gap-2 px-4 h-9 border-b border-white/[0.06] bg-white/[0.02]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]/70" />
            <span className="ml-3 text-[11px] text-white/30 font-mono">judge · room-42 · alice_dev</span>
            <span className="ml-auto inline-flex items-center gap-1.5 bg-[rgba(16,185,129,0.12)] text-easy text-[11px] font-semibold px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-easy" />Accepted
            </span>
          </div>
          {}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-white/[0.06]">
            {[
              { label: 'Problem', value: 'Valid Parentheses', sub: 'Easy · Stack' },
              { label: 'Runtime', value: '56 ms', sub: 'faster than 87.3%' },
              { label: 'Memory', value: '42.4 MB', sub: 'less than 91.2%' },
              { label: 'Test cases', value: '91 / 91', sub: 'all passed' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="px-6 py-5">
                <div className="text-[10px] uppercase tracking-[0.5px] text-white/30 mb-2">{label}</div>
                <div className="font-mono font-semibold text-white text-[15px] mb-0.5">{value}</div>
                <div className="text-[11px] text-white/30">{sub}</div>
              </div>
            ))}
          </div>
          {}
          <div className="border-t border-white/[0.06] px-6 py-3 flex items-center gap-4 bg-white/[0.01]">
            <span className="text-[11px] text-white/25 font-mono">JavaScript · submitted 2 min ago</span>
            <div className="flex gap-1.5 ml-auto">
              {[100, 87, 72, 94, 56, 88, 100, 91, 76, 100, 83, 95].map((p, i) => (
                <div key={i} className="w-1 rounded-full bg-easy/60" style={{ height: `${Math.max(8, p * 0.24)}px`, opacity: p === 100 ? 1 : 0.4 }} />
              ))}
              <span className="text-[10px] text-white/20 ml-1 self-end">pass rate</span>
            </div>
          </div>
        </div>
      </div>

      {}
      <section className="py-24 max-w-6xl mx-auto px-4">
        <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-white/40 text-center mb-3">What&apos;s included</p>
        <h2 className="font-bold tracking-[-0.04em] text-white text-center mb-12" style={{ fontSize: 'var(--text-3xl)' }}>
          A platform built for real practice
        </h2>
        <div className="grid grid-cols-12 gap-4">

          <div className="col-span-12 md:col-span-7lg-card p-6">
            <div className="w-10 h-10 lg rounded-[12px] mb-4 flex items-center justify-center">
              <Users className="w-5 h-5 text-white/60" />
            </div>
            <h3 className="font-semibold tracking-[-0.03em] text-white mb-2" style={{ fontSize: 'var(--text-xl)' }}>Real-time Rooms</h3>
            <p className="text-sm text-white/50 leading-relaxed mb-6">Write code with other people in real time. Everyone sees every keystroke as it happens — no refresh, no lag.</p>
            <div className="lg-card p-3 font-mono text-[11px]" style={{ borderRadius: '12px' }}>
              <div className="flex items-center gap-2 mb-2 text-white/30">
                <span className="w-2 h-2 rounded-full bg-easy" /><span>room-42 · 3 participants</span>
              </div>
              <div className="text-white/50">{'> Collaborating on: Merge Intervals'}</div>
              <div className="text-[#00d4ff] mt-1">{'  alice is typing...'}</div>
            </div>
          </div>

          <div className="col-span-12 md:col-span-5lg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 lg rounded-[12px] flex items-center justify-center">
                <Bot className="w-5 h-5 text-white/60" />
              </div>
              <span className="inline-flex items-center gap-1.5 bg-[rgba(0,212,255,0.15)] text-[#00d4ff] text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[rgba(0,212,255,0.25)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]" />AI thinking
              </span>
            </div>
            <h3 className="font-semibold tracking-[-0.03em] text-white mb-2" style={{ fontSize: 'var(--text-xl)' }}>AI Interviewer</h3>
            <p className="text-sm text-white/50 leading-relaxed">A mock interviewer powered by Claude that reads your code, gives hints when you&apos;re stuck, and scores your solution when you finish.</p>
          </div>

          <div className="col-span-12 md:col-span-5lg-card p-6">
            <div className="w-10 h-10 lg rounded-[12px] mb-4 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white/60" />
            </div>
            <h3 className="font-semibold tracking-[-0.03em] text-white mb-2" style={{ fontSize: 'var(--text-xl)' }}>Code Execution</h3>
            <p className="text-sm text-white/50 leading-relaxed mb-4">Paste your solution and run it against test cases. Supports 7 languages. Results come back in under a second.</p>
            <div className="lg-card p-3 font-mono text-[11px] space-y-1" style={{ borderRadius: '12px' }}>
              <div className="text-white/40">{'$ run solution.py'}</div>
              <div className="text-easy">{'✓ All 23 test cases passed'}</div>
              <div className="text-white/25">{'  Runtime: 56ms  Memory: 14.2 MB'}</div>
            </div>
          </div>

          <div className="col-span-12 md:col-span-7lg-card p-6">
            <h3 className="font-semibold tracking-[-0.03em] text-white mb-5" style={{ fontSize: 'var(--text-xl)' }}>Live Leaderboard</h3>
            <div className="space-y-2.5">
              {[
                { name: 'alice_dev', score: 2840, pct: 100 },
                { name: 'bob_codes', score: 2610, pct: 92  },
                { name: 'carol_01',  score: 2390, pct: 84  },
                { name: 'dave_io',   score: 2100, pct: 74  },
              ].map((row, idx) => (
                <div key={row.name} className="flex items-center gap-3">
                  <span className="w-5 text-right text-[11px] text-white/25 font-mono">{idx + 1}</span>
                  <span className="w-20 text-xs text-white/45 truncate">{row.name}</span>
                  <div className="flex-1 bg-white/[0.06] rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-[rgba(0,212,255,0.7)] rounded-full" style={{ width: `${row.pct}%` }} />
                  </div>
                  <span className="text-[11px] text-white/25 font-mono w-12 text-right">{row.score}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {}
      <section className="py-24 max-w-6xl mx-auto px-4">
        <div className="lg-strong p-12 text-center">
          <h2 className="font-bold tracking-[-0.04em] text-white mb-4" style={{ fontSize: 'var(--text-2xl)' }}>
            Start coding with other people
          </h2>
          <p className="text-white/50 mb-8 max-w-md mx-auto leading-relaxed" style={{ fontSize: 'var(--text-base)' }}>
            Free to sign up. Practice problems on your own, or drop into a room with other developers and work through them together.
          </p>
          <Link href="/register" className="lg-btn-primary inline-flex items-center justify-center px-8 h-10 text-sm">
            Create Free Account
          </Link>
        </div>
      </section>

      {}
      <footer className="border-t border-white/[0.06] py-10 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-6 mb-8">
            {footerLinks.map(({ href, label }) => (
              <Link key={href} href={href} className="text-xs text-white/25 hover:text-white/50 transition-colors">{label}</Link>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="lg-btn-primary flex items-center justify-center w-6 h-6 !px-0 !rounded-[7px]">
                <Code2 className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-sm text-white">Vyro Coding</span>
            </div>
            <p className="text-white/25 text-sm">&copy; {new Date().getFullYear()} Vyro Coding. Built for developers.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
