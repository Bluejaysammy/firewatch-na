"use client";

import { useEffect, useRef } from "react";
import type { Fire } from "@/lib/types";
import { formatArea, formatCoords, formatDateTime, relativeTime } from "@/lib/format";
import { useAirQuality, useSpotWeather } from "@/hooks/useAppData";
import StatusBadge from "./StatusBadge";

function aqiCategory(aqi: number | null): { label: string; color: string } {
  if (aqi === null) return { label: "Unavailable", color: "#94a3b8" };
  if (aqi <= 50) return { label: "Good", color: "#16a34a" };
  if (aqi <= 100) return { label: "Moderate", color: "#ca8a04" };
  if (aqi <= 150) return { label: "Unhealthy for sensitive groups", color: "#ea580c" };
  if (aqi <= 200) return { label: "Unhealthy", color: "#dc2626" };
  if (aqi <= 300) return { label: "Very unhealthy", color: "#9333ea" };
  return { label: "Hazardous", color: "#7f1d1d" };
}

function windArrow(deg: number | null): string {
  if (deg === null) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <dt className="shrink-0 text-ink-dim">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export default function FireDetail({
  fire,
  onClose,
  onZoomTo,
}: {
  fire: Fire;
  onClose: () => void;
  onZoomTo: (f: Fire) => void;
}) {
  const air = useAirQuality(fire.lat, fire.lon);
  const wx = useSpotWeather(fire.lat, fire.lon);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [fire.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const aqiCat = aqiCategory(air.data?.usAqi ?? null);
  const worst24 = air.data?.hourly?.reduce<number | null>(
    (acc, h) => (h.usAqi === null ? acc : acc === null ? h.usAqi : Math.max(acc, h.usAqi)),
    null
  );

  return (
    <aside
      aria-label={`Details for ${fire.name}`}
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-[1100] flex max-h-[70%] flex-col rounded-t-xl border border-line bg-panel shadow-2xl md:inset-x-auto md:right-3 md:top-3 md:bottom-3 md:max-h-none md:w-96 md:rounded-xl"
    >
      <header className="flex items-start justify-between gap-2 border-b border-line p-3">
        <div className="min-w-0">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="truncate text-base font-bold outline-none"
          >
            {fire.name}
          </h2>
          <div className="mt-1">
            <StatusBadge status={fire.status} evacuation={fire.evacuation} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details panel"
          className="rounded-md border border-line px-2 py-1 text-sm hover:bg-panel-2"
        >
          ✕
        </button>
      </header>

      <div className="fw-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {fire.evacuation && (
          <p className="mb-3 rounded-lg border border-purple-600 bg-purple-600/10 p-2 text-sm font-medium">
            An active evacuation alert covers this location. Follow directions
            from local authorities — see the official agency link below.
          </p>
        )}
        {fire.source === "CWFIS_HOTSPOT" && (
          <p className="mb-3 rounded-lg border border-line bg-panel-2 p-2 text-xs text-ink-dim">
            This is a satellite thermal detection, not an agency-confirmed
            incident. Size is a rough estimate from the detection footprint.
          </p>
        )}

        <dl className="divide-y divide-[var(--border)]">
          <Row label="Size">{formatArea(fire.sizeHa)}</Row>
          <Row label="Containment">
            {fire.containment === null ? "Not reported" : `${Math.round(fire.containment)}%`}
          </Row>
          {fire.behavior && <Row label="Behaviour">{fire.behavior}</Row>}
          <Row label="Cause">{fire.cause ?? "Not reported"}</Row>
          <Row label="Discovered">{formatDateTime(fire.discovered)}</Row>
          <Row label="Last updated">
            {formatDateTime(fire.updated)}
            <span className="block text-xs font-normal text-ink-dim">
              ({relativeTime(fire.updated)})
            </span>
          </Row>
          {fire.personnel !== null && <Row label="Personnel">{fire.personnel}</Row>}
          {fire.complexName && <Row label="Complex">{fire.complexName}</Row>}
          {fire.county && <Row label="County / region">{fire.county}</Row>}
          <Row label="Region">{fire.admin}</Row>
          <Row label="Location">{formatCoords(fire.lat, fire.lon)}</Row>
          <Row label="Agency">
            {fire.agencyUrl ? (
              <a
                href={fire.agencyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--focus)] underline"
              >
                {fire.agency ?? "Official source"}
              </a>
            ) : (
              fire.agency ?? "Not reported"
            )}
          </Row>
          <Row label="Data source">
            {fire.source === "WFIGS"
              ? "NIFC WFIGS (US)"
              : fire.source === "CWFIS"
                ? "CWFIS © Natural Resources Canada"
                : fire.source === "FIRMS"
                  ? "NASA FIRMS"
                  : "CWFIS satellite feed © NRCan"}
          </Row>
        </dl>

        <section aria-label="Air quality at fire location" className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Air quality nearby
          </h3>
          {air.isLoading ? (
            <p className="mt-1 text-sm text-ink-dim" role="status">Loading air quality…</p>
          ) : air.isError ? (
            <p className="mt-1 text-sm text-ink-dim">Air quality data unavailable.</p>
          ) : (
            <div className="mt-1.5 rounded-lg border border-line bg-panel-2 p-2.5">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: aqiCat.color }}
                />
                <span className="text-lg font-bold tabular-nums">
                  {air.data?.usAqi ?? "–"}
                </span>
                <span className="text-sm">US AQI · {aqiCat.label}</span>
              </div>
              <p className="mt-1 text-xs text-ink-dim">
                PM2.5 {air.data?.pm25 ?? "–"} µg/m³ · PM10 {air.data?.pm10 ?? "–"} µg/m³
                {worst24 !== null && worst24 !== undefined
                  ? ` · next 24 h peak AQI ≈ ${Math.round(worst24)}`
                  : ""}
              </p>
              <p className="mt-1 text-[10px] text-ink-dim">
                Modelled data (CAMS via Open-Meteo) — smoke impacts included.
              </p>
            </div>
          )}
        </section>

        <section aria-label="Weather at fire location" className="mt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Weather at the fire
          </h3>
          {wx.isLoading ? (
            <p className="mt-1 text-sm text-ink-dim" role="status">Loading weather…</p>
          ) : wx.isError ? (
            <p className="mt-1 text-sm text-ink-dim">Weather data unavailable.</p>
          ) : (
            <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-lg border border-line bg-panel-2 p-2.5 text-sm">
              <div>
                <span className="block text-xs text-ink-dim">Temperature</span>
                <span className="font-semibold">
                  {wx.data?.tempC !== null && wx.data ? `${wx.data.tempC}°C` : "–"}
                </span>
              </div>
              <div>
                <span className="block text-xs text-ink-dim">Humidity</span>
                <span className="font-semibold">
                  {wx.data?.rh !== null && wx.data ? `${wx.data.rh}%` : "–"}
                </span>
              </div>
              <div>
                <span className="block text-xs text-ink-dim">Wind</span>
                <span className="font-semibold">
                  {wx.data?.windKmh !== null && wx.data
                    ? `${Math.round(wx.data.windKmh!)} km/h ${windArrow(wx.data.windDir)}`
                    : "–"}
                </span>
              </div>
              <div>
                <span className="block text-xs text-ink-dim">Gusts</span>
                <span className="font-semibold">
                  {wx.data?.windGustKmh !== null && wx.data
                    ? `${Math.round(wx.data.windGustKmh!)} km/h`
                    : "–"}
                </span>
              </div>
            </div>
          )}
        </section>
      </div>

      <footer className="border-t border-line p-3">
        <button
          type="button"
          onClick={() => onZoomTo(fire)}
          className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Zoom to fire on map
        </button>
      </footer>
    </aside>
  );
}
