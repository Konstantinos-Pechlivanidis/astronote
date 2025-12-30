import { GlassCard } from '@/components/ui/glass-card';

export function AutomationsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <GlassCard key={i} className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-surface-light rounded w-32" />
            <div className="h-8 bg-surface-light rounded w-20" />
          </div>
          <div className="h-4 bg-surface-light rounded w-3/4 mb-4" />
          <div className="h-20 bg-surface-light rounded mb-4" />
          <div className="flex gap-2">
            <div className="h-10 bg-surface-light rounded w-24" />
            <div className="h-10 bg-surface-light rounded w-24" />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

