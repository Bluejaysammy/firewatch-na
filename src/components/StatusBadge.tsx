"use client";

import { STATUS_META, EVACUATION_COLOR } from "@/lib/status";
import { useTheme } from "@/components/Providers";
import type { FireStatus } from "@/lib/types";

export default function StatusBadge({
  status,
  evacuation = false,
}: {
  status: FireStatus;
  evacuation?: boolean;
}) {
  const { highContrast } = useTheme();
  const meta = STATUS_META[status];
  const color = highContrast ? meta.colorHC : meta.color;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-2 py-0.5 text-xs font-medium">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        {meta.label}
      </span>
      {evacuation && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: EVACUATION_COLOR }}
        >
          ⚠ Evacuation alert
        </span>
      )}
    </span>
  );
}
