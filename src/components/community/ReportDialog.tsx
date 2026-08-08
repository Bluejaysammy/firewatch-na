"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function ReportDialog({
  center,
  onClose,
  onPosted,
}: {
  /** Prefilled location: current map centre. */
  center: { lat: number; lon: number };
  onClose: () => void;
  onPosted: (msg: string) => void;
}) {
  const [kind, setKind] = useState<"smoke" | "fire" | "note">("smoke");
  const [body, setBody] = useState("");
  const [lat, setLat] = useState(center.lat.toFixed(4));
  const [lon, setLon] = useState(center.lon.toFixed(4));
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const firstField = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(4));
        setLon(pos.coords.longitude.toFixed(4));
      },
      () => setError("Could not read your location — enter coordinates or pan the map first")
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("body", body.trim());
      form.set("lat", lat);
      form.set("lon", lon);
      if (photo) form.set("photo", photo);
      const res = await fetch("/api/reports", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not post the report");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      onPosted("Report posted — thank you. It is publicly visible and labelled as unverified.");
      onClose();
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1500] grid place-items-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Report fire activity"
        className="fw-scroll max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-line bg-panel p-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Report fire activity</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-line px-2 py-1 text-sm hover:bg-panel-2"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 rounded-lg border border-amber-600 bg-amber-500/10 p-2 text-xs leading-snug">
          <strong>If this is an emergency, call 911 first.</strong> Community
          reports inform other map users — they do not notify fire services.
        </p>

        <form onSubmit={submit} className="mt-3 space-y-3">
          <label className="block text-sm">
            <span className="text-ink-dim">What are you seeing?</span>
            <select
              ref={firstField}
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="mt-1 w-full rounded-md border border-line bg-panel px-2 py-1.5"
            >
              <option value="smoke">Smoke</option>
              <option value="fire">Flames / new fire</option>
              <option value="note">Local conditions / note</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-ink-dim">Describe it (what, where, how big)</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={3}
              maxLength={1000}
              rows={3}
              placeholder="e.g. Grey smoke column NE of the lake, visible from Hwy 97 near Peachland"
              className="mt-1 w-full rounded-md border border-line bg-panel px-2 py-1.5"
            />
          </label>

          <fieldset className="rounded-lg border border-line p-2">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
              Location of what you&apos;re reporting
            </legend>
            <div className="flex items-center gap-2 text-sm">
              <label className="flex-1">
                <span className="sr-only">Latitude</span>
                <input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  inputMode="decimal"
                  aria-label="Latitude"
                  className="w-full rounded-md border border-line bg-panel px-2 py-1.5"
                />
              </label>
              <label className="flex-1">
                <span className="sr-only">Longitude</span>
                <input
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  inputMode="decimal"
                  aria-label="Longitude"
                  className="w-full rounded-md border border-line bg-panel px-2 py-1.5"
                />
              </label>
              <button
                type="button"
                onClick={useMyLocation}
                className="rounded-md border border-line px-2 py-1.5 text-xs font-medium hover:bg-panel-2"
              >
                📍 Use mine
              </button>
            </div>
            <p className="mt-1 text-[11px] text-ink-dim">
              Pre-filled with the map centre — pan the map to the spot before
              opening this form, or use your device location.
            </p>
          </fieldset>

          <label className="block text-sm">
            <span className="text-ink-dim">Photo (optional, max 6 MB)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />
            <span className="mt-0.5 block text-[11px] text-ink-dim">
              Photos are re-processed on upload, which removes hidden location
              (GPS) metadata for your privacy.
            </span>
          </label>

          {error && (
            <p role="alert" className="rounded-md border border-red-700 bg-red-600/10 px-2 py-1.5 text-sm">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Posting…" : "Post public report"}
          </button>
        </form>
      </div>
    </div>
  );
}
