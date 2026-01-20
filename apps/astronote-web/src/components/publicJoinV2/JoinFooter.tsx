import { THEME } from './theme';

type JoinFooterProps = {
  landingUrl?: string
};

/**
 * Simple footer
 */
export function JoinFooter({ landingUrl = 'https://astronote.app' }: JoinFooterProps) {
  const href = (landingUrl || 'https://astronote.onrender.com').replace(/\/+$/, '');
  return (
    <div className="text-center text-sm">
      <a
        href={href || 'https://astronote.onrender.com'}
        target="_blank"
        rel="noreferrer"
        className="transition-colors"
        style={{ color: THEME.text.tertiary }}
        onMouseEnter={(e) => (e.currentTarget.style.color = THEME.text.secondary)}
        onMouseLeave={(e) => (e.currentTarget.style.color = THEME.text.tertiary)}
      >
        Powered by <span className="font-medium">Astronote</span>
      </a>
    </div>
  );
}
