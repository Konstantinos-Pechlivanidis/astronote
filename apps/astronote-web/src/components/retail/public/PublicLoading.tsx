export function PublicLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}

