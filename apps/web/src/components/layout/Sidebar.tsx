'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Code2,
  LayoutDashboard,
  FileCode,
  Users,
  Trophy,
  BarChart2,
  LogOut,
  User,
  Sun,
  Moon,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useThemeStore } from '@/store/theme.store';

const navItems = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/problems',    label: 'Problems',     icon: FileCode },
  { href: '/rooms',       label: 'Rooms',        icon: Users },
  { href: '/contests',    label: 'Contests',     icon: Trophy },
  { href: '/leaderboard', label: 'Leaderboard',  icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  return (
    <aside className="lg-sidebar w-56 h-screen flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <Link href="/" className="h-14 flex items-center gap-2.5 px-4 border-b border-white/5 shrink-0 hover:bg-white/[0.04] transition-colors">
        <div className="lg-btn-primary flex items-center justify-center w-7 h-7 !px-0 !rounded-[9px] shrink-0">
          <Code2 className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-base text-white">Vyro Coding</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'relative flex items-center gap-3 text-sm font-medium rounded-[11px] px-3 py-2 transition-all duration-200',
                    active
                      ? 'lg text-[#00d4ff]'
                      : 'text-[#8a9bb5] hover:text-white hover:bg-[rgba(0,212,255,0.06)]'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                  {active && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#00d4ff]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Subtle gradient before user section */}
      <div className="h-8 bg-gradient-to-t from-black/30 to-transparent -mt-8 pointer-events-none" />

      {/* User section */}
      <div className="p-3 border-t border-white/[0.06]">
        {user ? (
          <div className="space-y-0.5">
            <Link href={`/profile/${user.username}`} className="flex items-center gap-3 px-3 py-2 hover:bg-[rgba(0,212,255,0.06)] rounded-[11px] transition-colors">
              <div className="w-7 h-7 rounded-full bg-[rgba(0,212,255,0.12)] border border-[rgba(0,212,255,0.25)] flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-[#00d4ff]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.username}</p>
                <p className="text-xs text-white/40">Rating: {user.rating}</p>
              </div>
            </Link>
            {/* Admin link if applicable */}
            {user?.username === 'Gannu' && (
              <Link
                href="/admin"
                className="flex items-center gap-3 text-sm font-medium text-white/40 hover:text-white hover:bg-[rgba(0,212,255,0.06)] rounded-[11px] px-3 py-2 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                Admin
              </Link>
            )}
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 w-full text-sm font-medium text-white/40 hover:text-white hover:bg-[rgba(0,212,255,0.06)] rounded-[11px] px-3 py-2 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-3 w-full text-sm font-medium text-white/40 hover:text-white hover:bg-[rgba(0,212,255,0.06)] rounded-[11px] px-3 py-2 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-3 text-sm font-medium text-white/40 hover:text-white hover:bg-[rgba(0,212,255,0.06)] rounded-[11px] px-3 py-2 transition-colors"
          >
            <User className="w-4 h-4" />
            Sign in
          </Link>
        )}
      </div>
    </aside>
  );
}
