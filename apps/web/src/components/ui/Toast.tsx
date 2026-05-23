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
                ? 'rgba(39,166,68,0.15)'
                : toast.type === 'error'
                ? 'rgba(207,45,86,0.15)'
                : 'rgba(94,106,210,0.15)',
            borderColor:
              toast.type === 'success'
                ? 'rgba(39,166,68,0.3)'
                : toast.type === 'error'
                ? 'rgba(207,45,86,0.3)'
                : 'rgba(94,106,210,0.3)',
            color:
              toast.type === 'success'
                ? '#27a644'
                : toast.type === 'error'
                ? '#cf2d56'
                : '#828fff',
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
