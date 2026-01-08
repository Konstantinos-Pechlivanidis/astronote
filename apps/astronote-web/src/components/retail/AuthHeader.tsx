'use client';

interface AuthHeaderProps {
  title: string;
  subtitle: string;
}

export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <div className="flex flex-col items-center space-y-4 text-center">
      <div className="flex items-center justify-center">
        <img
          src="/logo/astronote-logo-1200x1200.png"
          alt="Astronote"
          className="h-16 w-16 object-contain sm:h-20 sm:w-20"
        />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-text-primary sm:text-4xl">
          {title}
        </h1>
        <p className="text-sm text-text-secondary sm:text-base">{subtitle}</p>
      </div>
    </div>
  );
}

