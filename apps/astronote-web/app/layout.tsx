import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Astronote - SMS Marketing That Drives Revenue',
  description: 'Automate winback campaigns, recover abandoned carts, and turn messaging into a revenue engine. Premium SMS marketing for Shopify and retail businesses.',
  keywords: ['SMS marketing', 'Shopify', 'abandoned cart recovery', 'customer retention', 'SMS automation'],
};

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
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
