"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authHeaders, clearToken, getToken } from "../lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Props = {
  active: "dashboard" | "history" | "library";
  onBuyCredits?: () => void;
};

export default function Sidebar({ active, onBuyCredits }: Props) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{
    email: string;
    name: string | null;
    credits: number;
  } | null>(null);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }
    fetch(`${API}/api/v1/me`, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setUser)
      .catch(() => {
        clearToken();
        window.location.href = "/login";
      });
  }, []);

  const initial = (user?.name || user?.email || "U").charAt(0).toUpperCase();
  const username =
    user?.name || (user?.email ? user.email.split("@")[0] : "User");

  const buy = () => {
    setOpen(false);
    if (onBuyCredits) onBuyCredits();
    else window.location.href = "/dashboard?pricing=1";
  };

  const navCls = (isActive: boolean) =>
    `flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
      isActive
        ? "border-indigo-500/30 bg-linear-to-r from-indigo-500/20 to-purple-500/10 text-indigo-200 shadow-lg shadow-indigo-950/30"
        : "border-transparent text-slate-400 hover:translate-x-1 hover:bg-slate-800/60 hover:text-slate-100"
    }`;

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800/70 bg-slate-950/80 px-4 py-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setOpen(true)}
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

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800/70 bg-slate-900/90 backdrop-blur transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
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
            className={navCls(active === "dashboard")}
            onClick={() => setOpen(false)}
          >
            <span>⚡</span> Dashboard
          </Link>
          <Link
            href="/history"
            className={navCls(active === "history")}
            onClick={() => setOpen(false)}
          >
            <span>🗂️</span> History
          </Link>
          <Link
            href="/library"
            className={navCls(active === "library")}
            onClick={() => setOpen(false)}
          >
            <span>📚</span> Content Library
          </Link>

          <p className="px-3 pb-2 pt-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Billing
          </p>
          <button
            onClick={buy}
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
            <span className="text-xs font-bold text-amber-300">
              🪙 {user?.credits ?? 0} credits
            </span>
            <button
              onClick={buy}
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
    </>
  );
}
