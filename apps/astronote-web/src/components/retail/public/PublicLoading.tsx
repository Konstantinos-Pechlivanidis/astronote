export function PublicLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="text-center py-8 space-y-3 text-text-primary">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-border border-t-accent mx-auto" />
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}
