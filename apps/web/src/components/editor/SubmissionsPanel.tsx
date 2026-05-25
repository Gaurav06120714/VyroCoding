'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Clock, Cpu, Code2, X } from 'lucide-react';
import { submissionsApi, type ProblemSubmission } from '@/lib/api';
import { Language, LANGUAGE_NAMES } from '@vyro/types';
import { CodeEditor } from './CodeEditor';

interface SubmissionsPanelProps {
  slug: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  accepted:              { label: 'Accepted',              color: 'text-[#27a644]', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  wrong_answer:          { label: 'Wrong Answer',          color: 'text-[#e5534b]', icon: <XCircle className="w-3.5 h-3.5" /> },
  time_limit_exceeded:   { label: 'Time Limit',            color: 'text-yellow-400', icon: <Clock className="w-3.5 h-3.5" /> },
  memory_limit_exceeded: { label: 'Memory Limit',          color: 'text-orange-400', icon: <Cpu className="w-3.5 h-3.5" /> },
  runtime_error:         { label: 'Runtime Error',         color: 'text-[#e5534b]', icon: <XCircle className="w-3.5 h-3.5" /> },
  compile_error:         { label: 'Compile Error',         color: 'text-orange-400', icon: <XCircle className="w-3.5 h-3.5" /> },
  pending:               { label: 'Pending',               color: 'text-white/40',  icon: <Clock className="w-3.5 h-3.5" /> },
  processing:            { label: 'Processing',            color: 'text-blue-400',  icon: <Clock className="w-3.5 h-3.5" /> },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SubmissionsPanel({ slug }: SubmissionsPanelProps) {
  const [submissions, setSubmissions] = useState<ProblemSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProblemSubmission | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await submissionsApi.forProblem(slug);
      setSubmissions(res.data ?? []);
    } catch {
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 bg-white/[0.04] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-white/30">
        <Code2 className="w-8 h-8 mb-3" />
        <p className="text-sm">No submissions yet</p>
        <p className="text-xs mt-1">Submit your solution to see history</p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-white/[0.05]">
        {submissions.map((sub) => {
          const cfg = STATUS_CONFIG[sub.status] ?? { label: sub.status, color: 'text-white/40', icon: null };
          return (
            <button
              key={sub.id}
              onClick={() => setSelected(sub)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.04] transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className={cfg.color}>{cfg.icon}</span>
                <div>
                  <p className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {LANGUAGE_NAMES[sub.languageId as Language] ?? `Lang ${sub.languageId}`}
                    {' · '}{timeAgo(sub.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-white/30 shrink-0">
                {sub.timeMs && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />{sub.timeMs}ms
                  </span>
                )}
                {sub.memoryKb && (
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3 h-3" />{(sub.memoryKb / 1024).toFixed(1)}MB
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Code viewer modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-white/[0.1] rounded-xl w-full max-w-3xl h-[70vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${STATUS_CONFIG[selected.status]?.color ?? 'text-white/60'}`}>
                  {STATUS_CONFIG[selected.status]?.label ?? selected.status}
                </span>
                <span className="text-xs text-white/30">
                  {LANGUAGE_NAMES[selected.languageId as Language]} · {timeAgo(selected.createdAt)}
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                value={selected.code}
                onChange={() => {}}
                language={selected.languageId as Language}
                readOnly
                height="100%"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
