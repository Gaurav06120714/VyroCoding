'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, Copy, Check } from 'lucide-react';
import { authApiExt } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [resetToken, setResetToken] = useState('');
  const [copied, setCopied]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApiExt.forgotPassword(email);
      if (res.data.resetToken) {
        setResetToken(res.data.resetToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(resetToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-ink-subtle hover:text-ink mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to login
        </Link>

        <div className="lg-strong p-8">
          <h1 className="text-xl font-bold text-ink mb-1">Forgot password?</h1>
          <p className="text-sm text-ink-subtle mb-6">Enter your email and we&apos;ll generate a reset token.</p>

          {resetToken ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border" style={{ background: 'rgba(39,166,68,0.08)', borderColor: 'rgba(39,166,68,0.2)' }}>
                <p className="text-xs text-ink-subtle mb-2">Reset token (dev mode):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono text-easy break-all">{resetToken}</code>
                  <button onClick={handleCopy} className="shrink-0 p-1.5 rounded-lg hover:bg-surface2 transition-colors text-ink-subtle">
                    {copied ? <Check className="w-3.5 h-3.5 text-easy" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <Link
                href={`/reset-password?token=${resetToken}`}
                className="btn-primary w-full text-sm text-center block py-2.5"
              >
                Reset Password
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-ink-subtle mb-1.5 block">Email address</label>
                <input
                  type="email"
                  className="lg-input px-3 py-2.5 text-sm"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-xs text-hard">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Generate Reset Token
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
