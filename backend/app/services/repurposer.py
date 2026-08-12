import json
import time
from openai import OpenAI, RateLimitError, APIStatusError 
from app.config import settings

client = OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
FALLBACK_MODEL = "llama-3.1-8b-instant"

TONES = {
    "formal":    "profesional, bahasa baku, jelas dan terstruktur",
    "santai":    "kasual, ramah, seperti ngobrol dengan teman, boleh pakai emoji",
    "marketing": "persuasif, fokus benefit, hook kuat, CTA jelas",
}

SYSTEM = ("Kamu adalah expert content repurposing strategist. "
          "Ubah transkrip menjadi format yang diminta. "
          "WAJIB balas dalam JSON valid sesuai skema.")

PROMPTS = {
 "summary": """Buat ringkasan. Skema JSON:
   {"tldr": string, "key_points": [5-10 string poin penting], "quotes": [2-3 kutipan menarik]}""",

 "ig_caption": """Buat caption Instagram. Skema JSON:
   {"hook": string (kalimat pertama yang stop-scrolling),
    "caption": string (maks 2200 char, line break rapi),
    "cta": string, "hashtags": [10-15 hashtag relevan campur besar-kecil]}""",

 "twitter_thread": """Buat thread X/Twitter. Skema JSON:
   {"tweets": [5-8 string], } — tweet 1 = hook kuat + "(1/n)",
   tiap tweet maks 280 karakter, tweet terakhir = CTA follow/share.""",

 "blog_seo": """Buat artikel blog SEO. Skema JSON:
   {"title": string (maks 60 char, mengandung keyword),
    "meta_description": string (maks 155 char),
    "keywords": [5-10 keyword suggestion],
    "outline": [{"h2": string, "points": [string]}],
    "content": string (800-1200 kata, format markdown)}""",

 "short_script": """Buat script video short/Reels 30-60 detik. Skema JSON:
   {"hook_0_3s": string, "scenes": [{"time": string, "visual": string,
    "voiceover": string}], "cta": string, "caption": string, "hashtags": [string]}""",

 "thumbnail_idea": """Buat 3 konsep thumbnail. Skema JSON:
   {"ideas": [{"concept": string, "text_overlay": string (maks 5 kata),
     "visual_description": string, "emotion": string}, ...],
    "image_prompt": string (prompt bahasa Inggris untuk image generator)}""",

 "yt_description": """Buat deskripsi YouTube + chapters. Skema JSON:
   {"title": string (judul catchy maks 100 char),
    "description": string (150-300 kata: hook pembuka, ringkasan isi, CTA subscribe & komentar, diakhiri 3-5 hashtag),
    "tags": [10-15 keyword tag],
    "chapters": [{"time": string (MM:SS atau HH:MM:SS), "title": string maks 60 char}, 4-8 item]}
   ATURAN CHAPTERS: chapter pertama WAJIB 00:00, dan HANYA boleh memakai timestamp yang tersedia di TIMELINE.""",

    "tiktok_caption": """Buat caption TikTok. Skema JSON:
   {"caption": string (maks 400 char, gaya super kasual & trendy, hook kuat di baris pertama, pakai emoji, line break rapi),
    "hashtags": [8-15 hashtag campuran: 3-5 trending umum (#fyp #foryou #viral) + sisanya niche relevan],
    "cta": string (ajakan interaksi: komen / duet / stitch / share),
    "sound_suggestion": string (saran mood/jenis sound yang cocok, misal 'sound cinematic dramatis' atau 'lagu sped-up trending')}""",

}

def _smart_cut(text: str, limit: int = 12000) -> str:
    """Potong transkrip: 70% awal + 30% akhir (biar ending gak hilang)."""
    if len(text) <= limit:
        return text
    head = int(limit * 0.7)
    return text[:head] + "\n\n[...bagian tengah dipotong...]\n\n" + text[-(limit - head):]

def _chat(messages):
    last_err = None
    for model in [settings.llm_model, FALLBACK_MODEL]:
        for attempt in range(3):
            try:
                return client.chat.completions.create(
                    model=model,
                    response_format={"type": "json_object"},
                    messages=messages,
                    temperature=0.8,
                )
            except APIStatusError as e:
                if e.status_code not in (429, 413):
                    raise
                last_err = e
                time.sleep(3 * (attempt + 1))
    raise last_err

def _fmt(ts: float) -> str:
    ts = int(ts)
    h, rem = divmod(ts, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"

def build_timeline(segments: list, max_points: int = 8, chars: int = 250) -> str:
    """Ringkasan bertimestamp yang menutupi SELURUH durasi video (hemat token)."""
    segs = [s for s in segments if s.get("text")]
    if not segs:
        return ""
    duration = max(segs[-1].get("start", 0), 1)
    n = max(4, min(max_points, int(duration // 60) + 1))
    step = duration / n
    lines, idx = [], 0
    for i in range(n):
        t0 = i * step
        buf = []
        while idx < len(segs) and segs[idx]["start"] < t0 + step:
            buf.append(segs[idx]["text"])
            idx += 1
        if not buf and i == 0:
            buf = [segs[0]["text"]]
        chunk = " ".join(buf)[:chars]
        if chunk:
            lines.append(f"[{_fmt(t0)}] {chunk}")
    return "\n".join(lines)

def generate_asset(kind: str, transcript: str, tone: str, language: str, timeline: str = "") -> dict:
    lang_note = "auto" if language == "auto" else f"gunakan bahasa kode '{language}'"
    extra = f"\n\nTIMELINE VIDEO (pakai timestamp ini untuk chapters):\n{timeline}" if timeline else ""
    user = (f"TONE: {TONES.get(tone, TONES['santai'])}.\n"
            f"BAHASA OUTPUT: {lang_note}.\n"
            f"{PROMPTS[kind]}{extra}\n\nTRANSKRIP:\n{_smart_cut(transcript)}")
    resp = _chat([{"role": "system", "content": SYSTEM},
                  {"role": "user", "content": user}])
    return json.loads(resp.choices[0].message.content)