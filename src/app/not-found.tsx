import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-display font-semibold text-text-muted">404</p>
      <h1 className="text-h1 font-semibold text-text">We could not find that page</h1>
      <p className="max-w-sm text-small text-text-muted">
        The link may be old, or the record may have been deleted. Nothing has gone wrong with your data.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-touch items-center justify-center rounded-pill bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast"
      >
        Back to Home
      </Link>
    </div>
  );
}
