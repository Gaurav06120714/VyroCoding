'use client';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/Button';
import { Code2 } from 'lucide-react';

const navLinks = [
  { href: '/problems',    label: 'Problems'    },
  { href: '/rooms',       label: 'Rooms'       },
  { href: '/contests',    label: 'Contests'    },
  { href: '/leaderboard', label: 'Leaderboard' },
];

export function Navbar({ title: _title }: { title?: string }) {
  const { user, logout } = useAuthStore();
  return (
    <header className="lg-bar h-14 flex items-center justify-between px-6 sticky top-0 z-30">
      <Link href="/" className="flex items-center gap-2.5 shrink-0">
        <div className="lg-btn-primary flex items-center justify-center w-7 h-7 !px-0 !rounded-[9px]">
          <Code2 className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-base text-white">Vyro Coding</span>
      </Link>
      <nav className="hidden md:flex items-center gap-1">
        {navLinks.map(({ href, label }) => (
          <Link key={href} href={href} className="text-sm font-medium text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-[10px] hover:bg-white/[0.06]">
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-3 shrink-0">
        {user ? (
          <>
            <span className="text-sm text-white/40 hidden md:block">{user.username}</span>
            <Button variant="secondary" size="sm" onClick={logout}>Sign Out</Button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Sign in</Link>
            <Link href="/register"><Button variant="primary" size="sm">Start Free</Button></Link>
          </>
        )}
      </div>
    </header>
  );
}
