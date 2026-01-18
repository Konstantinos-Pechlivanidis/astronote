'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/src/components/ui/dialog';
import { useRetailAuth } from '@/src/features/retail/auth/useRetailAuth';
import RetailLogo from '@/logo/astronote-logo-1200x1200.png';
import { RetailNavList } from './RetailNavList';

type RetailMobileNavProps = {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  pathname: string;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function RetailMobileNav({ open, onOpenChange, pathname }: RetailMobileNavProps) {
  const { logout, user } = useRetailAuth();
  const drawerRef = useRef<HTMLDivElement>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const drawer = drawerRef.current;
    if (!drawer) return;

    const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const previousActive = document.activeElement as HTMLElement | null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key !== 'Tab') return;

      if (focusable.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    if (first) {
      first.focus();
    } else {
      drawer.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActive?.focus();
    };
  }, [open, onOpenChange]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/auth/retail/login';
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Retail navigation"
        tabIndex={-1}
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[280px] md:hidden',
          'border-r border-border bg-background-elevated',
          'flex flex-col shadow-xl',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <Link
            href="/app/retail/dashboard"
            className="flex items-center gap-2"
            onClick={() => onOpenChange(false)}
          >
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-surface">
              <Image
                src={RetailLogo}
                alt="Astronote"
                className="h-8 w-8 object-contain"
                priority
              />
            </div>
            <span className="text-lg font-semibold text-text-primary">Astronote Retail</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6" aria-label="Retail navigation">
          <RetailNavList pathname={pathname} onNavigate={() => onOpenChange(false)} />
        </nav>

        <div
          className="border-t border-border px-4 pb-6 pt-4"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
          {user && (
            <div className="px-2 pb-3 text-xs text-text-tertiary">
              <div className="truncate">{user.email}</div>
              {(user.company || user.senderName) && (
                <div className="truncate text-text-tertiary/80">
                  {user.company || user.senderName}
                </div>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-text-secondary hover:text-text-primary"
            onClick={() => setLogoutConfirmOpen(true)}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
      <Dialog
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        title="Sign out"
        size="sm"
      >
        <p className="text-sm text-text-secondary">Are you sure you want to sign out?</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setLogoutConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={async () => {
              await handleLogout();
            }}
          >
            Sign out
          </Button>
        </div>
      </Dialog>
    </>
  );
}
