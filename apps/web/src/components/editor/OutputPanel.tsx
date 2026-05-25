'use client';

import { useState } from 'react';
import {
  CheckCircle2, XCircle, Clock, Cpu, AlertTriangle,
  Loader2, Terminal, FlaskConical, History, ChevronRight,
} from 'lucide-react';
import type { ExecutionResult } from '@vyro/types';
import { SubmissionStatus } from '@vyro/types';
import type { TestCaseResult } from '@/lib/api';

interface OutputPanelProps {
  result: ExecutionResult | null;
  testResults?: TestCaseResult[] | null;
  isRunning: boolean;
  problemSlug?: string;
}

// ── Status helpers ─────────────────────────────────────────────────────────────

function getStatusConfig(status?: SubmissionStatus) {
  switch (status) {
    case SubmissionStatus.Accepted:
      return { label: 'Accepted', color: 'text-[#27a644]', bg: 'bg-[#27a644]/10 border-[#27a644]/20', icon: <CheckCircle2 className="w-4 h-4" /> };
    case SubmissionStatus.WrongAnswer:
      return { label: 'Wrong Answer', color: 'text-[#e5534b]', bg: 'bg-[#e5534b]/10 border-[#e5534b]/20', icon: <XCircle className="w-4 h-4" /> };
    case SubmissionStatus.TimeLimitExceeded:
      return { label: 'Time Limit Exceeded', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', icon: <Clock className="w-4 h-4" /> };
    case SubmissionStatus.MemoryLimitExceeded:
      return { label: 'Memory Limit Exceeded', color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20', icon: <Cpu className="w-4 h-4" /> };
    case SubmissionStatus.RuntimeError:
      return { label: 'Runtime Error', color: 'text-[#e5534b]', bg: 'bg-[#e5534b]/10 border-[#e5534b]/20', icon: <XCircle className="w-4 h-4" /> };
    case SubmissionStatus.CompileError:
      return { label: 'Compile Error', color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20', icon: <AlertTriangle className="w-4 h-4" /> };
    case SubmissionStatus.Processing:
      return { label: 'Processing…', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: <Loader2 className="w-4 h-4 animate-spin" /> };
    default:
      return { label: 'Error', color: 'text-white/50', bg: 'bg-white/5 border-white/10', icon: <AlertTriangle className="w-4 h-4" /> };
  }
}

// ── Running skeleton ───────────────────────────────────────────────────────────

function RunningView() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-white/40">
      <div className="relative">
        <div className="w-10 h-10 border-2 border-white/10 border-t-[#828fff] rounded-full animate-spin" />
        <Terminal className="w-4 h-4 absolute inset-0 m-auto text-[#828fff]" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-white/60">Executing…</p>
        <p className="text-xs mt-0.5">Sending to Judge0 CE</p>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyView() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-white/25">
      <Terminal className="w-7 h-7" />
      <p className="text-sm">Run your code to see output</p>
      <p className="text-xs font-mono text-white/20">Ctrl + Enter to run</p>
    </div>
  );
}

// ── Output tab ─────────────────────────────────────────────────────────────────

function OutputView({ result }: { result: ExecutionResult }) {
  const cfg = getStatusConfig(result.submissionStatus);
  const hasOutput = result.stdout?.trim();
  const hasError = result.stderr?.trim() || result.compileOutput?.trim();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status bar */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${cfg.bg} shrink-0`}>
        <div className={`flex items-center gap-2 text-sm font-semibold ${cfg.color}`}>
          {cfg.icon}
          {cfg.label}
        </div>
        <div className="flex items-center gap-4 text-xs text-white/40">
          {result.timeMs !== undefined && result.timeMs > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />{result.timeMs}ms
            </span>
          )}
          {result.memoryKb !== undefined && result.memoryKb > 0 && (
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3" />{(result.memoryKb / 1024).toFixed(1)} MB
            </span>
          )}
        </div>
      </div>

      {/* Console output */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
        {!hasOutput && !hasError && (
          <p className="text-white/25 italic">No output produced.</p>
        )}

        {hasOutput && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5 font-sans">stdout</p>
            <pre className="text-[#4ade80] whitespace-pre-wrap break-all leading-relaxed bg-[#4ade80]/5 rounded-lg p-3">
              {result.stdout}
            </pre>
          </div>
        )}

        {result.compileOutput?.trim() && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400/60 mb-1.5 font-sans">Compile Output</p>
            <pre className="text-orange-300 whitespace-pre-wrap break-all leading-relaxed bg-orange-400/5 rounded-lg p-3">
              {result.compileOutput}
            </pre>
          </div>
        )}

        {result.stderr?.trim() && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#e5534b]/60 mb-1.5 font-sans">stderr</p>
            <pre className="text-[#ff8080] whitespace-pre-wrap break-all leading-relaxed bg-[#e5534b]/5 rounded-lg p-3">
              {result.stderr}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Test Cases tab ─────────────────────────────────────────────────────────────

function TestCasesView({ testResults }: { testResults: TestCaseResult[] }) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const passed = testResults.filter((t) => t.passed).length;
  const total = testResults.length;
  const allPassed = passed === total;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary bar */}
      <div className={`flex items-center gap-2 px-4 py-2 border-b shrink-0 ${allPassed ? 'bg-[#27a644]/10 border-[#27a644]/20' : 'bg-[#e5534b]/10 border-[#e5534b]/20'}`}>
        {allPassed
          ? <CheckCircle2 className="w-4 h-4 text-[#27a644]" />
          : <XCircle className="w-4 h-4 text-[#e5534b]" />}
        <span className={`text-sm font-semibold ${allPassed ? 'text-[#27a644]' : 'text-[#e5534b]'}`}>
          {passed}/{total} test cases passed
        </span>
      </div>

      {/* Cases list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {testResults.map((tc, i) => (
          <div
            key={i}
            className={`rounded-lg border overflow-hidden ${
              tc.passed
                ? 'border-[#27a644]/20 bg-[#27a644]/5'
                : 'border-[#e5534b]/20 bg-[#e5534b]/5'
            }`}
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              {tc.passed
                ? <CheckCircle2 className="w-3.5 h-3.5 text-[#27a644] shrink-0" />
                : <XCircle className="w-3.5 h-3.5 text-[#e5534b] shrink-0" />}
              <span className={`text-xs font-semibold ${tc.passed ? 'text-[#27a644]' : 'text-[#e5534b]'}`}>
                Case {i + 1}
              </span>
              {tc.timeMs !== null && (
                <span className="ml-auto text-[10px] text-white/30 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />{tc.timeMs}ms
                </span>
              )}
              <ChevronRight className={`w-3.5 h-3.5 text-white/30 transition-transform shrink-0 ${expanded === i ? 'rotate-90' : ''}`} />
            </button>

            {expanded === i && (
              <div className="border-t border-white/[0.06] px-3 py-2 space-y-2 font-mono text-xs">
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1 font-sans">Input</p>
                  <pre className="text-white/70 bg-black/20 rounded p-2 whitespace-pre-wrap break-all">{tc.input}</pre>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1 font-sans">Expected</p>
                  <pre className="text-[#4ade80] bg-[#4ade80]/5 rounded p-2 whitespace-pre-wrap break-all">{tc.expectedOutput}</pre>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1 font-sans">Your Output</p>
                  <pre className={`${tc.passed ? 'text-[#4ade80]' : 'text-[#ff8080]'} bg-black/20 rounded p-2 whitespace-pre-wrap break-all`}>
                    {tc.actualOutput || '(empty)'}
                  </pre>
                </div>
                {tc.error && (
                  <div>
                    <p className="text-[10px] text-orange-400/60 uppercase tracking-wider mb-1 font-sans">Error</p>
                    <pre className="text-orange-300 bg-orange-400/5 rounded p-2 whitespace-pre-wrap break-all">{tc.error}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main OutputPanel ──────────────────────────────────────────────────────────

type TabId = 'output' | 'testcases';

export function OutputPanel({ result, testResults, isRunning, problemSlug: _problemSlug }: OutputPanelProps) {
  const hasTestResults = testResults && testResults.length > 0;
  const [activeTab, setActiveTab] = useState<TabId>('output');

  // Auto-switch to test-cases tab when run-all results come in
  const displayTab = hasTestResults ? 'testcases' : activeTab;

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'output',    label: 'Output',     icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: 'testcases', label: 'Test Cases', icon: <FlaskConical className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0d1117] overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-white/[0.08] px-2 shrink-0 h-9">
        {tabs.map((tab) => {
          const isActive = displayTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-[#828fff] text-white'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'testcases' && hasTestResults && (
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  testResults.every((t) => t.passed)
                    ? 'bg-[#27a644]/20 text-[#27a644]'
                    : 'bg-[#e5534b]/20 text-[#e5534b]'
                }`}>
                  {testResults.filter((t) => t.passed).length}/{testResults.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isRunning ? (
          <RunningView />
        ) : displayTab === 'testcases' && hasTestResults ? (
          <TestCasesView testResults={testResults} />
        ) : result ? (
          <OutputView result={result} />
        ) : (
          <EmptyView />
        )}
      </div>
    </div>
  );
}
