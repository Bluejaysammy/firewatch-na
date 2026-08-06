"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid h-dvh place-items-center bg-bg p-6">
      <div className="max-w-md text-center" role="alert">
        <p aria-hidden="true" className="text-5xl">
          ⚠️
        </p>
        <h1 className="mt-3 text-2xl font-extrabold">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-dim">
          An unexpected error occurred while rendering the app
          {error.digest ? ` (ref ${error.digest})` : ""}. Live fire data feeds
          are unaffected — try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Reload the app
        </button>
      </div>
    </div>
  );
}
