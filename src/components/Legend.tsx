"use client";

import { useState } from "react";
import { STATUS_ORDER, STATUS_META, EVACUATION_COLOR } from "@/lib/status";
import { useTheme } from "@/components/Providers";

export default function Legend() {
  const { highContrast } = useTheme();
  const [open, setOpen] = useState(true);

  return (
    <div className="pointer-events-auto absolute bottom-6 right-2 z-[1000] max-w-[240px] rounded-lg border border-line bg-panel/95 text-ink shadow-lg backdrop-blur">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-semibold"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Legend
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <dl className="space-y-1.5 px-3 pb-3 text-xs">
          {STATUS_ORDER.map((s) => {
            const m = STATUS_META[s];
            return (
              <div key={s} className="flex items-start gap-2" title={m.description}>
                <dt className="mt-0.5">
                  <span
                    aria-hidden="true"
                    className="block h-3 w-3 rounded-full border border-white/60"
                    style={{ backgroundColor: highContrast ? m.colorHC : m.color }}
                  />
                  <span className="sr-only">{m.label}:</span>
                </dt>
                <dd className="text-ink-dim">{m.label}</dd>
              </div>
            );
          })}
          <div className="flex items-start gap-2">
            <dt className="mt-0.5">
              <span
                aria-hidden="true"
                className="block h-3 w-3 rounded-full bg-transparent"
                style={{ border: `3px solid ${EVACUATION_COLOR}` }}
              />
              <span className="sr-only">Purple ring:</span>
            </dt>
            <dd className="text-ink-dim">Evacuation alert (ring)</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="mt-1">
              <span
                aria-hidden="true"
                className="block h-2 w-4 rounded-sm"
                style={{ background: "rgba(239,68,68,.35)", border: "1px solid #b91c1c" }}
              />
              <span className="sr-only">Shaded polygon:</span>
            </dt>
            <dd className="text-ink-dim">Fire perimeter (dashed = satellite estimate)</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="mt-0.5">
              <span
                aria-hidden="true"
                className="block h-2 w-2 translate-x-0.5 rounded-full"
                style={{ backgroundColor: "#f97316", opacity: 0.7 }}
              />
              <span className="sr-only">Small orange dot:</span>
            </dt>
            <dd className="text-ink-dim">Satellite hotspot (24 h)</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="mt-1.5">
              <span
                aria-hidden="true"
                className="block h-1 w-4 rounded-full"
                style={{ backgroundColor: "#dc2626" }}
              />
              <span className="sr-only">Solid red line:</span>
            </dt>
            <dd className="text-ink-dim">Highway impacted (crosses perimeter)</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="mt-1.5">
              <span
                aria-hidden="true"
                className="block h-1 w-4"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg, #d97706 0 4px, transparent 4px 7px)",
                }}
              />
              <span className="sr-only">Dashed amber line:</span>
            </dt>
            <dd className="text-ink-dim">Highway at risk (near active fire)</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="mt-0.5">
              <span aria-hidden="true" className="fw-closure-icon !static">!</span>
              <span className="sr-only">Exclamation icon:</span>
            </dt>
            <dd className="text-ink-dim">Official road event (511)</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="mt-1">
              <span
                aria-hidden="true"
                className="block h-2 w-4 rounded-sm"
                style={{ background: "rgba(147,51,234,.3)", border: "1.5px solid #9333ea" }}
              />
              <span className="sr-only">Purple polygon:</span>
            </dt>
            <dd className="text-ink-dim">Evacuation zone (solid = order, dashed = alert)</dd>
          </div>
          <p className="border-t border-line pt-1.5 text-[11px] leading-snug text-ink-dim">
            Marker size reflects reported fire size. US status is derived from
            containment %; Canadian status is reported by agencies.
          </p>
        </dl>
      )}
    </div>
  );
}
