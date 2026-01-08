import type { ComponentType } from 'react';

type SocialLink = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
};

type SocialLinksProps = {
  links: SocialLink[]
};

/**
 * Social media links row
 */
export function SocialLinks({ links }: SocialLinksProps) {
  if (!links || links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 backdrop-blur-xl transition-colors hover:text-white"
        >
          <link.icon className="h-4 w-4" />
          {link.label}
        </a>
      ))}
    </div>
  );
}

