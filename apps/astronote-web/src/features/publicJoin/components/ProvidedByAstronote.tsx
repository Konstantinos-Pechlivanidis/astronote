import { cn } from '@/lib/utils';

const LANDING_PAGE_URL = process.env.NEXT_PUBLIC_LANDING_PAGE_URL || 'https://astronote.app';

export function ProvidedByAstronote({ className }: { className?: string }) {
  return (
    <div className={cn('text-center text-xs lg:text-sm text-[#A9B4CC]', className)}>
      Provided by{' '}
      <a className="underline hover:text-[#EAF0FF] transition-colors" href={LANDING_PAGE_URL} target="_blank" rel="noreferrer">
        Astronote
      </a>
    </div>
  );
}
