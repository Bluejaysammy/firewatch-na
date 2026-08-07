"use client";

import type { AppConfig } from "@/lib/types";
import type { BaseLayerId, LayerToggles } from "./map/MapView";

const BASES: { id: BaseLayerId; label: string; hint: string }[] = [
  { id: "road", label: "Road map", hint: "OpenStreetMap — roads, rivers, lakes, parks, boundaries" },
  { id: "satellite", label: "Satellite", hint: "Esri World Imagery" },
  { id: "terrain", label: "Terrain", hint: "OpenTopoMap — elevation contours" },
  { id: "hybrid", label: "Hybrid", hint: "Satellite + place labels & boundaries" },
];

interface OverlayDef {
  key: keyof LayerToggles;
  label: string;
  hint: string;
  requires?: "owm" | "waqi";
}

const OVERLAYS: OverlayDef[] = [
  { key: "fires", label: "Active fires", hint: "Clustered incident markers, colour-coded by status" },
  { key: "perimeters", label: "Fire perimeters", hint: "US mapped perimeters + Canadian satellite estimates" },
  { key: "hotspots", label: "Satellite hotspots (24 h)", hint: "VIIRS/MODIS thermal detections, all of North America" },
  { key: "smoke", label: "Smoke forecast", hint: "NOAA near-surface smoke model" },
  { key: "radar", label: "Weather radar", hint: "Live precipitation radar (RainViewer)" },
  { key: "alerts", label: "Alerts & evacuation zones", hint: "Evacuation orders/alerts (BC official + US NWS), fire warnings, red flag warnings, air quality alerts" },
  { key: "stations", label: "Fire stations", hint: "From OpenStreetMap; loads at zoom 10+" },
  { key: "roads", label: "Fire-affected highways", hint: "Major roads crossing (solid red) or near (dashed amber) active fires — derived from OSM + perimeters" },
  { key: "closures", label: "Road closures & events (511)", hint: "Official DriveBC, Alberta 511 and Ontario 511 events that are fire-related or near active fires" },
  { key: "cameras", label: "Highway cameras", hint: "511 traffic cameras within 60 km of an active fire (AB/ON; opens official camera pages)" },
  { key: "aqi", label: "Air Quality Index", hint: "AQI ground-station tiles", requires: "waqi" },
  { key: "wind", label: "Wind speed & direction", hint: "OpenWeatherMap wind layer", requires: "owm" },
  { key: "temp", label: "Temperature", hint: "OpenWeatherMap temperature layer", requires: "owm" },
  { key: "precip", label: "Precipitation", hint: "OpenWeatherMap precipitation layer", requires: "owm" },
];

export default function LayersPanel({
  base,
  onBase,
  layers,
  onLayers,
  config,
}: {
  base: BaseLayerId;
  onBase: (b: BaseLayerId) => void;
  layers: LayerToggles;
  onLayers: (l: LayerToggles) => void;
  config: AppConfig | undefined;
}) {
  return (
    <div className="space-y-3 p-3">
      <fieldset className="rounded-lg border border-line p-2">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Base map
        </legend>
        <div className="space-y-1">
          {BASES.map((b) => (
            <label key={b.id} className="flex items-start gap-2 text-sm" title={b.hint}>
              <input
                type="radio"
                name="basemap"
                aria-label={b.label}
                checked={base === b.id}
                onChange={() => onBase(b.id)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">{b.label}</span>
                <span className="block text-xs text-ink-dim">{b.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-line p-2">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Data layers
        </legend>
        <div className="space-y-1.5">
          {OVERLAYS.map((o) => {
            const gated =
              (o.requires === "owm" && !config?.owmEnabled) ||
              (o.requires === "waqi" && !config?.waqiEnabled);
            return (
              <label
                key={o.key}
                className={`flex items-start gap-2 text-sm ${gated ? "opacity-50" : ""}`}
                title={o.hint}
              >
                <input
                  type="checkbox"
                  aria-label={o.label}
                  checked={layers[o.key]}
                  disabled={gated}
                  onChange={(e) => onLayers({ ...layers, [o.key]: e.target.checked })}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{o.label}</span>
                  <span className="block text-xs text-ink-dim">
                    {gated ? "Requires an API key — see .env.example" : o.hint}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="text-[11px] leading-snug text-ink-dim">
        Roads, rivers, lakes, parks, cities and administrative boundaries are part
        of the base maps. Additional agency layers can be added via the source
        registry — see the README.
      </p>
    </div>
  );
}
