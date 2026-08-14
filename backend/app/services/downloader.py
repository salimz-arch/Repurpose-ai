import os
import glob
import requests
import base64
import tempfile
import yt_dlp

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
COOKIE_FILE = os.path.join(BACKEND_DIR, "cookies.txt")

# Piped instances (multiple fallback)
PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
    "https://api.piped.yt",
]


def get_cookiefile():
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


def extract_video_id(url: str) -> str:
    """Extract video ID dari berbagai format URL YouTube."""
    import re
    patterns = [
        r"(?:v=|\/)([0-9A-Za-z_-]{11}).*",
        r"youtu\.be\/([0-9A-Za-z_-]{11})",
        r"embed\/([0-9A-Za-z_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise Exception(f"Could not extract video ID from: {url}")


def download_via_piped(video_id: str, output_dir: str) -> str:
    """Download audio via Piped API (no bot detection)."""
    for instance in PIPED_INSTANCES:
        try:
            resp = requests.get(f"{instance}/streams/{video_id}", timeout=15)
            if resp.status_code != 200:
                continue
            
            data = resp.json()
            audio_streams = data.get("audioStreams", [])
            
            if not audio_streams:
                continue
            
            # Pilih audio dengan bitrate tertinggi
            best_audio = max(audio_streams, key=lambda x: x.get("bitrate", 0))
            audio_url = best_audio["url"]
            
            # Download audio
            audio_resp = requests.get(audio_url, timeout=60, stream=True)
            output_path = os.path.join(output_dir, "audio.mp3")
            
            with open(output_path, "wb") as f:
                for chunk in audio_resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print(f"✅ Downloaded via Piped ({instance})")
            return output_path
            
        except Exception as e:
            print(f"⚠️ Piped {instance} failed: {e}")
            continue
    
    raise Exception("All Piped instances failed")


def download_audio(url: str, output_dir: str) -> str:
    os.makedirs(output_dir, exist_ok=True)
    
    # Coba Piped dulu (paling reliable)
    try:
        video_id = extract_video_id(url)
        return download_via_piped(video_id, output_dir)
    except Exception as e:
        print(f"⚠️ Piped failed: {e}, fallback to yt-dlp")
    
    # Fallback ke yt-dlp
    base_opts = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(output_dir, "audio.%(ext)s"),
        "quiet": True,
        "noplaylist": True,
        "extractor_args": {
            "youtube": {
                "player_client": ["mediaconnect", "web", "ios"],
            }
        },
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

    raise Exception(f"YouTube download gagal. Detail: {last_err}")