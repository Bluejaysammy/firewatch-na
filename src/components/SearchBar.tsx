"use client";

import { useEffect, useRef, useState } from "react";
import { parseCoordinates } from "@/lib/format";
import type { GeocodeResult } from "@/lib/types";

/** A locally-known hit (affected road, closure) shown above place results. */
export interface LocalHit {
  label: string;
  sublabel: string;
  lat: number;
  lon: number;
  zoom: number;
  badge: "impacted" | "at_risk" | "closure";
}

interface Option {
  label: string;
  sublabel?: string;
  badge?: LocalHit["badge"];
  lat: number;
  lon: number;
  zoom?: number;
  group: "roads" | "places";
}

const BADGE_STYLES: Record<NonNullable<Option["badge"]>, { text: string; cls: string }> = {
  impacted: { text: "Impacted", cls: "bg-red-600 text-white" },
  at_risk: { text: "At risk", cls: "bg-amber-600 text-white" },
  closure: { text: "511 event", cls: "bg-slate-600 text-white" },
};

export default function SearchBar({
  onGo,
  onNotice,
  localSearch,
}: {
  onGo: (t: { lat: number; lon: number; zoom?: number; label?: string }) => void;
  onNotice: (msg: string) => void;
  localSearch?: (q: string) => LocalHit[];
}) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const localOptions = (text: string): Option[] =>
    (localSearch?.(text) ?? []).map((h) => ({
      label: h.label,
      sublabel: h.sublabel,
      badge: h.badge,
      lat: h.lat,
      lon: h.lon,
      zoom: h.zoom,
      group: "roads" as const,
    }));

  const search = (text: string) => {
    setQ(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();

    const coords = parseCoordinates(text);
    if (coords) {
      setOptions([
        {
          label: `Go to coordinates ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`,
          lat: coords.lat,
          lon: coords.lon,
          zoom: 10,
          group: "places",
        },
      ]);
      setOpen(true);
      setActive(0);
      return;
    }

    const locals = text.trim().length >= 2 ? localOptions(text.trim()) : [];
    if (text.trim().length < 3) {
      setOptions(locals);
      setOpen(locals.length > 0);
      setActive(locals.length > 0 ? 0 : -1);
      return;
    }
    // Show local hits immediately; geocoded places arrive after the debounce.
    setOptions(locals);
    setOpen(true);
    setActive(locals.length > 0 ? 0 : -1);

    timerRef.current = setTimeout(async () => {
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(text.trim())}`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("geocode failed");
        const data = (await res.json()) as { results: GeocodeResult[] };
        const places: Option[] = data.results.map((r) => ({
          label: r.label,
          lat: r.lat,
          lon: r.lon,
          zoom: r.type === "state" || r.type === "province" ? 6 : 10,
          group: "places" as const,
        }));
        setOptions([...locals, ...places]);
        setOpen(true);
        setActive(locals.length + places.length > 0 ? 0 : -1);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          onNotice("Search is temporarily unavailable. You can enter coordinates like 49.28, -123.12.");
        }
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const choose = (o: Option) => {
    setOpen(false);
    setQ(o.label.split(",")[0]);
    onGo({
      lat: o.lat,
      lon: o.lon,
      zoom: o.zoom ?? 10,
      label: o.label.split(",").slice(0, 2).join(","),
    });
  };

  const firstPlaceIdx = options.findIndex((o) => o.group === "places");

  return (
    <div ref={rootRef} className="relative w-full max-w-md">
      <label htmlFor="place-search" className="sr-only">
        Search for a highway, address, city, province, state, postal code, or coordinates
      </label>
      <input
        id="place-search"
        role="combobox"
        aria-expanded={open}
        aria-controls="place-search-results"
        aria-activedescendant={active >= 0 ? `place-opt-${active}` : undefined}
        aria-autocomplete="list"
        type="text"
        value={q}
        placeholder="Search highway, place, postal code, or 49.28, -123.12"
        autoComplete="off"
        onChange={(e) => search(e.target.value)}
        onFocus={() => options.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(options.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && open && active >= 0 && options[active]) {
            e.preventDefault();
            choose(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border border-line bg-panel px-3 py-1.5 text-sm placeholder:text-ink-dim"
      />
      {loading && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-dim" aria-hidden="true">
          …
        </span>
      )}
      {open && (
        <ul
          id="place-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute z-[1200] mt-1 max-h-80 w-full min-w-72 max-w-[92vw] overflow-y-auto rounded-lg border border-line bg-panel shadow-xl"
        >
          {options.length === 0 && !loading && (
            <li className="px-3 py-2 text-sm text-ink-dim">No matches found</li>
          )}
          {options.map((o, i) => (
            <li key={`${o.group}-${o.lat}-${o.lon}-${i}`} role="presentation">
              {i === 0 && o.group === "roads" && (
                <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-dim">
                  Fire-affected roads
                </div>
              )}
              {i === firstPlaceIdx && firstPlaceIdx > 0 && (
                <div className="border-t border-line px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-dim">
                  Places
                </div>
              )}
              <button
                type="button"
                id={`place-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onClick={() => choose(o)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  i === active ? "bg-panel-2" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {o.sublabel && (
                    <span className="block truncate text-xs text-ink-dim">{o.sublabel}</span>
                  )}
                </span>
                {o.badge && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${BADGE_STYLES[o.badge].cls}`}
                  >
                    {BADGE_STYLES[o.badge].text}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
