'use client';

import React, { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BaseFormFieldProps {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  className?: string;
  id?: string;
}

interface InputFieldProps
  extends BaseFormFieldProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'time' | 'tel';
  as?: 'input';
}

interface TextareaFieldProps
  extends BaseFormFieldProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  as: 'textarea';
}

interface SelectFieldProps extends BaseFormFieldProps {
  as: 'select';
  children: ReactNode;
  value?: string;
  onValueChange?: (_value: string) => void;
  placeholder?: string;
}

type RetailFormFieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps;

export function RetailFormField({
  label,
  required = false,
  helper,
  error,
  className,
  ...props
}: RetailFormFieldProps) {
  const id = props.id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const as = 'as' in props ? props.as : 'input';

  return (
    <div className={cn('space-y-2', className)}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-text-secondary"
      >
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>

      {as === 'input' && (() => {
        const inputProps = props as InputFieldProps;
        const { onInput: customOnInput, onChange: rhfOnChange, ...restInputProps } = inputProps;
        return (
          <Input
            {...restInputProps}
            id={id}
            onChange={(e) => {
              // Always call RHF onChange first (from register())
              if (rhfOnChange) {
                rhfOnChange(e);
              }
            }}
            onInput={(e) => {
              // Handle autofill: manually trigger RHF onChange for autofill events
              // Autofill doesn't trigger onChange, so we need to manually sync
              if (rhfOnChange) {
                const target = e.target as HTMLInputElement;
                rhfOnChange({ target, type: 'change' } as any);
              }
              // Also call any custom onInput handler if provided
              if (customOnInput) {
                customOnInput(e);
              }
            }}
            className={cn(
              inputProps.className,
              error && 'border-red-300 focus:border-red-400',
            )}
          />
        );
      })()}

      {as === 'textarea' && (
        <Textarea
          id={id}
          {...(props as TextareaFieldProps)}
          className={cn(error && 'border-red-300 focus:border-red-400')}
        />
      )}

      {as === 'select' && (
        <Select
          value={(props as SelectFieldProps).value || ''}
          onValueChange={(props as SelectFieldProps).onValueChange}
        >
          <SelectTrigger id={id} className={cn(error && 'border-red-300 focus:border-red-400')}>
            <SelectValue placeholder={(props as SelectFieldProps).placeholder || 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {props.children}
          </SelectContent>
        </Select>
      )}

      {helper && !error && (
        <p className="text-xs text-text-tertiary">{helper}</p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

