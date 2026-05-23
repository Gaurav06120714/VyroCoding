'use client';

import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import type { ChatMessage } from '@vyro/types';
import { useAuthStore } from '@/store/auth.store';
import { formatRelativeTime } from '@/lib/utils';

interface RoomChatProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
}

export function RoomChat({ messages, onSendMessage }: RoomChatProps) {
  const [input, setInput] = useState('');
  const { user } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInput('');
  }

  return (
    <div className="flex flex-col h-full bg-surface1">
      <div className="px-4 py-2.5 border-b border-hairline shrink-0">
        <h3 className="text-[11px] font-semibold text-ink-subtle uppercase tracking-[0.88px]">Chat</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-xs text-ink-tertiary text-center py-6">
            No messages yet. Say something!
          </p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.userId === user?.id;
            return (
              <div key={msg.id} className={`flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                {!isOwn && (
                  <span className="text-[10px] text-ink-subtle px-1">{msg.username}</span>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    isOwn
                      ? 'bg-primary/20 border border-primary/30 text-ink'
                      : 'bg-surface3 text-ink-muted'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-ink-tertiary px-1">
                  {formatRelativeTime(msg.createdAt)}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-hairline shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-surface2 border border-hairline rounded-md text-sm text-ink px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50 transition-shadow placeholder:text-ink-tertiary"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-9 h-9 flex items-center justify-center bg-primary text-white rounded-md hover:bg-primary-hover transition-colors disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
