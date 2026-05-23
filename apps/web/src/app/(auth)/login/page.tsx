'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Code2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch {
      // error is set in store
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      {/* Ambient glow behind card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div style={{
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(94,106,210,0.12) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />
      </div>

      <div className="w-full max-w-[440px] relative">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="lg-btn-primary flex items-center justify-center w-9 h-9 !px-0 !rounded-[12px]">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <Link href="/" className="font-bold text-lg text-white">Vyro Coding</Link>
        </div>

        {/* Card */}
        <div className="lg-strong p-8">
          <h1 className="text-2xl font-bold tracking-[-0.04em] text-white mb-1">Welcome back</h1>
          <p className="text-sm text-white/45 mb-6">Sign in to continue coding</p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-[11px] text-sm" style={{
              background: 'rgba(207,45,86,0.12)',
              border: '1px solid rgba(207,45,86,0.25)',
              color: '#cf2d56',
            }}>{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.4px] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="lg-input h-11 px-4 text-sm"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.4px]">Password</label>
                <Link href="/forgot-password" className="text-[10px] text-white/35 hover:text-[#828fff] transition-colors">Forgot password?</Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="lg-input h-11 px-4 pr-11 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="lg-btn-primary w-full h-11 mt-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-white/35 mt-5">
          {"Don't have an account? "}
          <Link href="/register" className="text-[#828fff] hover:underline font-medium">Create one</Link>
        </p>
      </div>
    </div>
  );
}
