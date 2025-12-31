'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RetailCard } from '@/src/components/retail/RetailCard';

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <RetailCard className="relative max-w-md w-full p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-primary"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-text-secondary mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            <Button onClick={onClose} variant="outline" size="sm">
              {cancelText}
            </Button>
            <Button
              onClick={() => {
                if (process.env.NODE_ENV !== 'production') {
                  console.log('[ConfirmDialog] Confirm button clicked');
                }
                onConfirm();
              }}
              variant={variant === 'danger' ? 'default' : 'default'}
              size="sm"
              className={variant === 'danger' ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' : ''}
            >
              {confirmText}
            </Button>
          </div>
        </RetailCard>
      </div>
    </div>
  );
}

