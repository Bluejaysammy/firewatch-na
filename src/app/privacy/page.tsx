import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="h-dvh overflow-y-auto bg-bg">
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm leading-relaxed">
        <Link href="/" className="inline-block rounded-md border border-line bg-panel px-3 py-1.5 font-medium hover:bg-panel-2">
          ← Back to map
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold">Privacy Policy</h1>
        <div className="mt-3 space-y-3 text-ink-dim">
          <p>
            <strong className="text-ink">Browsing needs no account and collects no personal data.</strong>{" "}
            We set no cookies for visitors, run no analytics or advertising
            trackers, and never sell data. Display preferences (theme, layers)
            stay in your browser&apos;s local storage. Your device location is
            used only when you press a location button, is processed in your
            browser, and is never stored by us.
          </p>
          <p>
            <strong className="text-ink">If you create an account</strong> (optional, only needed to
            post reports): we store a username, a cryptographically hashed
            password, and the content you post (reports, comments, photos,
            and the location you attach to a report). We deliberately do
            not collect an email address or any other identifier — which also
            means we cannot reset a forgotten password. A single strictly
            necessary session cookie keeps you signed in; it is not used for
            tracking. Photos are re-processed on upload, which removes hidden
            metadata such as GPS coordinates before anything is stored or
            shown.
          </p>
          <p>
            <strong className="text-ink">Content you post is public.</strong> Your username, report
            text, photos, and report locations are visible to everyone. Don&apos;t
            include personal information in reports. You can delete your own
            reports at any time, which also deletes attached photos.
          </p>
          <p>
            <strong className="text-ink">Operational data:</strong> IP addresses are processed
            transiently in memory for rate limiting (abuse prevention,
            legitimate interest) and are not written to a database or logs by
            the application. Search queries are forwarded to OpenStreetMap&apos;s
            Nominatim service to resolve place names, subject to their privacy
            terms.
          </p>
          <p>
            <strong className="text-ink">Your rights</strong> (GDPR / PIPEDA / CCPA): access,
            correction, and deletion. Because accounts hold no email, exercise
            these by signing in and deleting your content, or contact the
            operator via the repository listed on the{" "}
            <Link href="/about" className="underline">About page</Link> for
            account deletion. Data is retained only while your account exists;
            reports stop being displayed after 7 days regardless.
          </p>
          <p>
            This policy changes only via updates to this page; the version in
            the public source repository is authoritative.
          </p>
        </div>
      </div>
    </div>
  );
}
