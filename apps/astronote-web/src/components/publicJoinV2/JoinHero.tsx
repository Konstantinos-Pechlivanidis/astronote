import { THEME } from './theme';

type JoinHeroProps = {
  headline: string
  subheadline: string
  trustLine: string
};

/**
 * Hero section: headline + subheadline + trust line
 */
export function JoinHero({ headline, subheadline, trustLine }: JoinHeroProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1
          className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl"
          style={{ color: THEME.text.primary }}
        >
          {headline}
        </h1>
        <p
          className="text-base sm:text-lg lg:text-xl"
          style={{ color: THEME.text.secondary }}
        >
          {subheadline}
        </p>
      </div>

      <p
        className="text-sm"
        style={{ color: THEME.text.tertiary }}
      >
        {trustLine}
      </p>
    </div>
  );
}

