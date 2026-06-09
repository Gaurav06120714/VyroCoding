'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, Mail, ExternalLink, Copy, Check } from 'lucide-react';
import { authApiExt } from '@/lib/api';

type Stage = 'form' | 'email-sent' | 'dev-token';

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [stage, setStage]       = useState<Stage>('form');
  const [devToken, setDevToken] = useState('');
  const [devLink, setDevLink]   = useState('');
  const [copied, setCopied]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApiExt.forgotPassword(email);
      const { resetToken, resetLink } = res.data as {
        message: string;
        resetToken?: string;
        resetLink?: string;
      };

      if (resetToken) {
        
        setDevToken(resetToken);
        setDevLink(resetLink ?? `/reset-password?token=${resetToken}`);
        setStage('dev-token');
      } else {
        
        setStage('email-sent');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(devToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-ink-subtle hover:text-ink mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to login
        </Link>

        <div className="lg-strong p-8">

          {}
          {stage === 'email-sent' && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center"
                   style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
                <Mail className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-ink mb-1">Check your inbox</h1>
                <p className="text-sm text-ink-subtle">
                  If <span className="text-ink font-medium">{email}</span> is registered,
                  we sent a password reset link. Check your spam folder if it doesn&apos;t arrive
                  within a minute.
                </p>
              </div>
              <p className="text-xs text-ink-tertiary">
                The link expires in <strong className="text-ink-subtle">1 hour</strong>.
              </p>
              <button
                onClick={() => { setStage('form'); setError(''); }}
                className="text-xs text-brand hover:text-brand/80 transition-colors underline underline-offset-2"
              >
                Try a different email
              </button>
            </div>
          )}

          {}
          {stage === 'dev-token' && (
            <div className="space-y-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-3"
                     style={{ background: 'rgba(234,179,8,0.1)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.2)' }}>
                  DEV MODE
                </div>
                <h1 className="text-xl font-bold text-ink mb-1">Reset token generated</h1>
                <p className="text-sm text-ink-subtle">
                  No email was sent. Use the token below or click the button to reset your password directly.
                </p>
              </div>

              <div className="p-4 rounded-xl border space-y-2"
                   style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}>
                <p className="text-xs font-medium text-ink-subtle">Reset token</p>
                <div className="flex items-start gap-2">
                  <code className="flex-1 text-xs font-mono text-easy break-all leading-relaxed">
                    {devToken}
                  </code>
                  <button
                    onClick={handleCopy}
                    title="Copy token"
                    className="shrink-0 p-1.5 rounded-lg hover:bg-surface2 transition-colors text-ink-subtle"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-easy" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <Link
                href={devLink}
                className="btn-primary w-full text-sm text-center flex items-center justify-center gap-2 py-2.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Reset Password Now
              </Link>

              <button
                onClick={() => { setStage('form'); setError(''); }}
                className="w-full text-xs text-ink-subtle hover:text-ink transition-colors text-center"
              >
                Try a different email
              </button>
            </div>
          )}

          {}
          {stage === 'form' && (
            <>
              <h1 className="text-xl font-bold text-ink mb-1">Forgot password?</h1>
              <p className="text-sm text-ink-subtle mb-6">
                Enter your account email and we&apos;ll send a reset link.
              </p>

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
                    autoComplete="email"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg text-xs"
                       style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
