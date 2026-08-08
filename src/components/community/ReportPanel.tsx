"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { relativeTime } from "@/lib/format";

export interface CommunityReport {
  id: number;
  kind: "smoke" | "fire" | "note";
  body: string;
  lat: number;
  lon: number;
  photoUrl: string | null;
  username: string;
  createdAt: number;
  commentCount: number;
}

const KIND_LABEL: Record<CommunityReport["kind"], string> = {
  smoke: "💨 Smoke sighting",
  fire: "🔥 Fire sighting",
  note: "💬 Local note",
};

export default function ReportPanel({
  report,
  currentUser,
  onClose,
  onNotice,
}: {
  report: CommunityReport;
  currentUser: { username: string; role: string } | null;
  onClose: () => void;
  onNotice: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [report.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const comments = useQuery({
    queryKey: ["report-comments", report.id],
    queryFn: async () => {
      const res = await fetch(`/api/reports/${report.id}/comments`);
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as {
        comments: { id: number; username: string; body: string; createdAt: number }[];
      };
    },
    staleTime: 30_000,
  });

  const act = async (path: string, method: string, body?: unknown) => {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onNotice(data.error ?? "That didn't work — try again");
        return false;
      }
      return true;
    } catch {
      onNotice("Network error — try again");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    if (await act(`/api/reports/${report.id}/comments`, "POST", { body: comment.trim() })) {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["report-comments", report.id] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  };

  const flag = async () => {
    if (await act(`/api/reports/${report.id}/flag`, "POST")) {
      onNotice("Flagged for review — thank you.");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  };

  const remove = async () => {
    if (await act(`/api/reports/${report.id}`, "DELETE")) {
      onNotice("Report removed.");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      onClose();
    }
  };

  const canRemove =
    currentUser &&
    (currentUser.username === report.username || currentUser.role === "admin");

  return (
    <aside
      aria-label="Community report details"
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-[1100] flex max-h-[70%] flex-col rounded-t-xl border border-line bg-panel shadow-2xl md:inset-x-auto md:right-3 md:top-3 md:bottom-3 md:max-h-none md:w-96 md:rounded-xl"
    >
      <header className="flex items-start justify-between gap-2 border-b border-line p-3">
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-base font-bold outline-none">
            {KIND_LABEL[report.kind]}
          </h2>
          <p className="text-xs text-ink-dim">
            by {report.username} · {relativeTime(new Date(report.createdAt).toISOString())}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close report panel"
          className="rounded-md border border-line px-2 py-1 text-sm hover:bg-panel-2"
        >
          ✕
        </button>
      </header>

      <div className="fw-scroll min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-2 rounded-lg border border-line bg-panel-2 p-2 text-xs text-ink-dim">
          Unverified community report — not confirmed by any agency. If you
          see an emergency, call 911.
        </p>

        <p className="whitespace-pre-wrap text-sm">{report.body}</p>

        {report.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- user upload served by our own API; next/image adds nothing here
          <img
            src={report.photoUrl}
            alt={`Photo attached to this ${report.kind} report`}
            className="mt-2 max-h-72 w-full rounded-lg border border-line object-contain"
            loading="lazy"
          />
        )}

        <section aria-label="Discussion" className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Discussion
          </h3>
          {comments.isLoading ? (
            <p className="mt-1 text-sm text-ink-dim" role="status">Loading comments…</p>
          ) : (comments.data?.comments.length ?? 0) === 0 ? (
            <p className="mt-1 text-sm text-ink-dim">No comments yet.</p>
          ) : (
            <ul className="mt-1 space-y-2">
              {comments.data!.comments.map((c) => (
                <li key={c.id} className="rounded-lg border border-line bg-panel-2 p-2 text-sm">
                  <p className="whitespace-pre-wrap">{c.body}</p>
                  <p className="mt-1 text-[11px] text-ink-dim">
                    {c.username} · {relativeTime(new Date(c.createdAt).toISOString())}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {currentUser ? (
            <form onSubmit={submitComment} className="mt-2 flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Add a comment</span>
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={500}
                  placeholder="Add a comment…"
                  className="w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm"
                />
              </label>
              <button
                type="submit"
                disabled={busy || !comment.trim()}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Post
              </button>
            </form>
          ) : (
            <p className="mt-2 text-xs text-ink-dim">Sign in to join the discussion.</p>
          )}
        </section>
      </div>

      <footer className="flex gap-2 border-t border-line p-3">
        {currentUser && (
          <button
            type="button"
            onClick={flag}
            disabled={busy}
            className="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-panel-2 disabled:opacity-50"
          >
            ⚑ Flag as inaccurate
          </button>
        )}
        {canRemove && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="flex-1 rounded-lg border border-red-700 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-600/10 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </footer>
    </aside>
  );
}
