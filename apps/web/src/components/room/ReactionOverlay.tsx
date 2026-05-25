'use client';

/**
 * ReactionOverlay — floating emoji reactions that pop and fade.
 * Also includes the reaction picker trigger button.
 */
import { useState } from 'react';
import { Smile } from 'lucide-react';
import type { RoomReaction } from '@/hooks/useRoomWebSocket';

const EMOJI_OPTIONS = ['🎉', '🔥', '💡', '😤', '😭', '🚀', '👀', '💀'];

interface ReactionOverlayProps {
  reactions: RoomReaction[];
  onSendReaction: (emoji: string) => void;
}

export function ReactionOverlay({ reactions, onSendReaction }: ReactionOverlayProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      {/* Floating reactions */}
      <div className="fixed bottom-20 right-6 pointer-events-none z-50 flex flex-col-reverse gap-2">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-1.5 bg-[#161b22]/90 border border-white/[0.08] rounded-full px-2.5 py-1 shadow-lg backdrop-blur-sm animate-reaction-pop"
          >
            <span className="text-base">{r.emoji}</span>
            <span className="text-[10px] text-white/50">{r.username}</span>
          </div>
        ))}
      </div>

      {/* Picker button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker((v) => !v)}
          title="Send reaction"
          className="flex items-center gap-1 text-white/40 hover:text-white/70 transition-colors px-1.5 py-1 rounded-md hover:bg-white/5"
        >
          <Smile className="w-4 h-4" />
        </button>

        {showPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
            <div className="absolute bottom-full right-0 mb-1 bg-[#161b22] border border-white/[0.08] rounded-xl p-2 flex gap-1 z-50 shadow-xl">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSendReaction(emoji);
                    setShowPicker(false);
                  }}
                  className="text-lg w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
