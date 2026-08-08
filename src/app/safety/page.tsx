import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Safety & Community Guidelines" };

export default function SafetyPage() {
  return (
    <div className="h-dvh overflow-y-auto bg-bg">
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm leading-relaxed">
        <Link href="/" className="inline-block rounded-md border border-line bg-panel px-3 py-1.5 font-medium hover:bg-panel-2">
          ← Back to map
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold">Safety & Community Guidelines</h1>

        <div className="mt-4 rounded-lg border border-red-700 bg-red-600/10 p-3">
          <strong>In an emergency, call 911 (Canada/US) or 911 in Mexico.</strong>{" "}
          Posting here does <em>not</em> notify fire services, and no one
          monitors this site for emergencies.
        </div>

        <div className="mt-4 space-y-3 text-ink-dim">
          <p>
            <strong className="text-ink">How to use this site safely.</strong> Treat everything here
            as situational awareness, not instructions. Evacuation decisions
            come from your local authorities — their word always overrides
            this map. Data can lag by minutes to hours; a quiet map does not
            mean a safe area.
          </p>
          <p>
            <strong className="text-ink">Community reports are unverified.</strong> They are labelled
            with the poster&apos;s username and never presented as official.
            Reports auto-expire from the map after 7 days. Three flags from
            different users hide a report pending review.
          </p>

          <h2 className="pt-2 text-lg font-bold text-ink">Community guidelines</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-ink">Report only what you can actually see</strong> — smoke,
              flames, fire activity, road conditions. First-hand observations
              only; don&apos;t relay rumours or repost from social media.
            </li>
            <li>
              <strong className="text-ink">Never fabricate or exaggerate.</strong> False fire reports
              waste attention during real emergencies, get removed, and get
              accounts banned. Knowingly raising a false alarm can be a
              criminal offence.
            </li>
            <li>
              <strong className="text-ink">Stay safe to get the picture.</strong> No photo is worth
              approaching a fire, stopping on a highway, or entering a closed
              area.
            </li>
            <li>
              <strong className="text-ink">Respect privacy.</strong> No photos of identifiable
              people, licence plates, or private property details; no personal
              information about anyone, including yourself.
            </li>
            <li>
              <strong className="text-ink">Be constructive.</strong> No harassment, hate, spam,
              advertising, or off-topic content. This space exists to help
              neighbours stay informed.
            </li>
            <li>
              <strong className="text-ink">Flag, don&apos;t fight.</strong> If a report looks wrong or
              violates these rules, use the flag button instead of arguing in
              the comments.
            </li>
          </ul>

          <p className="pt-2">
            See also the <Link href="/terms" className="underline">Terms of Use</Link>{" "}
            and <Link href="/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
