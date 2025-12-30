import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  icon?: LucideIcon
}

export function EmptyState({ title, description, action, icon: Icon }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4">
      {Icon && (
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-surface-light flex items-center justify-center">
            <Icon className="w-8 h-8 text-text-tertiary" />
          </div>
        </div>
      )}
      <h3 className="text-lg font-medium text-text-primary mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary mb-6 max-w-md mx-auto">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

