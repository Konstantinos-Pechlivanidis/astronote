import { cn } from '@/lib/utils';

const statusVariants = {
  draft: 'bg-surface-light text-text-secondary',
  scheduled: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  sending: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse',
  completed: 'bg-green-500/10 text-green-400 border border-green-500/20',
  failed: 'bg-red-500/10 text-red-400 border border-red-500/20',
  paused: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  active: 'bg-green-500/10 text-green-400 border border-green-500/20',
  inactive: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

interface StatusBadgeProps {
  status: string | null | undefined
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  if (!status) return null;

  const variant = statusVariants[status as keyof typeof statusVariants] || statusVariants.draft;
  const displayStatus = label || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', variant, className)}>
      {displayStatus}
    </span>
  );
}

