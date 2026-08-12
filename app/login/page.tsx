"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { setToken } from "../lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState<"form" | "verify" | "forgot" | "reset">(
    "form",
  );
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("rp_remember_email");
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  const input =
    "w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30";
  const label =
    "mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400";
  const errBox =
    "rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300";
  const infoBox =
    "rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-2.5 text-xs text-indigo-300";
  const okBox =
    "rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300";
  const btnMain =
    "w-full rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-950/50 transition hover:from-indigo-400 hover:to-purple-400 hover:shadow-indigo-900/60 active:scale-[0.98] disabled:opacity-40";

  const go = (s: typeof step) => {
    setStep(s);
    setErr(null);
    setInfo(null);
  };

  const submitForm = async () => {
    setBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await fetch(`${API}/api/v1/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Authentication failed");
      if (mode === "register") {
        go("verify");
        setInfo(
          data.dev_mode
            ? "🖥️ Dev mode: your code is printed in the BACKEND terminal."
            : `📧 We sent a 6-digit code to ${data.email}. Check your inbox.`,
        );
      } else {
        if (remember) localStorage.setItem("rp_remember_email", email);
        else localStorage.removeItem("rp_remember_email");
        setToken(data.token);
        window.location.href = "/dashboard";
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitVerify = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${API}/api/v1/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Verification failed");
      setToken(data.token);
      window.location.href = "/dashboard";
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const resendVerify = async () => {
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const res = await fetch(`${API}/api/v1/auth/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Resend failed");
      setInfo(
        data.dev_mode
          ? "🖥️ Dev mode: new code printed in the BACKEND terminal."
          : "📧 New code sent. Check your inbox.",
      );
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async () => {
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const res = await fetch(`${API}/api/v1/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed");
      go("reset");
      setInfo(
        data.dev_mode
          ? "🖥️ Dev mode: reset code printed in the BACKEND terminal."
          : `📧 If ${email} is registered, a reset code has been sent.`,
      );
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${API}/api/v1/auth/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Reset failed");
      setCode("");
      setNewPw("");
      setPw("");
      go("form");
      setMode("login");
      setOkMsg(
        "Password reset successful! Please login with your new password.",
      );
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const heading =
    step === "verify"
      ? "Check Your Inbox"
      : step === "forgot"
        ? "Forgot Password?"
        : step === "reset"
          ? "Set New Password"
          : mode === "login"
            ? "Welcome Back"
            : "Create Your Account";

  const subheading =
    step === "verify"
      ? "Enter the 6-digit code we emailed you to activate your account."
      : step === "forgot"
        ? "No worries — we'll email you a reset code."
        : step === "reset"
          ? `Enter the code + a new password for ${email || "your account"}.`
          : mode === "login"
            ? "Enter your email and password to access your account."
            : "Start free — get 3 credits instantly. 🪙";

  return (
    <main className="relative min-h-screen bg-slate-950 text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_500px_at_50%_-120px,rgba(99,102,241,0.18),transparent)]" />

      {/* ── Brand pojok kiri atas ── */}
      <Link
        href="/dashboard"
        className="absolute left-6 top-5 z-20 flex items-center gap-2 font-extrabold text-slate-100 transition hover:opacity-80"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-950/50">
          ⚡
        </span>
        <span className="text-lg">
          RePurpose<span className="text-indigo-400">AI</span>
        </span>
      </Link>

      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-4 py-20 md:px-8">
        <div className="grid w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-indigo-950/40 backdrop-blur lg:grid-cols-2">
          {/* ══════════ KIRI: FORM ══════════ */}
          <div className="p-8 md:p-12">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
              {heading}
            </h1>
            <p className="mt-2 text-sm text-slate-400">{subheading}</p>

            <div className="mt-8 space-y-4">
              {okMsg && <p className={okBox}>✅ {okMsg}</p>}
              {info && <p className={infoBox}>{info}</p>}

              {step === "form" && (
                <>
                  {mode === "register" && (
                    <div>
                      <label className={label}>Name</label>
                      <input
                        className={input}
                        placeholder="Your name (optional)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                  )}
                  <div>
                    <label className={label}>Email</label>
                    <input
                      className={input}
                      type="email"
                      placeholder="yourname@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>Password</label>
                    <div className="relative">
                      <input
                        className={`${input} pr-11`}
                        type={showPw ? "text" : "password"}
                        placeholder="(min. 6 characters)"
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitForm()}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300"
                        aria-label="Toggle password visibility"
                      >
                        {showPw ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>
                  {mode === "login" && (
                    <div className="flex items-center justify-between text-xs">
                      <label className="flex cursor-pointer items-center gap-2 text-slate-400 transition hover:text-slate-200">
                        <input
                          type="checkbox"
                          checked={remember}
                          onChange={(e) => setRemember(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-indigo-500"
                        />
                        Remember me
                      </label>
                      <button
                        className="font-semibold text-indigo-300 transition hover:text-indigo-200 hover:underline"
                        onClick={() => go("forgot")}
                      >
                        Forgot your password?
                      </button>
                    </div>
                  )}
                  {err && <p className={errBox}>❌ {err}</p>}
                  <button
                    onClick={submitForm}
                    disabled={busy || !email || !pw}
                    className={btnMain}
                  >
                    {busy
                      ? "⏳ Please wait..."
                      : mode === "login"
                        ? "🔓 Log In"
                        : "🚀 Create Free Account"}
                  </button>

                  <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-slate-500">
                    <span className="h-px flex-1 bg-slate-700/70" /> or login
                    with <span className="h-px flex-1 bg-slate-700/70" />
                  </div>

                  <a
                    href={`${API}/api/v1/auth/google`}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-white py-3 text-sm font-bold text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-lg active:scale-[0.98]"
                  >
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path
                        fill="#FFC107"
                        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.3-.4-3.5z"
                      />
                      <path
                        fill="#FF3D00"
                        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                      />
                      <path
                        fill="#4CAF50"
                        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
                      />
                      <path
                        fill="#1976D2"
                        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z"
                      />
                    </svg>
                    Google
                  </a>

                  <p className="text-center text-xs text-slate-400">
                    {mode === "login" ? (
                      <>
                        Don&apos;t have an account?{" "}
                        <button
                          className="font-bold text-indigo-300 transition hover:text-indigo-200 hover:underline"
                          onClick={() => {
                            setMode("register");
                            setOkMsg(null);
                          }}
                        >
                          Register free
                        </button>
                      </>
                    ) : (
                      <>
                        Already have an account?{" "}
                        <button
                          className="font-bold text-indigo-300 transition hover:text-indigo-200 hover:underline"
                          onClick={() => setMode("login")}
                        >
                          Log in
                        </button>
                      </>
                    )}
                  </p>
                </>
              )}

              {step === "verify" && (
                <>
                  <div>
                    <label className={label}>Verification code</label>
                    <input
                      className={`${input} text-center text-2xl font-extrabold tracking-[0.5em]`}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="••••••"
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ""))
                      }
                      onKeyDown={(e) => e.key === "Enter" && submitVerify()}
                    />
                  </div>
                  {err && <p className={errBox}>❌ {err}</p>}
                  <button
                    onClick={submitVerify}
                    disabled={busy || code.length !== 6}
                    className={btnMain}
                  >
                    {busy
                      ? "⏳ Verifying..."
                      : "✅ Verify & Create Account (+3 🪙)"}
                  </button>
                  <div className="flex justify-between text-xs">
                    <button
                      className="text-slate-400 transition hover:text-slate-200"
                      onClick={() => go("form")}
                    >
                      ← Change email
                    </button>
                    <button
                      className="font-semibold text-indigo-300 hover:underline"
                      onClick={resendVerify}
                      disabled={busy}
                    >
                      🔄 Resend code
                    </button>
                  </div>
                </>
              )}

              {step === "forgot" && (
                <>
                  <div>
                    <label className={label}>Email</label>
                    <input
                      className={input}
                      type="email"
                      placeholder="yourname@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitForgot()}
                    />
                  </div>
                  {err && <p className={errBox}>❌ {err}</p>}
                  <button
                    onClick={submitForgot}
                    disabled={busy || !email}
                    className={btnMain}
                  >
                    {busy ? "⏳ Sending..." : "📨 Send Reset Code"}
                  </button>
                  <p className="text-center text-xs">
                    <button
                      className="text-slate-400 transition hover:text-slate-200"
                      onClick={() => go("form")}
                    >
                      ← Back to login
                    </button>
                  </p>
                </>
              )}

              {step === "reset" && (
                <>
                  <div>
                    <label className={label}>Reset code</label>
                    <input
                      className={`${input} text-center text-2xl font-extrabold tracking-[0.5em]`}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="••••••"
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ""))
                      }
                    />
                  </div>
                  <div>
                    <label className={label}>New password</label>
                    <input
                      className={input}
                      type="password"
                      placeholder="(min. 6 characters)"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitReset()}
                    />
                  </div>
                  {err && <p className={errBox}>❌ {err}</p>}
                  <button
                    onClick={submitReset}
                    disabled={busy || code.length !== 6 || newPw.length < 6}
                    className={btnMain}
                  >
                    {busy ? "⏳ Resetting..." : "🔐 Reset Password"}
                  </button>
                  <div className="flex justify-between text-xs">
                    <button
                      className="text-slate-400 transition hover:text-slate-200"
                      onClick={() => go("form")}
                    >
                      ← Back to login
                    </button>
                    <button
                      className="font-semibold text-indigo-300 hover:underline"
                      onClick={submitForgot}
                      disabled={busy}
                    >
                      🔄 Resend code
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ══════════ KANAN: PANEL MARKETING ══════════ */}
          <div className="relative hidden overflow-hidden bg-linear-to-br from-indigo-600 via-purple-600 to-fuchsia-600 p-12 lg:flex lg:flex-col lg:justify-between">
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-black/25 blur-2xl" />
            <div className="pointer-events-none absolute inset-0 opacity-10 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:24px_24px]" />

            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                AI Content Repurposing Studio
              </span>
              <h2 className="mt-6 text-4xl font-extrabold leading-tight text-white xl:text-5xl">
                One Video.
                <br />A Week of Content.
                <br />
                <span className="text-amber-300">
                  Zero Writer&apos;s Block.
                </span>
              </h2>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-indigo-100">
                Paste a YouTube link and let AI craft Instagram captions, X
                threads, SEO blogs, TikTok captions, YouTube chapters & AI
                thumbnails — ready to publish in under a minute.
              </p>

              <div className="mt-8 grid grid-cols-3 gap-3">
                {[
                  { big: "9", label: "formats per video" },
                  { big: "~60s", label: "turnaround time" },
                  { big: "24/7", label: "AI on your team" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl bg-white/10 p-4 backdrop-blur transition hover:-translate-y-1 hover:bg-white/20"
                  >
                    <p className="text-2xl font-extrabold text-white">
                      {s.big}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-indigo-100">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mt-10 rounded-2xl bg-white/10 p-5 backdrop-blur transition hover:bg-white/15">
              <p className="text-sm italic leading-relaxed text-white">
                &ldquo;I used to spend my whole Sunday rewriting one podcast
                episode. Now it takes 10 minutes — and the posts actually sound
                like me.&rdquo;
              </p>
              <p className="mt-4 text-xs font-bold uppercase tracking-widest text-amber-300">
                ⚡ 10 minutes a week — that&apos;s all it costs you.
              </p>
            </div>

            <div className="relative mt-8 flex flex-col items-start gap-3">
              <a
                href="https://instagram.com/bygugu.11"
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3"
              >
                <img
                  src="/avatar.png"
                  alt="bygugu.11"
                  className="h-11 w-11 rounded-full border-2 border-white/50 object-cover shadow-lg transition duration-300 group-hover:scale-110 group-hover:border-amber-300"
                />
                <span className="text-sm font-bold text-white underline-offset-4 transition group-hover:text-amber-300 group-hover:underline">
                  @bygugu.11
                </span>
              </a>
              <p className="rounded-full bg-white/15 px-4 py-2 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25">
                👋 Hey there, how can we help you?
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
