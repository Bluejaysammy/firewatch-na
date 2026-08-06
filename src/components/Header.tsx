"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme, type ThemeMode } from "./Providers";
import { relativeTime } from "@/lib/format";
import SearchBar, { type LocalHit } from "./SearchBar";
import type { SourceHealth } from "@/lib/types";

const INTERVALS = [
  { ms: 60_000, label: "1 min" },
  { ms: 120_000, label: "2 min" },
  { ms: 300_000, label: "5 min" },
  { ms: 600_000, label: "10 min" },
  { ms: 900_000, label: "15 min" },
  { ms: 1_800_000, label: "30 min" },
];

export default function Header({
  fetchedAt,
  sources,
  refreshMs,
  onRefreshMs,
  onManualRefresh,
  isFetching,
  onGo,
  onNotice,
  localSearch,
}: {
  fetchedAt: string | null;
  sources: SourceHealth[];
  refreshMs: number;
  onRefreshMs: (ms: number) => void;
  onManualRefresh: () => void;
  isFetching: boolean;
  onGo: (t: { lat: number; lon: number; zoom?: number; label?: string }) => void;
  onNotice: (msg: string) => void;
  localSearch?: (q: string) => LocalHit[];
}) {
  const { mode, setMode, highContrast, setHighContrast } = useTheme();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const failing = sources.filter((s) => !s.ok);

  return (
    <header className="z-[1300] flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-panel px-3 py-2">
      <h1 className="flex items-center gap-2 text-base font-extrabold tracking-tight">
        <span aria-hidden="true">🔥</span> FireWatch{" "}
        <span className="font-medium text-ink-dim">North America</span>
      </h1>

      <div className="order-last w-full min-w-0 lg:order-none lg:w-auto lg:min-w-72 lg:flex-1">
        <SearchBar onGo={onGo} onNotice={onNotice} localSearch={localSearch} />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          role="status"
          className="hidden items-center gap-1.5 sm:flex"
          title={
            failing.length > 0
              ? `Degraded: ${failing.map((s) => s.label).join(", ")} unavailable`
              : sources.map((s) => `${s.label}: ${s.count} records`).join("\n")
          }
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${
              failing.length > 0 ? "bg-amber-500" : "bg-green-600"
            } ${isFetching ? "animate-pulse" : ""}`}
          />
          <span className="text-ink-dim">
            {failing.length > 0 ? "Partial data · " : ""}
            Updated {fetchedAt ? relativeTime(fetchedAt) : "—"}
          </span>
        </span>

        <button
          type="button"
          onClick={onManualRefresh}
          disabled={isFetching}
          className="rounded-md border border-line px-2 py-1 font-medium hover:bg-panel-2 disabled:opacity-50"
          aria-label="Refresh fire data now"
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>

        <label className="flex items-center gap-1">
          <span className="sr-only sm:not-sr-only sm:text-ink-dim">Every</span>
          <select
            aria-label="Automatic refresh interval"
            value={refreshMs}
            onChange={(e) => onRefreshMs(Number(e.target.value))}
            className="rounded-md border border-line bg-panel px-1.5 py-1"
          >
            {INTERVALS.map((i) => (
              <option key={i.ms} value={i.ms}>
                {i.label}
              </option>
            ))}
          </select>
        </label>

        <select
          aria-label="Colour theme"
          value={mode}
          onChange={(e) => setMode(e.target.value as ThemeMode)}
          className="rounded-md border border-line bg-panel px-1.5 py-1"
        >
          <option value="system">Auto</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>

        <button
          type="button"
          aria-pressed={highContrast}
          onClick={() => setHighContrast(!highContrast)}
          className={`rounded-md border px-2 py-1 font-medium ${
            highContrast
              ? "border-ink bg-ink text-panel"
              : "border-line hover:bg-panel-2"
          }`}
          title="Toggle high-contrast mode"
        >
          HC
        </button>

        <Link
          href="/about"
          className="rounded-md border border-line px-2 py-1 font-medium hover:bg-panel-2"
        >
          About & data
        </Link>
      </div>
    </header>
  );
}
