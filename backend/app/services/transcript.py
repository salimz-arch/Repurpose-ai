"""Transcript service — Supadata API (prod) + youtube-transcript-api (fallback)."""
import os
import re

import requests
from youtube_transcript_api import YouTubeTranscriptApi


def extract_video_id(url: str) -> str:
    m = re.search(r"(?:v=|youtu\.be/|/shorts/|/embed/)([\w-]{11})", url)
    return m.group(1) if m else url.strip()


def _fetch_via_supadata(video_id: str):
    """Coba Supadata (prioritas utama). Return dict atau None."""
    key = os.environ.get("SUPADATA_API_KEY", "").strip()
    if not key:
        return None

    base_url = "https://api.supadata.ai/v1/transcript"
    # Coba beberapa bahasa: id, en, auto
    for lang in ["id", "en", None]:
        try:
            params = {"url": f"https://youtu.be/{video_id}"}
            if lang:
                params["lang"] = lang
            r = requests.get(
                base_url,
                params=params,
                headers={"x-api-key": key},
                timeout=90,
            )
            if r.status_code != 200:
                continue
            data = r.json()
            segs_raw = data.get("content") or []
            if not segs_raw:
                continue

            # Convert offset (ms) → start (detik), skip noise
            segs = []
            for s in segs_raw:
                text = (s.get("text") or "").strip()
                if not text or text.lower() in ("[music]", "[musik]", "♪"):
                    continue
                segs.append({
                    "start": s.get("offset", 0) / 1000.0,
                    "text": text,
                })
            if not segs:
                continue

            text = " ".join(s["text"] for s in segs).strip()
            print(f"✅ Supadata OK (lang={data.get('lang')}): {len(text)} karakter, {len(segs)} segments")
            return {"text": text, "segments": segs}
        except Exception as e:
            print(f"⚠️ Supadata lang={lang} gagal: {e}")
            continue
    return None


def _fetch_via_local(video_id: str):
    """Fallback lokal: youtube-transcript-api (bagus buat dev di laptop)."""
    try:
        api = YouTubeTranscriptApi()
        try:
            data = api.fetch(video_id, languages=["id", "en"])
        except Exception:
            tlist = api.list(video_id)
            lang = next(iter(tlist)).language
            data = api.fetch(video_id, languages=[lang])
        segs = [{"start": s.start, "text": s.text} for s in data.snippets]
        text = " ".join(s["text"] for s in segs).strip()
        if text:
            print(f"✅ Local transcript OK: {len(text)} karakter")
            return {"text": text, "segments": segs}
    except Exception as e:
        print(f"⚠️ Local transcript gagal: {e}")
    return None


def fetch_transcript(url: str):
    """Return {"text": str, "segments": [{"start": float, "text": str}]} atau None."""
    vid = extract_video_id(url)

    # 1. Prioritas: Supadata API (anti-bot diurus server)
    result = _fetch_via_supadata(vid)
    if result:
        return result

    # 2. Fallback: youtube-transcript-api lokal
    result = _fetch_via_local(vid)
    if result:
        return result

    return None