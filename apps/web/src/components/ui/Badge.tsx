import { cn } from '@/lib/utils';

type BadgeVariant =
  | 'easy'
  | 'medium'
  | 'hard'
  | 'default'
  | 'ai-thinking'
  | 'ai-done'
  | 'purple'
  | 'blue';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  easy:
    'bg-easy/15 text-easy rounded-pill px-3 py-0.5 text-xs font-medium',
  medium:
    'bg-medium/15 text-medium rounded-pill px-3 py-0.5 text-xs font-medium',
  hard:
    'bg-hard/15 text-hard rounded-pill px-3 py-0.5 text-xs font-medium',
  default:
    'bg-surface2 text-ink-muted rounded-pill px-3 py-0.5 text-xs font-medium',
  'ai-thinking':
    'bg-ai-thinking text-canvas rounded-pill px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.88px]',
  'ai-done':
    'bg-ai-done text-white rounded-pill px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.88px]',
  // legacy
  purple:
    'bg-primary/15 text-primary-hover rounded-pill px-3 py-0.5 text-xs font-medium',
  blue:
    'bg-ai-reading/15 text-ai-reading rounded-pill px-3 py-0.5 text-xs font-medium',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span className={cn(variantClasses[variant], className)}>
      {children}
    </span>
  );
}
