import { CheckCircle2 } from 'lucide-react';

type JoinValuePropsProps = {
  title: string
  benefits: readonly string[]
  extraTextBox?: string | null
  showIcons?: boolean
};

/**
 * Value proposition: benefits list + trust signals
 */
export function JoinValueProps({
  title,
  benefits,
  extraTextBox,
  showIcons = true,
}: JoinValuePropsProps) {
  return (
    <div className="space-y-6">
      {/* Benefits list */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white sm:text-xl">{title}</h2>
        <ul className="space-y-3">
          {benefits.map((benefit, idx) => {
            const Icon = CheckCircle2;
            return (
              <li key={idx} className="flex items-start gap-3">
                {showIcons && (
                  <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--theme-accent,#0ABAB5)]" />
                )}
                <span className="text-base text-white/70 sm:text-lg">{benefit}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Extra merchant text */}
      {extraTextBox && (
        <div
          className="rounded-2xl border-l-4 bg-white/5 p-5 backdrop-blur-xl sm:p-6"
          style={{
            borderLeftColor: 'var(--theme-accent, #0ABAB5)',
            borderLeftWidth: '4px',
          }}
        >
          <p className="text-base text-white/70 sm:text-lg">{extraTextBox}</p>
        </div>
      )}
    </div>
  );
}
