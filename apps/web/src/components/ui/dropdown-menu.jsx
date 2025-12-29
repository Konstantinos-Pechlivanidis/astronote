import * as React from 'react';
import { cn } from '@/lib/utils';

const DropdownMenu = ({ children, open, onOpenChange }) => {
  const [isOpen, setIsOpen] = React.useState(open || false);

  React.useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  const handleClickOutside = React.useCallback((e) => {
    if (isOpen && !e.target.closest('[data-dropdown]')) {
      setIsOpen(false);
      onOpenChange?.(false);
    }
  }, [isOpen, onOpenChange]);

  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen, handleClickOutside]);

  return (
    <div className="relative" data-dropdown>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { isOpen, setIsOpen, onOpenChange }),
      )}
    </div>
  );
};

const DropdownMenuTrigger = ({ children, ...props }) => {
  return <div {...props}>{children}</div>;
};

const DropdownMenuContent = ({ className, children, isOpen, ...props }) => {
  if (!isOpen) return null;
  return (
    <div
      className={cn(
        'absolute right-0 z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const DropdownMenuItem = ({ className, children, ...props }) => (
  <div
    className={cn(
      'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
};

