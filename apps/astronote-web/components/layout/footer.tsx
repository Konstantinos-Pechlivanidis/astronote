import Link from 'next/link';
import Image from 'next/image';

const footerLinks = {
  product: [
    { href: '/features', label: 'Features' },
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/roi', label: 'ROI Calculator' },
  ],
  company: [
    { href: '/security', label: 'Security' },
    { href: 'https://konstantinos-pechlivanidis.onrender.com', label: 'Personal website' },
    { href: 'https://www.linkedin.com/in/konstantinos-pechlivanidis-65a339293/', label: 'LinkedIn' },
  ],
  legal: [
    { href: '/terms', label: 'Terms & Conditions' },
    { href: '/privacy', label: 'Privacy Policy' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/30 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-white/90 overflow-hidden border border-white/20 shadow-sm">
                <Image
                  src="/logo/astronote-logo-1200x1200.png"
                  alt="Astronote logo"
                  width={36}
                  height={36}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xl font-semibold text-text-primary font-display">Astronote</span>
                <span className="text-xs uppercase tracking-[0.24em] text-text-tertiary">
                  Retail SMS Studio
                </span>
              </div>
            </div>
            <p className="text-text-secondary text-sm max-w-md">
              Turn messaging into a revenue engine. Automate winback campaigns, recover abandoned carts, and drive repeat purchases with premium SMS marketing.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-text-primary font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-text-secondary hover:text-text-primary text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-text-primary font-semibold mb-4">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-text-secondary hover:text-text-primary text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <h3 className="text-text-primary font-semibold mb-4 mt-6">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-text-secondary hover:text-text-primary text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/10">
          <p className="text-text-tertiary text-sm text-center">
            © {new Date().getFullYear()} Astronote. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
