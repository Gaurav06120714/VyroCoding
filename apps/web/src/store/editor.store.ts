import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface EditorSettings {
  fontSize: number;
  theme: 'vs-dark' | 'vs';
  minimap: boolean;
  wordWrap: boolean;
  tabSize: number;
  setFontSize: (n: number) => void;
  setTheme: (t: 'vs-dark' | 'vs') => void;
  toggleMinimap: () => void;
  toggleWordWrap: () => void;
  setTabSize: (n: number) => void;
}

export const useEditorStore = create<EditorSettings>()(
  persist(
    (set) => ({
      fontSize: 14,
      theme: 'vs-dark',
      minimap: false,
      wordWrap: true,
      tabSize: 2,
      setFontSize: (n) => set({ fontSize: Math.min(22, Math.max(10, n)) }),
      setTheme: (t) => set({ theme: t }),
      toggleMinimap: () => set((s) => ({ minimap: !s.minimap })),
      toggleWordWrap: () => set((s) => ({ wordWrap: !s.wordWrap })),
      setTabSize: (n) => set({ tabSize: n }),
    }),
    {
      name: 'vyro-editor-settings',
    }
  )
);
