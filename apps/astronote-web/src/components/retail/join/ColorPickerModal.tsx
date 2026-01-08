'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/src/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ColorPickerModalProps = {
  open: boolean;
  onClose: () => void;
  label: string;
  value: string;
  presets: string[];
  onChange: (_value: string) => void;
};

export function ColorPickerModal({ open, onClose, label, value, presets, onChange }: ColorPickerModalProps) {
  const [draft, setDraft] = useState(value || '#111827');

  useEffect(() => {
    if (open) {
      setDraft(value || '#111827');
    }
  }, [open, value]);

  const apply = () => {
    onChange(draft);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Choose ${label}`} size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-10 w-10 rounded border border-border bg-surface"
            aria-label={`${label} color`}
          />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="#111827"
          />
        </div>
        <div className="grid grid-cols-6 gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDraft(preset)}
              className="h-8 w-8 rounded border border-border"
              style={{ backgroundColor: preset }}
              aria-label={`Preset ${preset}`}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={apply}>Apply</Button>
        </div>
      </div>
    </Dialog>
  );
}
