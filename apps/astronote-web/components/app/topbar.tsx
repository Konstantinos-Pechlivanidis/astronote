'use client';

import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TopBarProps {
  serviceType: 'retail' | 'shopify'
}

export function TopBar({ serviceType }: TopBarProps) {
  return (
    <header className="h-16 glass border-b border-border flex items-center justify-between px-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">
          {serviceType === 'shopify' ? 'Shopify Dashboard' : 'Retail Dashboard'}
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon">
          <User className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}

