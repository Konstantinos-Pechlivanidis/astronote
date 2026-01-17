import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Astronote - SMS Marketing That Drives Revenue',
  description: 'Automate winback campaigns, recover abandoned carts, and turn messaging into a revenue engine. Premium SMS marketing for Shopify and retail businesses.',
  keywords: ['SMS marketing', 'Shopify', 'abandoned cart recovery', 'customer retention', 'SMS automation'],
};

// This app relies heavily on client-side auth/context and runtime data.
// Force dynamic rendering to avoid build-time prerender crashes.
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
