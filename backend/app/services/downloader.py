import os
import glob
import yt_dlp

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
COOKIE_FILE = os.path.join(BACKEND_DIR, "cookies.txt")

def download_audio(url: str, output_dir: str) -> str:
    os.makedirs(output_dir, exist_ok=True)
    base_opts = {
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "outtmpl": os.path.join(output_dir, "audio.%(ext)s"),
        "quiet": True,
        "noplaylist": True,
        "js_runtimes": {"node": {"path": None}},
        "remote_components": ["ejs:github"],
    }

    attempts = []
    if os.path.exists(COOKIE_FILE):
        attempts.append({**base_opts, "cookiefile": COOKIE_FILE})  # jalur sakti
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
        "YouTube mendeteksi bot dan cookies tidak tersedia. "
        "Solusi: (1) taruh file cookies.txt di folder backend (export via extension "
        "'Get cookies.txt LOCALLY'), atau (2) ganti jaringan (tethering HP). "
        f"Detail: {last_err}"
    )