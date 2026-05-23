import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('bg-white/8 rounded animate-pulse', className)}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="glass-card p-5 space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 px-5 border-b border-white/5">
      <Skeleton className="h-4 w-8" />
      <Skeleton className="h-4 w-48 flex-1" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-10 ml-auto" />
    </div>
  );
}
