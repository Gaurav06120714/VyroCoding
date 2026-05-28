'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, X, Send, Loader2, Code2, Bot, User, Trash2,
  Lightbulb, BookOpen, Bug, Eye, Zap, WifiOff, Settings2,
  RefreshCw, AlertCircle, Download,
} from 'lucide-react';
import { Language, LANGUAGE_NAMES } from '@vyro/types';
import { OllamaSetupModal } from './OllamaSetupModal';
import type { OllamaSetupStatus } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentCode: string;
  currentLanguage: Language;
  problemTitle?: string;
  problemDescription?: string;
}

// ── Quick actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { id: 'hint',    icon: Lightbulb, label: 'Hint',    prompt: 'Give me a small hint without spoiling the solution.', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20 hover:bg-yellow-400/15' },
  { id: 'explain', icon: BookOpen,  label: 'Explain', prompt: 'Explain what my current code does step-by-step.',         color: 'text-blue-400 bg-blue-400/10 border-blue-400/20 hover:bg-blue-400/15' },
  { id: 'review',  icon: Eye,       label: 'Review',  prompt: 'Review my code for bugs, edge cases, and performance.',   color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20 hover:bg-emerald-400/15' },
  { id: 'debug',   icon: Bug,       label: 'Debug',   prompt: 'Help me find and fix the bug in my code.',                color: 'text-red-400 bg-red-400/10 border-red-400/20 hover:bg-red-400/15' },
] as const;

// ── Markdown formatter ────────────────────────────────────────────────────────

function formatResponse(content: string) {
  if (!content) return null;
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
      const lang  = match ? match[1] : '';
      const code  = match ? match[2] : part.slice(3, -3);
      return (
        <div key={index} className="my-2.5 rounded-xl overflow-hidden border border-white/[0.08] bg-[#0d1117] font-mono text-[11px]">
          <div className="bg-white/[0.03] px-3 py-1.5 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-[9px] text-white/30 uppercase tracking-widest font-sans font-semibold">{lang || 'code'}</span>
            <button onClick={() => navigator.clipboard.writeText(code.trim())} className="text-[9px] text-white/30 hover:text-white/70 transition-colors font-sans px-1.5 py-0.5 rounded hover:bg-white/[0.06]">Copy</button>
          </div>
          <pre className="p-3 overflow-x-auto whitespace-pre leading-relaxed text-[#c9d1d9]"><code>{code.trim()}</code></pre>
        </div>
      );
    }
    const inlineParts = part.split(/(`[^`\n]+`)/g);
    return (
      <span key={index} className="whitespace-pre-wrap break-words leading-[1.65] text-[#c9d1d9]">
        {inlineParts.map((ip, ii) => {
          if (ip.startsWith('`') && ip.endsWith('`')) {
            return <code key={ii} className="px-1.5 py-0.5 rounded-md bg-white/[0.08] border border-white/[0.05] font-mono text-[11px] text-[#00d4ff] mx-0.5">{ip.slice(1, -1)}</code>;
          }
          return ip.split(/(\*\*[^*]+\*\*)/g).map((bp, bi) =>
            bp.startsWith('**') && bp.endsWith('**')
              ? <strong key={bi} className="font-bold text-white">{bp.slice(2, -2)}</strong>
              : bp
          );
        })}
      </span>
    );
  });
}

function TypingCursor() {
  return <span className="inline-block w-[2px] h-[13px] bg-[#00d4ff] rounded-sm animate-pulse ml-0.5 align-middle" />;
}

// ── Auto-setup progress banner ────────────────────────────────────────────────

function AutoSetupBanner({ stage, percent }: { stage: string; percent: number | null }) {
  return (
    <div className="mx-4 mt-3 p-3 rounded-xl border bg-[#00d4ff]/8 border-[#00d4ff]/20 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Download className="w-4 h-4 text-[#00d4ff] shrink-0 animate-pulse" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-[#00d4ff]">Setting up AI…</p>
          <p className="text-[10px] text-white/40 truncate mt-0.5">{stage}</p>
        </div>
        {percent !== null && (
          <span className="text-[11px] font-mono text-[#00d4ff]/70 tabular-nums shrink-0">{percent}%</span>
        )}
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-[#00d4ff] transition-all duration-500"
          style={{ width: percent !== null ? `${Math.max(percent, 4)}%` : '100%' }}
        />
      </div>
    </div>
  );
}

// ── Connection banner ─────────────────────────────────────────────────────────

function ConnectionBanner({
  status,
  onSetup,
  onRetry,
  retrying,
}: {
  status: 'offline' | 'no-model' | 'error';
  onSetup: () => void;
  onRetry: () => void;
  retrying: boolean;
}) {
  const config = {
    offline: {
      icon: WifiOff,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/8 border-yellow-500/20',
      title: 'Ollama not installed',
      desc: 'Install Ollama to run AI locally — free and private. Or set NVIDIA_API_KEY for cloud.',
    },
    'no-model': {
      icon: AlertCircle,
      color: 'text-blue-400',
      bg: 'bg-blue-500/8 border-blue-500/20',
      title: 'Downloading model…',
      desc: 'A coding model is being pulled automatically. This may take a few minutes.',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/8 border-red-500/20',
      title: 'AI unavailable',
      desc: 'Could not connect to AI service. Check Ollama is running or NVIDIA_API_KEY is set.',
    },
  }[status];

  const Icon = config.icon;

  return (
    <div className={`mx-4 mt-3 p-3 rounded-xl border ${config.bg} flex flex-col gap-2`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${config.color}`} />
        <div className="min-w-0">
          <p className={`text-[12px] font-semibold ${config.color}`}>{config.title}</p>
          <p className="text-[10px] text-white/40 leading-relaxed mt-0.5">{config.desc}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-0.5">
        <button
          onClick={onSetup}
          className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-semibold bg-[#00d4ff]/15 border border-[#00d4ff]/25 text-[#00d4ff] hover:bg-[#00d4ff]/25 transition-all"
        >
          <Settings2 className="w-3 h-3" /> Setup
        </button>
        <button
          onClick={onRetry}
          disabled={retrying}
          className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-semibold bg-white/[0.05] border border-white/[0.09] text-white/50 hover:text-white hover:bg-white/[0.09] disabled:opacity-40 transition-all"
        >
          {retrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Retry
        </button>
      </div>
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export function AiChatDrawer({
  isOpen, onClose, currentCode, currentLanguage, problemTitle, problemDescription,
}: AiChatDrawerProps) {
  const [messages, setMessages]       = useState<AiMessage[]>([]);
  const [inputText, setInputText]     = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeCode, setIncludeCode] = useState(true);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Ollama state
  const [aiStatus, setAiStatus]           = useState<{ available: boolean; model: string; provider: string } | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [connectionBanner, setConnectionBanner] = useState<'offline' | 'no-model' | 'error' | null>(null);
  const [retrying, setRetrying]           = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [ollamaStatus, setOllamaStatus]   = useState<OllamaSetupStatus | null>(null);
  // Auto-setup state (shown inline before a model is ready)
  const [autoSetupStage, setAutoSetupStage] = useState<string | null>(null);
  const [autoSetupPct, setAutoSetupPct]     = useState<number | null>(null);
  const [autoSetupDone, setAutoSetupDone]   = useState(false);
  const autoSetupRunRef = useRef(false);

  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const currentStreamRef = useRef<string>('');
  const textareaRef      = useRef<HTMLTextAreaElement>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003';

  // ── Check AI availability ────────────────────────────────────────────────────

  // ── Auto-setup via SSE ──────────────────────────────────────────────────────

  const runAutoSetup = useCallback(async () => {
    if (autoSetupRunRef.current) return;
    autoSetupRunRef.current = true;
    setAutoSetupStage('Checking Ollama…');
    setAutoSetupPct(null);
    setAutoSetupDone(false);

    try {
      const res = await fetch(`${apiBase}/ai/ollama/auto-setup`, { method: 'POST' });
      if (!res.body) throw new Error('no stream');

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
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.stage)   setAutoSetupStage(evt.message ?? evt.stage);
            if (evt.percent !== undefined) setAutoSetupPct(evt.percent);
            if (evt.status === 'pulling manifest' || evt.status === 'pulling') {
              setAutoSetupStage(`Downloading model… ${evt.percent ?? 0}%`);
            }
            if (evt.activeModel || evt.modelPulled) {
              setAutoSetupDone(true);
              setAutoSetupStage(null);
              // Re-check AI status to update banner and provider label
              checkAiStatusSimple();
            }
            if (evt.error && !evt.activeModel) {
              setAutoSetupStage(null);
              setConnectionBanner('offline');
            }
          } catch { /* malformed line */ }
        }
      }
    } catch {
      setAutoSetupStage(null);
    } finally {
      autoSetupRunRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  // Lightweight status check used after auto-setup completes
  const checkAiStatusSimple = useCallback(async () => {
    try {
      const res  = await fetch(`${apiBase}/ai/status`);
      const data = await res.json();
      setAiStatus(data);
      if (data.available) setConnectionBanner(null);
    } catch { /* ignore */ }
  }, [apiBase]);

  const checkAiStatus = useCallback(async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    else setStatusLoading(true);
    try {
      const res  = await fetch(`${apiBase}/ai/status`);
      const data = await res.json();
      setAiStatus(data);

      if (!data.available) {
        // Get detailed Ollama status to show the right banner
        const setupRes  = await fetch(`${apiBase}/ai/ollama/setup`);
        const setupData: OllamaSetupStatus = await setupRes.json();
        setOllamaStatus(setupData);

        if (!setupData.installed) {
          setConnectionBanner('offline');
        } else if (!setupData.running || !setupData.activeModel) {
          // Ollama installed but daemon/model not ready — trigger auto-setup
          setConnectionBanner(null);
          runAutoSetup();
        } else {
          setConnectionBanner('error');
        }
      } else {
        setConnectionBanner(null);
      }
    } catch {
      setConnectionBanner('error');
    } finally {
      setStatusLoading(false);
      setRetrying(false);
    }
  }, [apiBase, runAutoSetup]);

  useEffect(() => {
    if (isOpen) checkAiStatus();
  }, [isOpen, checkAiStatus]);

  // ── Restore history ──────────────────────────────────────────────────────────

  useEffect(() => {
    const key   = `vyro-ai-chat-${problemTitle || 'global'}`;
    const saved = sessionStorage.getItem(key);
    if (saved) try { setMessages(JSON.parse(saved)); } catch { /* ignore */ }
  }, [problemTitle]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
  }, [inputText]);

  const saveMessages = useCallback((msgs: AiMessage[]) => {
    setMessages(msgs);
    sessionStorage.setItem(`vyro-ai-chat-${problemTitle || 'global'}`, JSON.stringify(msgs));
  }, [problemTitle]);

  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isGenerating) return;
    setErrorMsg(null);
    setInputText('');

    const newMessages: AiMessage[] = [...messages, { role: 'user', content: text }];
    saveMessages(newMessages);
    setIsGenerating(true);
    setIsStreaming(false);
    setMessages([...newMessages, { role: 'assistant' as const, content: '' }]);
    currentStreamRef.current = '';

    const token = typeof window !== 'undefined' ? localStorage.getItem('vyro_token') : null;

    try {
      const res = await fetch(`${apiBase}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          codeContext: includeCode ? currentCode : undefined,
          language: includeCode ? (LANGUAGE_NAMES[currentLanguage] || 'Code') : undefined,
        }),
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); msg = j.error ?? j.message ?? msg; } catch { /* ignore */ }
        throw new Error(msg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Response stream not readable');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          // Check for SSE error event
          if (line.startsWith('event: error')) continue;
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            // Error object from server
            if (typeof parsed === 'object' && parsed?.error) {
              throw new Error(parsed.error);
            }
            const chunk = typeof parsed === 'string' ? parsed : '';
            currentStreamRef.current += chunk;
            setIsStreaming(true);
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: currentStreamRef.current };
              return updated;
            });
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected token') throw parseErr;
          }
        }
      }

      saveMessages([...newMessages, { role: 'assistant', content: currentStreamRef.current }]);

      // If AI was offline and now works, clear the banner
      if (connectionBanner) checkAiStatus();

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to AI';
      if (msg.toLowerCase().includes('unauthorized') || msg.includes('401')) {
        setErrorMsg('⚠️ Please sign in to use AI.');
      } else if (msg.toLowerCase().includes('unavailable') || msg.toLowerCase().includes('provider')) {
        setErrorMsg(msg);
        setConnectionBanner('error');
      } else {
        setErrorMsg(msg);
      }
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
    }
  }, [
    isGenerating, messages, includeCode, currentCode, currentLanguage,
    saveMessages, apiBase, connectionBanner, checkAiStatus,
  ]);

  const handleSubmit = (e?: React.FormEvent) => { e?.preventDefault(); sendMessage(inputText); };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  if (!isOpen) return null;

  const langName = LANGUAGE_NAMES[currentLanguage] || 'Code';

  // Provider label for header
  const isAutoSetting = !!autoSetupStage;
  const providerShort = aiStatus?.provider?.includes('Ollama')
    ? 'local · ' + (aiStatus.model?.split('/').pop() ?? aiStatus.model)
    : aiStatus?.provider?.includes('NIM')
    ? 'cloud · ' + (aiStatus.model?.split('/').pop() ?? aiStatus.model)
    : statusLoading   ? 'connecting…'
    : isAutoSetting   ? 'setting up…'
    : 'unavailable';

  const isBlocked = isGenerating || (!!connectionBanner && !isAutoSetting);

  return (
    <>
      {/* Ollama setup modal */}
      {showSetupModal && (
        <OllamaSetupModal
          onClose={() => setShowSetupModal(false)}
          onReady={(model) => {
            setShowSetupModal(false);
            setAiStatus({ available: true, model, provider: 'Ollama (Local)' });
            setConnectionBanner(null);
          }}
          initialStatus={ollamaStatus}
        />
      )}

      {/* Drawer backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-screen w-full max-w-[480px] bg-[#0d1117] border-l border-white/[0.08] shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="h-14 bg-[#161b22] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-lg bg-[#00d4ff]/15 border border-[#00d4ff]/25 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#00d4ff]" />
              </div>
              {/* Connection dot */}
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#161b22] ${
                statusLoading || isAutoSetting ? 'bg-yellow-400 animate-pulse' :
                connectionBanner ? 'bg-red-400' : 'bg-emerald-500'
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white leading-none">Vyro AI</p>
              <p className="text-[10px] text-white/35 font-mono truncate mt-0.5">{providerShort}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowSetupModal(true)}
              title="Ollama setup"
              className="w-7 h-7 flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.06] rounded-lg transition-all"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
            {messages.length > 0 && (
              <button
                onClick={() => { saveMessages([]); setErrorMsg(null); }}
                title="Clear chat"
                className="w-7 h-7 flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.06] rounded-lg transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.06] rounded-lg transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Auto-setup progress (shown while daemon starts / model pulls) ── */}
        {autoSetupStage && !connectionBanner && (
          <AutoSetupBanner stage={autoSetupStage} percent={autoSetupPct} />
        )}

        {/* ── Connection banner ── */}
        {connectionBanner && (
          <ConnectionBanner
            status={connectionBanner}
            onSetup={() => setShowSetupModal(true)}
            onRetry={() => checkAiStatus(true)}
            retrying={retrying}
          />
        )}

        {/* ── Quick Actions ── */}
        <div className="px-3 pt-3 pb-2 border-b border-white/[0.05] bg-[#0d1117] shrink-0">
          <div className="grid grid-cols-4 gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => sendMessage(action.prompt)}
                disabled={isBlocked}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-[10px] font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed ${action.color}`}
              >
                <action.icon className="w-3.5 h-3.5" />
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
              <div className="w-14 h-14 rounded-2xl bg-[#00d4ff]/8 border border-[#00d4ff]/15 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-[#00d4ff]/60" />
              </div>
              <p className="text-sm font-semibold text-white/60 mb-1.5">Ask me anything</p>
              <p className="text-[11px] text-white/25 max-w-[240px] leading-relaxed">
                {connectionBanner
                  ? 'Install Ollama to enable local AI — free and private. Or set NVIDIA_API_KEY.'
                  : isAutoSetting
                  ? 'AI is setting up automatically. This only happens once.'
                  : 'Use the quick actions above, or type a question. Toggle code attachment to include your editor.'}
              </p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const isLast = i === messages.length - 1;
              return (
                <div key={i} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center ${isUser ? 'bg-[#00d4ff]/20 border border-[#00d4ff]/30' : 'bg-white/[0.05] border border-white/[0.08]'}`}>
                    {isUser ? <User className="w-3 h-3 text-[#00d4ff]" /> : <Bot className="w-3 h-3 text-white/50" />}
                  </div>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-[1.65] ${isUser ? 'bg-[#00d4ff]/15 border border-[#00d4ff]/20 text-white rounded-tr-sm' : 'bg-[#161b22] border border-white/[0.06] rounded-tl-sm'}`}>
                    {isUser ? (
                      <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                    ) : msg.content ? (
                      <>
                        {formatResponse(msg.content)}
                        {isLast && isStreaming && <TypingCursor />}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-white/35 py-0.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00d4ff]" />
                        <span>Thinking…</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {errorMsg && (
            <div className="bg-red-500/8 border border-red-500/20 text-red-400 p-3 rounded-xl text-[11px] leading-relaxed">
              {errorMsg}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Bar ── */}
        <div className="p-3 bg-[#161b22] border-t border-white/[0.08] shrink-0 space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <button
              type="button"
              onClick={() => setIncludeCode((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border ${includeCode ? 'bg-[#00d4ff]/12 border-[#00d4ff]/25 text-[#00d4ff]' : 'bg-transparent border-white/[0.08] text-white/30 hover:text-white/50'}`}
            >
              <Code2 className="w-3 h-3" />
              {includeCode ? `Attached: ${langName}` : `Attach ${langName} code`}
            </button>
            <span className="text-[9px] text-white/20 font-mono">Shift+Enter = newline</span>
          </div>

          <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={connectionBanner ? 'Install Ollama to start chatting…' : isAutoSetting ? 'Setting up AI, please wait…' : 'Ask about algorithms, errors, approaches…'}
                disabled={isBlocked}
                className="w-full min-h-[36px] max-h-[120px] resize-none px-3 py-2 bg-[#0d1117] border border-white/[0.08] focus:border-[#00d4ff]/50 focus:outline-none rounded-xl text-[12px] text-white placeholder:text-white/20 transition-colors leading-[1.5] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ scrollbarWidth: 'none' }}
              />
            </div>
            <button
              type="submit"
              disabled={!inputText.trim() || isBlocked}
              className="w-9 h-9 shrink-0 flex items-center justify-center bg-[#00d4ff] hover:bg-[#6a74e8] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg shadow-[#00d4ff]/20"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
