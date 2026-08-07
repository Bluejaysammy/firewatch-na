"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { ClosuresResponse, Fire, FireStatus, RoadsResponse } from "@/lib/types";
import { STATUS_META, EVACUATION_COLOR, statusColor } from "@/lib/status";
import { formatArea, relativeTime } from "@/lib/format";

export type BaseLayerId = "road" | "satellite" | "terrain" | "hybrid";

export interface LayerToggles {
  fires: boolean;
  perimeters: boolean;
  hotspots: boolean;
  smoke: boolean;
  radar: boolean;
  alerts: boolean;
  stations: boolean;
  roads: boolean;
  closures: boolean;
  cameras: boolean;
  aqi: boolean;
  wind: boolean;
  temp: boolean;
  precip: boolean;
}

export interface FlyTarget {
  lat: number;
  lon: number;
  zoom?: number;
  label?: string;
  nonce: number;
}

interface MapViewProps {
  fires: Fire[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  layers: LayerToggles;
  base: BaseLayerId;
  highContrast: boolean;
  flyTo: FlyTarget | null;
  onNotice: (msg: string) => void;
}

interface Hotspot {
  lat: number;
  lon: number;
  sensor: string | null;
  reportedAt: string | null;
  frp: number | null;
}

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ESRI_ATTR = "Imagery &copy; Esri, Maxar, Earthstar Geographics";
const TOPO_ATTR = 'Map data: &copy; OpenStreetMap contributors, SRTM | Style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)';

function baseLayers(): Record<BaseLayerId, L.TileLayer[]> {
  return {
    road: [
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        className: "fw-basemap-road",
        attribution: OSM_ATTR,
      }),
    ],
    satellite: [
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: ESRI_ATTR }
      ),
    ],
    terrain: [
      L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        maxZoom: 16,
        className: "fw-basemap-terrain",
        attribution: TOPO_ATTR,
      }),
    ],
    hybrid: [
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: ESRI_ATTR }
      ),
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Labels &copy; Esri" }
      ),
    ],
  };
}

function markerRadius(sizeHa: number | null): number {
  if (sizeHa === null || sizeHa <= 0) return 6;
  return Math.max(6, Math.min(22, 5 + Math.sqrt(sizeHa) / 14));
}

function clusterColor(markers: L.Marker[], hc: boolean): string {
  let best: FireStatus = "info";
  let bestRank = Infinity;
  for (const m of markers) {
    const st = (m.options as { fireStatus?: FireStatus }).fireStatus;
    if (st && STATUS_META[st].rank < bestRank) {
      bestRank = STATUS_META[st].rank;
      best = st;
    }
  }
  return statusColor(best, hc);
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

class SimpleControl extends L.Control {
  private html: string;
  private title: string;
  private onClick: () => void;
  constructor(
    pos: L.ControlPosition,
    html: string,
    title: string,
    onClick: () => void
  ) {
    super({ position: pos });
    this.html = html;
    this.title = title;
    this.onClick = onClick;
  }
  onAdd(): HTMLElement {
    const div = L.DomUtil.create("div", "leaflet-bar");
    const btn = L.DomUtil.create("a", "fw-map-btn", div);
    btn.href = "#";
    btn.role = "button";
    btn.innerHTML = this.html;
    btn.title = this.title;
    btn.setAttribute("aria-label", this.title);
    btn.style.fontSize = "16px";
    L.DomEvent.on(btn, "click", (e) => {
      L.DomEvent.preventDefault(e);
      this.onClick();
    });
    return div;
  }
}

export default function MapView({
  fires,
  selectedId,
  onSelect,
  layers,
  base,
  highContrast,
  flyTo,
  onNotice,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.TileLayer[]>([]);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markerById = useRef<Map<string, L.CircleMarker>>(new Map());
  const perimUsRef = useRef<L.GeoJSON | null>(null);
  const perimCaRef = useRef<L.GeoJSON | null>(null);
  const hotspotsRef = useRef<L.LayerGroup | null>(null);
  const alertsRef = useRef<L.GeoJSON | null>(null);
  const radarRef = useRef<L.TileLayer | null>(null);
  const owmRefs = useRef<Partial<Record<"wind" | "temp" | "precip" | "aqi", L.TileLayer>>>({});
  const smokeRef = useRef<L.ImageOverlay | null>(null);
  const roadsRef = useRef<L.GeoJSON | null>(null);
  const closuresRef = useRef<L.LayerGroup | null>(null);
  const evacRef = useRef<L.GeoJSON | null>(null);
  const camerasRef = useRef<L.LayerGroup | null>(null);
  const stationsRef = useRef<L.LayerGroup | null>(null);
  const searchPinRef = useRef<L.Marker | null>(null);
  const locateRef = useRef<L.LayerGroup | null>(null);

  // Latest-prop mirrors, written in an effect (not during render) so
  // long-lived Leaflet event closures always see current values.
  const hcRef = useRef(highContrast);
  const layersRef = useRef(layers);
  const onSelectRef = useRef(onSelect);
  const onNoticeRef = useRef(onNotice);
  useEffect(() => {
    hcRef.current = highContrast;
    layersRef.current = layers;
    onSelectRef.current = onSelect;
    onNoticeRef.current = onNotice;
  }, [highContrast, layers, onSelect, onNotice]);

  // Imperative refresh hooks filled in by the map-init effect.
  const smokeRefresh = useRef<() => void>(() => {});
  const stationsRefresh = useRef<() => void>(() => {});

  // ---------- data queries for overlay layers ----------
  const perimUs = useQuery({
    queryKey: ["perimeters", "us"],
    queryFn: () => getJson<GeoJSON.FeatureCollection>("/api/perimeters?country=us"),
    enabled: layers.perimeters,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
  const perimCa = useQuery({
    queryKey: ["perimeters", "ca"],
    queryFn: () => getJson<GeoJSON.FeatureCollection>("/api/perimeters?country=ca"),
    enabled: layers.perimeters,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
  const hotspots = useQuery({
    queryKey: ["hotspots"],
    queryFn: () => getJson<{ hotspots: Hotspot[] }>("/api/hotspots"),
    enabled: layers.hotspots,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
  const alerts = useQuery({
    queryKey: ["alerts"],
    queryFn: () => getJson<GeoJSON.FeatureCollection>("/api/alerts"),
    enabled: layers.alerts,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });
  const radar = useQuery({
    queryKey: ["radar"],
    queryFn: () => getJson<{ host: string; path: string }>("/api/radar"),
    enabled: layers.radar,
    staleTime: 4 * 60_000,
    refetchInterval: 5 * 60_000,
  });
  const roads = useQuery({
    queryKey: ["roads"],
    queryFn: () => getJson<RoadsResponse>("/api/roads"),
    enabled: layers.roads,
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
  });
  const closures = useQuery({
    queryKey: ["closures"],
    queryFn: () => getJson<ClosuresResponse>("/api/closures"),
    enabled: layers.closures,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
  const evacZones = useQuery({
    queryKey: ["evacuations"],
    queryFn: () => getJson<GeoJSON.FeatureCollection>("/api/evacuations"),
    enabled: layers.alerts,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
  const cameras = useQuery({
    queryKey: ["cameras"],
    queryFn: () =>
      getJson<{
        cameras: {
          id: string;
          name: string;
          road: string | null;
          lat: number;
          lon: number;
          sourceLabel: string;
          nearestFireKm: number;
          nearestFireName: string;
          views: { url: string; description: string | null }[];
        }[];
      }>("/api/cameras"),
    enabled: layers.cameras,
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
  });

  // ---------- map init ----------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [52, -100],
      zoom: 4,
      minZoom: 3,
      maxZoom: 19,
      zoomControl: false,
      worldCopyJump: true,
      attributionControl: true,
    });
    map.attributionControl.setPrefix(
      'Fire data: <a href="https://data-nifc.opendata.arcgis.com/">NIFC WFIGS</a>, <a href="https://cwfis.cfs.nrcan.gc.ca/">CWFIS © NRCan</a>, <a href="https://www.weather.gov/">NWS</a>'
    );
    L.control.zoom({ position: "topright" }).addTo(map);
    L.control.scale({ position: "bottomleft", metric: true, imperial: true }).addTo(map);

    new SimpleControl("topright", "⛶", "Toggle full-screen map", () => {
      const el = containerRef.current;
      if (!el) return;
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void el.requestFullscreen().catch(() => {
          onNoticeRef.current("Full-screen is not available in this browser.");
        });
      }
    }).addTo(map);

    new SimpleControl("topright", "◎", "Zoom to my location", () => {
      if (!navigator.geolocation) {
        onNoticeRef.current("Geolocation is not supported by this browser.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          locateRef.current?.clearLayers();
          const grp = locateRef.current ?? L.layerGroup().addTo(map);
          locateRef.current = grp;
          L.circle([latitude, longitude], {
            radius: accuracy,
            color: "#2563eb",
            fillOpacity: 0.08,
            weight: 1,
          }).addTo(grp);
          L.circleMarker([latitude, longitude], {
            radius: 7,
            color: "#fff",
            weight: 2,
            fillColor: "#2563eb",
            fillOpacity: 1,
          })
            .bindTooltip("Your location")
            .addTo(grp);
          map.flyTo([latitude, longitude], Math.max(map.getZoom(), 10));
          onNoticeRef.current("Map centred on your location.");
        },
        () => onNoticeRef.current("Could not determine your location (permission denied or unavailable)."),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
      );
    }).addTo(map);

    // North indicator: Leaflet cannot rotate the map, so north is always up.
    const compass = new L.Control({ position: "topright" });
    compass.onAdd = () => {
      const div = L.DomUtil.create("div", "leaflet-bar fw-compass");
      div.innerHTML = `<span aria-hidden="true">N<br>▲</span>`;
      div.title = "North is up — the map does not rotate";
      div.setAttribute("role", "img");
      div.setAttribute("aria-label", "Compass: north is up; the map does not rotate");
      return div;
    };
    compass.addTo(map);

    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 55,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (c) => {
        const n = c.getChildCount();
        const color = clusterColor(c.getAllChildMarkers(), hcRef.current);
        const size = n >= 100 ? 46 : n >= 10 ? 40 : 34;
        return L.divIcon({
          html: `<div class="fw-cluster" style="width:${size}px;height:${size}px;background:${color}" aria-hidden="true">${n}</div>`,
          className: "",
          iconSize: [size, size],
        });
      },
    });
    map.addLayer(cluster);
    clusterRef.current = cluster;
    mapRef.current = map;

    // --- smoke overlay (NOAA NDGD), re-requested for the current viewport ---
    let smokeTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshSmoke = () => {
      if (!layersRef.current.smoke) return;
      if (smokeTimer) clearTimeout(smokeTimer);
      smokeTimer = setTimeout(() => {
        const b = map.getBounds();
        const size = map.getSize();
        const w = Math.min(1600, Math.max(256, Math.round(size.x)));
        const h = Math.min(1600, Math.max(256, Math.round(size.y)));
        const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
          .map((v) => v.toFixed(4))
          .join(",");
        const url = `/api/smoke?bbox=${bbox}&width=${w}&height=${h}`;
        const img = new Image();
        img.onload = () => {
          if (!layersRef.current.smoke) return;
          smokeRef.current?.remove();
          smokeRef.current = L.imageOverlay(url, b, {
            opacity: 0.55,
            attribution: "Smoke forecast: NOAA NDGD",
          }).addTo(map);
        };
        img.src = url;
      }, 350);
    };
    smokeRefresh.current = refreshSmoke;

    // --- fire stations (OSM Overpass), zoom-gated ---
    let stationsAc: AbortController | null = null;
    const refreshStations = async () => {
      if (!layersRef.current.stations) return;
      if (map.getZoom() < 10) {
        stationsRef.current?.remove();
        stationsRef.current = null;
        return;
      }
      stationsAc?.abort();
      const ac = new AbortController();
      stationsAc = ac;
      const b = map.getBounds();
      const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
        .map((v) => v.toFixed(3))
        .join(",");
      try {
        const res = await fetch(`/api/stations?bbox=${bbox}`, { signal: ac.signal });
        if (!res.ok) return;
        const data = (await res.json()) as {
          stations: { lat: number; lon: number; name: string }[];
        };
        if (ac.signal.aborted || !layersRef.current.stations) return;
        stationsRef.current?.remove();
        const grp = L.layerGroup();
        for (const s of data.stations) {
          L.marker([s.lat, s.lon], {
            icon: L.divIcon({ className: "fw-station-icon", iconSize: [12, 12] }),
            keyboard: false,
          })
            .bindTooltip(escapeHtml(s.name))
            .addTo(grp);
        }
        grp.addTo(map);
        stationsRef.current = grp;
      } catch {
        /* aborted or offline — ignore */
      }
    };
    stationsRefresh.current = refreshStations;

    const onMoveEnd = () => {
      void refreshStations();
      refreshSmoke();
    };
    map.on("moveend", onMoveEnd);

    return () => {
      map.off("moveend", onMoveEnd);
      if (smokeTimer) clearTimeout(smokeTimer);
      stationsAc?.abort();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      baseRef.current = [];
    };
  }, []);

  // ---------- base layer ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    baseRef.current.forEach((l) => map.removeLayer(l));
    const defs = baseLayers()[base];
    defs.forEach((l) => {
      l.addTo(map);
      l.bringToBack();
    });
    baseRef.current = defs;
  }, [base]);

  // ---------- fire markers ----------
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    markerById.current.clear();
    if (!layers.fires) return;
    const markers: L.CircleMarker[] = [];
    for (const fire of fires) {
      const color = statusColor(fire.status, highContrast);
      const m = L.circleMarker([fire.lat, fire.lon], {
        radius: markerRadius(fire.sizeHa),
        fillColor: color,
        fillOpacity: 0.85,
        color: fire.evacuation ? EVACUATION_COLOR : highContrast ? "#000" : "#ffffff",
        weight: fire.evacuation ? 4 : 1.5,
        opacity: 1,
        // custom option consumed by the cluster icon factory
        ...({ fireStatus: fire.status } as object),
      });
      m.bindTooltip(
        `<strong>${escapeHtml(fire.name)}</strong><br>` +
          `${STATUS_META[fire.status].label}${fire.evacuation ? " · EVACUATION ALERT" : ""}<br>` +
          `${formatArea(fire.sizeHa)} · updated ${relativeTime(fire.updated)}`,
        { direction: "top", opacity: 0.95 }
      );
      m.on("click", () => onSelectRef.current(fire.id));
      markerById.current.set(fire.id, m);
      markers.push(m);
    }
    cluster.addLayers(markers);
  }, [fires, layers.fires, highContrast]);

  // ---------- selection highlight ----------
  useEffect(() => {
    const markers = markerById.current;
    const selected = selectedId ? markers.get(selectedId) : undefined;
    const fire = selectedId ? fires.find((f) => f.id === selectedId) : undefined;
    selected?.setStyle({ weight: 4, color: "#2563eb" });
    return () => {
      if (selected && fire) {
        selected.setStyle({
          weight: fire.evacuation ? 4 : 1.5,
          color: fire.evacuation
            ? EVACUATION_COLOR
            : hcRef.current
              ? "#000"
              : "#ffffff",
        });
      }
    };
  }, [selectedId, fires]);

  // ---------- perimeters ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    perimUsRef.current?.remove();
    perimCaRef.current?.remove();
    perimUsRef.current = null;
    perimCaRef.current = null;
    if (!layers.perimeters) return;
    if (perimUs.data) {
      perimUsRef.current = L.geoJSON(perimUs.data, {
        style: {
          color: "#b91c1c",
          weight: 1.5,
          fillColor: "#ef4444",
          fillOpacity: 0.18,
        },
        onEachFeature: (f, l) => {
          const p = (f.properties ?? {}) as Record<string, unknown>;
          const name = (p.poly_IncidentName as string) ?? "Fire perimeter";
          const acres = typeof p.poly_GISAcres === "number" ? p.poly_GISAcres : null;
          l.bindTooltip(
            `<strong>${escapeHtml(String(name))}</strong><br>Mapped perimeter` +
              (acres !== null ? `<br>${formatArea(acres * 0.404686)}` : ""),
            { sticky: true }
          );
        },
      }).addTo(map);
    }
    if (perimCa.data) {
      perimCaRef.current = L.geoJSON(perimCa.data, {
        style: {
          color: "#c2410c",
          weight: 1.5,
          dashArray: "4 3",
          fillColor: "#f97316",
          fillOpacity: 0.15,
        },
        onEachFeature: (f, l) => {
          const p = (f.properties ?? {}) as Record<string, unknown>;
          const area = typeof p.area === "number" ? p.area : null;
          l.bindTooltip(
            `<strong>Estimated perimeter (CWFIS M3)</strong>` +
              (area !== null ? `<br>${formatArea(area)}` : ""),
            { sticky: true }
          );
        },
      }).addTo(map);
    }
  }, [layers.perimeters, perimUs.data, perimCa.data]);

  // ---------- hotspots ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    hotspotsRef.current?.remove();
    hotspotsRef.current = null;
    if (!layers.hotspots || !hotspots.data) return;
    const renderer = L.canvas({ padding: 0.3 });
    const grp = L.layerGroup();
    for (const h of hotspots.data.hotspots) {
      L.circleMarker([h.lat, h.lon], {
        renderer,
        radius: 3,
        stroke: false,
        fillColor: highContrast ? "#ff5a00" : "#f97316",
        fillOpacity: 0.65,
        interactive: false,
      }).addTo(grp);
    }
    grp.addTo(map);
    hotspotsRef.current = grp;
  }, [layers.hotspots, hotspots.data, highContrast]);

  // ---------- NWS alerts ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    alertsRef.current?.remove();
    alertsRef.current = null;
    if (!layers.alerts || !alerts.data) return;
    const styleFor = (event: string): L.PathOptions => {
      if (/evacuation/i.test(event))
        return { color: EVACUATION_COLOR, weight: 2.5, fillColor: EVACUATION_COLOR, fillOpacity: 0.25 };
      if (/fire warning/i.test(event))
        return { color: "#dc2626", weight: 2, fillColor: "#dc2626", fillOpacity: 0.18 };
      if (/red flag/i.test(event))
        return { color: "#ea580c", weight: 1.5, dashArray: "5 4", fillColor: "#ea580c", fillOpacity: 0.12 };
      if (/air quality/i.test(event))
        return { color: "#64748b", weight: 1.5, dashArray: "2 4", fillColor: "#94a3b8", fillOpacity: 0.12 };
      return { color: "#eab308", weight: 1.5, dashArray: "5 4", fillColor: "#eab308", fillOpacity: 0.1 };
    };
    alertsRef.current = L.geoJSON(
      {
        ...alerts.data,
        features: alerts.data.features.filter((f) => f.geometry),
      } as GeoJSON.FeatureCollection,
      {
        style: (f) => styleFor(String(f?.properties?.event ?? "")),
        onEachFeature: (f, l) => {
          const p = (f.properties ?? {}) as Record<string, unknown>;
          l.bindPopup(
            `<strong>${escapeHtml(String(p.event ?? "Alert"))}</strong><br>` +
              `${escapeHtml(String(p.headline ?? ""))}<br>` +
              `<em>${escapeHtml(String(p.areaDesc ?? ""))}</em>`,
            { maxWidth: 320 }
          );
        },
      }
    ).addTo(map);
  }, [layers.alerts, alerts.data]);

  // ---------- Canadian evacuation zones (provincial feeds) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    evacRef.current?.remove();
    evacRef.current = null;
    if (!layers.alerts || !evacZones.data) return;
    evacRef.current = L.geoJSON(evacZones.data, {
      style: (f) => {
        const isOrder = f?.properties?.status === "order";
        return {
          color: EVACUATION_COLOR,
          weight: isOrder ? 2.5 : 1.5,
          dashArray: isOrder ? undefined : "6 4",
          fillColor: EVACUATION_COLOR,
          fillOpacity: isOrder ? 0.28 : 0.12,
        };
      },
      onEachFeature: (f, l) => {
        const p = (f.properties ?? {}) as Record<string, unknown>;
        const isOrder = p.status === "order";
        l.bindPopup(
          `<strong>EVACUATION ${isOrder ? "ORDER" : "ALERT"}</strong><br>` +
            `${escapeHtml(String(p.name ?? ""))}<br>` +
            `${escapeHtml(String(p.agency ?? ""))}` +
            `<br><em>${escapeHtml(String(p.sourceLabel ?? ""))}${
              p.updated ? ` · updated ${escapeHtml(String(p.updated))}` : ""
            }</em>` +
            `<br>${isOrder ? "Leave the area now — follow local authority instructions." : "Be ready to leave on short notice."}`,
          { maxWidth: 300 }
        );
      },
    }).addTo(map);
  }, [layers.alerts, evacZones.data]);

  // ---------- highway cameras (511) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    camerasRef.current?.remove();
    camerasRef.current = null;
    if (!layers.cameras || !cameras.data) return;
    const grp = L.layerGroup();
    for (const c of cameras.data.cameras) {
      const m = L.marker([c.lat, c.lon], {
        icon: L.divIcon({
          html: `<div class="fw-camera-icon" aria-hidden="true">▣</div>`,
          className: "",
          iconSize: [18, 18],
        }),
        keyboard: false,
      });
      const links = c.views
        .slice(0, 4)
        .map(
          (v, i) =>
            `<a href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
              v.description || `View ${i + 1}`
            )}</a>`
        )
        .join(" · ");
      m.bindPopup(
        `<strong>${escapeHtml(c.name)}</strong><br>` +
          `${escapeHtml(c.road ?? "")} · ${escapeHtml(c.sourceLabel)}<br>` +
          `${escapeHtml(String(c.nearestFireKm))} km from ${escapeHtml(c.nearestFireName)} fire<br>` +
          links,
        { maxWidth: 300 }
      );
      m.bindTooltip(escapeHtml(c.name));
      m.addTo(grp);
    }
    grp.addTo(map);
    camerasRef.current = grp;
  }, [layers.cameras, cameras.data]);

  // ---------- fire-affected highways (derived) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    roadsRef.current?.remove();
    roadsRef.current = null;
    if (!layers.roads || !roads.data) return;
    const hc = highContrast;
    roadsRef.current = L.geoJSON(roads.data.segments as GeoJSON.FeatureCollection, {
      style: (f) => {
        const impacted = f?.properties?.level === "impacted";
        return impacted
          ? { color: hc ? "#ff2020" : "#dc2626", weight: 5, opacity: 0.9 }
          : { color: hc ? "#ff9d00" : "#d97706", weight: 4, opacity: 0.85, dashArray: "10 8" };
      },
      onEachFeature: (f, l) => {
        const p = (f.properties ?? {}) as Record<string, unknown>;
        const label = [p.ref, p.name].filter(Boolean).join(" — ");
        const impacted = p.level === "impacted";
        l.bindTooltip(
          `<strong>${escapeHtml(String(label || "Highway"))}</strong><br>` +
            (impacted
              ? "Crosses an active fire perimeter"
              : "Near an active fire — conditions may change") +
            `<br><em>Derived from OSM + fire perimeters, not an official closure</em>`,
          { sticky: true }
        );
      },
    }).addTo(map);
  }, [layers.roads, roads.data, highContrast]);

  // ---------- official road closures / events (511) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    closuresRef.current?.remove();
    closuresRef.current = null;
    if (!layers.closures || !closures.data) return;
    const grp = L.layerGroup();
    for (const c of closures.data.closures) {
      const m = L.marker([c.lat, c.lon], {
        icon: L.divIcon({
          html: `<div class="fw-closure-icon${c.fullClosure ? " fw-closure-full" : ""}" aria-hidden="true">!</div>`,
          className: "",
          iconSize: [18, 18],
        }),
        keyboard: false,
      });
      m.bindPopup(
        `<strong>${escapeHtml(c.road ?? "Road event")}</strong>` +
          (c.fullClosure ? ' · <span style="color:#dc2626;font-weight:700">CLOSED</span>' : "") +
          `<br>${escapeHtml(c.description.slice(0, 280))}` +
          `<br><em>${escapeHtml(c.sourceLabel)}${
            c.nearestFireName ? ` · ${escapeHtml(String(c.nearestFireKm))} km from ${escapeHtml(c.nearestFireName)} fire` : ""
          }</em>`,
        { maxWidth: 320 }
      );
      m.bindTooltip(escapeHtml(`${c.road ?? "Road event"}${c.fullClosure ? " (closed)" : ""}`));
      m.addTo(grp);
    }
    grp.addTo(map);
    closuresRef.current = grp;
  }, [layers.closures, closures.data]);

  // ---------- radar ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    radarRef.current?.remove();
    radarRef.current = null;
    if (!layers.radar || !radar.data) return;
    radarRef.current = L.tileLayer(
      `${radar.data.host}${radar.data.path}/256/{z}/{x}/{y}/2/1_1.png`,
      {
        opacity: 0.6,
        maxZoom: 19,
        // RainViewer serves radar tiles up to z8; upscale beyond that.
        maxNativeZoom: 8,
        attribution: 'Radar &copy; <a href="https://www.rainviewer.com/">RainViewer</a>',
      }
    ).addTo(map);
  }, [layers.radar, radar.data]);

  // ---------- optional key-gated tile layers (proxied) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const defs: [keyof typeof owmRefs.current, boolean, string, string][] = [
      ["wind", layers.wind, "/api/owm/wind_new/{z}/{x}/{y}", "Wind &copy; OpenWeatherMap"],
      ["temp", layers.temp, "/api/owm/temp_new/{z}/{x}/{y}", "Temp &copy; OpenWeatherMap"],
      ["precip", layers.precip, "/api/owm/precipitation_new/{z}/{x}/{y}", "Precip &copy; OpenWeatherMap"],
      ["aqi", layers.aqi, "/api/waqi/{z}/{x}/{y}", 'AQI &copy; <a href="https://waqi.info/">WAQI</a> / EPA'],
    ];
    for (const [key, on, url, attr] of defs) {
      const existing = owmRefs.current[key];
      if (!on && existing) {
        existing.remove();
        delete owmRefs.current[key];
      } else if (on && !existing) {
        owmRefs.current[key] = L.tileLayer(url, {
          opacity: 0.65,
          maxZoom: 12,
          attribution: attr,
        }).addTo(map);
      }
    }
  }, [layers.wind, layers.temp, layers.precip, layers.aqi]);

  // ---------- smoke + stations layer toggles ----------
  useEffect(() => {
    if (layers.smoke) {
      smokeRefresh.current();
    } else {
      smokeRef.current?.remove();
      smokeRef.current = null;
    }
  }, [layers.smoke]);

  useEffect(() => {
    const map = mapRef.current;
    if (layers.stations) {
      if (map && map.getZoom() < 10) {
        onNoticeRef.current("Fire stations load when zoomed in (zoom 10+).");
      }
      stationsRefresh.current();
    } else {
      stationsRef.current?.remove();
      stationsRef.current = null;
    }
  }, [layers.stations]);

  // ---------- fly-to (search / list selection / locate) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo([flyTo.lat, flyTo.lon], flyTo.zoom ?? Math.max(map.getZoom(), 9), {
      duration: 0.8,
    });
    searchPinRef.current?.remove();
    searchPinRef.current = null;
    if (flyTo.label) {
      searchPinRef.current = L.marker([flyTo.lat, flyTo.lon], {
        icon: L.divIcon({ className: "fw-search-pin", iconSize: [16, 16] }),
      })
        .bindTooltip(escapeHtml(flyTo.label))
        .addTo(map);
    }
  }, [flyTo]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="application"
      aria-label="Interactive wildfire map of North America. Use the fire list panel for a screen-reader-friendly alternative."
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
