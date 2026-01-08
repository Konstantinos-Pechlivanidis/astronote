import { CheckCircle } from 'lucide-react';

type JoinBenefitsProps = {
  title: string
  subtitle?: string
  benefits: readonly string[]
  trustLine: string
  customMessage?: string | null
};

/**
 * Benefits section: value proposition with clean cards
 */
export function JoinBenefits({
  title,
  subtitle,
  benefits,
  trustLine,
  customMessage,
}: JoinBenefitsProps) {
  return (
    <div className="w-full max-w-[640px] space-y-6">
      {/* Headline */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="text-base text-slate-600 sm:text-lg lg:text-xl">{subtitle}</p>
        )}
      </div>

      {/* Benefits list */}
      <div className="space-y-3">
        {benefits.map((benefit, idx) => {
          const Icon = CheckCircle;
          return (
            <div
              key={idx}
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--accent,#2563eb)]" />
              <span className="text-base text-slate-700">{benefit}</span>
            </div>
          );
        })}
      </div>

      {/* Custom merchant message */}
      {customMessage && (
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-4">
          <p className="text-sm text-slate-700">{customMessage}</p>
        </div>
      )}

      {/* Trust line */}
      <p className="text-sm text-slate-500">{trustLine}</p>
    </div>
  );
}
