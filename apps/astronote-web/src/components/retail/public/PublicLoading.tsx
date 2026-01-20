export function PublicLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="text-center py-8 text-white space-y-3">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/20 border-t-[#0ed7c4] mx-auto" />
      <p className="text-sm text-white/80">{message}</p>
    </div>
  );
}
