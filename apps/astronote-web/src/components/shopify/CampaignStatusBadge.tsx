import { cn } from '@/lib/utils';

const variants = {
  draft: 'bg-surface-light text-text-secondary',
  scheduled: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  sending: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse',
  paused: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  completed: 'bg-green-500/10 text-green-400 border border-green-500/20',
  sent: 'bg-green-500/10 text-green-400 border border-green-500/20', // legacy alias
  failed: 'bg-red-500/10 text-red-400 border border-red-500/20',
  cancelled: 'bg-surface-light text-text-secondary border border-border',
} as const;

type CampaignStatusKey = keyof typeof variants;

export function CampaignStatusBadge({
  status,
  label,
  className,
}: {
  status: string | null | undefined;
  label?: string;
  className?: string;
}) {
  if (!status) return null;
  const key = (status as CampaignStatusKey) in variants ? (status as CampaignStatusKey) : 'draft';
  const display = label || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', variants[key], className)}>
      {display}
    </span>
  );
}


