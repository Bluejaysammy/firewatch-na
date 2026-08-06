import type { FireStatus } from "./types";

export interface StatusMeta {
  label: string;
  /** Marker/legend colour. */
  color: string;
  /** High-contrast variant. */
  colorHC: string;
  /** Sort order: most severe first. */
  rank: number;
  description: string;
}

/**
 * Colour scheme required by the product spec:
 * green=contained, yellow=under control, orange=active, red=out of control,
 * purple=evacuation order (overlay ring), blue=information only.
 */
export const STATUS_META: Record<FireStatus, StatusMeta> = {
  out_of_control: {
    label: "Out of control",
    color: "#dc2626",
    colorHC: "#ff2020",
    rank: 0,
    description: "Fire is not responding to suppression, or containment is below 30%.",
  },
  active: {
    label: "Active",
    color: "#ea580c",
    colorHC: "#ff7a00",
    rank: 1,
    description: "Fire is being actively suppressed (30–69% contained in the US).",
  },
  being_held: {
    label: "Being held",
    color: "#eab308",
    colorHC: "#ffd500",
    rank: 2,
    description: "Not expected to spread under current conditions (Canada).",
  },
  under_control: {
    label: "Under control",
    color: "#facc15",
    colorHC: "#ffe655",
    rank: 3,
    description: "Fire will not spread further (70–99% contained in the US).",
  },
  contained: {
    label: "Contained / out",
    color: "#16a34a",
    colorHC: "#00c853",
    rank: 4,
    description: "Fully contained, extinguished, or being patrolled.",
  },
  prescribed: {
    label: "Prescribed burn",
    color: "#2563eb",
    colorHC: "#2b7bff",
    rank: 5,
    description: "Planned, intentionally set fire (information only).",
  },
  info: {
    label: "Satellite detection",
    color: "#3b82f6",
    colorHC: "#4d94ff",
    rank: 6,
    description: "Thermal anomaly detected from satellite; not a confirmed incident.",
  },
};

export const EVACUATION_COLOR = "#9333ea";
export const EVACUATION_COLOR_HC = "#c24dff";

export const STATUS_ORDER: FireStatus[] = (
  Object.keys(STATUS_META) as FireStatus[]
).sort((a, b) => STATUS_META[a].rank - STATUS_META[b].rank);

/** CWFIS stage_of_control_status codes -> unified status. */
export function statusFromCwfis(stage: string | null | undefined, prescribed: boolean): FireStatus {
  if (prescribed) return "prescribed";
  switch ((stage ?? "").trim().toUpperCase()) {
    case "OC":
      return "out_of_control";
    case "BH":
      return "being_held";
    case "UC":
      return "under_control";
    case "EX":
    case "OUT":
    case "UEX":
      return "contained";
    default:
      return "active";
  }
}

/**
 * WFIGS (US) does not publish a stage of control; derive one from percent
 * containment. Thresholds are documented in the legend.
 */
export function statusFromWfigs(
  incidentTypeCategory: string | null | undefined,
  percentContained: number | null | undefined,
  fireOut: boolean
): FireStatus {
  if (incidentTypeCategory === "RX") return "prescribed";
  if (fireOut) return "contained";
  const pct = typeof percentContained === "number" ? percentContained : null;
  if (pct === null) return "active";
  if (pct >= 100) return "contained";
  if (pct >= 70) return "under_control";
  if (pct >= 30) return "active";
  return "out_of_control";
}

export function statusColor(status: FireStatus, highContrast = false): string {
  const m = STATUS_META[status];
  return highContrast ? m.colorHC : m.color;
}
