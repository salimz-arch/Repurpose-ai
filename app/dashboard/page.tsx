"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CARDS, copyText, CardBody } from "../components/cards";
import { getToken, setToken, clearToken, authHeaders } from "../lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const STEPS = ["queued", "downloading", "transcribing", "generating", "done"];
const STEP_LABEL: Record<string, string> = {
  queued: "Queued",
  downloading: "Download",
  transcribing: "Transcribe",
  generating: "Generate",
  done: "Done",
};

type PackageKey = "starter" | "basic" | "pro" | "premium";

export default function DashboardPage() {
  const [url, setUrl] = useState("");
  const [tone, setTone] = useState("santai");
  const [lang, setLang] = useState("id");
  const [pid, setPid] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [notionBusy, setNotionBusy] = useState<string | null>(null);
  const [notionMsg, setNotionMsg] = useState<string | null>(null);
  const [user, setUser] = useState<{
    email: string;
    name: string | null;
    credits: number;
  } | null>(null);
  const [stats, setStats] = useState({ videos: 0, formats: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Pricing modal (WA flow) ──
  const [showPricing, setShowPricing] = useState(false);
  const [packages, setPackages] = useState<Record<string, any>>({});
  const [payStep, setPayStep] = useState<"packages" | "instructions">(
    "packages",
  );
  const [order, setOrder] = useState<any>(null);
  const [payBusy, setPayBusy] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<string | null>(null);

  const initial = (user?.name || user?.email || "U").charAt(0).toUpperCase();
  const username =
    user?.name || (user?.email ? user.email.split("@")[0] : "User");

  const refreshStats = async () => {
    try {
      const res = await fetch(`${API}/api/v1/projects`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      const done = (data.projects ?? []).filter(
        (p: any) => p.status === "done",
      ).length;
      setStats({ videos: done, formats: done * 9 });
    } catch {
      /* skip */
    }
  };

  useEffect(() => {
    if (!pid) return;
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/v1/projects/${pid}`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        setStatus(data.status);
        if (data.status === "done") {
          setResults(data.results);
          refreshStats();
          if (timer.current) clearInterval(timer.current);
        } else if (data.status === "failed") {
          setError(data.error ?? "Processing failed.");
          if (timer.current) clearInterval(timer.current);
        }
      } catch {
        /* skip */
      }
    }, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [pid]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
      params.delete("token");
      window.history.replaceState(
        {},
        "",
        window.location.pathname +
          (params.get("pid") ? `?pid=${params.get("pid")}` : ""),
      );
    }
    (async () => {
      if (!getToken()) {
        window.location.href = "/login";
        return;
      }
      const res = await fetch(`${API}/api/v1/me`, { headers: authHeaders() });
      if (!res.ok) {
        clearToken();
        window.location.href = "/login";
        return;
      }
      setUser(await res.json());
      refreshStats();
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oldPid = params.get("pid");
    if (!oldPid) return;
    setPid(oldPid);
    fetch(`${API}/api/v1/projects/${oldPid}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "done") {
          setResults(data.results);
          setStatus("done");
          if (data.source_url) setUrl(data.source_url);
        } else setStatus(data.status);
      })
      .catch(() => setError("Failed to load project from history."));
  }, []);

  useEffect(() => {
    if (!showPricing) return;
    fetch(`${API}/api/v1/payments/packages`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setPackages(data.packages ?? {}))
      .catch(() => setPayMsg("❌ Failed to load pricing."));
  }, [showPricing]);

  useEffect(() => {
    if (!pendingOrder) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/v1/payments/${pendingOrder}`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (data.status === "success") {
          setPayMsg(`✅ Payment confirmed! +${data.credits} credits added.`);
          setPendingOrder(null);
          const me = await fetch(`${API}/api/v1/me`, {
            headers: authHeaders(),
          });
          if (me.ok) setUser(await me.json());
          clearInterval(poll);
        } else if (data.status === "failed" || data.status === "expired") {
          setPayMsg("❌ Payment failed or expired. Please try again.");
          setPendingOrder(null);
          clearInterval(poll);
        }
      } catch {
        /* skip */
      }
    }, 4000);
    return () => clearInterval(poll);
  }, [pendingOrder]);

  // ── Auto-open pricing modal from ?pricing=1 (History/Library) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pricing")) {
      setShowPricing(true);
      params.delete("pricing");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const submit = async () => {
    setError(null);
    setResults(null);
    setStatus("queued");
    try {
      const res = await fetch(`${API}/api/v1/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ url, tone, language: lang }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.detail ?? (res.status === 401 ? "Login expired." : "Failed"),
        );
      setPid(data.id);
      setUser((u) => (u ? { ...u, credits: data.credits } : u));
      refreshStats();
    } catch (e: any) {
      setStatus(null);
      setError(e.message ?? "Backend not connected.");
    }
  };

  const exportNotion = async (kind: string) => {
    if (!pid) return;
    setNotionBusy(kind);
    setNotionMsg(null);
    try {
      const res = await fetch(`${API}/api/v1/projects/${pid}/export/notion`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Export failed");
      setNotionMsg("✅ Saved to Notion!");
      if (data.url) window.open(data.url, "_blank");
    } catch (e: any) {
      setNotionMsg(`❌ ${e.message}`);
    } finally {
      setNotionBusy(null);
    }
  };

  const downloadZip = async () => {
    if (!pid) return;
    setNotionMsg("📦 Preparing zip...");
    try {
      const res = await fetch(`${API}/api/v1/projects/${pid}/export/zip`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Zip download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `repurpose-${pid.slice(0, 8)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      setNotionMsg("✅ Zip downloaded!");
    } catch (e: any) {
      setNotionMsg(`❌ ${e.message}`);
    }
  };

  const shareLink = () => {
    if (!pid) return;
    navigator.clipboard.writeText(`${window.location.origin}/share/${pid}`);
    setNotionMsg("🔗 Public link copied to clipboard!");
  };

  const startOrder = async (pkg: PackageKey) => {
    setPayBusy(pkg);
    setPayMsg(null);
    try {
      const res = await fetch(`${API}/api/v1/payments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ package: pkg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to create order");
      setOrder(data);
      setPayStep("instructions");
      setPendingOrder(data.order_id);
    } catch (e: any) {
      setPayMsg(`❌ ${e.message}`);
    } finally {
      setPayBusy(null);
    }
  };

  const running = !!status && !["done", "failed"].includes(status);
  const activeIdx = STEPS.indexOf(status ?? "queued");
  const outOfCredits = (user?.credits ?? 0) === 0;

  const navCls = (active: boolean) =>
    `flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
      active
        ? "border-indigo-500/30 bg-linear-to-r from-indigo-500/20 to-purple-500/10 text-indigo-200 shadow-lg shadow-indigo-950/30"
        : "border-transparent text-slate-400 hover:translate-x-1 hover:bg-slate-800/60 hover:text-slate-100"
    }`;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <div className="flex min-h-screen">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ══════════ SIDEBAR ══════════ */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800/70 bg-slate-900/90 backdrop-blur transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center gap-3 px-6 py-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 text-lg shadow-lg shadow-indigo-950/50">
              ⚡
            </span>
            <div>
              <p className="text-base font-extrabold tracking-tight text-slate-100">
                RePurpose <span className="text-indigo-400">AI</span>
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Content Studio
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-4 pt-2">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Menu
            </p>
            <Link
              href="/dashboard"
              className={navCls(true)}
              onClick={() => setSidebarOpen(false)}
            >
              <span>⫶☰</span> Dashboard
            </Link>
            <Link
              href="/history"
              className={navCls(false)}
              onClick={() => setSidebarOpen(false)}
            >
              <span>🗂️</span> History
            </Link>
            <Link
              href="/library"
              className={navCls(false)}
              onClick={() => setSidebarOpen(false)}
            >
              <span>📚</span> Content Library
            </Link>

            <p className="px-3 pb-2 pt-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Billing
            </p>
            <button
              onClick={() => {
                setShowPricing(true);
                setSidebarOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl bg-linear-to-r from-amber-500 to-orange-500 px-3 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-amber-950/40 transition-all duration-200 hover:translate-x-1 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98]"
            >
              <span>💎</span> Buy Credits
            </button>
          </nav>

          <div className="space-y-3 border-t border-slate-800/70 p-4">
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3 transition hover:border-slate-700">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-linear-to-br from-fuchsia-500 to-indigo-500 text-sm font-extrabold text-white shadow-lg">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-100">
                  {username}
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={() => {
                  clearToken();
                  window.location.href = "/login";
                }}
                title="Logout"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
              >
                ⎋
              </button>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
              <span
                className={`text-xs font-bold ${outOfCredits ? "text-red-300" : "text-amber-300"}`}
              >
                🪙 {user?.credits ?? 0} credits
              </span>
              <button
                onClick={() => setShowPricing(true)}
                className="text-[11px] font-bold text-amber-200 transition hover:text-amber-100 hover:underline"
              >
                Top up
              </button>
            </div>
            <p className="flex items-center gap-1.5 px-1 text-[10px] text-slate-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />{" "}
              All systems operational
            </p>
          </div>
        </aside>

        {/* ══════════ MAIN CONTENT ══════════ */}
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_500px_at_50%_-120px,rgba(99,102,241,0.15),transparent)]" />

          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800/70 bg-slate-950/80 px-4 py-3 backdrop-blur lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-700 text-slate-300 transition hover:bg-slate-800"
            >
              ☰
            </button>
            <span className="text-sm font-extrabold text-slate-100">
              ⚡ RePurpose <span className="text-indigo-400">AI</span>
            </span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300">
              🪙 {user?.credits ?? 0}
            </span>
          </div>

          <div className="relative mx-auto max-w-6xl space-y-8 px-6 py-10">
            <section>
              <h1 className="text-3xl font-extrabold md:text-4xl">
                <span className="bg-linear-to-r from-indigo-300 via-purple-300 to-fuchsia-300 bg-clip-text text-transparent">
                  One Video In, Nine Posts Out
                </span>
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
                AI content repurposing studio for creators, small businesses &
                marketers. Paste a YouTube link and instantly get Instagram
                captions, X threads, SEO blogs, TikTok captions, YouTube
                descriptions with chapters, short-video scripts, key points & AI
                thumbnails — a whole week of content in under a minute.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {[
                  "🧾 9 formats per video",
                  "⏳ ~60s processing",
                  "📤 Copy • Notion • ZIP",
                  "🌐 ID • EN • Auto",
                ].map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-slate-400 transition hover:border-indigo-500/40 hover:text-slate-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: "🎬",
                  big: String(stats.videos),
                  label: "Videos processed",
                },
                {
                  icon: "📄",
                  big: String(stats.formats),
                  label: "Formats generated for you",
                },
                {
                  icon: "🤑",
                  big: String(user?.credits ?? 0),
                  label: "Credits remaining",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:-translate-y-0.5 hover:border-indigo-500/40"
                >
                  <p className="text-2xl font-extrabold text-slate-100">
                    {s.icon} {s.big}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{s.label}</p>
                </div>
              ))}
            </section>

            {outOfCredits && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-linear-to-r from-amber-500/10 to-orange-500/10 p-4">
                <p className="text-sm text-amber-200">
                  ⚠️ You&apos;ve used all your free credits. Top up to keep
                  generating.
                </p>
                <button
                  onClick={() => setShowPricing(true)}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400"
                >
                  💎 Buy Credits
                </button>
              </div>
            )}

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-indigo-950/30">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube URL here..."
                  className="min-w-64 flex-1 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-slate-200 placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                />
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-3 text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="formal">Formal</option>
                  <option value="santai">Casual</option>
                  <option value="marketing">Marketing</option>
                </select>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-3 text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="id">Indonesian</option>
                  <option value="en">English</option>
                  <option value="auto">Auto</option>
                </select>
                <button
                  onClick={submit}
                  disabled={running || !url || outOfCredits}
                  title={
                    outOfCredits ? "Out of credits — buy more to continue" : ""
                  }
                  className="rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-950/50 transition hover:from-indigo-400 hover:to-purple-400 active:scale-[0.98] disabled:opacity-40"
                >
                  {running
                    ? "⏳ Processing..."
                    : outOfCredits
                      ? "🔒 Out of Credits"
                      : "Generate"}
                </button>
              </div>
            </section>

            {(running || status === "done" || status === "failed") && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex items-center">
                  {STEPS.map((s, i) => (
                    <div key={s} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <div
                          className={
                            "grid h-9 w-9 place-items-center rounded-full border text-xs font-bold transition " +
                            (status === "failed" && i === activeIdx
                              ? "border-red-500 bg-red-500/20 text-red-300"
                              : i < activeIdx || status === "done"
                                ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                                : i === activeIdx
                                  ? "animate-pulse border-indigo-400 bg-indigo-500/20 text-indigo-200"
                                  : "border-slate-700 bg-slate-800/60 text-slate-500")
                          }
                        >
                          {i < activeIdx || status === "done" ? "✓" : i + 1}
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">
                          {STEP_LABEL[s]}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div
                          className={`mx-2 mb-5 h-px flex-1 ${i < activeIdx || status === "done" ? "bg-emerald-500/60" : "bg-slate-700"}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                {error && (
                  <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    ❌ {error}
                  </p>
                )}
              </section>
            )}

            {results && pid && (
              <>
                <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => exportNotion("all")}
                      disabled={!!notionBusy}
                      className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                    >
                      {notionBusy === "all"
                        ? "⏳ Exporting..."
                        : "📤 Notion (all)"}
                    </button>
                    <button
                      onClick={downloadZip}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                    >
                      📦 Export Pack (.zip)
                    </button>
                    <button
                      onClick={shareLink}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                    >
                      🔗 Share Link
                    </button>
                  </div>
                  {notionMsg && (
                    <span className="text-sm text-slate-400">{notionMsg}</span>
                  )}
                </section>
                <div className="grid gap-4 md:grid-cols-2">
                  {CARDS.map(({ key, title }) => (
                    <div
                      key={key}
                      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-950/40"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="font-bold text-slate-100">{title}</h2>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => exportNotion(key)}
                            disabled={!!notionBusy}
                            className="text-sm font-medium text-slate-400 transition hover:text-slate-200 disabled:opacity-50"
                          >
                            {notionBusy === key ? "⏳ ..." : "📤 Notion"}
                          </button>
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(
                                copyText(key, results[key]),
                              )
                            }
                            className="text-sm font-medium text-indigo-300 transition hover:text-indigo-200"
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>
                      <div className="max-h-96 overflow-auto pr-1">
                        <CardBody kind={key} d={results[key]} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══════════ PRICING MODAL ══════════ */}
      {showPricing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !payBusy && setShowPricing(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-100">
                  💎 Top Up Credits
                </h2>
                <p className="text-xs text-slate-400">
                  {payStep === "instructions"
                    ? "Transfer the exact amount, then confirm via WhatsApp."
                    : "Pay via QRIS / e-wallet / bank transfer. Credits added after admin approval."}
                </p>
              </div>
              <button
                onClick={() => !payBusy && setShowPricing(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {payMsg && (
              <div
                className={`mb-4 rounded-lg border p-2 text-xs ${
                  payMsg.startsWith("✅")
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : payMsg.startsWith("❌")
                      ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                }`}
              >
                {payMsg}
              </div>
            )}

            {payStep === "packages" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.entries(packages) as [PackageKey, any][]).map(
                    ([k, p]) => (
                      <button
                        key={k}
                        onClick={() => startOrder(k)}
                        disabled={!!payBusy}
                        className={`group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 disabled:opacity-50 ${
                          k === "pro"
                            ? "border-indigo-500/60 bg-linear-to-br from-indigo-500/10 to-purple-500/10"
                            : "border-slate-800 bg-slate-800/40 hover:border-indigo-500/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-slate-100">{p.label}</p>
                          {k === "pro" && (
                            <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-bold text-white">
                              BEST VALUE
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-2xl font-extrabold text-slate-100">
                          Rp {p.price.toLocaleString("id-ID")}
                        </p>
                        <p className="text-xs text-slate-400">
                          +{p.credits} credits • Rp{" "}
                          {Math.round(p.price / p.credits).toLocaleString(
                            "id-ID",
                          )}{" "}
                          per credit
                        </p>
                        <div className="mt-3 text-xs font-semibold text-indigo-300 transition group-hover:translate-x-1">
                          {payBusy === k ? "⏳ Making order..." : "Order →"}
                        </div>
                      </button>
                    ),
                  )}
                </div>
                <p className="mt-4 text-center text-[11px] text-slate-500">
                  💬 Payment verified via WhatsApp — credits added automatically
                  after admin approval (usually &lt; 5 min).
                </p>
              </>
            ) : (
              order && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Package</span>
                      <span className="font-semibold text-slate-100">
                        {packages[order.package]?.label}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-slate-400">Amount to transfer</span>
                      <span className="font-extrabold text-amber-300">
                        Rp {order.amount.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-slate-400">Order code</span>
                      <span className="font-mono font-bold text-indigo-300">
                        {order.order_id}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                    <p className="font-semibold">
                      1️⃣ Transfer the exact amount to:
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs">
                      {order.payment_info}
                    </p>
                  </div>
                  <a
                    href={order.wa_link}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full rounded-xl bg-emerald-600 py-3 text-center font-semibold text-white transition hover:bg-emerald-500"
                  >
                    💬 2️⃣ I&apos;ve Paid — Confirm via WhatsApp
                  </a>
                  <p className="text-center text-xs text-slate-400">
                    ⏳ 3️⃣ Credits are added <b>automatically</b> once admin
                    approves.
                    {pendingOrder && (
                      <span className="ml-1 animate-pulse text-amber-300">
                        Waiting for approval...
                      </span>
                    )}
                  </p>
                  <button
                    onClick={() => setPayStep("packages")}
                    className="w-full text-center text-xs text-slate-400 hover:text-slate-200"
                  >
                    ← Choose another package
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </main>
  );
}
