"use client";

import { useMemo, useState } from "react";
import type { Fire } from "@/lib/types";
import { formatArea, relativeTime } from "@/lib/format";
import StatusBadge from "./StatusBadge";

type SortKey = "size" | "updated" | "name";
const PAGE = 120;

export default function FireList({
  fires,
  selectedId,
  onSelect,
}: {
  fires: Fire[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>("size");
  const [text, setText] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const shown = useMemo(() => {
    let list = fires;
    const q = text.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.admin.toLowerCase().includes(q) ||
          (f.agency ?? "").toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    if (sort === "size") sorted.sort((a, b) => (b.sizeHa ?? -1) - (a.sizeHa ?? -1));
    else if (sort === "updated")
      sorted.sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""));
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return { total: sorted.length, page: sorted.slice(0, limit) };
  }, [fires, sort, text, limit]);

  return (
    <div className="flex h-full flex-col" id="fire-list">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
        <label className="sr-only" htmlFor="fire-search">
          Search fires by name, region or agency
        </label>
        <input
          id="fire-search"
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="Filter list…"
          className="min-w-0 flex-1 rounded-md border border-line bg-panel px-2 py-1.5 text-sm"
        />
        <label className="sr-only" htmlFor="fire-sort">
          Sort fires
        </label>
        <select
          id="fire-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm"
        >
          <option value="size">Largest first</option>
          <option value="updated">Recently updated</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
      <p className="px-3 pt-2 text-xs text-ink-dim" role="status">
        {shown.total} fires match current filters
        {shown.total > shown.page.length ? ` · showing first ${shown.page.length}` : ""}
      </p>
      <ul className="fw-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {shown.page.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onSelect(f.id)}
              aria-pressed={f.id === selectedId}
              className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel-2 focus-visible:bg-panel-2 ${
                f.id === selectedId ? "bg-panel-2 ring-1 ring-line" : ""
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{f.name}</span>
                <StatusBadge status={f.status} evacuation={f.evacuation} />
              </span>
              <span className="mt-0.5 block text-xs text-ink-dim">
                {f.admin} · {formatArea(f.sizeHa)} · updated {relativeTime(f.updated)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {shown.total > shown.page.length && (
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm font-medium hover:bg-panel-2"
          >
            Show more ({shown.total - shown.page.length} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
