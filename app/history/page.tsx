"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import { authHeaders } from "../lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type P = {
  id: string;
  source_url: string;
  status: string;
  tone: string;
  language: string;
  created_at: string | null;
  title: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  done: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/30 bg-red-500/10 text-red-300",
  queued: "border-slate-600 bg-slate-700/50 text-slate-300",
  downloading: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  transcribing: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  generating: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

export default function HistoryPage() {
  const [projects, setProjects] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/projects`, {
        headers: authHeaders(),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch {
      setMsg("Backend not connected.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const del = async (id: string) => {
    if (!confirm("Delete this project from history?")) return;
    await fetch(`${API}/api/v1/projects/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    load();
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <Sidebar active="history" />
      <div className="relative lg:pl-72">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_500px_at_50%_-120px,rgba(99,102,241,0.15),transparent)]" />
        <div className="relative mx-auto max-w-5xl space-y-6 px-6 py-10">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-100 md:text-3xl">
              🗂️ Project History
            </h1>
            <button
              onClick={load}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              ⭮ Refresh
            </button>
          </div>

          {msg && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              ❌ {msg}
            </div>
          )}

          {loading ? (
            <div className="animate-pulse rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-indigo-300">
              ⏳ Loading history...
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-10 text-center text-slate-400">
              No history yet.{" "}
              <Link
                href="/dashboard"
                className="font-semibold text-indigo-300 hover:underline"
              >
                Generate your first content!
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:-translate-y-0.5 hover:border-indigo-500/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">
                      {p.title ?? p.source_url ?? p.id}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleString("en-US")
                        : ""}{" "}
                      • tone: {p.tone} • lang: {p.language}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status] ?? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"}`}
                    >
                      {p.status}
                    </span>
                    {p.status === "done" && (
                      <Link
                        href={`/dashboard?pid=${p.id}`}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
                      >
                        Open
                      </Link>
                    )}
                    <button
                      onClick={() => del(p.id)}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
