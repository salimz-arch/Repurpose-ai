import json
import requests
from app.config import settings

NOTION_API = "https://api.notion.com/v1"

TITLES = {
    "ig_caption": "📸 Instagram Caption",
    "twitter_thread": "🐦 Twitter/X Thread",
    "blog_seo": "✍️ SEO Blog Post",
    "short_script": "🎬 Short Video Script",
    "summary": "✅ Key Points Summary",
    "yt_description": "▶️ YouTube Description",
    "thumbnail_idea": "🖼️ Thumbnail Ideas",
    "tiktok_caption": "🎵 TikTok Caption",
}

def _headers():
    return {
        "Authorization": f"Bearer {settings.notion_token}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }

def _rt(text) -> list:
    text = str(text or "")
    chunks = [text[i:i + 1900] for i in range(0, len(text), 1900)] or [""]
    return [{"type": "text", "text": {"content": c}} for c in chunks]

def _p(t):
    return {"object": "block", "type": "paragraph", "paragraph": {"rich_text": _rt(t)}}

def _h1(t):
    return {"object": "block", "type": "heading_1", "heading_1": {"rich_text": _rt(t)}}

def _h3(t):
    return {"object": "block", "type": "heading_3", "heading_3": {"rich_text": _rt(t)}}

def _b(t):
    return {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rt(t)}}

def _img(u):
    return {"object": "block", "type": "image", "image": {"type": "external", "external": {"url": u}}}

def _md_blocks(md: str) -> list:
    blocks = []
    for line in (md or "").splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith("### "):
            blocks.append(_h3(s[4:]))
        elif s.startswith("## "):
            blocks.append(_h3(s[3:]))
        elif s.startswith("# "):
            blocks.append(_h1(s[2:]))
        elif s.startswith(("- ", "* ")):
            blocks.append(_b(s[2:]))
        else:
            blocks.append(_p(s))
    return blocks

def _build(kind: str, d) -> list:
    if not d:
        return []
    if kind == "ig_caption":
        return [_p(d.get("hook")), _p(d.get("caption")), _p(d.get("cta")),
                _p(" ".join(d.get("hashtags", [])))]
    if kind == "twitter_thread":
        n = len(d.get("tweets", []))
        return [_p(f"{i + 1}/{n} {t}") for i, t in enumerate(d.get("tweets", []))]
    if kind == "blog_seo":
        b = [_p(f"Meta: {d.get('meta_description')}")]
        b += [_b(k) for k in d.get("keywords", [])]
        b += _md_blocks(d.get("content"))
        return b
    if kind == "short_script":
        b = [_p(f"HOOK: {d.get('hook_0_3s')}")]
        for s in d.get("scenes", []):
            b.append(_h3(s.get("time")))
            b.append(_p(f"Visual: {s.get('visual')}"))
            b.append(_p(f"VO: {s.get('voiceover')}"))
        b.append(_p(f"CTA: {d.get('cta')}"))
        return b
    if kind == "summary":
        return [_p(d.get("tldr"))] + [_b(k) for k in d.get("key_points", [])]
    if kind == "thumbnail_idea":
        b = []
        for i, x in enumerate(d.get("ideas", [])):
            b.append(_h3(f"{i + 1}. {x.get('concept')} ({x.get('emotion')})"))
            b.append(_p(f"Teks overlay: {x.get('text_overlay')}"))
            b.append(_p(x.get("visual_description")))
        for u in d.get("image_urls", []):
            b.append(_img(u))
        return b
    if kind == "yt_description":
        b = [_p(d.get("title")), _p(d.get("description")),
             _p("Tags: " + ", ".join(d.get("tags", [])))]
        b += [_p(f"{c.get('time')}  {c.get('title')}") for c in d.get("chapters", [])]
        return b
    if kind == "tiktok_caption":
        return [_p(d.get("caption")), _p("Hashtags: " + ", ".join(d.get("hashtags", []))),
                _p(f"CTA: {d.get('cta')}"), _p(f"Sound: {d.get('sound_suggestion')}")]
    return [_p(json.dumps(d, ensure_ascii=False))]
    

def export_results(results: dict, kind: str) -> str:
    if not settings.notion_token or not settings.notion_parent_page_id:
        raise Exception(
            "Notion belum dikonfigurasi. Isi NOTION_TOKEN & NOTION_PARENT_PAGE_ID "
            "di backend/.env lalu restart uvicorn."
        )
    keys = list(results.keys()) if kind == "all" else [kind]
    blocks = []
    for k in keys:
        blocks.append(_h1(TITLES.get(k, k)))
        blocks += _build(k, results.get(k))
    title = (results.get("blog_seo") or {}).get("title") or "RePurpose AI Export"
    payload = {
        "parent": {"page_id": settings.notion_parent_page_id.replace("-", "")},
        "properties": {"title": {"title": [{"text": {"content": f"⚡ {title}"}}]}},
        "children": blocks[:990],
    }
    r = requests.post(f"{NOTION_API}/pages", headers=_headers(), json=payload, timeout=30)
    if r.status_code != 200:
        raise Exception(f"Notion error {r.status_code}: {r.text[:300]}")
    return r.json().get("url", "")