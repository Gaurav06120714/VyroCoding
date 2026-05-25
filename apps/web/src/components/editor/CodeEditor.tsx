'use client';

import dynamic from 'next/dynamic';
import { useRef, useCallback, useEffect } from 'react';
import { Language, LANGUAGE_MONACO_MAP } from '@vyro/types';
import type * as Monaco from 'monaco-editor';
import { useEditorStore } from '@/store/editor.store';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#1e1e1e] flex flex-col gap-3 p-4">
      <div className="h-4 bg-white/[0.06] rounded animate-pulse w-1/3" />
      <div className="h-4 bg-white/[0.04] rounded animate-pulse w-2/3" />
      <div className="h-4 bg-white/[0.06] rounded animate-pulse w-1/2" />
      <div className="h-4 bg-white/[0.04] rounded animate-pulse w-3/4" />
      <div className="h-4 bg-white/[0.06] rounded animate-pulse w-1/4" />
      <div className="flex items-center gap-2 mt-4 text-slate-500 text-xs font-mono">
        <div className="w-3 h-3 border border-slate-500/40 border-t-slate-400 rounded-full animate-spin" />
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
  onRun?: () => void;
  onSubmit?: () => void;
  problemSlug?: string;
  /** Called with (line, column) on cursor position change — used for live cursors */
  onCursorChange?: (line: number, column: number) => void;
}

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height = '100%',
  onRun,
  onSubmit,
  problemSlug,
  onCursorChange,
}: CodeEditorProps) {
  const { fontSize, theme, minimap, wordWrap, tabSize } = useEditorStore();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoLang = LANGUAGE_MONACO_MAP[language] ?? 'javascript';

  // LocalStorage key per problem per language
  const storageKey = problemSlug ? `vyro-code-${problemSlug}-${language}` : null;

  // Restore code from localStorage on mount / when language changes
  useEffect(() => {
    if (!storageKey) return;
    const saved = localStorage.getItem(storageKey);
    if (saved && saved !== value) {
      onChange(saved);
    }
    // Only run on storageKey change (language/slug change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Auto-save to localStorage whenever value changes
  useEffect(() => {
    if (!storageKey || !value) return;
    const timer = setTimeout(() => {
      localStorage.setItem(storageKey, value);
    }, 300);
    return () => clearTimeout(timer);
  }, [storageKey, value]);

  const handleChange = useCallback(
    (val: string | undefined) => {
      onChange(val ?? '');
    },
    [onChange]
  );

  const handleMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      editorRef.current = editor;

      // Ctrl+Enter / Cmd+Enter → Run
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        () => { onRun?.(); }
      );

      // Ctrl+Shift+Enter / Cmd+Shift+Enter → Submit
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
        () => { onSubmit?.(); }
      );

      // Cursor position → broadcast for live cursors
      if (onCursorChange) {
        editor.onDidChangeCursorPosition((e) => {
          onCursorChange(e.position.lineNumber, e.position.column);
        });
      }
    },
    [onRun, onSubmit, onCursorChange]
  );

  const editorOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
    fontSize,
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    fontLigatures: true,
    lineHeight: Math.round(fontSize * 1.6),
    minimap: { enabled: minimap },
    scrollBeyondLastLine: false,
    wordWrap: wordWrap ? 'on' : 'off',
    tabSize,
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
    readOnly,
    automaticLayout: true,
  };

  return (
    <div className="monaco-editor-container w-full" style={{ height }}>
      <MonacoEditor
        height={height}
        language={monacoLang}
        value={value}
        theme={theme}
        onChange={handleChange}
        onMount={handleMount}
        options={editorOptions}
      />
    </div>
  );
}
