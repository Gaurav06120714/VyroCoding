'use client';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:   'lg-btn-primary px-5 h-10 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none',
  secondary: 'lg-btn-secondary px-5 h-10 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none',
  ghost:     'inline-flex items-center justify-center bg-transparent text-[#8a9bb5] hover:text-white hover:bg-[rgba(0,212,255,0.06)] rounded-[11px] px-5 h-10 font-medium text-sm transition-all duration-150 cursor-pointer disabled:opacity-40',
  danger:    'lg-btn-primary px-5 h-10 disabled:opacity-40 disabled:cursor-not-allowed !bg-[rgba(239,68,68,0.5)] !border-[rgba(239,68,68,0.5)]',
};

const sizeOverrides: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: '!h-8 !px-3 !text-xs',
  md: '',
  lg: '!h-12 !px-7 !text-base',
};

export function Button({ variant = 'primary', size = 'md', loading = false, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(variantClasses[variant], sizeOverrides[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin mr-2 shrink-0" />}
      {children}
    </button>
  );
}
