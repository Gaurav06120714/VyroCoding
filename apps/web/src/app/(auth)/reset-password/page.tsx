'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { authApiExt } from '@/lib/api';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken]       = useState(searchParams.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApiExt.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-3">
        <p className="text-easy font-medium">Password reset successfully!</p>
        <p className="text-xs text-ink-subtle">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-ink-subtle mb-1.5 block">Reset Token</label>
        <input
          className="lg-input px-3 py-2.5 text-sm font-mono"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste your reset token"
          required
        />
      </div>
      <div>
        <label className="text-xs text-ink-subtle mb-1.5 block">New Password</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            className="lg-input px-3 py-2.5 text-sm pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            minLength={8}
            required
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-muted transition-colors"
          >
            {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-hard">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Reset Password
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-ink-subtle hover:text-ink mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to login
        </Link>

        <div className="lg-strong p-8">
          <h1 className="text-xl font-bold text-ink mb-1">Reset password</h1>
          <p className="text-sm text-ink-subtle mb-6">Enter your token and a new password.</p>
          <Suspense fallback={<div className="text-ink-subtle text-sm">Loading...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
