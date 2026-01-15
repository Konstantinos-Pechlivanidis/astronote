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
  scheduleType,
  scheduleAt,
  label,
  className,
}: {
  status: string | null | undefined;
  scheduleType?: string | null;
  scheduleAt?: string | null;
  label?: string;
  className?: string;
}) {
  if (!status) return null;
  // Backward compat: some legacy scheduled flows stored scheduleAt but kept status as "draft".
  const normalizedStatus =
    status === 'draft' && scheduleAt && scheduleType === 'scheduled' ? 'scheduled' : status;

  const key =
    (normalizedStatus as CampaignStatusKey) in variants
      ? (normalizedStatus as CampaignStatusKey)
      : 'draft';
  const display =
    label ||
    normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);

  return (
    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', variants[key], className)}>
      {display}
    </span>
  );
}


