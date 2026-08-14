import os
import glob
import base64
import tempfile
import yt_dlp

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
COOKIE_FILE = os.path.join(BACKEND_DIR, "cookies.txt")


def get_cookiefile():
    """Prod: decode env YOUTUBE_COOKIES_B64. Dev: cookies.txt lokal."""
    b64 = os.environ.get("YOUTUBE_COOKIES_B64", "").strip()
    if b64:
        path = os.path.join(tempfile.gettempdir(), "yt_cookies.txt")
        try:
            with open(path, "wb") as f:
                f.write(base64.b64decode(b64))
            return path
        except Exception as e:
            print(f"⚠️ Gagal decode YOUTUBE_COOKIES_B64: {e}")
    if os.path.exists(COOKIE_FILE):
        return COOKIE_FILE
    return None


def download_audio(url: str, output_dir: str) -> str:
    os.makedirs(output_dir, exist_ok=True)
    base_opts = {
        "format": "bestaudio/best",  # Lebih flexible, gak maksa m4a
        "outtmpl": os.path.join(output_dir, "audio.%(ext)s"),
        "quiet": True,
        "noplaylist": True,
        "js_runtimes": {"node": {"path": None}},
        "remote_components": ["ejs:github"],
        "extractor_args": {
            "youtube": {
                "player_client": ["web", "mweb", "android"],  # Multiple fallback
            }
        },
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
    }

    attempts = []
    cookie = get_cookiefile()
    if cookie:
        attempts.append({**base_opts, "cookiefile": cookie})
    attempts.append(base_opts)

    last_err = None
    for opts in attempts:
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            files = glob.glob(os.path.join(output_dir, "audio.*"))
            if files:
                return files[0]
        except Exception as e:
            last_err = e
            for f in glob.glob(os.path.join(output_dir, "audio.*")):
                os.remove(f)

    raise Exception(
        f"YouTube download gagal. Detail: {last_err}"
    )