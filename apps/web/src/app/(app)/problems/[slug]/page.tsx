'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Play, Send, Loader2, ChevronLeft } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Language, LANGUAGE_NAMES, type Problem, type ExecutionResult } from '@vyro/types';
import { problemsApi, executeApi, executeApiExt, languagesApi, type LanguageEntry } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { ProblemStatement } from '@/components/problems/ProblemStatement';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { OutputPanel } from '@/components/editor/OutputPanel';
import { CustomInput } from '@/components/editor/CustomInput';
import { SubmissionsPanel } from '@/components/editor/SubmissionsPanel';
import type { TestCaseResult } from '@/lib/api';
import Link from 'next/link';

// ── Tab types ──────────────────────────────────────────────────────────────────

type LeftTab = 'description' | 'submissions' | 'hints';

// ── Starter code fallbacks per language ───────────────────────────────────────

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

  // Data
  const [problem, setProblem]       = useState<Problem | null>(null);
  const [languages, setLanguages]   = useState<LanguageEntry[]>([]);
  const [loading, setLoading]       = useState(true);

  // Editor state
  const [code, setCode]             = useState('');
  const [language, setLanguage]     = useState<Language>(Language.JavaScript);

  // Execution state
  const [isRunning, setIsRunning]   = useState(false);
  const [result, setResult]         = useState<ExecutionResult | null>(null);
  const [testResults, setTestResults] = useState<TestCaseResult[] | null>(null);

  // UI state
  const [leftTab, setLeftTab]       = useState<LeftTab>('description');
  const [customInput, setCustomInput] = useState('');
  const [customInputOpen, setCustomInputOpen] = useState(false);
  const [isMobile, setIsMobile]     = useState(false);
  const [mobileView, setMobileView] = useState<'problem' | 'editor'>('problem');

  // Track if code was loaded from localStorage to avoid overwrite
  const codeLoadedRef = useRef(false);

  // ── Responsive detection ────────────────────────────────────────────────────

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Load languages ──────────────────────────────────────────────────────────

  useEffect(() => {
    languagesApi.list().then((res) => setLanguages(res.data)).catch(() => {});
  }, []);

  // ── Load problem ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    problemsApi.get(slug).then((res) => {
      setProblem(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [slug]);

  // ── Load/restore code ───────────────────────────────────────────────────────

  // When language or slug changes, try loading from localStorage first
  useEffect(() => {
    if (!slug) return;
    codeLoadedRef.current = false;
    const storageKey = `vyro-code-${slug}-${language}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setCode(saved);
      codeLoadedRef.current = true;
      return;
    }
    // Fall back to problem starter code
    if (problem) {
      const starterCode = (problem.starterCode as Record<string, string>)?.[String(language)];
      if (starterCode) {
        setCode(starterCode);
        return;
      }
    }
    // Fall back to generic starter
    setCode(FALLBACK_STARTERS[language] ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, language]);

  // When problem loads and code hasn't been set from storage, load starter
  useEffect(() => {
    if (!problem || codeLoadedRef.current) return;
    const storageKey = `vyro-code-${slug}-${language}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setCode(saved);
      return;
    }
    const starterCode = (problem.starterCode as Record<string, string>)?.[String(language)];
    setCode(starterCode ?? FALLBACK_STARTERS[language] ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleRun = useCallback(async () => {
    if (!problem || isRunning) return;
    setIsRunning(true);
    setResult(null);
    setTestResults(null);

    try {
      if (customInputOpen && customInput.trim()) {
        // Custom stdin → single run
        const res = await executeApi.run({ code, languageId: language, stdin: customInput });
        setResult(res.data);
      } else {
        // Run against visible test cases
        const res = await executeApiExt.runAll({ code, languageId: language, problemId: problem.id });
        setTestResults(res.data);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      const isUnauth = msg.toLowerCase().includes('unauthorized');
      setResult({
        token: '',
        status: { id: -1, description: 'runtime_error' },
        submissionStatus: 'runtime_error' as ExecutionResult['submissionStatus'],
        stderr: isUnauth ? '⚠️ Please sign in to run code.' : msg,
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

      // Poll for result
      const poll = async (id: string, attempts = 0): Promise<void> => {
        if (attempts > 30) return;
        await new Promise((r) => setTimeout(r, 600));
        const subRes = await executeApi.getSubmission(id);
        const { status } = subRes.data;
        if (status === 'processing' || status === 'pending') {
          return poll(id, attempts + 1);
        }
        setResult({
          token: id,
          status: { id: 0, description: status },
          stdout: subRes.data.stdout ?? undefined,
          stderr: subRes.data.stderr ?? undefined,
          timeMs: subRes.data.timeMs ?? undefined,
          memoryKb: subRes.data.memoryKb ?? undefined,
          submissionStatus: status as ExecutionResult['submissionStatus'],
        });
      };
      await poll(data.submissionId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      const isUnauth = msg.toLowerCase().includes('unauthorized');
      setResult({
        token: '',
        status: { id: -1, description: 'runtime_error' },
        submissionStatus: 'runtime_error' as ExecutionResult['submissionStatus'],
        stderr: isUnauth ? '⚠️ Please sign in to submit.' : msg,
      } as ExecutionResult);
    } finally {
      setIsRunning(false);
    }
  }, [code, language, problem, isRunning]);

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen bg-[#0d1117] flex flex-col">
        <TopBar problem={null} language={language} onLanguageChange={setLanguage} languages={languages} isRunning={false} onRun={() => {}} onSubmit={() => {}} slug={slug} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-white/30" />
        </div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="h-screen bg-[#0d1117] flex flex-col items-center justify-center text-white/40">
        <p className="text-sm">Problem not found.</p>
        <Link href="/problems" className="mt-3 text-xs text-[#828fff] hover:underline">← Back to problems</Link>
      </div>
    );
  }

  // ── Mobile layout ────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className="h-screen bg-[#0d1117] flex flex-col overflow-hidden">
        <TopBar problem={problem} language={language} onLanguageChange={setLanguage} languages={languages} isRunning={isRunning} onRun={handleRun} onSubmit={handleSubmit} slug={slug} />

        {/* Mobile tab switcher */}
        <div className="flex border-b border-white/[0.08] shrink-0">
          <button
            onClick={() => setMobileView('problem')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${mobileView === 'problem' ? 'text-white border-b-2 border-[#828fff]' : 'text-white/40'}`}
          >
            Problem
          </button>
          <button
            onClick={() => setMobileView('editor')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${mobileView === 'editor' ? 'text-white border-b-2 border-[#828fff]' : 'text-white/40'}`}
          >
            Solution
          </button>
        </div>

        {mobileView === 'problem' ? (
          <div className="flex-1 overflow-y-auto">
            <LeftPanel problem={problem} leftTab={leftTab} setLeftTab={setLeftTab} slug={slug} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <EditorToolbar language={language} onLanguageChange={setLanguage} />
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                value={code}
                onChange={setCode}
                language={language}
                onRun={handleRun}
                onSubmit={handleSubmit}
                problemSlug={slug}
                height="100%"
              />
            </div>
            <CustomInput value={customInput} onChange={setCustomInput} isOpen={customInputOpen} onToggle={() => setCustomInputOpen(!customInputOpen)} />
            <div className="h-48 shrink-0">
              <OutputPanel result={result} testResults={testResults} isRunning={isRunning} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Desktop layout ───────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-[#0d1117] flex flex-col overflow-hidden">
      <TopBar problem={problem} language={language} onLanguageChange={setLanguage} languages={languages} isRunning={isRunning} onRun={handleRun} onSubmit={handleSubmit} slug={slug} />

      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" className="h-full">
          {/* LEFT: Problem panel */}
          <Panel defaultSize={38} minSize={25} maxSize={55}>
            <div className="h-full bg-[#0d1117] border-r border-white/[0.06] overflow-hidden flex flex-col">
              <LeftPanel problem={problem} leftTab={leftTab} setLeftTab={setLeftTab} slug={slug} />
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-white/[0.04] hover:bg-[#828fff]/40 active:bg-[#828fff]/60 transition-colors cursor-col-resize" />

          {/* RIGHT: Editor + Output */}
          <Panel defaultSize={62} minSize={35}>
            <PanelGroup direction="vertical" className="h-full">
              {/* Editor section */}
              <Panel defaultSize={60} minSize={30}>
                <div className="h-full flex flex-col overflow-hidden">
                  <EditorToolbar language={language} onLanguageChange={setLanguage} />
                  <div className="flex-1 overflow-hidden">
                    <CodeEditor
                      value={code}
                      onChange={setCode}
                      language={language}
                      onRun={handleRun}
                      onSubmit={handleSubmit}
                      problemSlug={slug}
                      height="100%"
                    />
                  </div>
                  <CustomInput
                    value={customInput}
                    onChange={setCustomInput}
                    isOpen={customInputOpen}
                    onToggle={() => setCustomInputOpen(!customInputOpen)}
                  />
                </div>
              </Panel>

              <PanelResizeHandle className="h-1 bg-white/[0.04] hover:bg-[#828fff]/40 active:bg-[#828fff]/60 transition-colors cursor-row-resize" />

              {/* Output section */}
              <Panel defaultSize={40} minSize={15}>
                <OutputPanel result={result} testResults={testResults} isRunning={isRunning} />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

// ── TopBar component ───────────────────────────────────────────────────────────

function TopBar({
  problem, language, onLanguageChange, languages, isRunning, onRun, onSubmit, slug: _slug,
}: {
  problem: Problem | null;
  language: Language;
  onLanguageChange: (l: Language) => void;
  languages: LanguageEntry[];
  isRunning: boolean;
  onRun: () => void;
  onSubmit: () => void;
  slug: string;
}) {
  return (
    <div className="h-12 bg-[#161b22] border-b border-white/[0.08] flex items-center justify-between px-4 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/problems" className="text-white/40 hover:text-white/70 transition-colors shrink-0">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        {problem && (
          <>
            <span className="text-sm font-semibold text-white truncate max-w-[200px] md:max-w-xs">
              {problem.title}
            </span>
            <Badge variant={problem.difficulty as 'easy' | 'medium' | 'hard'}>
              {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
            </Badge>
          </>
        )}
      </div>

      {/* Right: Run + Submit */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden md:block text-[10px] text-white/20 font-mono mr-1">⌘↵ run · ⌘⇧↵ submit</span>
        <button
          onClick={onRun}
          disabled={isRunning}
          className="flex items-center gap-1.5 bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-50 border border-white/[0.1] text-white text-xs font-medium rounded-lg px-3 h-8 transition-colors"
        >
          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-[#4ade80]" />}
          Run
        </button>
        <button
          onClick={onSubmit}
          disabled={isRunning}
          className="flex items-center gap-1.5 bg-[#828fff] hover:bg-[#6a74e8] disabled:opacity-50 text-white text-xs font-semibold rounded-lg px-3 h-8 transition-colors shadow-lg shadow-[#828fff]/20"
        >
          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Submit
        </button>
      </div>
    </div>
  );
}

// ── LeftPanel component ────────────────────────────────────────────────────────

function LeftPanel({
  problem, leftTab, setLeftTab, slug,
}: {
  problem: Problem;
  leftTab: LeftTab;
  setLeftTab: (t: LeftTab) => void;
  slug: string;
}) {
  const tabs: { id: LeftTab; label: string }[] = [
    { id: 'description', label: 'Description' },
    { id: 'submissions', label: 'Submissions' },
    { id: 'hints',       label: 'Hints' },
  ];

  return (
    <>
      {/* Tab bar */}
      <div className="flex items-center border-b border-white/[0.08] px-2 shrink-0 h-10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setLeftTab(tab.id)}
            className={`px-3 h-full text-[11px] font-medium border-b-2 transition-colors ${
              leftTab === tab.id
                ? 'border-[#828fff] text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {leftTab === 'description' && (
          <div className="p-5">
            <ProblemStatement problem={problem} />
          </div>
        )}
        {leftTab === 'submissions' && (
          <SubmissionsPanel slug={slug} />
        )}
        {leftTab === 'hints' && (
          <HintsPanel problem={problem} />
        )}
      </div>
    </>
  );
}

// ── HintsPanel ─────────────────────────────────────────────────────────────────

function HintsPanel({ problem }: { problem: Problem }) {
  const [revealed, setRevealed] = useState<number[]>([]);

  // Generate generic hints based on difficulty and tags
  const hints = getHints(problem);

  if (hints.length === 0) {
    return (
      <div className="p-5 text-white/30 text-sm text-center mt-10">
        No hints available for this problem.
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      <p className="text-xs text-white/40 mb-4">
        Hints are here to guide you — try to solve it yourself first!
      </p>
      {hints.map((hint, i) => (
        <div key={i} className="border border-white/[0.08] rounded-xl overflow-hidden">
          <button
            onClick={() => setRevealed((prev) =>
              prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
            )}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
          >
            <span className="text-sm font-medium text-white/70">Hint {i + 1}</span>
            <span className="text-xs text-[#828fff]">{revealed.includes(i) ? 'Hide' : 'Reveal'}</span>
          </button>
          {revealed.includes(i) && (
            <div className="px-4 pb-4 text-sm text-white/60 border-t border-white/[0.06] pt-3">
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

  if (tags.includes('hash-map') || tags.includes('hash-table')) {
    hints.push('Consider using a hash map (object/dictionary) to store seen values for O(1) lookup.');
  }
  if (tags.includes('two-pointers')) {
    hints.push('A two-pointer approach can often reduce time complexity to O(n).');
  }
  if (tags.includes('binary-search')) {
    hints.push('The array is sorted — can you use binary search to find the answer in O(log n)?');
  }
  if (tags.includes('dynamic-programming')) {
    hints.push('Think about breaking the problem into subproblems. What is the recurrence relation?');
    hints.push('Consider building a dp[] array where dp[i] represents the answer for the first i elements.');
  }
  if (tags.includes('recursion')) {
    hints.push('Think recursively — what is the base case? What does the recursive call return?');
  }
  if (tags.includes('sorting')) {
    hints.push('Does sorting the input first simplify the problem?');
  }
  if (tags.includes('sliding-window')) {
    hints.push('A sliding window maintains a range [left, right] — think about when to expand vs shrink it.');
  }
  if (tags.includes('stack')) {
    hints.push('A stack (LIFO) can help track "pending" elements — think about what to push and when to pop.');
  }
  if (tags.includes('trees') || tags.includes('binary-tree')) {
    hints.push('Consider DFS (recursion) or BFS (queue) to traverse the tree.');
  }
  if (tags.includes('graphs')) {
    hints.push('Build an adjacency list, then use BFS/DFS to explore connectivity.');
  }

  // Generic hints based on difficulty
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
