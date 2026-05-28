'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowLeft, Eye, EyeOff, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { authApiExt } from '@/lib/api';

// ── Token validation ──────────────────────────────────────────────────────────

function validateToken(token: string): string | null {
  if (!token) return 'No reset token found. Please request a new password reset link.';
  if (token.length !== 64) return 'The reset token is malformed. Please request a new password reset link.';
  if (!/^[0-9a-f]+$/.test(token)) return 'The reset token contains invalid characters. Please request a new password reset link.';
  return null; // valid
}

// ── Password strength ─────────────────────────────────────────────────────────

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (password.length === 0) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak',   color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair',   color: '#f59e0b' };
  if (score <= 3) return { score, label: 'Good',   color: '#3b82f6' };
  return           { score, label: 'Strong', color: '#22c55e' };
}

// ── Inner form (needs useSearchParams, must be wrapped in Suspense) ───────────

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const tokenFromUrl = searchParams.get('token') ?? '';

  const [token, setToken]       = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Pre-validate the token from URL on mount
  const [tokenError, setTokenError] = useState<string | null>(null);
  useEffect(() => {
    setTokenError(validateToken(tokenFromUrl));
  }, [tokenFromUrl]);

  // Countdown redirect after success
  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) { router.push('/login'); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [success, countdown, router]);

  const strength = getPasswordStrength(password);
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const passwordsMismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side guards
    const tokenValidationError = validateToken(token);
    if (tokenValidationError) { setError(tokenValidationError); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      await authApiExt.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reset failed. Please try again.';
      // Detect expiry vs generic error for better UX
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
        setError('This reset link has expired or is invalid. Please request a new one.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center"
             style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <CheckCircle2 className="w-7 h-7" style={{ color: '#22c55e' }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink mb-1">Password updated!</h2>
          <p className="text-sm text-ink-subtle">Your password has been reset successfully.</p>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-ink-subtle">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Redirecting to login in {countdown}s…
        </div>
        <Link href="/login" className="btn-primary inline-block text-sm px-6 py-2.5">
          Log In Now
        </Link>
      </div>
    );
  }

  // ── Token missing / malformed ──────────────────────────────────────────────

  if (tokenError && !token) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center"
             style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <AlertTriangle className="w-5 h-5" style={{ color: '#ef4444' }} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-ink mb-1">Invalid reset link</h2>
          <p className="text-sm text-ink-subtle">{tokenError}</p>
        </div>
        <Link href="/forgot-password" className="btn-primary inline-block text-sm px-6 py-2.5">
          Request a new link
        </Link>
      </div>
    );
  }

  // ── Reset form ─────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>

      {/* Token field — shown if not pre-filled from URL */}
      {!tokenFromUrl && (
        <div>
          <label className="text-xs text-ink-subtle mb-1.5 block">Reset token</label>
          <input
            className="lg-input px-3 py-2.5 text-xs font-mono"
            value={token}
            onChange={(e) => { setToken(e.target.value.trim()); setError(''); }}
            placeholder="Paste the 64-character token from your email"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      )}

      {/* New password */}
      <div>
        <label className="text-xs text-ink-subtle mb-1.5 block">New password</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            className="lg-input px-3 py-2.5 text-sm pr-10"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Min. 8 characters"
            minLength={8}
            required
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-muted transition-colors"
          >
            {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Strength bar */}
        {password.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full transition-colors duration-200"
                  style={{
                    background: i <= strength.score ? strength.color : 'var(--color-surface2, #23232d)',
                  }}
                />
              ))}
            </div>
            <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
          </div>
        )}
      </div>

      {/* Confirm password */}
      <div>
        <label className="text-xs text-ink-subtle mb-1.5 block">Confirm password</label>
        <div className="relative">
          <input
            type={showCf ? 'text' : 'password'}
            className={`lg-input px-3 py-2.5 text-sm pr-10 transition-colors ${
              passwordsMismatch ? 'border-red-500/50' : passwordsMatch ? 'border-green-500/40' : ''
            }`}
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(''); }}
            placeholder="Re-enter your password"
            required
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowCf((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-muted transition-colors"
          >
            {showCf ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        {passwordsMismatch && (
          <p className="text-xs mt-1" style={{ color: '#ef4444' }}>Passwords do not match</p>
        )}
        {passwordsMatch && (
          <p className="text-xs mt-1" style={{ color: '#22c55e' }}>Passwords match ✓</p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg text-xs"
             style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error.toLowerCase().includes('expired') ? (
            <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#f87171' }} />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#f87171' }} />
          )}
          <div style={{ color: '#f87171' }}>
            {error}
            {(error.toLowerCase().includes('expired') || error.toLowerCase().includes('invalid')) && (
              <div className="mt-1.5">
                <Link href="/forgot-password"
                      className="underline underline-offset-2 hover:no-underline">
                  Request a new reset link →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !password || !confirm || passwordsMismatch}
        className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Resetting password…</>
        ) : (
          'Reset Password'
        )}
      </button>

    </form>
  );
}

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
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
          <h1 className="text-xl font-bold text-ink mb-1">Reset password</h1>
          <p className="text-sm text-ink-subtle mb-6">
            Choose a strong new password for your account.
          </p>

          <Suspense fallback={
            <div className="flex items-center justify-center gap-2 text-ink-subtle text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
