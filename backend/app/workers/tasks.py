from app.config import settings
from app.models import SessionLocal, Project, ProjectStatus
from app.services import downloader, transcriber, repurposer, transcript, thumbnail

ASSETS = ["summary", "ig_caption", "twitter_thread", "blog_seo", "short_script", "thumbnail_idea", "yt_description", "tiktok_caption"]

def _get(pid):
    db = SessionLocal()
    try:
        p = db.get(Project, pid)
        return {"url": p.source_url, "tone": p.tone, "language": p.language}
    finally:
        db.close()

def _update(pid, **fields):
    db = SessionLocal()
    try:
        p = db.get(Project, pid)
        for k, v in fields.items():
            setattr(p, k, v)
        db.commit()
    finally:
        db.close()

def process_project(project_id: str):
    try:
        meta = _get(project_id)
        _update(project_id, status=ProjectStatus.transcribing)
        tr = transcript.fetch_transcript(meta["url"])

        if tr:
            text, segs = tr["text"], tr["segments"]
        else:
            _update(project_id, status=ProjectStatus.downloading)
            audio = downloader.download_audio(meta["url"], f"{settings.upload_dir}/{project_id}")
            _update(project_id, status=ProjectStatus.transcribing)
            tr = transcriber.transcribe(audio, meta["language"])
            text, segs = tr["text"], tr["segments"]

        timeline = repurposer.build_timeline(segs)
        _update(project_id, transcript=text, status=ProjectStatus.generating)
        results = {
            k: repurposer.generate_asset(k, text, meta["tone"], meta["language"], timeline=timeline)
            for k in ASSETS
        }
        if "thumbnail_idea" in results:
            results["thumbnail_idea"]["image_urls"] = thumbnail.build_image_urls(results["thumbnail_idea"])
        _update(project_id, results=results, status=ProjectStatus.done)
    except Exception as e:
        _update(project_id, status=ProjectStatus.failed, error=str(e))