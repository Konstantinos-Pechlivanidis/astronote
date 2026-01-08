import { CheckCircle, Zap, Bell, LogOut } from 'lucide-react';
import { THEME } from './theme';

type Benefit = {
  icon?: 'check' | 'zap' | 'bell' | 'logout'
  title: string
  description: string
};

type JoinBenefitsProps = {
  benefits: Benefit[]
};

const iconMap = {
  check: CheckCircle,
  zap: Zap,
  bell: Bell,
  logout: LogOut,
};

// Default icon rotation for benefits without explicit icon
const defaultIcons: Array<'check' | 'zap' | 'bell' | 'logout'> = ['check', 'zap', 'bell', 'logout'];

/**
 * Benefits grid with real content (no empty blocks)
 * Supports both icon-based benefits (from static copy) and parsed benefits (from merchant overrides)
 */
export function JoinBenefits({ benefits }: JoinBenefitsProps) {
  return (
    <div className="grid gap-4 sm:gap-5">
      {benefits.map((benefit, idx) => {
        const iconKey = benefit.icon || defaultIcons[idx % defaultIcons.length];
        const Icon = iconMap[iconKey];
        return (
          <div
            key={idx}
            className="flex items-start gap-4 rounded-xl p-4 backdrop-blur-xl sm:p-5"
            style={{
              backgroundColor: THEME.bg.card,
              border: `1px solid ${THEME.border.default}`,
            }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: THEME.accent.light }}
            >
              <Icon className="h-5 w-5" style={{ color: THEME.accent.default }} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="text-base font-semibold sm:text-lg" style={{ color: THEME.text.primary }}>
                {benefit.title}
              </h3>
              {benefit.description && (
                <p className="text-sm sm:text-base" style={{ color: THEME.text.secondary }}>
                  {benefit.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

