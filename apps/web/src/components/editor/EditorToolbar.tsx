'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Sun, Moon, Map, WrapText } from 'lucide-react';
import { Language, LANGUAGE_NAMES } from '@vyro/types';
import { useEditorStore } from '@/store/editor.store';
import { languagesApi } from '@/lib/api';

interface LanguageOption {
  id: number;
  name: string;
  monacoId: string;
  version: string;
}

interface EditorToolbarProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export function EditorToolbar({ language, onLanguageChange }: EditorToolbarProps) {
  const { fontSize, theme, minimap, wordWrap, tabSize, setFontSize, setTheme, toggleMinimap, toggleWordWrap, setTabSize } =
    useEditorStore();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);

  useEffect(() => {
    languagesApi
      .list()
      .then((res) => setLanguages(res.data))
      .catch(() => {
        // Fallback to static list from types
        setLanguages(
          Object.entries(LANGUAGE_NAMES).map(([id, name]) => ({
            id: parseInt(id),
            name,
            monacoId: '',
            version: '',
          }))
        );
      });
  }, []);

  const currentLang = languages.find((l) => l.id === language);

  return (
    <div className="h-9 bg-[#161b22] border-b border-white/[0.08] flex items-center justify-between px-3 shrink-0 gap-2">
      {/* Left: Language dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowLangMenu(!showLangMenu)}
          className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-md px-2.5 py-1 transition-colors"
        >
          <span>{currentLang?.name ?? LANGUAGE_NAMES[language] ?? `Lang ${language}`}</span>
          <ChevronDown className="w-3 h-3 text-white/40" />
        </button>
        {showLangMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowLangMenu(false)}
            />
            <div className="absolute left-0 top-full mt-1 w-48 bg-[#1c2128] border border-white/[0.1] rounded-lg py-1 z-50 shadow-xl">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => {
                    onLanguageChange(lang.id as Language);
                    setShowLangMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-white/[0.06] ${
                    language === lang.id ? 'text-[#828fff]' : 'text-white/60'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right: Editor controls */}
      <div className="flex items-center gap-1">
        {/* Font size */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setFontSize(fontSize - 1)}
            className="w-6 h-6 flex items-center justify-center text-xs text-white/50 hover:text-white hover:bg-white/[0.06] rounded transition-colors"
            title="Decrease font size"
          >
            A-
          </button>
          <span className="text-[10px] text-white/30 w-4 text-center tabular-nums">{fontSize}</span>
          <button
            onClick={() => setFontSize(fontSize + 1)}
            className="w-6 h-6 flex items-center justify-center text-sm text-white/50 hover:text-white hover:bg-white/[0.06] rounded transition-colors"
            title="Increase font size"
          >
            A+
          </button>
        </div>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        {/* Tab size */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setTabSize(2)}
            className={`px-1.5 h-5 text-[10px] rounded transition-colors ${
              tabSize === 2
                ? 'bg-[#828fff]/20 text-[#828fff]'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
            }`}
            title="Tab size 2"
          >
            2
          </button>
          <button
            onClick={() => setTabSize(4)}
            className={`px-1.5 h-5 text-[10px] rounded transition-colors ${
              tabSize === 4
                ? 'bg-[#828fff]/20 text-[#828fff]'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
            }`}
            title="Tab size 4"
          >
            4
          </button>
        </div>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        {/* Word wrap toggle */}
        <button
          onClick={toggleWordWrap}
          className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
            wordWrap
              ? 'bg-[#828fff]/20 text-[#828fff]'
              : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
          }`}
          title={wordWrap ? 'Word wrap on' : 'Word wrap off'}
        >
          <WrapText className="w-3.5 h-3.5" />
        </button>

        {/* Minimap toggle */}
        <button
          onClick={toggleMinimap}
          className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
            minimap
              ? 'bg-[#828fff]/20 text-[#828fff]'
              : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
          }`}
          title={minimap ? 'Minimap on' : 'Minimap off'}
        >
          <Map className="w-3.5 h-3.5" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'vs-dark' ? 'vs' : 'vs-dark')}
          className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] rounded transition-colors"
          title={theme === 'vs-dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'vs-dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
