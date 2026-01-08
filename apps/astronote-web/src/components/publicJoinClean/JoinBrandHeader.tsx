type JoinBrandHeaderProps = {
  logoUrl?: string | null
  storeName: string
  storeDisplayName?: string
  showAstronoteCredit?: boolean
  landingUrl?: string
};

/**
 * Brand header: merchant logo + Astronote credit
 */
export function JoinBrandHeader({
  logoUrl,
  storeName,
  storeDisplayName,
  showAstronoteCredit = true,
  landingUrl = 'https://astronote.app',
}: JoinBrandHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      {/* Merchant branding */}
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={storeDisplayName || storeName}
            className="h-10 w-auto object-contain sm:h-12"
          />
        ) : (
          <div className="text-lg font-semibold text-slate-900 sm:text-xl">
            {storeDisplayName || storeName}
          </div>
        )}
      </div>

      {/* Astronote credit */}
      {showAstronoteCredit && (
        <a
          href={landingUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-slate-500 transition-colors hover:text-slate-700"
        >
          Provided by <span className="font-medium">Astronote</span>
        </a>
      )}
    </div>
  );
}

