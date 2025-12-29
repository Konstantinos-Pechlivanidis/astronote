import { clsx } from 'clsx';

const statusVariants = {
  draft: 'bg-gray-100 text-gray-800',
  scheduled: 'bg-blue-100 text-blue-800',
  sending: 'bg-yellow-100 text-yellow-800 animate-pulse',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  paused: 'bg-orange-100 text-orange-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-red-100 text-red-800',
};

export default function StatusBadge({ status, label, className }) {
  if (!status) return null;

  const variant = statusVariants[status] || statusVariants.draft;
  const displayStatus = label || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', variant, className)}>
      {displayStatus}
    </span>
  );
}

