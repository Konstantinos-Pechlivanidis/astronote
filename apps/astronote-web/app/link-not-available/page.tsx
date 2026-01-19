export const dynamic = 'force-dynamic';

export default function LinkNotAvailablePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold text-white">Link not available</h1>
      <p className="mt-3 text-sm text-zinc-200">
        The link you followed is no longer valid. Please contact the sender or return to the home page.
      </p>
      <a
        href="https://astronote.onrender.com"
        className="mt-6 inline-flex rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
      >
        Go to homepage
      </a>
    </main>
  );
}
