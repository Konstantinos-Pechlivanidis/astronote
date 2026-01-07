'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';
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
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[ConfirmDialog] open changed', { open });
    }

    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange?.(false);
        onClose?.();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
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
    >
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={handleClose}
      />
      <RetailCard
        className="relative z-50 max-w-md w-full p-6 bg-surface"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          <button
            onClick={handleClose}
            className="text-text-tertiary hover:text-text-primary"
            aria-label="Close"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <Button onClick={handleClose} variant="outline" size="sm" type="button">
            {cancelText}
          </Button>
          <Button
            onClick={() => {
              if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('[ConfirmDialog] Confirm button clicked');
              }
              onConfirm();
            }}
            disabled={confirmDisabled || confirmLoading}
            variant={variant === 'danger' ? 'default' : 'default'}
            size="sm"
            className={variant === 'danger' ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' : ''}
            type="button"
          >
            {confirmLoading ? 'Sending...' : confirmText}
          </Button>
        </div>
      </RetailCard>
    </div>
  );

  return createPortal(content, portalTarget);
}
