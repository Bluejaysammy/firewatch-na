import type { Country, Fire, FireStatus } from "./types";

export interface FireFilters {
  countries: Country[];
  admins: string[];
  statuses: FireStatus[];
  minSizeHa: number;
  containMin: number;
  containMax: number;
  /** 0 = any time; otherwise "discovered in the last N days". */
  discoveredDays: number;
  agencies: string[];
  evacOnly: boolean;
}

export const DEFAULT_FILTERS: FireFilters = {
  countries: [],
  admins: [],
  statuses: [],
  minSizeHa: 0,
  containMin: 0,
  containMax: 100,
  discoveredDays: 0,
  agencies: [],
  evacOnly: false,
};

export function isDefaultFilters(f: FireFilters): boolean {
  return (
    f.countries.length === 0 &&
    f.admins.length === 0 &&
    f.statuses.length === 0 &&
    f.minSizeHa === 0 &&
    f.containMin === 0 &&
    f.containMax === 100 &&
    f.discoveredDays === 0 &&
    f.agencies.length === 0 &&
    !f.evacOnly
  );
}

export function filterFires(fires: Fire[], f: FireFilters, now = Date.now()): Fire[] {
  const countries = f.countries.length ? new Set(f.countries) : null;
  const admins = f.admins.length ? new Set(f.admins) : null;
  const statuses = f.statuses.length ? new Set(f.statuses) : null;
  const agencies = f.agencies.length ? new Set(f.agencies) : null;
  const containmentNarrowed = f.containMin > 0 || f.containMax < 100;
  const sinceMs = f.discoveredDays > 0 ? now - f.discoveredDays * 86_400_000 : null;

  return fires.filter((fire) => {
    if (countries && !countries.has(fire.country)) return false;
    if (admins && !admins.has(fire.admin)) return false;
    if (statuses && !statuses.has(fire.status)) return false;
    if (agencies && !agencies.has(fire.agency ?? "")) return false;
    if (f.minSizeHa > 0 && (fire.sizeHa ?? 0) < f.minSizeHa) return false;
    if (containmentNarrowed) {
      if (fire.containment === null) return false;
      if (fire.containment < f.containMin || fire.containment > f.containMax) return false;
    }
    if (sinceMs !== null) {
      if (!fire.discovered) return false;
      if (new Date(fire.discovered).getTime() < sinceMs) return false;
    }
    if (f.evacOnly && !fire.evacuation) return false;
    return true;
  });
}
