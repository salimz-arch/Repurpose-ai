import io
import zipfile
import datetime
import requests

def _lines(*parts):
    return "\n\n".join(p for p in parts if p) + "\n"

def build_zip(results: dict, source_url: str) -> bytes:
    files = {}

    ig = results.get("ig_caption") or {}
    files["instagram_caption.md"] = _lines(
        "# Instagram Caption", f"**{ig.get('hook', '')}**", ig.get("caption", ""),
        ig.get("cta", ""), " ".join(ig.get("hashtags", [])),
    )

    tw = results.get("twitter_thread") or {}
    tweets = tw.get("tweets", [])
    files["twitter_thread.md"] = _lines(
        "# Twitter/X Thread",
        "\n\n".join(f"**{i + 1}/{len(tweets)}** {t}" for i, t in enumerate(tweets)),
    )

    blog = results.get("blog_seo") or {}
    files["seo_blog_post.md"] = _lines(
        f"# {blog.get('title', '')}", f"*{blog.get('meta_description', '')}*",
        "Keywords: " + ", ".join(blog.get("keywords", [])), blog.get("content", ""),
    )

    sc = results.get("short_script") or {}
    scenes = "\n\n".join(
        f"### {s.get('time', '')}\n🎥 {s.get('visual', '')}\n🎙️ {s.get('voiceover', '')}"
        for s in sc.get("scenes", [])
    )
    files["short_video_script.md"] = _lines(
        "# Short Video Script", f"🪝 HOOK: {sc.get('hook_0_3s', '')}", scenes,
        f"CTA: {sc.get('cta', '')}", sc.get("caption", ""), " ".join(sc.get("hashtags", [])),
    )

    sm = results.get("summary") or {}
    files["key_points_summary.md"] = _lines(
        "# Key Points Summary", sm.get("tldr", ""),
        "\n".join(f"- {k}" for k in sm.get("key_points", [])),
        "\n".join(f"> {q}" for q in sm.get("quotes", [])),
    )

    yt = results.get("yt_description") or {}
    files["youtube_description.md"] = _lines(
        f"# {yt.get('title', '')}", yt.get("description", ""),
        "Tags: " + ", ".join(yt.get("tags", [])),
        "## Chapters\n" + "\n".join(f"{c.get('time', '')} {c.get('title', '')}" for c in yt.get("chapters", [])),
    )

    th = results.get("thumbnail_idea") or {}
    ideas = "\n\n".join(
        f"### {i + 1}. {x.get('concept', '')} ({x.get('emotion', '')})\n"
        f"Teks overlay: {x.get('text_overlay', '')}\n{x.get('visual_description', '')}"
        for i, x in enumerate(th.get("ideas", []))
    )
    files["thumbnail_ideas.md"] = _lines("# Thumbnail Ideas", ideas, f"Image prompt: {th.get('image_prompt', '')}")

    tk = results.get("tiktok_caption") or {}
    files["tiktok_caption.md"] = _lines(
        "# TikTok Caption", tk.get("caption", ""), tk.get("cta", ""),
        "🎵 Sound: " + str(tk.get("sound_suggestion", "")),
        " ".join(tk.get("hashtags", [])),
    )

    readme = _lines(
        "⚡ RePurpose AI — Export Pack",
        f"Source: {source_url}",
        f"Dibuat: {datetime.datetime.now().isoformat(timespec='seconds')}",
        "Isi pack: " + ", ".join(files.keys()),
        "Gambar thumbnail ada di folder /thumbnails (jika berhasil diunduh).",
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("README.txt", readme)
        for name, content in files.items():
            z.writestr(name, content)
        urls = th.get("image_urls", [])
        if urls:
            z.writestr("thumbnails/urls.txt", "\n".join(urls))
            for i, u in enumerate(urls):
                try:  # skip gambar yang gagal/lama, jangan sampai gagalkan zip
                    r = requests.get(u, timeout=20)
                    if r.status_code == 200 and r.content:
                        z.writestr(f"thumbnails/thumbnail_{i + 1}.jpg", r.content)
                except Exception:
                    pass
    return buf.getvalue()