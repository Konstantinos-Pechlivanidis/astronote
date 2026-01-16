'use client';

import { X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { RetailCard } from '@/src/components/retail/RetailCard';

interface ConfirmDialogProps {
  open: boolean
  onClose?: () => void
  onOpenChange?: (_open: boolean) => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  confirmDisabled?: boolean
  confirmLoading?: boolean
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function ConfirmDialog({
  open,
  onClose,
  onOpenChange,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  confirmDisabled = false,
  confirmLoading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const ids = useMemo(() => {
    const base = `confirm-${Math.random().toString(16).slice(2)}`;
    return { titleId: `${base}-title`, descId: `${base}-desc` };
  }, []);

  useEffect(() => {
    if (!open) return;

    previousActiveRef.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange?.(false);
        onClose?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const container = dialogRef.current;
      if (!container) return;

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    // Focus the cancel button by default for safety (avoid accidental confirm)
    const focusTimer = window.setTimeout(() => cancelButtonRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      previousActiveRef.current?.focus();
      previousActiveRef.current = null;
    };
  }, [open, onClose, onOpenChange]);

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;
  if (!open) return null;

  const handleClose = () => {
    onOpenChange?.(false);
    onClose?.();
  };

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ids.titleId}
      aria-describedby={ids.descId}
    >
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={handleClose}
      />
      <RetailCard
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-50 max-w-md w-full p-6 bg-surface outline-none"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id={ids.titleId} className="text-lg font-semibold text-text-primary">
            {title}
          </h3>
          <button
            onClick={handleClose}
            className="text-text-tertiary hover:text-text-primary"
            aria-label="Close"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p id={ids.descId} className="text-sm text-text-secondary mb-6">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <Button
            ref={cancelButtonRef}
            onClick={handleClose}
            variant="outline"
            size="sm"
            type="button"
          >
            {cancelText}
          </Button>
          <Button
            onClick={() => {
              onConfirm();
            }}
            disabled={confirmDisabled || confirmLoading}
            variant={variant === 'danger' ? 'default' : 'default'}
            size="sm"
            className={variant === 'danger' ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' : ''}
            type="button"
          >
            {confirmLoading ? 'Working…' : confirmText}
          </Button>
        </div>
      </RetailCard>
    </div>
  );

  return createPortal(content, portalTarget);
}
