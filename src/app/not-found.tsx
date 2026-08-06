import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid h-dvh place-items-center bg-bg p-6">
      <div className="max-w-md text-center">
        <p aria-hidden="true" className="text-5xl">
          🔥
        </p>
        <h1 className="mt-3 text-2xl font-extrabold">Page not found</h1>
        <p className="mt-2 text-sm text-ink-dim">
          The page you&apos;re looking for doesn&apos;t exist. The live wildfire
          map is waiting for you instead.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Back to the map
        </Link>
      </div>
    </div>
  );
}
