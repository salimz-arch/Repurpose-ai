"use client";

import { useState } from "react";

export const CARDS = [
  { key: "ig_caption", title: "📸 Instagram Caption" },
  { key: "twitter_thread", title: "🐦 Twitter/X Thread" },
  { key: "blog_seo", title: "✍️ SEO Blog Post" },
  { key: "short_script", title: "🎬 Short Video Script" },
  { key: "summary", title: "✅ Key Points Summary" },
  { key: "thumbnail_idea", title: "🖼️ Thumbnail Ideas" },
  { key: "yt_description", title: "▶️ YouTube Description" },
  { key: "tiktok_caption", title: "🎵 TikTok Caption" },
];

export function copyText(kind: string, d: any): string {
  switch (kind) {
    case "ig_caption":
      return `${d.hook ?? ""}\n\n${d.caption ?? ""}\n\n${d.cta ?? ""}\n\n${(d.hashtags ?? []).join(" ")}`;
    case "twitter_thread":
      return (d.tweets ?? [])
        .map((t: string, i: number) => `${i + 1}/${d.tweets.length}  ${t}`)
        .join("\n\n");
    case "blog_seo":
      return `# ${d.title}\n\nMeta: ${d.meta_description}\nKeywords: ${(d.keywords ?? []).join(", ")}\n\n${d.content ?? ""}`;
    case "short_script":
      return `HOOK (0-3s): ${d.hook_0_3s}\n\n${(d.scenes ?? []).map((s: any) => `[${s.time}] VISUAL: ${s.visual}\nVO: ${s.voiceover}`).join("\n\n")}\n\nCTA: ${d.cta}`;
    case "yt_description":
      return `${d.title ?? ""}\n\n${d.description ?? ""}\n\nTags: ${(d.tags ?? []).join(", ")}\n\n${(d.chapters ?? []).map((c: any) => `${c.time} ${c.title}`).join("\n")}`;
    case "tiktok_caption":
      return `${d.caption ?? ""}\n\n${d.cta ?? ""}\n\n${(d.hashtags ?? []).join(" ")}\n\n🎵 Sound: ${d.sound_suggestion ?? ""}`;
    case "summary":
      return `TL;DR: ${d.tldr}\n\n${(d.key_points ?? []).map((k: string, i: number) => `${i + 1}. ${k}`).join("\n")}`;
    case "thumbnail_idea":
      return (d.ideas ?? [])
        .map(
          (x: any, i: number) =>
            `${i + 1}. ${x.concept} — "${x.text_overlay}" (${x.emotion})\n   ${x.visual_description}`,
        )
        .join("\n\n");
    default:
      return JSON.stringify(d, null, 2);
  }
}

export function ThumbImg({ url, alt }: { url: string; alt: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <img
      src={attempt ? `${url}&r=${attempt}` : url}
      alt={alt}
      loading="lazy"
      onError={() => {
        if (attempt < 2) setTimeout(() => setAttempt((a) => a + 1), 4000);
      }}
      className="w-full rounded-xl border border-slate-700 bg-slate-800"
    />
  );
}

const chip = "rounded-full border px-2 py-0.5 text-xs";

export function CardBody({ kind, d }: { kind: string; d: any }) {
  if (!d) return <p className="text-sm text-slate-500">No data.</p>;
  switch (kind) {
    case "ig_caption":
      return (
        <div className="space-y-2 text-sm text-slate-300">
          <p className="font-semibold text-slate-100">{d.hook}</p>
          <p className="whitespace-pre-wrap">{d.caption}</p>
          <p className="font-medium text-indigo-300">{d.cta}</p>
          <div className="flex flex-wrap gap-1 pt-1">
            {(d.hashtags ?? []).map((h: string) => (
              <span
                key={h}
                className={`${chip} border-indigo-500/20 bg-indigo-500/10 text-indigo-300`}
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      );
    case "twitter_thread":
      return (
        <ol className="space-y-2 text-sm text-slate-300">
          {(d.tweets ?? []).map((t: string, i: number) => (
            <li
              key={i}
              className="rounded-lg border border-slate-700/50 bg-slate-800/60 p-2"
            >
              <span className="mr-1 font-bold text-indigo-300">
                {i + 1}/{d.tweets.length}
              </span>
              {t}
            </li>
          ))}
        </ol>
      );
    case "blog_seo":
      return (
        <div className="space-y-2 text-sm text-slate-300">
          <p className="font-bold text-slate-100">{d.title}</p>
          <p className="italic text-slate-400">{d.meta_description}</p>
          <div className="flex flex-wrap gap-1">
            {(d.keywords ?? []).map((k: string) => (
              <span
                key={k}
                className={`${chip} border-emerald-500/20 bg-emerald-500/10 text-emerald-300`}
              >
                {k}
              </span>
            ))}
          </div>
          <ul className="list-disc pl-5">
            {(d.outline ?? []).map((o: any, i: number) => (
              <li key={i}>{o.h2}</li>
            ))}
          </ul>
          <details>
            <summary className="cursor-pointer font-medium text-indigo-300">
              View full content
            </summary>
            <pre className="whitespace-pre-wrap pt-2 text-xs">{d.content}</pre>
          </details>
        </div>
      );
    case "short_script":
      return (
        <div className="space-y-2 text-sm text-slate-300">
          <p className="font-semibold text-slate-100">🪝 {d.hook_0_3s}</p>
          {(d.scenes ?? []).map((s: any, i: number) => (
            <div
              key={i}
              className="rounded-lg border border-slate-700/50 bg-slate-800/60 p-2"
            >
              <p className="text-xs font-bold text-indigo-300">{s.time}</p>
              <p>🎥 {s.visual}</p>
              <p>🎙️ {s.voiceover}</p>
            </div>
          ))}
          <p className="font-medium text-indigo-300">CTA: {d.cta}</p>
        </div>
      );
    case "summary":
      return (
        <div className="space-y-2 text-sm text-slate-300">
          <p className="font-medium text-slate-100">{d.tldr}</p>
          <ul className="space-y-1">
            {(d.key_points ?? []).map((k: string, i: number) => (
              <li key={i}>✔️ {k}</li>
            ))}
          </ul>
        </div>
      );
    case "yt_description":
      return (
        <div className="space-y-2 text-sm text-slate-300">
          <p className="font-bold text-slate-100">{d.title}</p>
          <p className="whitespace-pre-wrap">{d.description}</p>
          <div className="flex flex-wrap gap-1">
            {(d.tags ?? []).map((t: string) => (
              <span
                key={t}
                className={`${chip} border-red-500/20 bg-red-500/10 text-red-300`}
              >
                {t}
              </span>
            ))}
          </div>
          <div className="rounded-lg border border-slate-700/50 bg-slate-800/60 p-2 font-mono text-xs">
            {(d.chapters ?? []).map((c: any, i: number) => (
              <p key={i}>
                <span className="font-bold text-indigo-300">{c.time}</span>{" "}
                {c.title}
              </p>
            ))}
          </div>
        </div>
      );
    case "tiktok_caption":
      return (
        <div className="space-y-2 text-sm text-slate-300">
          <p className="whitespace-pre-wrap font-medium">{d.caption}</p>
          <p className="font-medium text-indigo-300">{d.cta}</p>
          <p className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10 p-2 text-xs text-fuchsia-300">
            🎵 Sound: {d.sound_suggestion}
          </p>
          <div className="flex flex-wrap gap-1">
            {(d.hashtags ?? []).map((h: string) => (
              <span
                key={h}
                className={`${chip} border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300`}
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      );
    case "thumbnail_idea":
      return (
        <div className="space-y-2 text-sm text-slate-300">
          {(d.ideas ?? []).map((x: any, i: number) => (
            <div
              key={i}
              className="rounded-lg border border-slate-700/50 bg-slate-800/60 p-2"
            >
              <p className="font-semibold text-slate-100">
                {i + 1}. {x.concept}{" "}
                <span className="text-xs text-emerald-300">({x.emotion})</span>
              </p>
              <p className="text-xs">Text: &quot;{x.text_overlay}&quot;</p>
              <p className="text-xs">{x.visual_description}</p>
            </div>
          ))}
          {(d.image_urls ?? []).length > 0 && (
            <div className="grid grid-cols-1 gap-2 pt-2">
              {(d.image_urls ?? []).map((u: string, i: number) => (
                <a key={i} href={u} target="_blank" rel="noreferrer">
                  <ThumbImg url={u} alt={`Thumbnail idea ${i + 1}`} />
                </a>
              ))}
              <p className="text-xs text-slate-500">
                🎨 AI-generated images — click for full 1280×720 size.
              </p>
            </div>
          )}
        </div>
      );
  }
}
