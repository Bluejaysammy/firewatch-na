"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AirQuality,
  AppConfig,
  ClosuresResponse,
  FireStats,
  FiresResponse,
  RoadsResponse,
  SpotWeather,
} from "@/lib/types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

/**
 * Offline resilience: the last successful fire snapshot is persisted to
 * localStorage and used as placeholder data, so a reload without a network
 * connection (or a slow cold start) still shows the most recent picture
 * while the real fetch proceeds. The header's "updated" timestamp and the
 * offline banner make the data's age visible.
 */
const FIRES_SNAPSHOT_KEY = "fw-fires-snapshot";

function readFiresSnapshot(): FiresResponse | undefined {
  try {
    const raw = localStorage.getItem(FIRES_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as FiresResponse) : undefined;
  } catch {
    return undefined; // SSR, disabled storage, or corrupted JSON
  }
}

export function useFires(refetchIntervalMs: number) {
  return useQuery<FiresResponse & { stale?: boolean }>({
    queryKey: ["fires"],
    queryFn: async () => {
      const data = await getJson<FiresResponse & { stale?: boolean }>("/api/fires");
      try {
        localStorage.setItem(FIRES_SNAPSHOT_KEY, JSON.stringify(data));
      } catch {
        /* storage full or unavailable — persistence is best-effort */
      }
      return data;
    },
    placeholderData: readFiresSnapshot,
    refetchInterval: refetchIntervalMs,
    staleTime: 30_000,
    retry: 2,
  });
}

export function useStats(refetchIntervalMs: number) {
  return useQuery<FireStats>({
    queryKey: ["stats"],
    queryFn: () => getJson("/api/stats"),
    refetchInterval: refetchIntervalMs,
    staleTime: 30_000,
  });
}

export function useRoads() {
  return useQuery<RoadsResponse>({
    queryKey: ["roads"],
    queryFn: () => getJson("/api/roads"),
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
    // First computation can take ~30 s (Overpass); don't hammer on failure.
    retry: 1,
  });
}

export function useClosures() {
  return useQuery<ClosuresResponse>({
    queryKey: ["closures"],
    queryFn: () => getJson("/api/closures"),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useConfig() {
  return useQuery<AppConfig>({
    queryKey: ["config"],
    queryFn: () => getJson("/api/config"),
    staleTime: Infinity,
  });
}

export function useAirQuality(lat: number | null, lon: number | null) {
  return useQuery<AirQuality>({
    queryKey: ["air", lat?.toFixed(2), lon?.toFixed(2)],
    queryFn: () => getJson(`/api/air?lat=${lat}&lon=${lon}`),
    enabled: lat !== null && lon !== null,
    staleTime: 10 * 60_000,
  });
}

export function useSpotWeather(lat: number | null, lon: number | null) {
  return useQuery<SpotWeather>({
    queryKey: ["wx", lat?.toFixed(2), lon?.toFixed(2)],
    queryFn: () => getJson(`/api/weather?lat=${lat}&lon=${lon}`),
    enabled: lat !== null && lon !== null,
    staleTime: 10 * 60_000,
  });
}

/**
 * Live updates: listen to the server's SSE stream and refetch fire data the
 * moment the server-side cache refreshes. Falls back silently to polling if
 * EventSource is unavailable or the connection drops (EventSource
 * auto-reconnects).
 */
export function useLiveUpdates() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/api/stream");
    const onFires = () => {
      queryClient.invalidateQueries({ queryKey: ["fires"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    };
    es.addEventListener("fires", onFires);
    return () => {
      es.removeEventListener("fires", onFires);
      es.close();
    };
  }, [queryClient]);
}
