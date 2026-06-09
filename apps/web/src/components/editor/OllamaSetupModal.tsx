'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Terminal, CheckCircle2, XCircle, Loader2, Copy, Check,
  Download, RefreshCw, Cpu, ArrowRight, Wifi, WifiOff, X,
} from 'lucide-react';
import type { OllamaSetupStatus } from '@/lib/api';

type Platform = 'mac' | 'linux' | 'windows';

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'linux';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'mac';
  return 'linux';
}

const INSTALL_STEPS: Record<Platform, { title: string; steps: { cmd?: string; desc: string }[] }> = {
  mac: {
    title: 'macOS',
    steps: [
      { desc: 'Download the macOS installer from the official site:', cmd: 'https://ollama.com/download/mac' },
      { desc: 'Or install via Homebrew:', cmd: 'brew install ollama' },
      { desc: 'Start Ollama and keep it running in the background:', cmd: 'ollama serve' },
      { desc: 'Pull the recommended coding model:', cmd: 'ollama pull qwen2.5-coder:7b' },
    ],
  },
  linux: {
    title: 'Linux',
    steps: [
      { desc: 'Install Ollama with one command:', cmd: 'curl -fsSL https://ollama.com/install.sh | sh' },
      { desc: 'Start the Ollama daemon:', cmd: 'ollama serve' },
      { desc: 'Or enable as a system service:', cmd: 'sudo systemctl enable --now ollama' },
      { desc: 'Pull the recommended coding model:', cmd: 'ollama pull qwen2.5-coder:7b' },
    ],
  },
  windows: {
    title: 'Windows',
    steps: [
      { desc: 'Download the Windows installer:', cmd: 'https://ollama.com/download/windows' },
      { desc: 'Run the installer and follow prompts. Ollama starts automatically.' },
      { desc: 'Open PowerShell and pull the coding model:', cmd: 'ollama pull qwen2.5-coder:7b' },
    ],
  },
};

function CopyCmd({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  const isUrl = cmd.startsWith('http');

  const copy = () => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (isUrl) {
    return (
      <a
        href={cmd}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 mt-1.5 px-3 py-2 rounded-lg bg-[#00d4ff]/10 border border-[#00d4ff]/20 text-[#00d4ff] text-xs font-mono hover:bg-[#00d4ff]/15 transition-colors group"
      >
        <ArrowRight className="w-3 h-3 shrink-0" />
        <span className="truncate">{cmd}</span>
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <code className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/[0.08] text-[11px] font-mono text-[#c9d1d9] overflow-x-auto">
        {cmd}
      </code>
      <button
        onClick={copy}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.10] transition-colors"
        title="Copy"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/40" />}
      </button>
    </div>
  );
}

interface PullProgress {
  status: string;
  percent?: number;
  done: boolean;
  error?: string;
}

function PullProgressBar({ progress }: { progress: PullProgress | null }) {
  if (!progress) return null;
  const pct = progress.percent ?? 0;
  const isError = !!progress.error;
  const isDone = progress.done && !isError;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className={`font-medium ${isError ? 'text-red-400' : isDone ? 'text-emerald-400' : 'text-white/60'}`}>
          {isError ? `Error: ${progress.error}` : isDone ? '✓ Model ready' : progress.status}
        </span>
        {!isError && !isDone && pct > 0 && (
          <span className="text-white/30 font-mono tabular-nums">{pct}%</span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isError ? 'bg-red-500' : isDone ? 'bg-emerald-500' : 'bg-[#00d4ff]'
          }`}
          style={{ width: isDone ? '100%' : `${Math.max(pct, 3)}%` }}
        />
      </div>
    </div>
  );
}

function StatusDot({ ok, loading }: { ok: boolean; loading?: boolean }) {
  if (loading) return <Loader2 className="w-3.5 h-3.5 text-[#00d4ff] animate-spin" />;
  return ok
    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
    : <XCircle className="w-3.5 h-3.5 text-red-400/80" />;
}

interface OllamaSetupModalProps {
  onClose: () => void;
  onReady: (model: string) => void;
  initialStatus?: OllamaSetupStatus | null;
}

export function OllamaSetupModal({ onClose, onReady, initialStatus }: OllamaSetupModalProps) {
  const [platform, setPlatform] = useState<Platform>('mac');
  const [status, setStatus]     = useState<OllamaSetupStatus | null>(initialStatus ?? null);
  const [checking, setChecking] = useState(!initialStatus);
  const [starting, setStarting] = useState(false);
  const [pulling, setPulling]   = useState(false);
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [activeTab, setActiveTab] = useState<Platform>('mac');

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003';

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    setActiveTab(p);
  }, []);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(`${apiBase}/ai/ollama/setup`);
      if (res.ok) {
        const data: OllamaSetupStatus = await res.json();
        setStatus(data);
        if (data.activeModel) {
          onReady(data.activeModel);
        }
      }
    } catch {
      
    } finally {
      setChecking(false);
    }
  }, [apiBase, onReady]);

  useEffect(() => {
    if (!initialStatus) checkStatus();
  }, [checkStatus, initialStatus]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await fetch(`${apiBase}/ai/ollama/start`, { method: 'POST' });
      if (res.ok) {
        await checkStatus();
      }
    } finally {
      setStarting(false);
    }
  };

  const handlePull = async (model: string) => {
    if (pulling) return;
    setPulling(true);
    setPullProgress({ status: 'connecting…', done: false });

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vyro_token') : null;
      const res = await fetch(`${apiBase}/ai/ollama/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ model }),
      });

      if (!res.body) throw new Error('No stream');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buf     = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: progress')) continue;
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.status === 'error' || data.error) {
              setPullProgress({ status: 'error', done: true, error: data.error ?? 'Pull failed' });
            } else {
              setPullProgress({
                status: data.status ?? 'pulling…',
                percent: data.percent,
                done: data.done ?? false,
              });
              if (data.done) {
                await checkStatus();
              }
            }
          } catch {  }
        }
      }
    } catch (err) {
      setPullProgress({
        status: 'error', done: true,
        error: err instanceof Error ? err.message : 'Failed to pull model',
      });
    } finally {
      setPulling(false);
    }
  };

  const isDaemonRunning  = status?.running  ?? false;
  const isInstalled      = status?.installed ?? false;
  const hasModel         = !!status?.activeModel;
  const recommendedModel = status?.recommendedModel ?? 'qwen2.5-coder:7b';

  const steps = INSTALL_STEPS[activeTab];

  return (
    <>
      {}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />

      {}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-[#161b22] border border-white/[0.08] rounded-2xl shadow-2xl">

        {}
        <div className="px-6 py-5 border-b border-white/[0.07] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/20 flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5 text-[#00d4ff]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Set up Ollama AI</h2>
              <p className="text-[11px] text-white/40 mt-0.5">
                Run AI models locally — free, private, no API key needed.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] rounded-lg transition-all shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {}
        <div className="px-6 py-4 border-b border-white/[0.06] space-y-2.5">
          <p className="text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-3">Status</p>

          {}
          <div className="flex items-center gap-3">
            <StatusDot ok={isInstalled} loading={checking} />
            <span className={`text-[12px] font-medium ${isInstalled ? 'text-white/80' : 'text-white/40'}`}>
              Ollama installed
            </span>
            {!isInstalled && !checking && (
              <span className="ml-auto text-[10px] text-white/25">See instructions below ↓</span>
            )}
          </div>

          {}
          <div className="flex items-center gap-3">
            <StatusDot ok={isDaemonRunning} loading={starting} />
            <span className={`text-[12px] font-medium ${isDaemonRunning ? 'text-white/80' : 'text-white/40'}`}>
              {isDaemonRunning ? 'Ollama daemon running' : 'Daemon not running'}
            </span>
            {isInstalled && !isDaemonRunning && !starting && (
              <button
                onClick={handleStart}
                className="ml-auto flex items-center gap-1 text-[10px] text-[#00d4ff] hover:text-white border border-[#00d4ff]/30 hover:border-[#00d4ff]/60 px-2 py-1 rounded-lg transition-all"
              >
                <RefreshCw className="w-3 h-3" /> Start
              </button>
            )}
            {starting && <span className="ml-auto text-[10px] text-white/30 animate-pulse">Starting…</span>}
          </div>

          {}
          <div className="flex items-center gap-3">
            <StatusDot ok={hasModel} loading={pulling && !pullProgress?.done} />
            <span className={`text-[12px] font-medium ${hasModel ? 'text-white/80' : 'text-white/40'}`}>
              {hasModel ? `Model: ${status?.activeModel}` : 'No coding model found'}
            </span>
            {isDaemonRunning && !hasModel && !pulling && (
              <button
                onClick={() => handlePull(recommendedModel)}
                className="ml-auto flex items-center gap-1 text-[10px] text-[#00d4ff] hover:text-white border border-[#00d4ff]/30 hover:border-[#00d4ff]/60 px-2 py-1 rounded-lg transition-all"
              >
                <Download className="w-3 h-3" /> Pull {recommendedModel}
              </button>
            )}
          </div>

          {}
          {pullProgress && (
            <div className="mt-2">
              <PullProgressBar progress={pullProgress} />
            </div>
          )}

          {}
          {isInstalled && isDaemonRunning && hasModel && (
            <div className="mt-2 flex items-center gap-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-4 py-3">
              <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-[12px] font-semibold text-emerald-400">Ready!</p>
                <p className="text-[10px] text-emerald-400/60">
                  {status?.activeModel} is active. AI assistant is fully operational.
                </p>
              </div>
              <button
                onClick={onClose}
                className="ml-auto text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {}
          {!isInstalled && !checking && (
            <div className="mt-2 flex items-start gap-2 bg-yellow-500/8 border border-yellow-500/20 rounded-xl px-4 py-3">
              <WifiOff className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-yellow-400/80 leading-relaxed">
                Ollama is not installed. Follow the instructions below for your platform, then click Recheck.
              </p>
            </div>
          )}
        </div>

        {}
        {!isInstalled && (
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <p className="text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-3">Installation</p>

            {}
            <div className="flex gap-1 mb-4 bg-white/[0.03] p-1 rounded-xl">
              {(['mac', 'linux', 'windows'] as Platform[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setActiveTab(p)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    activeTab === p
                      ? 'bg-[#00d4ff]/20 text-white border border-[#00d4ff]/30'
                      : 'text-white/35 hover:text-white/60'
                  }`}
                >
                  {INSTALL_STEPS[p].title}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {steps.steps.map((step, i) => (
                <div key={i}>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    <span className="text-white/20 font-mono mr-1">{i + 1}.</span>
                    {step.desc}
                  </p>
                  {step.cmd && <CopyCmd cmd={step.cmd} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {}
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[11px] text-white/25">
            <Terminal className="w-3.5 h-3.5" />
            <span>
              {status?.models.length
                ? `${status.models.length} model${status.models.length > 1 ? 's' : ''} installed`
                : 'No models installed'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={checkStatus}
              disabled={checking}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-[11px] font-semibold bg-white/[0.05] border border-white/[0.09] text-white/60 hover:text-white hover:bg-white/[0.09] disabled:opacity-40 transition-all"
            >
              {checking
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              Recheck
            </button>
            {isInstalled && isDaemonRunning && hasModel && (
              <button
                onClick={onClose}
                className="h-8 px-3.5 rounded-xl text-[11px] font-semibold bg-[#00d4ff] hover:bg-[#6a74e8] text-white transition-colors shadow-md shadow-[#00d4ff]/20"
              >
                Start chatting →
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
