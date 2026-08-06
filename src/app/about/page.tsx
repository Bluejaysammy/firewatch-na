import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About & Data Sources — FireWatch NA",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-dim">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="h-dvh overflow-y-auto bg-bg">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/"
          className="inline-block rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-medium hover:bg-panel-2"
        >
          ← Back to map
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold">About FireWatch NA</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          FireWatch NA displays active wildfire information for Canada, the
          United States and Mexico from official government data services,
          refreshed automatically.
        </p>

        <div className="mt-4 rounded-lg border border-amber-600 bg-amber-500/10 p-3 text-sm">
          <strong>Safety notice:</strong> this application is an informational
          aggregator and is <em>not</em> an emergency alerting service. Data can
          be delayed, incomplete, or wrong. During an emergency, always follow
          directions from local authorities and consult official provincial,
          state and municipal emergency services directly.
        </div>

        <Section title="Data sources & licences">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>United States — NIFC WFIGS</strong> (Wildland Fire
              Interagency Geospatial Services): current incident locations and
              interagency fire perimeters, via the National Interagency Fire
              Center&apos;s public ArcGIS services. US federal data, public
              domain.
            </li>
            <li>
              <strong>Canada — CWFIS</strong> (Canadian Wildland Fire
              Information System, Natural Resources Canada): national active
              fires, M3 satellite-estimated perimeters, and North-American
              thermal hotspots. © His Majesty the King in Right of Canada, used
              under the{" "}
              <a
                className="text-[var(--focus)] underline"
                href="https://open.canada.ca/en/open-government-licence-canada"
              >
                Open Government Licence – Canada
              </a>
              . Provincial detail links go to BC Wildfire Service, Alberta
              Wildfire, Saskatchewan Public Safety Agency, Ontario MNR, SOPFEU
              and other responsible agencies.
            </li>
            <li>
              <strong>Mexico</strong>: no public machine-readable incident feed
              exists; satellite thermal detections (VIIRS/MODIS via CWFIS, or
              NASA FIRMS when configured) are shown instead and labelled as
              detections. Official reports:{" "}
              <a
                className="text-[var(--focus)] underline"
                href="https://www.gob.mx/conafor/documentos/reporte-semanal-de-incendios"
              >
                CONAFOR weekly reports
              </a>
              .
            </li>
            <li>
              <strong>US National Weather Service</strong>: evacuation alerts,
              fire warnings, red flag warnings and air-quality alerts from
              api.weather.gov (public domain).
            </li>
            <li>
              <strong>NOAA</strong>: near-surface smoke forecast (NDGD).
            </li>
            <li>
              <strong>Open-Meteo</strong> (CC-BY 4.0): air quality (CAMS model)
              and spot weather at fire locations.
            </li>
            <li>
              <strong>RainViewer</strong>: precipitation radar tiles.
            </li>
            <li>
              <strong>OpenStreetMap</strong> (© OpenStreetMap contributors,
              ODbL): road base map, geocoding via Nominatim, fire-station
              locations and highway geometry via Overpass.
            </li>
            <li>
              <strong>Provincial 511 services</strong>: official road closures
              and traffic events from DriveBC (Open511), Alberta 511 and
              Ontario 511, filtered to fire-related or fire-adjacent events.
              Additional state/provincial feeds can be added via the source
              registry.
            </li>
            <li>
              <strong>Esri</strong>: satellite imagery and hybrid labels
              (Imagery © Esri, Maxar, Earthstar Geographics).
            </li>
            <li>
              <strong>OpenTopoMap</strong> (CC-BY-SA): terrain base map.
            </li>
            <li>
              <strong>NASA FIRMS</strong> (optional, when configured): active
              fire detections. We acknowledge the use of data from NASA&apos;s
              Fire Information for Resource Management System.
            </li>
          </ul>
        </Section>

        <Section title="How statuses are determined">
          <p>
            Canadian agencies report a stage of control directly (out of
            control, being held, under control, extinguished). The US WFIGS
            feed reports percent containment instead, so a status is derived:
            100% = contained, 70–99% = under control, 30–69% = active, below
            30% = out of control (uncontained). Prescribed burns are shown in
            blue. Mexican records are satellite detections and shown as
            informational.
          </p>
          <p>
            A purple ring marks fires located inside an active NWS evacuation
            alert area (US only — Canadian evacuation orders are issued by
            provinces and municipalities and are not available as a unified
            feed).
          </p>
        </Section>

        <Section title="How “fire-affected highways” are determined">
          <p>
            The highways layer is <strong>derived data</strong>: major roads
            (motorway/trunk/primary) from OpenStreetMap are checked against
            active fire perimeters and proximity to large active fires. A road
            drawn solid red crosses a mapped or satellite-estimated perimeter;
            dashed amber means it runs near a large active fire. This is an
            early-awareness aid, <em>not</em> a road-closure authority — always
            confirm with the official 511 markers and provincial/state traffic
            services before travelling.
          </p>
        </Section>

        <Section title="Terms of use">
          <p>
            FireWatch NA is provided “as is”, without warranty of any kind.
            Fire, smoke, air-quality and road information is aggregated from
            third-party sources that can be delayed, incomplete or incorrect,
            and may be presented with derived interpretations (such as
            containment-based status or road proximity). Nothing on this site
            constitutes safety advice; do not use it as your sole source for
            evacuation, travel or emergency decisions. By using the site you
            accept that the operators are not liable for decisions made based
            on the information shown. Data remains subject to the licences of
            the respective providers listed above.
          </p>
        </Section>

        <Section title="Privacy">
          <p>
            FireWatch NA collects no personal information, sets no cookies, and
            uses no analytics or advertising trackers. Your approximate
            location is used only when you press the &quot;Locate me&quot;
            button, stays in your browser, and is never transmitted to our
            server. Display preferences (theme, layers, refresh interval) are
            stored locally in your browser. Search queries are forwarded to the
            OpenStreetMap Nominatim service to resolve place names. This
            approach is designed to satisfy GDPR, CCPA and PIPEDA without
            requiring consent banners, because no personal data is processed or
            sold.
          </p>
        </Section>

        <Section title="Accessibility">
          <p>
            The interface targets WCAG 2.2 AA: full keyboard operability, a
            screen-reader-friendly fire list as an alternative to the map,
            visible focus indicators, status announcements via live regions,
            reduced-motion support, and light, dark and high-contrast themes.
            Status is never conveyed by colour alone — text labels accompany
            every badge and legend entry.
          </p>
        </Section>

        <Section title="Contact & source code">
          <p>
            Configuration, deployment instructions and the full source are in
            the project README. Additional agency data feeds can be added
            through the source-adapter registry.
          </p>
        </Section>
      </div>
    </div>
  );
}
