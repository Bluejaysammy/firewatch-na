"use client";

import { useMemo } from "react";
import type { Fire, Country, FireStatus } from "@/lib/types";
import { COUNTRY_LABELS } from "@/lib/types";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import {
  DEFAULT_FILTERS,
  isDefaultFilters,
  type FireFilters,
} from "@/lib/filterFires";

function CheckGroup<T extends string>({
  legend,
  options,
  selected,
  onChange,
}: {
  legend: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <fieldset className="rounded-lg border border-line p-2">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
        {legend}
      </legend>
      <div className="fw-scroll max-h-40 space-y-1 overflow-y-auto">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              aria-label={o.label}
              checked={selected.includes(o.value)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, o.value]
                    : selected.filter((v) => v !== o.value)
                )
              }
            />
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function FiltersPanel({
  fires,
  filters,
  onChange,
}: {
  fires: Fire[];
  filters: FireFilters;
  onChange: (f: FireFilters) => void;
}) {
  const adminOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of fires) {
      if (filters.countries.length === 0 || filters.countries.includes(f.country)) {
        set.add(f.admin);
      }
    }
    return [...set].sort().map((a) => ({ value: a, label: a }));
  }, [fires, filters.countries]);

  const agencyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of fires) if (f.agency) set.add(f.agency);
    return [...set].sort().map((a) => ({ value: a, label: a }));
  }, [fires]);

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        <button
          type="button"
          disabled={isDefaultFilters(filters)}
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel-2 disabled:opacity-40"
        >
          Reset all
        </button>
      </div>

      <CheckGroup<Country>
        legend="Country"
        options={(Object.keys(COUNTRY_LABELS) as Country[]).map((c) => ({
          value: c,
          label: COUNTRY_LABELS[c],
        }))}
        selected={filters.countries}
        onChange={(countries) => onChange({ ...filters, countries, admins: [] })}
      />

      <CheckGroup
        legend="Province / State"
        options={adminOptions}
        selected={filters.admins}
        onChange={(admins) => onChange({ ...filters, admins })}
      />

      <CheckGroup<FireStatus>
        legend="Fire status"
        options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label }))}
        selected={filters.statuses}
        onChange={(statuses) => onChange({ ...filters, statuses })}
      />

      <CheckGroup
        legend="Agency"
        options={agencyOptions}
        selected={filters.agencies}
        onChange={(agencies) => onChange({ ...filters, agencies })}
      />

      <div className="rounded-lg border border-line p-2">
        <label htmlFor="min-size" className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Minimum size: {filters.minSizeHa > 0 ? `${filters.minSizeHa.toLocaleString()} ha` : "any"}
        </label>
        <input
          id="min-size"
          type="range"
          min={0}
          max={5}
          step={1}
          value={[0, 10, 100, 1000, 10000, 100000].indexOf(filters.minSizeHa)}
          onChange={(e) =>
            onChange({
              ...filters,
              minSizeHa: [0, 10, 100, 1000, 10000, 100000][Number(e.target.value)],
            })
          }
          className="mt-1 w-full"
          aria-valuetext={filters.minSizeHa > 0 ? `${filters.minSizeHa} hectares` : "any size"}
        />
        <div className="flex justify-between text-[10px] text-ink-dim">
          <span>any</span><span>10</span><span>100</span><span>1k</span><span>10k</span><span>100k ha</span>
        </div>
      </div>

      <div className="rounded-lg border border-line p-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Containment %
        </span>
        <div className="mt-1 flex items-center gap-2 text-sm">
          <label className="sr-only" htmlFor="contain-min">Minimum containment</label>
          <input
            id="contain-min"
            type="number"
            min={0}
            max={100}
            value={filters.containMin}
            onChange={(e) =>
              onChange({ ...filters, containMin: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
            }
            className="w-16 rounded-md border border-line bg-panel px-2 py-1"
          />
          <span aria-hidden="true">–</span>
          <label className="sr-only" htmlFor="contain-max">Maximum containment</label>
          <input
            id="contain-max"
            type="number"
            min={0}
            max={100}
            value={filters.containMax}
            onChange={(e) =>
              onChange({ ...filters, containMax: Math.max(0, Math.min(100, Number(e.target.value) || 100)) })
            }
            className="w-16 rounded-md border border-line bg-panel px-2 py-1"
          />
          <span className="text-xs text-ink-dim">%</span>
        </div>
        {(filters.containMin > 0 || filters.containMax < 100) && (
          <p className="mt-1 text-[11px] text-ink-dim">
            Fires without a reported containment % are hidden while this is narrowed.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-line p-2">
        <label htmlFor="discovered" className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Discovered
        </label>
        <select
          id="discovered"
          value={filters.discoveredDays}
          onChange={(e) => onChange({ ...filters, discoveredDays: Number(e.target.value) })}
          className="mt-1 w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm"
        >
          <option value={0}>Any time</option>
          <option value={1}>Last 24 hours</option>
          <option value={3}>Last 3 days</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-line p-2 text-sm">
        <input
          type="checkbox"
          checked={filters.evacOnly}
          onChange={(e) => onChange({ ...filters, evacOnly: e.target.checked })}
        />
        Only fires with evacuation alerts
      </label>
    </div>
  );
}
