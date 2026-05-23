'use client';

import dynamic from 'next/dynamic';
import { useRef, useCallback } from 'react';
import { Language, LANGUAGE_MONACO_MAP } from '@vyro/types';
import type * as Monaco from 'monaco-editor';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#1e1e1e] flex items-center justify-center">
      <div className="flex items-center gap-2 text-slate-400 text-sm">
        <div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
        Loading editor...
      </div>
    </div>
  ),
});

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: Language;
  readOnly?: boolean;
  height?: string;
}

const EDITOR_OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions = {
  fontSize: 14,
  fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  fontLigatures: true,
  lineHeight: 22,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  renderWhitespace: 'selection',
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  bracketPairColorization: { enabled: true },
  guides: {
    bracketPairs: true,
    indentation: true,
  },
  padding: { top: 16, bottom: 16 },
  scrollbar: {
    verticalScrollbarSize: 6,
    horizontalScrollbarSize: 6,
  },
  suggest: {
    showIcons: true,
  },
  quickSuggestions: {
    other: true,
    comments: false,
    strings: false,
  },
};

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height = '100%',
}: CodeEditorProps) {
  const monacoLang = LANGUAGE_MONACO_MAP[language] ?? 'javascript';

  const handleChange = useCallback(
    (val: string | undefined) => {
      onChange(val ?? '');
    },
    [onChange]
  );

  return (
    <div className="monaco-editor-container w-full" style={{ height }}>
      <MonacoEditor
        height={height}
        language={monacoLang}
        value={value}
        theme="vs-dark"
        onChange={handleChange}
        options={{
          ...EDITOR_OPTIONS,
          readOnly,
        }}
      />
    </div>
  );
}
