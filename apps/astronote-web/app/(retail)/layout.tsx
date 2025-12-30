'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

export default function RetailLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Set retail light theme on html element
    document.documentElement.setAttribute('data-theme', 'retail-light');
    document.documentElement.classList.add('retail-light');

    return () => {
      // Cleanup on unmount (though this layout shouldn't unmount)
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.remove('retail-light');
    };
  }, []);

  return <>{children}</>;
}

