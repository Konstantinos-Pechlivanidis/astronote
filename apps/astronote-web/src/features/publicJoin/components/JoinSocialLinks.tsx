import type { ComponentType } from 'react';

type SocialLink = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
};

export function JoinSocialLinks({ links }: { links: SocialLink[] }) {
  if (!links.length) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-[rgba(255,255,255,0.06)] backdrop-blur-xl px-4 py-2 text-sm lg:text-base text-[#A9B4CC] hover:text-[#EAF0FF] shadow-sm transition-colors"
        >
          <link.icon className="h-5 w-5" />
          {link.label}
        </a>
      ))}
    </div>
  );
}
