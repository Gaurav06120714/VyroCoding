'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Play, Send, Loader2, ChevronLeft, Sparkles, LayoutPanelLeft, Code2 } from 'lucide-react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { Language, LANGUAGE_NAMES, type Problem, type ExecutionResult } from '@vyro/types';
import { problemsApi, executeApi, executeApiExt, languagesApi, type LanguageEntry } from '@/lib/api';
import { ProblemStatement } from '@/components/problems/ProblemStatement';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { OutputPanel } from '@/components/editor/OutputPanel';
import { CustomInput } from '@/components/editor/CustomInput';
import { SubmissionsPanel } from '@/components/editor/SubmissionsPanel';
import { AiChatDrawer } from '@/components/editor/AiChatDrawer';
import type { TestCaseResult } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ── Tab types ──────────────────────────────────────────────────────────────────

type LeftTab = 'description' | 'submissions' | 'hints';

// ── Difficulty colours ─────────────────────────────────────────────────────────

const DIFF_BADGE: Record<string, string> = {
  easy:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  hard:   'text-red-400 bg-red-400/10 border-red-400/20',
};

// ── Starter code fallbacks ─────────────────────────────────────────────────────

const FALLBACK_STARTERS: Record<number, string> = {
  93: 'function solution() {\n\n}\n',
  71: 'def solution():\n    pass\n',
  54: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your code here\n    return 0;\n}\n',
  62: 'class Solution {\n    public void solution() {\n        // your code here\n    }\n}\n',
  74: 'function solution(): void {\n\n}\n',
  60: 'package main\n\nfunc main() {\n\n}\n',
  73: 'fn main() {\n\n}\n',
};

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ProblemPage() {
  const { slug } = useParams<{ slug: string }>();

  const [problem, setProblem]       = useState<Problem | null>(null);
  const [languages, setLanguages]   = useState<LanguageEntry[]>([]);
  const [loading, setLoading]       = useState(true);

  const [code, setCode]             = useState('');
  const [language, setLanguage]     = useState<Language>(Language.JavaScript);

  const [isRunning, setIsRunning]   = useState(false);
  const [result, setResult]         = useState<ExecutionResult | null>(null);
  const [testResults, setTestResults] = useState<TestCaseResult[] | null>(null);

  const [leftTab, setLeftTab]       = useState<LeftTab>('description');
  const [customInput, setCustomInput] = useState('');
  const [customInputOpen, setCustomInputOpen] = useState(false);
  const [isMobile, setIsMobile]     = useState(false);
  const [mobileView, setMobileView] = useState<'problem' | 'editor'>('problem');
  const [aiChatOpen, setAiChatOpen] = useState(false);

  const codeLoadedRef = useRef(false);


  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // react-resizable-panels v4 has a known SSR/hydration issue in Next.js 15:
  // react-resizable-panels v4 SSR/hydration bug: the Group initialises before
  // child Panels register, so defaultSize is ignored and panels collapse to ~5%.
  // Poll every 30ms for 1.5s — catches the library's deferred layout write
  // regardless of which rAF/microtask it happens in.
  useEffect(() => {
    if (loading) return;

    const applyFlex = () => {
      const left   = document.getElementById('problem-left');
      const right  = document.getElementById('problem-right');
      const editor = document.getElementById('problem-editor');
      const output = document.getElementById('problem-output');

      if (left && right) {
        const g = parseFloat(left.style.flexGrow || '0');
        if (g < 20 || g > 80) {
          left.style.flex  = '38 1 0px';
          right.style.flex = '62 1 0px';
        }
      }
      if (editor && output) {
        const g = parseFloat(editor.style.flexGrow || '0');
        if (g < 20 || g > 90) {
          editor.style.flex = '65 1 0px';
          output.style.flex = '35 1 0px';
        }
      }
    };

    // Poll repeatedly for 1.5 s so we catch however late the library writes.
    const intervalId = setInterval(applyFlex, 30);
    const stopId     = setTimeout(() => clearInterval(intervalId), 1500);

    return () => {
      clearInterval(intervalId);
      clearTimeout(stopId);
    };
  }, [loading]);

  useEffect(() => {
    languagesApi.list().then((res) => setLanguages(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    problemsApi.get(slug).then((res) => {
      setProblem(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    codeLoadedRef.current = false;
    const storageKey = `vyro-code-${slug}-${language}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) { setCode(saved); codeLoadedRef.current = true; return; }
    if (problem) {
      const starter = (problem.starterCode as Record<string, string>)?.[String(language)];
      if (starter) { setCode(starter); return; }
    }
    setCode(FALLBACK_STARTERS[language] ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, language]);

  useEffect(() => {
    if (!problem || codeLoadedRef.current) return;
    const storageKey = `vyro-code-${slug}-${language}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) { setCode(saved); return; }
    const starter = (problem.starterCode as Record<string, string>)?.[String(language)];
    setCode(starter ?? FALLBACK_STARTERS[language] ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem]);

  const handleRun = useCallback(async () => {
    if (!problem || isRunning) return;
    setIsRunning(true);
    setResult(null);
    setTestResults(null);
    try {
      if (customInputOpen && customInput.trim()) {
        const res = await executeApi.run({ code, languageId: language, stdin: customInput });
        setResult(res.data);
      } else {
        const res = await executeApiExt.runAll({ code, languageId: language, problemId: problem.id });
        setTestResults(res.data);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      setResult({
        token: '', status: { id: -1, description: 'runtime_error' },
        submissionStatus: 'runtime_error' as ExecutionResult['submissionStatus'],
        stderr: msg.toLowerCase().includes('unauthorized') ? '⚠️ Please sign in to run code.' : msg,
      } as ExecutionResult);
    } finally {
      setIsRunning(false);
    }
  }, [code, language, problem, isRunning, customInput, customInputOpen]);

  const handleSubmit = useCallback(async () => {
    if (!problem || isRunning) return;
    setIsRunning(true);
    setTestResults(null);
    setResult(null);
    try {
      const { data } = await executeApi.submit({ code, languageId: language, problemId: problem.id });
      const poll = async (id: string, attempts = 0): Promise<void> => {
        if (attempts > 30) return;
        await new Promise((r) => setTimeout(r, 600));
        const subRes = await executeApi.getSubmission(id);
        const { status } = subRes.data;
        if (status === 'processing' || status === 'pending') return poll(id, attempts + 1);
        setResult({
          token: id, status: { id: 0, description: status },
          stdout: subRes.data.stdout ?? undefined, stderr: subRes.data.stderr ?? undefined,
          timeMs: subRes.data.timeMs ?? undefined, memoryKb: subRes.data.memoryKb ?? undefined,
          submissionStatus: status as ExecutionResult['submissionStatus'],
        });
      };
      await poll(data.submissionId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setResult({
        token: '', status: { id: -1, description: 'runtime_error' },
        submissionStatus: 'runtime_error' as ExecutionResult['submissionStatus'],
        stderr: msg.toLowerCase().includes('unauthorized') ? '⚠️ Please sign in to submit.' : msg,
      } as ExecutionResult);
    } finally {
      setIsRunning(false);
    }
  }, [code, language, problem, isRunning]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      // h-full fills the parent <main> which is now h-full in the layout
      <div className="h-full bg-[#0d1117] flex flex-col">
        <TopBar problem={null} language={language} onLanguageChange={setLanguage} languages={languages} isRunning={false} onRun={() => {}} onSubmit={() => {}} slug={slug} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-white/10 border-t-[#00d4ff] rounded-full animate-spin" />
            <p className="text-xs text-white/30">Loading problem…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="h-full bg-[#0d1117] flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-white/40">Problem not found.</p>
        <Link href="/problems" className="text-xs text-[#00d4ff] hover:underline">← Back to problems</Link>
      </div>
    );
  }

  // ── Mobile layout ────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className="h-full bg-[#0d1117] flex flex-col overflow-hidden">
        <TopBar problem={problem} language={language} onLanguageChange={setLanguage} languages={languages} isRunning={isRunning} onRun={handleRun} onSubmit={handleSubmit} slug={slug} onAiChatClick={() => setAiChatOpen(true)} />

        {/* Mobile tab switcher */}
        <div className="flex border-b border-white/[0.07] bg-[#161b22] shrink-0">
          {(['problem', 'editor'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setMobileView(v)}
              className={cn(
                'flex-1 py-2.5 text-[11px] font-semibold transition-colors capitalize flex items-center justify-center gap-1.5',
                mobileView === v
                  ? 'text-white border-b-2 border-[#00d4ff] bg-[#00d4ff]/5'
                  : 'text-white/35 hover:text-white/60'
              )}
            >
              {v === 'problem'
                ? <><LayoutPanelLeft className="w-3 h-3" />Problem</>
                : <><Code2 className="w-3 h-3" />Solution</>}
            </button>
          ))}
        </div>

        {mobileView === 'problem' ? (
          /* Problem panel — independent scroll */
          <div className="flex-1 overflow-hidden flex flex-col">
            <LeftPanel problem={problem} leftTab={leftTab} setLeftTab={setLeftTab} slug={slug} />
          </div>
        ) : (
          /* Editor panel */
          <div className="flex-1 flex flex-col overflow-hidden">
            <EditorToolbar language={language} onLanguageChange={setLanguage} />
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                value={code} onChange={setCode} language={language}
                onRun={handleRun} onSubmit={handleSubmit} problemSlug={slug}
                height="100%"
              />
            </div>
            <CustomInput
              value={customInput} onChange={setCustomInput}
              isOpen={customInputOpen} onToggle={() => setCustomInputOpen(!customInputOpen)}
            />
            <div className="h-48 shrink-0 border-t border-white/[0.07]">
              <OutputPanel result={result} testResults={testResults} isRunning={isRunning} />
            </div>
          </div>
        )}

        <AiChatDrawer isOpen={aiChatOpen} onClose={() => setAiChatOpen(false)} currentCode={code} currentLanguage={language} problemTitle={problem.title} problemDescription={problem.description} />
      </div>
    );
  }

  // ── Desktop layout ───────────────────────────────────────────────────────────

  return (
    // h-full fills the parent <main> (which is h-full in layout.tsx)
    // overflow-hidden prevents any child from causing layout-level scrollbars
    <div className="h-full bg-[#0d1117] flex flex-col overflow-hidden">
      <TopBar
        problem={problem} language={language} onLanguageChange={setLanguage}
        languages={languages} isRunning={isRunning} onRun={handleRun}
        onSubmit={handleSubmit} slug={slug} onAiChatClick={() => setAiChatOpen(true)}
      />

      {/* Main workspace — fills all remaining height */}
      <div className="flex-1 overflow-hidden min-h-0">
        <PanelGroup
          orientation="horizontal"
          className="h-full"
          id="problem-workspace"
          defaultLayout={{ "problem-left": 38, "problem-right": 62 }}
        >

          {/* ── Left: Problem statement ──────────────────────────────────── */}
          <Panel id="problem-left" defaultSize={38} minSize={24} maxSize={60}>
            <div className="h-full overflow-hidden flex flex-col border-r border-white/[0.06] bg-[#0d1117]">
              <LeftPanel problem={problem} leftTab={leftTab} setLeftTab={setLeftTab} slug={slug} />
            </div>
          </Panel>

          <PanelResizeHandle className="w-[3px] bg-white/[0.03] hover:bg-[#00d4ff]/40 active:bg-[#00d4ff]/60 transition-colors cursor-col-resize shrink-0" />

          {/* ── Right: Editor + Output ───────────────────────────────────── */}
          <Panel id="problem-right" defaultSize={62} minSize={30}>
            <PanelGroup
              orientation="vertical"
              className="h-full"
              id="problem-editor-stack"
              defaultLayout={{ "problem-editor": 65, "problem-output": 35 }}
            >

              {/* Code editor pane */}
              <Panel id="problem-editor" defaultSize={65} minSize={28}>
                <div className="h-full flex flex-col overflow-hidden bg-[#0d1117]">
                  <EditorToolbar language={language} onLanguageChange={setLanguage} />
                  {/* flex-1 min-h-0 is crucial — without min-h-0 flex children ignore overflow */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <CodeEditor
                      value={code} onChange={setCode} language={language}
                      onRun={handleRun} onSubmit={handleSubmit} problemSlug={slug}
                      height="100%"
                    />
                  </div>
                  <CustomInput
                    value={customInput} onChange={setCustomInput}
                    isOpen={customInputOpen} onToggle={() => setCustomInputOpen(!customInputOpen)}
                  />
                </div>
              </Panel>

              <PanelResizeHandle className="h-[3px] bg-white/[0.03] hover:bg-[#00d4ff]/40 active:bg-[#00d4ff]/60 transition-colors cursor-row-resize shrink-0" />

              {/* Output / test cases pane */}
              <Panel id="problem-output" defaultSize={35} minSize={14}>
                <div className="h-full overflow-hidden">
                  <OutputPanel result={result} testResults={testResults} isRunning={isRunning} />
                </div>
              </Panel>

            </PanelGroup>
          </Panel>

        </PanelGroup>
      </div>

      <AiChatDrawer
        isOpen={aiChatOpen} onClose={() => setAiChatOpen(false)}
        currentCode={code} currentLanguage={language}
        problemTitle={problem.title} problemDescription={problem.description}
      />
    </div>
  );
}

// ── TopBar ─────────────────────────────────────────────────────────────────────

function TopBar({
  problem, language, onLanguageChange, languages, isRunning, onRun, onSubmit, slug: _slug, onAiChatClick,
}: {
  problem: Problem | null;
  language: Language;
  onLanguageChange: (l: Language) => void;
  languages: LanguageEntry[];
  isRunning: boolean;
  onRun: () => void;
  onSubmit: () => void;
  slug: string;
  onAiChatClick?: () => void;
}) {
  // suppress unused warning
  void language; void onLanguageChange; void languages;

  return (
    <div className="h-12 bg-[#161b22] border-b border-white/[0.07] flex items-center justify-between px-4 shrink-0 gap-3">
      {/* Left */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Link href="/problems" className="shrink-0 text-white/30 hover:text-white/60 transition-colors p-1 -ml-1 rounded-lg hover:bg-white/[0.05]">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        {problem && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-semibold text-white truncate max-w-[180px] md:max-w-xs leading-none">
              {problem.title}
            </span>
            <span className={cn(
              'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md border',
              DIFF_BADGE[problem.difficulty] ?? 'text-white/50 bg-white/5 border-white/10'
            )}>
              {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
            </span>
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 shrink-0">
        {/* AI button */}
        {onAiChatClick && (
          <button
            onClick={onAiChatClick}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold bg-[#00d4ff]/12 hover:bg-[#00d4ff]/20 border border-[#00d4ff]/25 hover:border-[#00d4ff]/45 text-[#00d4ff] transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask AI</span>
          </button>
        )}

        {/* Divider */}
        <div className="w-px h-5 bg-white/[0.08]" />

        {/* Run */}
        <button
          onClick={onRun}
          disabled={isRunning}
          className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-medium bg-white/[0.06] hover:bg-white/[0.10] disabled:opacity-40 border border-white/[0.09] text-white transition-colors"
        >
          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3 h-3 fill-emerald-400 text-emerald-400" />}
          Run
        </button>

        {/* Submit */}
        <button
          onClick={onSubmit}
          disabled={isRunning}
          className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-semibold bg-[#00d4ff] hover:bg-[#6a74e8] disabled:opacity-40 text-white transition-colors shadow-md shadow-[#00d4ff]/20"
        >
          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3 h-3" />}
          Submit
        </button>

        <span className="hidden lg:block text-[9px] text-white/15 font-mono ml-1">⌘↵ · ⌘⇧↵</span>
      </div>
    </div>
  );
}

// ── LeftPanel ──────────────────────────────────────────────────────────────────

function LeftPanel({
  problem, leftTab, setLeftTab, slug,
}: {
  problem: Problem;
  leftTab: LeftTab;
  setLeftTab: (t: LeftTab) => void;
  slug: string;
}) {
  const TABS: { id: LeftTab; label: string }[] = [
    { id: 'description', label: 'Description' },
    { id: 'submissions', label: 'Submissions' },
    { id: 'hints',       label: 'Hints' },
  ];

  return (
    <>
      {/* Tab bar — fixed height, never shrinks */}
      <div className="flex items-center border-b border-white/[0.07] bg-[#0d1117] px-3 shrink-0 h-10 gap-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setLeftTab(tab.id)}
            className={cn(
              'px-3 h-full text-[11px] font-semibold border-b-2 transition-colors',
              leftTab === tab.id
                ? 'border-[#00d4ff] text-white'
                : 'border-transparent text-white/35 hover:text-white/65'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable content — min-h-0 is required for flex children to respect overflow */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {leftTab === 'description' && (
          <div className="px-5 py-4 pb-8">
            <ProblemStatement problem={problem} />
          </div>
        )}
        {leftTab === 'submissions' && <SubmissionsPanel slug={slug} />}
        {leftTab === 'hints'       && <HintsPanel problem={problem} />}
      </div>
    </>
  );
}

// ── HintsPanel ─────────────────────────────────────────────────────────────────

function HintsPanel({ problem }: { problem: Problem }) {
  const [revealed, setRevealed] = useState<number[]>([]);
  const hints = getHints(problem);

  if (hints.length === 0) {
    return (
      <div className="p-6 text-center mt-8">
        <p className="text-xs text-white/25">No hints available for this problem.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <p className="text-[11px] text-white/30 px-1 mb-3 leading-relaxed">
        Try the problem yourself first. Hints are here if you get stuck.
      </p>
      {hints.map((hint, i) => (
        <div key={i} className="rounded-xl border border-white/[0.07] overflow-hidden bg-[#161b22]/40">
          <button
            onClick={() => setRevealed((prev) =>
              prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
            )}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
          >
            <span className="text-[12px] font-semibold text-white/60">Hint {i + 1}</span>
            <span className="text-[10px] text-[#00d4ff] font-medium">
              {revealed.includes(i) ? 'Hide ↑' : 'Reveal ↓'}
            </span>
          </button>
          {revealed.includes(i) && (
            <div className="px-4 pb-4 text-[12px] text-white/55 border-t border-white/[0.05] pt-3 leading-relaxed">
              {hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function getHints(problem: Problem): string[] {
  const diff = problem.difficulty;
  const tags = problem.tags ?? [];
  const hints: string[] = [];

  if (tags.includes('hash-map') || tags.includes('hash-table'))
    hints.push('Consider using a hash map (object/dictionary) to store seen values for O(1) lookup.');
  if (tags.includes('two-pointers'))
    hints.push('A two-pointer approach can often reduce time complexity to O(n).');
  if (tags.includes('binary-search'))
    hints.push('The array is sorted — can you use binary search to find the answer in O(log n)?');
  if (tags.includes('dynamic-programming')) {
    hints.push('Think about breaking the problem into subproblems. What is the recurrence relation?');
    hints.push('Consider building a dp[] array where dp[i] represents the answer for the first i elements.');
  }
  if (tags.includes('recursion'))
    hints.push('Think recursively — what is the base case? What does the recursive call return?');
  if (tags.includes('sorting'))
    hints.push('Does sorting the input first simplify the problem?');
  if (tags.includes('sliding-window'))
    hints.push('A sliding window maintains a range [left, right] — think about when to expand vs shrink it.');
  if (tags.includes('stack'))
    hints.push('A stack (LIFO) can help track "pending" elements — think about what to push and when to pop.');
  if (tags.includes('trees') || tags.includes('binary-tree'))
    hints.push('Consider DFS (recursion) or BFS (queue) to traverse the tree.');
  if (tags.includes('graphs'))
    hints.push('Build an adjacency list, then use BFS/DFS to explore connectivity.');

  if (hints.length === 0) {
    if (diff === 'easy') {
      hints.push('Start with a brute force approach — iterate through all possibilities.');
      hints.push('Think about what data structure would make lookups fastest.');
    } else if (diff === 'medium') {
      hints.push('Can you reduce the time complexity below O(n²)?');
      hints.push('Think about sorting or using a frequency map to pre-process the input.');
    } else {
      hints.push('Optimize your solution — there is likely an O(n log n) or O(n) approach.');
      hints.push('Consider whether a greedy strategy provably gives the optimal answer.');
      hints.push('Think about divide and conquer — can you split the problem at the midpoint?');
    }
  }

  return hints;
}
