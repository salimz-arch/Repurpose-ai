import re
from youtube_transcript_api import YouTubeTranscriptApi

def extract_video_id(url: str) -> str:
    m = re.search(r"(?:v=|youtu\.be/|/shorts/|/embed/)([\w-]{11})", url)
    return m.group(1) if m else url.strip()

def fetch_transcript(url: str):
    """Return {"text": str, "segments": [{"start": float, "text": str}]} atau None."""
    try:
        vid = extract_video_id(url)
        api = YouTubeTranscriptApi()
        try:
            data = api.fetch(vid, languages=["id", "en"])
        except Exception:
            tlist = api.list(vid)
            lang = next(iter(tlist)).language
            data = api.fetch(vid, languages=[lang])
        segs = [{"start": s.start, "text": s.text} for s in data.snippets]
        text = " ".join(s["text"] for s in segs).strip()
        return {"text": text, "segments": segs} if text else None
    except Exception:
        return None