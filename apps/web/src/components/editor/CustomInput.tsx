'use client';

import { ChevronDown, ChevronUp, Terminal } from 'lucide-react';

interface CustomInputProps {
  value: string;
  onChange: (v: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function CustomInput({ value, onChange, isOpen, onToggle }: CustomInputProps) {
  return (
    <div className="border-t border-white/[0.08] bg-[#0d1117] shrink-0">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full h-8 flex items-center justify-between px-3 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-white/40" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.7px] text-white/40">
            Custom Input
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-white/30" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-white/30" />
        )}
      </button>

      {/* Textarea */}
      {isOpen && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter custom stdin here..."
          spellCheck={false}
          className="w-full h-24 bg-transparent text-white/80 text-xs font-mono px-3 pb-3 resize-none outline-none placeholder:text-white/20 border-0"
          style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
        />
      )}
    </div>
  );
}
