export default function LinkNotAvailablePage({ searchParams }: { searchParams: { type?: string; token?: string } }) {
  const type = searchParams?.type || 'link';
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Link not available</h1>
        <p className="text-sm text-gray-300">
          The {type === 's' ? 'unsubscribe' : 'offer'} link you followed is not available. It may have expired or was entered incorrectly.
        </p>
        <a
          href="https://astronote.onrender.com"
          className="inline-flex items-center justify-center rounded-lg bg-white text-black px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          Go to astronote.onrender.com
        </a>
      </div>
    </main>
  );
}
