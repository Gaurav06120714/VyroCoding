'use client';

import { CheckCircle2, XCircle, Loader2, Zap } from 'lucide-react';
import type { ExecutionFeedItem } from '@/hooks/useRoomWebSocket';

interface ExecutionFeedProps {
  items: ExecutionFeedItem[];
  currentUserId: string;
}

function statusIcon(status?: string) {
  if (!status) return <Loader2 className="w-3 h-3 animate-spin text-[#00d4ff]" />;
  if (status === 'accepted') return <CheckCircle2 className="w-3 h-3 text-[#10b981]" />;
  return <XCircle className="w-3 h-3 text-[#e5534b]" />;
}

function statusColor(status?: string) {
  if (!status) return 'text-[#00d4ff]';
  if (status === 'accepted') return 'text-[#10b981]';
  return 'text-[#e5534b]';
}

function statusLabel(status?: string) {
  if (!status) return 'running…';
  return status.replace(/_/g, ' ');
}

export function ExecutionFeed({ items, currentUserId }: ExecutionFeedProps) {
  if (items.length === 0) return null;

  const visible = items.slice(0, 3);

  return (
    <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-20 px-2 pb-2 flex flex-col gap-1 items-start">
      {visible.map((item) => {
        const isMe = item.userId === currentUserId;
        if (isMe) return null;

        return (
          <div
            key={item.id}
            className="flex items-center gap-1.5 bg-[#0d1117]/90 border border-white/[0.08] rounded-full px-2.5 py-1 text-[10px] backdrop-blur-sm shadow-lg animate-fade-in-up"
          >
            <Zap className="w-2.5 h-2.5 text-[#00d4ff]" />
            <span className="text-white/60 font-medium">{item.username}</span>
            {statusIcon(item.type === 'start' ? undefined : item.status)}
            <span className={statusColor(item.type === 'start' ? undefined : item.status)}>
              {item.type === 'start'
                ? 'running…'
                : `${statusLabel(item.status)}${
                    item.testsPassed !== undefined
                      ? ` (${item.testsPassed}/${item.testsTotal})`
                      : ''
                  }`
              }
            </span>
          </div>
        );
      })}
    </div>
  );
}
