"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import { authHeaders } from "../lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const CONTENT_TYPES = [
  { key: "all", label: "📚 All Content" },
  { key: "instagram", label: "📸 Instagram" },
  { key: "tiktok", label: "🎵 TikTok" },
  { key: "youtube", label: "▶️ YouTube" },
  { key: "twitter", label: "🐦 Twitter/X" },
  { key: "blog", label: "✍️ Blog" },
  { key: "scripts", label: "🎬 Scripts" },
  { key: "summaries", label: "✅ Summaries" },
  { key: "thumbnail", label: "🖼️ Thumbnail" },
];

export default function LibraryPage() {
  const [selectedType, setSelectedType] = useState("all");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLibrary = async (type: string) => {
    setLoading(true);
    setError(null);
    try {
      if (type === "all") {
        const allItems: any[] = [];
        for (const ct of CONTENT_TYPES.filter((c) => c.key !== "all")) {
          const res = await fetch(`${API}/api/v1/library/${ct.key}`, {
            headers: authHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            allItems.push(
              ...(data.items || []).map((item: any) => ({
                ...item,
                type: ct.key,
              })),
            );
          }
        }
        setItems(allItems);
      } else {
        const res = await fetch(`${API}/api/v1/library/${type}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch library");
        const data = await res.json();
        setItems((data.items || []).map((item: any) => ({ ...item, type })));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary(selectedType);
  }, [selectedType]);

  const renderContent = (item: any) => {
    const c = item.content;
    switch (item.type) {
      case "instagram":
        return (
          <div className="space-y-2">
            <p className="font-semibold text-slate-100">{c.hook}</p>
            <p className="whitespace-pre-wrap text-sm text-slate-300 line-clamp-4">
              {c.caption}
            </p>
            <p className="text-xs text-indigo-300">{c.cta}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {(c.hashtags || []).slice(0, 5).map((h: string) => (
                <span
                  key={h}
                  className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-300"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        );
      case "tiktok":
        return (
          <div className="space-y-2">
            <p className="whitespace-pre-wrap text-sm text-slate-300 line-clamp-4">
              {c.caption}
            </p>
            <p className="text-xs text-indigo-300">{c.cta}</p>
            <p className="rounded-lg bg-fuchsia-500/10 p-2 text-xs text-fuchsia-300">
              🎵 {c.sound_suggestion}
            </p>
          </div>
        );
      case "youtube":
        return (
          <div className="space-y-2">
            <p className="font-semibold text-slate-100">{c.title}</p>
            <p className="whitespace-pre-wrap text-sm text-slate-300 line-clamp-4">
              {c.description}
            </p>
            <div className="rounded-lg bg-slate-800/60 p-2 font-mono text-xs text-indigo-300">
              {(c.chapters || []).slice(0, 3).map((ch: any, i: number) => (
                <p key={i}>
                  <span className="font-bold">{ch.time}</span> {ch.title}
                </p>
              ))}
            </div>
          </div>
        );
      case "twitter":
        return (
          <div className="space-y-2">
            {(c.tweets || []).slice(0, 3).map((t: string, i: number) => (
              <div
                key={i}
                className="rounded-lg bg-slate-800/60 p-2 text-sm text-slate-300"
              >
                <span className="mr-1 font-bold text-indigo-300">
                  {i + 1}/{c.tweets.length}
                </span>
                {t}
              </div>
            ))}
          </div>
        );
      case "blog":
        return (
          <div className="space-y-2">
            <p className="font-bold text-slate-100">{c.title}</p>
            <p className="text-sm italic text-slate-400">
              {c.meta_description}
            </p>
            <p className="text-sm text-slate-300 line-clamp-3">{c.content}</p>
          </div>
        );
      case "scripts":
        return (
          <div className="space-y-2">
            <p className="font-semibold text-slate-100">🪝 {c.hook_0_3s}</p>
            {(c.scenes || []).slice(0, 2).map((s: any, i: number) => (
              <div
                key={i}
                className="rounded-lg bg-slate-800/60 p-2 text-xs text-slate-300"
              >
                <p className="font-bold text-indigo-300">{s.time}</p>
                <p>🎥 {s.visual}</p>
              </div>
            ))}
          </div>
        );
      case "summaries":
        return (
          <div className="space-y-2">
            <p className="font-medium text-slate-100">{c.tldr}</p>
            <ul className="space-y-1">
              {(c.key_points || []).slice(0, 3).map((k: string, i: number) => (
                <li key={i} className="text-sm text-slate-300">
                  ✔️ {k}
                </li>
              ))}
            </ul>
          </div>
        );
      case "thumbnail":
        return (
          <div className="space-y-2">
            {(c.ideas || []).slice(0, 2).map((x: any, i: number) => (
              <div key={i} className="rounded-lg bg-slate-800/60 p-2">
                <p className="font-semibold text-slate-100">
                  {i + 1}. {x.concept}
                </p>
                <p className="text-xs text-slate-400">{x.visual_description}</p>
              </div>
            ))}
          </div>
        );
      default:
        return <p className="text-sm text-slate-400">No preview available</p>;
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <Sidebar active="library" />
      <div className="relative lg:pl-72">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_500px_at_50%_-120px,rgba(99,102,241,0.15),transparent)]" />
        <div className="relative mx-auto max-w-6xl space-y-6 px-6 py-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-slate-100 md:text-3xl">
              📚 Content Library
            </h1>
            <span className="text-sm text-slate-400">{items.length} items</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map((ct) => (
              <button
                key={ct.key}
                onClick={() => setSelectedType(ct.key)}
                className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                  selectedType === ct.key
                    ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-200"
                    : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-indigo-500/40 hover:text-slate-200"
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="animate-pulse rounded-xl bg-indigo-500/10 p-4 text-indigo-300">
              ⏳ Loading content...
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              ❌ {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-10 text-center text-slate-400">
              No content found.{" "}
              <Link
                href="/dashboard"
                className="font-semibold text-indigo-300 hover:underline"
              >
                Generate your first content!
              </Link>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((item, idx) => (
                <div
                  key={`${item.project_id}-${idx}`}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-indigo-500/40"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-100 line-clamp-1">
                      {item.title}
                    </h3>
                    <Link
                      href={`/dashboard?pid=${item.project_id}`}
                      className="text-xs font-medium text-indigo-300 hover:underline"
                    >
                      Open →
                    </Link>
                  </div>
                  {renderContent(item)}
                  <p className="mt-3 text-xs text-slate-500">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString("en-US")
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
