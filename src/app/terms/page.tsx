import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <div className="h-dvh overflow-y-auto bg-bg">
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm leading-relaxed">
        <Link href="/" className="inline-block rounded-md border border-line bg-panel px-3 py-1.5 font-medium hover:bg-panel-2">
          ← Back to map
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold">Terms of Use</h1>
        <div className="mt-3 space-y-3 text-ink-dim">
          <p>
            <strong className="text-ink">No warranty; not an emergency service.</strong> FireWatch NA
            aggregates third-party data that can be delayed, incomplete, or
            wrong, and presents derived interpretations (containment-based
            statuses, road proximity, satellite detection clusters). Nothing
            here is safety advice. Never rely on this site as your sole source
            for evacuation, travel, or emergency decisions — follow official
            authorities. The operators are not liable for decisions made based
            on information shown here. The service is provided &quot;as is&quot;.
          </p>
          <p>
            <strong className="text-ink">Community content.</strong> Reports and comments are posted
            by users and are <em>unverified</em>; they are labelled as such.
            By posting you grant the site a non-exclusive licence to display
            and moderate your content, you confirm you have the right to share
            any photo you upload, and you accept the{" "}
            <Link href="/safety" className="underline">community guidelines</Link>.
            Deliberately false emergency reports are prohibited — knowingly
            spreading false alarm during an emergency can be a criminal
            offence — and lead to removal and account bans. Moderators may
            remove any content and suspend any account at their discretion.
          </p>
          <p>
            <strong className="text-ink">Acceptable use.</strong> No scraping beyond reasonable API
            use (respect the rate limits and the published{" "}
            <code>openapi.yaml</code>), no attempts to bypass security
            measures, no unlawful content, no impersonating officials or
            agencies.
          </p>
          <p>
            <strong className="text-ink">Data licences.</strong> Underlying data remains subject to
            its providers&apos; licences (see NOTICE.md and the{" "}
            <Link href="/about" className="underline">About page</Link>).
          </p>
        </div>
      </div>
    </div>
  );
}
