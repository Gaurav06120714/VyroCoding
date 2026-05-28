'use client';

import { X } from 'lucide-react';
import { useToastStore } from '@/store/toast.store';

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 min-w-[260px] max-w-[360px] px-4 py-3 rounded-xl border text-sm font-medium shadow-lg animate-fadeIn"
          style={{
            background:
              toast.type === 'success'
                ? 'rgba(16,185,129,0.15)'
                : toast.type === 'error'
                ? 'rgba(239,68,68,0.15)'
                : 'rgba(0,212,255,0.15)',
            borderColor:
              toast.type === 'success'
                ? 'rgba(16,185,129,0.3)'
                : toast.type === 'error'
                ? 'rgba(239,68,68,0.3)'
                : 'rgba(0,212,255,0.3)',
            color:
              toast.type === 'success'
                ? '#10b981'
                : toast.type === 'error'
                ? '#ef4444'
                : '#00d4ff',
          }}
        >
          {toast.icon && <span className="text-base leading-none shrink-0">{toast.icon}</span>}
          <span className="flex-1 text-ink leading-snug">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
