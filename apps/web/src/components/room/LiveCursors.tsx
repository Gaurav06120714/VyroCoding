'use client';

/**
 * LiveCursors — renders remote users' cursor positions as colored badges
 * overlaid on top of the Monaco editor container.
 * We don't inject directly into Monaco's DOM; instead we show floating
 * name badges that pulse briefly when updated.
 */
import { useEffect, useRef, useState } from 'react';
import type { RemoteCursor } from '@/hooks/useRoomWebSocket';

interface LiveCursorsProps {
  cursors: Map<string, RemoteCursor>;
  /** height of the editor area in px (used for clamping) */
  editorHeight?: number;
}

interface AnimatedCursor extends RemoteCursor {
  pulse: boolean;
}

const LINE_HEIGHT_PX = 19; // Monaco default line height
const CHAR_WIDTH_PX  = 8.4; // approximate for 14px monospace

export function LiveCursors({ cursors, editorHeight = 400 }: LiveCursorsProps) {
  const [animated, setAnimated] = useState<Map<string, AnimatedCursor>>(new Map());
  const prevRef = useRef<Map<string, RemoteCursor>>(new Map());

  useEffect(() => {
    const next = new Map<string, AnimatedCursor>();

    cursors.forEach((cursor, uid) => {
      const prev = prevRef.current.get(uid);
      const moved = !prev || prev.line !== cursor.line || prev.column !== cursor.column;
      next.set(uid, { ...cursor, pulse: moved });
    });

    setAnimated(next);
    prevRef.current = new Map(cursors);

    // Clear pulse after animation
    const t = setTimeout(() => {
      setAnimated((m) => {
        const cleared = new Map<string, AnimatedCursor>();
        m.forEach((c, k) => cleared.set(k, { ...c, pulse: false }));
        return cleared;
      });
    }, 600);
    return () => clearTimeout(t);
  }, [cursors]);

  if (animated.size === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 10 }}
    >
      {Array.from(animated.values()).map((cursor) => {
        const top    = Math.min((cursor.line - 1) * LINE_HEIGHT_PX + 2, editorHeight - 24);
        const left   = Math.min((cursor.column - 1) * CHAR_WIDTH_PX + 60, 9999); // 60px gutter approx

        return (
          <div
            key={cursor.userId}
            className="absolute flex items-center gap-1 select-none"
            style={{ top, left, transition: 'top 0.15s ease, left 0.15s ease' }}
          >
            {/* Cursor caret */}
            <div
              className="w-0.5 h-4 rounded-sm"
              style={{ backgroundColor: cursor.color, opacity: cursor.pulse ? 1 : 0.7 }}
            />
            {/* Name badge */}
            <div
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-sm whitespace-nowrap shadow-sm"
              style={{
                backgroundColor: cursor.color,
                color: '#fff',
                opacity: cursor.pulse ? 1 : 0.85,
                transform: cursor.pulse ? 'scale(1.05)' : 'scale(1)',
                transition: 'opacity 0.3s ease, transform 0.3s ease',
              }}
            >
              {cursor.username}
            </div>
          </div>
        );
      })}
    </div>
  );
}
