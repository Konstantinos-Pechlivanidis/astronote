type JoinFooterProps = {
  landingUrl?: string
};

/**
 * Simple footer
 */
export function JoinFooter({ landingUrl = 'https://astronote.app' }: JoinFooterProps) {
  return (
    <div className="text-center text-sm text-slate-500">
      <a
        href={landingUrl}
        target="_blank"
        rel="noreferrer"
        className="transition-colors hover:text-slate-700"
      >
        Powered by <span className="font-medium">Astronote</span>
      </a>
    </div>
  );
}

