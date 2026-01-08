type JoinFooterProps = {
  landingUrl?: string
};

/**
 * Footer with "Provided by Astronote" attribution
 */
export function JoinFooter({ landingUrl = 'https://astronote.app' }: JoinFooterProps) {
  return (
    <div className="text-center text-xs text-white/40 sm:text-sm">
      Provided by{' '}
      <a
        href={landingUrl}
        target="_blank"
        rel="noreferrer"
        className="underline transition-colors hover:text-white/60"
      >
        Astronote
      </a>
    </div>
  );
}

