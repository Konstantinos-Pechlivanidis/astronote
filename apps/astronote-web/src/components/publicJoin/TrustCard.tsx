import { Bell } from 'lucide-react';

type TrustCardProps = {
  title: string
  body: string
};

/**
 * Trust/consent card below form
 */
export function TrustCard({ title, body }: TrustCardProps) {
  return (
    <div className="w-full max-w-[580px] rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl lg:justify-self-end">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--theme-accent,#0ABAB5)]" />
        <div>
          <p className="text-base font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm text-white/60">{body}</p>
        </div>
      </div>
    </div>
  );
}

