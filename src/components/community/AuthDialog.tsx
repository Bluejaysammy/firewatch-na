"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";

export default function AuthDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong — try again");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["me"] });
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
        aria-label={mode === "login" ? "Sign in" : "Create account"}
        className="w-full max-w-sm rounded-xl border border-line bg-panel p-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">
            {mode === "login" ? "Sign in" : "Create account"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-line px-2 py-1 text-sm hover:bg-panel-2"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="mt-3 space-y-3">
          <label className="block text-sm">
            <span className="text-ink-dim">Username</span>
            <input
              ref={firstField}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9_\-]{3,24}"
              title="3–24 characters: letters, numbers, - or _"
              className="mt-1 w-full rounded-md border border-line bg-panel px-2 py-1.5"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-dim">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              maxLength={128}
              className="mt-1 w-full rounded-md border border-line bg-panel px-2 py-1.5"
            />
          </label>

          {mode === "register" && (
            <p className="text-xs text-ink-dim">
              No email is collected, so there is no password reset — keep your
              password safe. By creating an account you agree to the{" "}
              <Link href="/terms" className="underline" target="_blank">
                terms
              </Link>{" "}
              and{" "}
              <Link href="/safety" className="underline" target="_blank">
                community guidelines
              </Link>
              .
            </p>
          )}
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
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
          className="mt-3 w-full text-center text-sm text-ink-dim underline hover:text-ink"
        >
          {mode === "login" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
