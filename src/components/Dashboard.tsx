"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Fire, FireStats, FireStatus, RoadsResponse } from "@/lib/types";
import { COUNTRY_LABELS, type Country } from "@/lib/types";
import type { FireFilters } from "@/lib/filterFires";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import { formatArea, haToAcres, relativeTime } from "@/lib/format";
import { haversineKm } from "@/lib/geo";
import { useTheme } from "./Providers";
import StatusBadge from "./StatusBadge";

const ACTIVE_SET = new Set<FireStatus>(["out_of_control", "active", "being_held", "under_control"]);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Count-up number that respects prefers-reduced-motion. */
function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString(),
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      // Animation escape hatch: snap straight to the value, no tween.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const duration = 500;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (value - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{format(display)}</>;
}

function StatTile({
  label,
  value,
  hint,
  onClick,
  actionHint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  onClick?: () => void;
  actionHint?: string;
}) {
  const inner = (
    <>
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-dim">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] leading-snug text-ink-dim">{hint}</div>}
    </>
  );
  if (!onClick) {
    return <div className="fw-tile rounded-lg border border-line bg-panel p-3">{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={actionHint}
      aria-label={`${label}. ${actionHint ?? ""}`}
      className="fw-tile rounded-lg border border-line bg-panel p-3 text-left"
    >
      {inner}
    </button>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-dim">
      {children}
    </h3>
  );
}

function FireRow({
  fire,
  onSelect,
  metric,
}: {
  fire: Fire;
  onSelect: (id: string) => void;
  metric: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(fire.id)}
        className="fw-row-btn flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel-2 focus-visible:bg-panel-2"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{fire.name}</span>
          <span className="block text-xs text-ink-dim">
            {fire.admin} · {metric}
          </span>
        </span>
        <StatusBadge status={fire.status} evacuation={fire.evacuation} />
      </button>
    </li>
  );
}

export default function Dashboard({
  stats,
  fires,
  roads,
  closuresCount,
  onSelect,
  onApplyFilter,
  onGo,
  onNotice,
}: {
  stats: FireStats | undefined;
  fires: Fire[];
  roads: RoadsResponse | undefined;
  closuresCount: number | undefined;
  onSelect: (id: string) => void;
  onApplyFilter: (patch: Partial<FireFilters>) => void;
  onGo: (t: { lat: number; lon: number; zoom?: number; label?: string }) => void;
  onNotice: (msg: string) => void;
}) {
  const { highContrast } = useTheme();
  const [nearMe, setNearMe] = useState<{ fire: Fire; km: number }[] | null>(null);
  const [locating, setLocating] = useState(false);

  const byStatus = useMemo(() => {
    const counts = new Map<FireStatus, number>();
    for (const f of fires) counts.set(f.status, (counts.get(f.status) ?? 0) + 1);
    return STATUS_ORDER.map((s) => ({ status: s, count: counts.get(s) ?? 0 })).filter(
      (x) => x.count > 0
    );
  }, [fires]);
  const statusTotal = byStatus.reduce((a, b) => a + b.count, 0);

  const impactedRoads = roads?.roads.filter((r) => r.level === "impacted") ?? [];
  const topRoads = roads?.roads.slice(0, 5) ?? [];

  const findNearMe = () => {
    if (!navigator.geolocation) {
      onNotice("Geolocation is not supported by this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        const nearest = fires
          .filter((f) => ACTIVE_SET.has(f.status) || f.evacuation)
          .map((fire) => ({
            fire,
            km: Math.round(haversineKm(latitude, longitude, fire.lat, fire.lon)),
          }))
          .sort((a, b) => a.km - b.km)
          .slice(0, 5);
        setNearMe(nearest);
        onGo({ lat: latitude, lon: longitude, zoom: 7, label: "Your area" });
      },
      () => {
        setLocating(false);
        onNotice("Could not determine your location (permission denied or unavailable).");
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    );
  };

  if (!stats) {
    return (
      <p className="p-4 text-sm text-ink-dim" role="status">
        Loading live statistics…
      </p>
    );
  }

  const maxCountry = Math.max(1, ...Object.values(stats.byCountry));
  const topAdmins = Object.entries(stats.byAdmin)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-4 p-3">
      <section aria-label="Key statistics" className="grid grid-cols-2 gap-2">
        <StatTile
          label="Active fires"
          value={<AnimatedNumber value={stats.totalActive} />}
          hint={`${stats.totalAll} records incl. detections`}
          onClick={() =>
            onApplyFilter({ statuses: ["out_of_control", "active", "being_held", "under_control"] })
          }
          actionHint="Show all active fires in the list"
        />
        <StatTile
          label="Area burned"
          value={
            <AnimatedNumber
              value={stats.totalHa}
              format={(n) =>
                n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M ha` : `${Math.round(n / 1000)}k ha`
              }
            />
          }
          hint={`${Math.round(haToAcres(stats.totalHa) / 1000).toLocaleString()}k acres this season`}
        />
        <StatTile
          label="Started today"
          value={<AnimatedNumber value={stats.startedToday} />}
          onClick={() => onApplyFilter({ discoveredDays: 1 })}
          actionHint="Show fires discovered in the last 24 hours"
        />
        <StatTile
          label="Contained today"
          value={<AnimatedNumber value={stats.containedToday} />}
          onClick={() => onApplyFilter({ statuses: ["contained"] })}
          actionHint="Show contained fires in the list"
        />
        <StatTile
          label="Evacuation alerts"
          value={<AnimatedNumber value={stats.evacuations} />}
          hint="fires inside active NWS evacuation areas"
          onClick={() => onApplyFilter({ evacOnly: true })}
          actionHint="Show only fires with evacuation alerts"
        />
        <StatTile
          label="Roads affected"
          value={<AnimatedNumber value={(roads?.roads.length ?? 0) + (closuresCount ?? 0)} />}
          hint={
            roads
              ? `${impactedRoads.length} impacted hwys · ${closuresCount ?? 0} official events`
              : "computing from OSM + 511…"
          }
          onClick={
            topRoads.length > 0
              ? () =>
                  onGo({
                    lat: topRoads[0].lat,
                    lon: topRoads[0].lon,
                    zoom: 10,
                    label: topRoads[0].label,
                  })
              : undefined
          }
          actionHint="Zoom the map to the most affected highway"
        />
      </section>

      {statusTotal > 0 && (
        <section aria-label="Fires by status">
          <SectionHeading>By status</SectionHeading>
          <div
            aria-hidden="true"
            className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full"
          >
            {byStatus.map(({ status, count }) => (
              <div
                key={status}
                title={`${STATUS_META[status].label}: ${count}`}
                className="h-full rounded-sm"
                style={{
                  width: `${Math.max(2, (count / statusTotal) * 100)}%`,
                  backgroundColor: highContrast
                    ? STATUS_META[status].colorHC
                    : STATUS_META[status].color,
                }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {byStatus.map(({ status, count }) => (
              <button
                key={status}
                type="button"
                onClick={() => onApplyFilter({ statuses: [status] })}
                className="fw-row-btn flex items-center gap-1.5 rounded-md px-1 py-0.5 text-xs hover:bg-panel-2"
                aria-label={`${STATUS_META[status].label}: ${count} fires. Filter the list to this status.`}
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: highContrast
                      ? STATUS_META[status].colorHC
                      : STATUS_META[status].color,
                  }}
                />
                <span className="text-ink-dim">{STATUS_META[status].label}</span>
                <span className="font-semibold tabular-nums">{count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Fires near your location">
        <div className="flex items-center justify-between">
          <SectionHeading>Near me</SectionHeading>
          <button
            type="button"
            onClick={findNearMe}
            disabled={locating}
            className="fw-row-btn rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel-2 disabled:opacity-50"
          >
            {locating ? "Locating…" : nearMe ? "Refresh" : "📍 Find fires near me"}
          </button>
        </div>
        {nearMe && (
          <ul className="mt-1 space-y-0.5">
            {nearMe.length === 0 && (
              <li className="px-2 py-1 text-sm text-ink-dim">
                No active fires found — that&apos;s good news.
              </li>
            )}
            {nearMe.map(({ fire, km }) => (
              <FireRow
                key={fire.id}
                fire={fire}
                onSelect={onSelect}
                metric={`${km} km away · ${formatArea(fire.sizeHa)}`}
              />
            ))}
          </ul>
        )}
      </section>

      {roads && topRoads.length > 0 && (
        <section aria-label="Fire-affected highways">
          <SectionHeading>Fire-affected highways</SectionHeading>
          <ul className="space-y-0.5">
            {topRoads.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => onGo({ lat: r.lat, lon: r.lon, zoom: 10, label: r.label })}
                  className="fw-row-btn flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel-2 focus-visible:bg-panel-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.label}</span>
                    <span className="block text-xs text-ink-dim">
                      {r.fireName ? `near ${r.fireName} fire` : "near active fire"}
                      {r.distanceKm !== null ? ` · ${r.distanceKm} km` : ""}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${
                      r.level === "impacted" ? "bg-red-600" : "bg-amber-600"
                    }`}
                  >
                    {r.level === "impacted" ? "Impacted" : "At risk"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] leading-snug text-ink-dim">
            Derived from OSM roads vs. fire perimeters — check the map&apos;s 511
            markers and official sources before travelling.
          </p>
        </section>
      )}

      <section aria-label="Fires by country">
        <SectionHeading>Fires by country</SectionHeading>
        <ul className="space-y-1">
          {(Object.keys(stats.byCountry) as Country[]).map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => onApplyFilter({ countries: [c] })}
                aria-label={`${COUNTRY_LABELS[c]}: ${stats.byCountry[c]} fires. Filter the list to this country.`}
                className="fw-row-btn w-full rounded-md px-1.5 py-1 text-left text-sm hover:bg-panel-2"
              >
                <span className="flex items-baseline justify-between">
                  <span>{COUNTRY_LABELS[c]}</span>
                  <span className="font-semibold tabular-nums">{stats.byCountry[c]}</span>
                </span>
                <span
                  aria-hidden="true"
                  className="mt-0.5 block h-1.5 w-full overflow-hidden rounded-full bg-panel-2"
                >
                  <span
                    className="block h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${(stats.byCountry[c] / maxCountry) * 100}%` }}
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11px] text-ink-dim">
          Mexico counts are satellite detections (no public incident feed).
        </p>
      </section>

      {topAdmins.length > 0 && (
        <section aria-label="Top provinces and states">
          <SectionHeading>Top provinces / states</SectionHeading>
          <ul className="space-y-0.5 text-sm">
            {topAdmins.map(([admin, n]) => (
              <li key={admin}>
                <button
                  type="button"
                  onClick={() => onApplyFilter({ admins: [admin] })}
                  aria-label={`${admin}: ${n} fires. Filter the list to this region.`}
                  className="fw-row-btn flex w-full justify-between rounded-md px-1.5 py-1 hover:bg-panel-2"
                >
                  <span className="text-ink-dim">{admin}</span>
                  <span className="font-medium tabular-nums">{n}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Largest active fires">
        <SectionHeading>Largest active fires</SectionHeading>
        <ul className="space-y-0.5">
          {stats.largest.map((f) => (
            <FireRow key={f.id} fire={f} onSelect={onSelect} metric={formatArea(f.sizeHa)} />
          ))}
        </ul>
      </section>

      <section aria-label="Recently updated incidents">
        <SectionHeading>Recently updated</SectionHeading>
        <ul className="space-y-0.5">
          {stats.recentlyUpdated.map((f) => (
            <FireRow
              key={f.id}
              fire={f}
              onSelect={onSelect}
              metric={`updated ${relativeTime(f.updated)}`}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
