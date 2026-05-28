'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, X, Send, Loader2, Code2, Bot, User, Trash2,
  Lightbulb, BookOpen, Bug, Eye, ChevronDown, Zap,
} from 'lucide-react';
import { Language, LANGUAGE_NAMES } from '@vyro/types';

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

// ── Quick actions ──────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { id: 'hint',    icon: Lightbulb, label: 'Hint',    prompt: 'Give me a small hint without spoiling the solution.', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20 hover:bg-yellow-400/15' },
  { id: 'explain', icon: BookOpen,  label: 'Explain', prompt: 'Explain what my current code does step-by-step.', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20 hover:bg-blue-400/15' },
  { id: 'review',  icon: Eye,       label: 'Review',  prompt: 'Review my code for bugs, edge cases, and performance.', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20 hover:bg-emerald-400/15' },
  { id: 'debug',   icon: Bug,       label: 'Debug',   prompt: 'Help me find and fix the bug in my code.', color: 'text-red-400 bg-red-400/10 border-red-400/20 hover:bg-red-400/15' },
] as const;

// ── Markdown-safe formatter (no dangerouslySetInnerHTML) ───────────────────────

function formatResponse(content: string) {
  if (!content) return null;

  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
      const lang = match ? match[1] : '';
      const code = match ? match[2] : part.slice(3, -3);
      return (
        <div key={index} className="my-2.5 rounded-xl overflow-hidden border border-white/[0.08] bg-[#0d1117] font-mono text-[11px]">
          <div className="bg-white/[0.03] px-3 py-1.5 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-[9px] text-white/30 uppercase tracking-widest font-sans font-semibold">{lang || 'code'}</span>
            <button
              onClick={() => navigator.clipboard.writeText(code.trim())}
              className="text-[9px] text-white/30 hover:text-white/70 transition-colors font-sans px-1.5 py-0.5 rounded hover:bg-white/[0.06]"
            >
              Copy
            </button>
          </div>
          <pre className="p-3 overflow-x-auto whitespace-pre leading-relaxed text-[#c9d1d9]">
            <code>{code.trim()}</code>
          </pre>
        </div>
      );
    }

    const inlineParts = part.split(/(`[^`\n]+`)/g);
    return (
      <span key={index} className="whitespace-pre-wrap break-words leading-[1.65] text-[#c9d1d9]">
        {inlineParts.map((ip, ii) => {
          if (ip.startsWith('`') && ip.endsWith('`')) {
            return (
              <code key={ii} className="px-1.5 py-0.5 rounded-md bg-white/[0.08] border border-white/[0.05] font-mono text-[11px] text-[#828fff] mx-0.5">
                {ip.slice(1, -1)}
              </code>
            );
          }
          return ip.split(/(\*\*[^*]+\*\*)/g).map((bp, bi) => {
            if (bp.startsWith('**') && bp.endsWith('**')) {
              return <strong key={bi} className="font-bold text-white">{bp.slice(2, -2)}</strong>;
            }
            return bp;
          });
        })}
      </span>
    );
  });
}

// ── Typing cursor ──────────────────────────────────────────────────────────────

function TypingCursor() {
  return <span className="inline-block w-[2px] h-[13px] bg-[#828fff] rounded-sm animate-pulse ml-0.5 align-middle" />;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AiChatDrawer({
  isOpen,
  onClose,
  currentCode,
  currentLanguage,
  problemTitle,
  problemDescription,
}: AiChatDrawerProps) {
  const [messages, setMessages]       = useState<AiMessage[]>([]);
  const [inputText, setInputText]     = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeCode, setIncludeCode] = useState(true);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [modelInfo, setModelInfo]     = useState<{ model: string; provider: string } | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const currentStreamRef = useRef<string>('');
  const textareaRef      = useRef<HTMLTextAreaElement>(null);

  // Fetch AI status when drawer opens
  useEffect(() => {
    if (!isOpen) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003';
    fetch(`${apiBase}/ai/status`)
      .then((r) => r.json())
      .then((d) => { if (d.available) setModelInfo({ model: d.model, provider: d.provider }); })
      .catch(() => {});
  }, [isOpen]);

  // Restore session history
  useEffect(() => {
    const key = `vyro-ai-chat-${problemTitle || 'global'}`;
    const saved = sessionStorage.getItem(key);
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, [problemTitle]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Auto-resize textarea
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
  }, [inputText]);

  const saveMessages = useCallback((msgs: AiMessage[]) => {
    setMessages(msgs);
    sessionStorage.setItem(`vyro-ai-chat-${problemTitle || 'global'}`, JSON.stringify(msgs));
  }, [problemTitle]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isGenerating) return;
    setErrorMsg(null);
    setInputText('');

    const newMessages: AiMessage[] = [...messages, { role: 'user', content: text }];
    saveMessages(newMessages);
    setIsGenerating(true);
    setIsStreaming(false);

    const token    = localStorage.getItem('vyro_token');
    const apiBase  = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003';

    try {
      // Placeholder assistant bubble
      const withPlaceholder = [...newMessages, { role: 'assistant' as const, content: '' }];
      setMessages(withPlaceholder);
      currentStreamRef.current = '';

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
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;
          try {
            const chunk = JSON.parse(data);
            currentStreamRef.current += chunk;
            setIsStreaming(true);
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: currentStreamRef.current };
              return updated;
            });
          } catch { /* ignore incomplete JSON */ }
        }
      }

      saveMessages([...newMessages, { role: 'assistant', content: currentStreamRef.current }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to AI';
      setErrorMsg(msg.toLowerCase().includes('unauthorized') ? '⚠️ Please sign in to use AI.' : msg);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
    }
  }, [isGenerating, messages, includeCode, currentCode, currentLanguage, saveMessages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    sendMessage(inputText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  const langName = LANGUAGE_NAMES[currentLanguage] || 'Code';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-screen w-full max-w-[480px] bg-[#0d1117] border-l border-white/[0.08] shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="h-14 bg-[#161b22] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-lg bg-[#828fff]/15 border border-[#828fff]/25 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#828fff]" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#161b22]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white leading-none">Vyro AI</p>
              <p className="text-[10px] text-white/35 font-mono truncate mt-0.5">
                {modelInfo
                  ? <><span className="text-[#828fff]/70">{modelInfo.provider}</span> · {modelInfo.model.split('/').pop()}</>
                  : 'detecting model…'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {messages.length > 0 && (
              <button
                onClick={() => { saveMessages([]); setErrorMsg(null); }}
                title="Clear chat"
                className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] rounded-lg transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div className="px-3 pt-3 pb-2 border-b border-white/[0.05] bg-[#0d1117] shrink-0">
          <div className="grid grid-cols-4 gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => sendMessage(action.prompt)}
                disabled={isGenerating}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-[10px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${action.color}`}
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
              <div className="w-14 h-14 rounded-2xl bg-[#828fff]/8 border border-[#828fff]/15 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-[#828fff]/60" />
              </div>
              <p className="text-sm font-semibold text-white/60 mb-1.5">Ask me anything</p>
              <p className="text-[11px] text-white/25 max-w-[240px] leading-relaxed">
                Use the quick actions above, or type a question. Toggle code attachment to include your editor.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const isLast = i === messages.length - 1;
              return (
                <div key={i} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center ${
                    isUser
                      ? 'bg-[#828fff]/20 border border-[#828fff]/30'
                      : 'bg-white/[0.05] border border-white/[0.08]'
                  }`}>
                    {isUser
                      ? <User className="w-3 h-3 text-[#828fff]" />
                      : <Bot className="w-3 h-3 text-white/50" />}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-[1.65] ${
                    isUser
                      ? 'bg-[#828fff]/15 border border-[#828fff]/20 text-white rounded-tr-sm'
                      : 'bg-[#161b22] border border-white/[0.06] rounded-tl-sm'
                  }`}>
                    {isUser ? (
                      <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                    ) : msg.content ? (
                      <>
                        {formatResponse(msg.content)}
                        {isLast && isStreaming && <TypingCursor />}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-white/35 py-0.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#828fff]" />
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
          {/* Code attachment toggle */}
          <div className="flex items-center justify-between px-0.5">
            <button
              type="button"
              onClick={() => setIncludeCode((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
                includeCode
                  ? 'bg-[#828fff]/12 border-[#828fff]/25 text-[#828fff]'
                  : 'bg-transparent border-white/[0.08] text-white/30 hover:text-white/50'
              }`}
            >
              <Code2 className="w-3 h-3" />
              {includeCode ? `Attached: ${langName}` : `Attach ${langName} code`}
            </button>
            <span className="text-[9px] text-white/20 font-mono">Shift+Enter for newline</span>
          </div>

          {/* Textarea form */}
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about algorithms, errors, approaches…"
                disabled={isGenerating}
                className="w-full min-h-[36px] max-h-[120px] resize-none px-3 py-2 bg-[#0d1117] border border-white/[0.08] focus:border-[#828fff]/50 focus:outline-none rounded-xl text-[12px] text-white placeholder:text-white/20 transition-colors leading-[1.5] scrollbar-none pr-10"
                style={{ scrollbarWidth: 'none' }}
              />
            </div>
            <button
              type="submit"
              disabled={!inputText.trim() || isGenerating}
              className="w-9 h-9 shrink-0 flex items-center justify-center bg-[#828fff] hover:bg-[#6a74e8] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg shadow-[#828fff]/20"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
