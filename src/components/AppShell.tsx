"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import {
  useClosures,
  useConfig,
  useFires,
  useLiveUpdates,
  useRoads,
  useStats,
} from "@/hooks/useAppData";
import { DEFAULT_FILTERS, filterFires, type FireFilters } from "@/lib/filterFires";
import type { LocalHit } from "./SearchBar";
import { useTheme } from "./Providers";
import Header from "./Header";
import Dashboard from "./Dashboard";
import FireList from "./FireList";
import FiltersPanel from "./FiltersPanel";
import LayersPanel from "./LayersPanel";
import Legend from "./Legend";
import FireDetail from "./FireDetail";
import type { BaseLayerId, FlyTarget, LayerToggles } from "./map/MapView";

const MapView = dynamic(() => import("./map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-panel-2 text-sm text-ink-dim" role="status">
      Loading map…
    </div>
  ),
});

const DEFAULT_LAYERS: LayerToggles = {
  fires: true,
  perimeters: true,
  hotspots: false,
  smoke: false,
  radar: false,
  alerts: false,
  stations: false,
  roads: true,
  closures: true,
  cameras: false,
  aqi: false,
  wind: false,
  temp: false,
  precip: false,
};

type Tab = "dashboard" | "fires" | "filters" | "layers";

export default function AppShell() {
  const { highContrast } = useTheme();
  const queryClient = useQueryClient();
  const config = useConfig();

  const [refreshMs, setRefreshMs] = useState(300_000);
  useEffect(() => {
    // Stored preference must be read post-mount (SSR has no localStorage).
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = Number(localStorage.getItem("fw-refresh-ms"));
    if (stored >= 60_000) setRefreshMs(stored);
    else if (config.data) setRefreshMs(config.data.refreshDefaultMs);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [config.data]);
  const changeRefresh = (ms: number) => {
    setRefreshMs(ms);
    localStorage.setItem("fw-refresh-ms", String(ms));
  };

  const fires = useFires(refreshMs);
  const stats = useStats(refreshMs);
  const roads = useRoads();
  const closures = useClosures();
  useLiveUpdates();

  const [filters, setFilters] = useState<FireFilters>(DEFAULT_FILTERS);
  const [layers, setLayers] = useState<LayerToggles>(DEFAULT_LAYERS);
  const [base, setBase] = useState<BaseLayerId>("road");
  useEffect(() => {
    // Stored preferences must be read post-mount (SSR has no localStorage).
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const l = localStorage.getItem("fw-layers");
      if (l) setLayers({ ...DEFAULT_LAYERS, ...(JSON.parse(l) as Partial<LayerToggles>) });
      const b = localStorage.getItem("fw-base") as BaseLayerId | null;
      if (b && ["road", "satellite", "terrain", "hybrid"].includes(b)) setBase(b);
    } catch {
      /* corrupted storage — fall back to defaults */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  const changeLayers = (l: LayerToggles) => {
    setLayers(l);
    localStorage.setItem("fw-layers", JSON.stringify(l));
  };
  const changeBase = (b: BaseLayerId) => {
    setBase(b);
    localStorage.setItem("fw-base", b);
  };

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null);
  const flyNonce = useRef(0);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [panelOpen, setPanelOpen] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }, []);

  const allFires = useMemo(() => fires.data?.fires ?? [], [fires.data]);
  const visibleFires = useMemo(
    () => filterFires(allFires, filters),
    [allFires, filters]
  );
  const selectedFire = useMemo(
    () => allFires.find((f) => f.id === selectedId) ?? null,
    [allFires, selectedId]
  );

  const goTo = useCallback((t: { lat: number; lon: number; zoom?: number; label?: string }) => {
    flyNonce.current += 1;
    setFlyTo({ ...t, nonce: flyNonce.current });
  }, []);

  const selectFire = useCallback(
    (id: string) => {
      setSelectedId(id);
      const f = (fires.data?.fires ?? []).find((x) => x.id === id);
      if (f) goTo({ lat: f.lat, lon: f.lon, zoom: 9 });
    },
    [fires.data, goTo]
  );

  const manualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["fires"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  /**
   * Dashboard interactions: replace filters with defaults + the patch (a
   * shortcut always shows exactly what its label promises), then jump to
   * the list so the result is visible.
   */
  const applyFilter = useCallback((patch: Partial<FireFilters>) => {
    setFilters({ ...DEFAULT_FILTERS, ...patch });
    setTab("fires");
    setPanelOpen(true);
  }, []);

  /** Instant search over affected roads + official closures. */
  const localSearch = useCallback(
    (q: string): LocalHit[] => {
      const needle = q.toLowerCase();
      const hits: LocalHit[] = [];
      for (const r of roads.data?.roads ?? []) {
        if (
          r.label.toLowerCase().includes(needle) ||
          (r.ref ?? "").toLowerCase().includes(needle) ||
          (r.name ?? "").toLowerCase().includes(needle)
        ) {
          hits.push({
            label: r.label,
            sublabel: `${r.level === "impacted" ? "Crosses fire perimeter" : "Near active fire"}${
              r.fireName ? ` · ${r.fireName}` : ""
            }${r.distanceKm !== null ? ` · ${r.distanceKm} km` : ""}`,
            lat: r.lat,
            lon: r.lon,
            zoom: 10,
            badge: r.level,
          });
        }
        if (hits.length >= 4) break;
      }
      for (const c of closures.data?.closures ?? []) {
        if (hits.length >= 6) break;
        if (
          (c.road ?? "").toLowerCase().includes(needle) ||
          c.description.toLowerCase().includes(needle)
        ) {
          hits.push({
            label: c.road ?? "Road event",
            sublabel: `${c.sourceLabel} · ${c.description.slice(0, 70)}`,
            lat: c.lat,
            lon: c.lon,
            zoom: 11,
            badge: "closure",
          });
        }
      }
      return hits;
    },
    [roads.data, closures.data]
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "fires", label: `Fires (${visibleFires.length})` },
    { id: "filters", label: "Filters" },
    { id: "layers", label: "Layers" },
  ];

  return (
    <div className="flex h-dvh flex-col">
      <Header
        fetchedAt={fires.data?.fetchedAt ?? null}
        sources={fires.data?.sources ?? []}
        refreshMs={refreshMs}
        onRefreshMs={changeRefresh}
        onManualRefresh={manualRefresh}
        isFetching={fires.isFetching}
        onGo={goTo}
        onNotice={showNotice}
        localSearch={localSearch}
      />

      {fires.isError && (
        <div
          role="alert"
          className="border-b border-red-700 bg-red-600/10 px-3 py-2 text-sm"
        >
          Live fire data is temporarily unavailable ({fires.error.message}).
          Retrying automatically…
        </div>
      )}
      {fires.data?.stale && (
        <div role="alert" className="border-b border-amber-600 bg-amber-500/10 px-3 py-1.5 text-xs">
          Upstream feeds are unreachable — showing the most recent cached data
          (from {new Date(fires.data.fetchedAt).toLocaleTimeString()}).
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        {/* Sidebar (desktop) / slide-over (mobile) */}
        <div
          className={`${
            panelOpen ? "flex" : "hidden"
          } absolute inset-y-0 left-0 z-[1200] w-full max-w-sm flex-col border-r border-line bg-panel md:static md:flex md:w-[370px] md:max-w-none`}
        >
          <nav aria-label="Panel sections" className="flex border-b border-line" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 px-1 py-2 text-xs font-semibold sm:text-sm ${
                  tab === t.id
                    ? "border-b-2 border-[var(--accent)] text-ink"
                    : "text-ink-dim hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="Hide panel"
              className="px-2 text-ink-dim hover:text-ink md:hidden"
            >
              ✕
            </button>
          </nav>
          <div className="fw-scroll min-h-0 flex-1 overflow-y-auto">
            <div key={tab} className="fw-tab-in h-full">
              {fires.isLoading && tab !== "layers" ? (
                <div className="space-y-2 p-3" role="status" aria-label="Loading fire data">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-panel-2" />
                  ))}
                  <p className="text-sm text-ink-dim">Loading live fire data…</p>
                </div>
              ) : tab === "dashboard" ? (
                <Dashboard
                  stats={stats.data}
                  fires={allFires}
                  roads={roads.data}
                  closuresCount={closures.data?.closures.length}
                  onSelect={selectFire}
                  onApplyFilter={applyFilter}
                  onGo={goTo}
                  onNotice={showNotice}
                />
              ) : tab === "fires" ? (
                <FireList
                  fires={visibleFires}
                  selectedId={selectedId}
                  onSelect={selectFire}
                />
              ) : tab === "filters" ? (
                <FiltersPanel fires={allFires} filters={filters} onChange={setFilters} />
              ) : (
                <LayersPanel
                  base={base}
                  onBase={changeBase}
                  layers={layers}
                  onLayers={changeLayers}
                  config={config.data}
                />
              )}
            </div>
          </div>
        </div>

        {/* Map */}
        <main className="relative min-w-0 flex-1" aria-label="Wildfire map">
          <MapView
            fires={visibleFires}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            layers={layers}
            base={base}
            highContrast={highContrast}
            flyTo={flyTo}
            onNotice={showNotice}
          />
          <Legend />
          {!panelOpen && (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="absolute left-2 top-2 z-[1000] rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold shadow-lg md:hidden"
            >
              ☰ Panels
            </button>
          )}
          {selectedFire && (
            <FireDetail
              fire={selectedFire}
              onClose={() => setSelectedId(null)}
              onZoomTo={(f) => goTo({ lat: f.lat, lon: f.lon, zoom: 11 })}
            />
          )}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Open panel"
        className="flex border-t border-line bg-panel md:hidden"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setPanelOpen(true);
            }}
            className="flex-1 py-2.5 text-xs font-semibold text-ink-dim"
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div aria-live="polite" className="sr-only" role="status">
        {fires.data
          ? `Fire data updated. ${visibleFires.length} fires shown.`
          : ""}
      </div>
      {notice && (
        <div
          role="status"
          className="fixed left-1/2 top-14 z-[1400] -translate-x-1/2 rounded-lg border border-line bg-panel px-4 py-2 text-sm shadow-xl"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
