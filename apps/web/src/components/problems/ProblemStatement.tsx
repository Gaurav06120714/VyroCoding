'use client';

import type { Problem } from '@vyro/types';
import { difficultyClass, formatDifficulty } from '@/lib/utils';

interface ProblemStatementProps {
  problem: Problem;
}

export function ProblemStatement({ problem }: ProblemStatementProps) {
  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-bold">{problem.title}</h2>
          <span className={difficultyClass(problem.difficulty)}>
            {formatDifficulty(problem.difficulty)}
          </span>
        </div>

        {/* Tags */}
        {problem.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {problem.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs text-slate-400 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="prose prose-invert prose-sm max-w-none">
        <div
          className="text-slate-300 leading-relaxed text-sm whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: problem.description.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') }}
        />
      </div>

      {/* Examples */}
      {problem.examples.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Examples</h3>
          {problem.examples.map((example, i) => (
            <div key={i} className="bg-white/4 rounded-lg p-4 space-y-2 border border-white/8">
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wide">Input</span>
                <pre className="text-sm text-white font-mono mt-1 whitespace-pre-wrap">{example.input}</pre>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wide">Output</span>
                <pre className="text-sm text-emerald-300 font-mono mt-1">{example.output}</pre>
              </div>
              {example.explanation && (
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wide">Explanation</span>
                  <p className="text-sm text-slate-300 mt-1">{example.explanation}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Constraints */}
      {problem.constraints.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Constraints</h3>
          <ul className="space-y-1">
            {problem.constraints.map((c, i) => (
              <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                <span className="text-violet-400 mt-0.5">•</span>
                <code className="text-slate-300">{c}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
