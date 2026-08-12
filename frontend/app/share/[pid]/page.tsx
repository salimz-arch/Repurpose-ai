"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CARDS, copyText, CardBody } from "../../components/cards";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function SharePage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.location.pathname.split("/").filter(Boolean).pop();
    if (!id) return setError("Link tidak valid.");
    fetch(`${API}/api/v1/public/${id}`)
      .then((r) => {
        if (!r.ok)
          throw new Error("Link tidak valid atau project belum selesai.");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 md:text-3xl">
              One Video In, Eight Posts Out
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              This page was generated automatically by our AI repurposing studio
              — one YouTube video turned into ready-to-publish content for every
              platform.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white"
          >
            ⚡ Make your own — FREE
          </Link>
        </div>

        {error && (
          <div className="rounded-xl bg-red-100 p-4 text-red-700">
            ❌ {error}
          </div>
        )}
        {!error && !data && (
          <div className="animate-pulse rounded-xl bg-indigo-100 p-4 text-indigo-700">
            ⏳ Memuat hasil...
          </div>
        )}

        {data && (
          <>
            <div className="rounded-2xl bg-white p-5 shadow">
              <h2 className="text-lg font-bold text-slate-900">
                {data.title ?? "Hasil Repurpose Konten"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {data.created_at
                  ? new Date(data.created_at).toLocaleString("id-ID")
                  : ""}{" "}
                • tone: {data.tone} • lang: {data.language}
                {data.source_url && (
                  <>
                    {" "}
                    •{" "}
                    <a
                      className="text-indigo-600 hover:underline"
                      href={data.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Sumber video ↗
                    </a>
                  </>
                )}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {CARDS.map(({ key, title }) => (
                <div key={key} className="rounded-2xl bg-white p-5 shadow">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">{title}</h3>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          copyText(key, data.results[key]),
                        )
                      }
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      📋 Copy
                    </button>
                  </div>
                  <div className="max-h-96 overflow-auto pr-1">
                    <CardBody kind={key} d={data.results[key]} />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-slate-800 p-6 text-center text-white">
              <p className="font-semibold">
                1 video → 8 ready-to-post formats in ~60 seconds 🤯
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Instagram captions, X threads, SEO blogs, TikTok captions,
                YouTube chapters, AI thumbnails & more.
              </p>
              <Link
                href="/dashboard"
                className="mt-4 inline-block rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 px-6 py-3 font-semibold"
              >
                Try It Free
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
