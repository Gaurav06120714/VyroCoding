'use client';

import { CheckCircle2, XCircle, Clock, Cpu, AlertTriangle, Loader2 } from 'lucide-react';
import type { ExecutionResult } from '@vyro/types';
import { SubmissionStatus } from '@vyro/types';
import type { TestCaseResult } from '@/lib/api';

interface OutputPanelProps {
  result: ExecutionResult | null;
  testResults?: TestCaseResult[] | null;
  isRunning: boolean;
}

function StatusIcon({ status }: { status: SubmissionStatus }) {
  switch (status) {
    case SubmissionStatus.Accepted:
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case SubmissionStatus.WrongAnswer:
    case SubmissionStatus.RuntimeError:
    case SubmissionStatus.CompileError:
      return <XCircle className="w-4 h-4 text-red-400" />;
    case SubmissionStatus.TimeLimitExceeded:
      return <Clock className="w-4 h-4 text-amber-400" />;
    case SubmissionStatus.MemoryLimitExceeded:
      return <Cpu className="w-4 h-4 text-orange-400" />;
    default:
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
  }
}

function statusColor(status: SubmissionStatus): string {
  switch (status) {
    case SubmissionStatus.Accepted:           return 'text-emerald-400';
    case SubmissionStatus.WrongAnswer:        return 'text-red-400';
    case SubmissionStatus.RuntimeError:       return 'text-red-400';
    case SubmissionStatus.CompileError:       return 'text-red-400';
    case SubmissionStatus.TimeLimitExceeded:  return 'text-amber-400';
    case SubmissionStatus.MemoryLimitExceeded:return 'text-orange-400';
    default:                                  return 'text-yellow-400';
  }
}

function statusLabel(status: SubmissionStatus | undefined): string {
  if (!status) return 'Error';
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function OutputPanel({ result, testResults, isRunning }: OutputPanelProps) {
  if (isRunning) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1e1e1e] rounded-lg">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-mono">Running code...</span>
        </div>
      </div>
    );
  }

  // Test-cases run-all results view
  if (testResults && testResults.length > 0) {
    const passed = testResults.filter((t) => t.passed).length;
    const total = testResults.length;
    const allPassed = passed === total;
    return (
      <div className="h-full flex flex-col bg-[#1e1e1e] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.03]">
          <div className="flex items-center gap-2">
            {allPassed
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              : <XCircle className="w-4 h-4 text-red-400" />}
            <span className={`text-sm font-semibold ${allPassed ? 'text-emerald-400' : 'text-red-400'}`}>
              {passed}/{total} passed
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
          {testResults.map((tc, i) => (
            <div
              key={i}
              className="rounded-lg p-3 border"
              style={{
                background: tc.passed ? 'rgba(39,166,68,0.07)' : 'rgba(207,45,86,0.07)',
                borderColor: tc.passed ? 'rgba(39,166,68,0.2)' : 'rgba(207,45,86,0.2)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {tc.passed
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                <span className={`font-semibold ${tc.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                  Case {i + 1}
                </span>
                {tc.timeMs !== null && (
                  <span className="ml-auto text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />{tc.timeMs}ms
                  </span>
                )}
              </div>
              <div className="space-y-1 text-[11px]">
                <div>
                  <span className="text-slate-500">Input: </span>
                  <span className="text-slate-300">{tc.input.length > 60 ? tc.input.slice(0, 60) + '…' : tc.input}</span>
                </div>
                <div>
                  <span className="text-slate-500">Expected: </span>
                  <span className="text-emerald-300">{tc.expectedOutput}</span>
                </div>
                {!tc.passed && (
                  <div>
                    <span className="text-slate-500">Got: </span>
                    <span className="text-red-400">{tc.actualOutput || tc.error || '(no output)'}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1e1e1e] rounded-lg">
        <p className="text-slate-500 text-sm">Run your code to see output here.</p>
      </div>
    );
  }

  const hasOutput = result.stdout && result.stdout.trim();
  const hasError  = result.stderr || result.compileOutput;

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] rounded-lg overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 bg-white/3">
        <div className="flex items-center gap-2">
          <StatusIcon status={result.submissionStatus} />
          <span className={`text-sm font-semibold ${statusColor(result.submissionStatus)}`}>
            {statusLabel(result.submissionStatus)}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          {result.timeMs !== undefined && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {result.timeMs}ms
            </span>
          )}
          {result.memoryKb !== undefined && (
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3" />
              {(result.memoryKb / 1024).toFixed(1)}MB
            </span>
          )}
        </div>
      </div>

      {/* Output content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm">
        {/* Stdout */}
        {hasOutput && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Output</p>
            <pre className="text-emerald-300 whitespace-pre-wrap break-all leading-relaxed">
              {result.stdout}
            </pre>
          </div>
        )}

        {/* Stderr */}
        {result.stderr && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Stderr</p>
            <pre className="text-red-400 whitespace-pre-wrap break-all leading-relaxed">
              {result.stderr}
            </pre>
          </div>
        )}

        {/* Compile output */}
        {result.compileOutput && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Compile Error</p>
            <pre className="text-orange-400 whitespace-pre-wrap break-all leading-relaxed">
              {result.compileOutput}
            </pre>
          </div>
        )}

        {!hasOutput && !hasError && (
          <p className="text-slate-500 text-center py-4">No output produced.</p>
        )}
      </div>
    </div>
  );
}
