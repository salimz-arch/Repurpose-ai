from openai import OpenAI
from app.config import settings

client = OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)

def transcribe(audio_path: str, language: str | None = None) -> dict:
    with open(audio_path, "rb") as f:
        resp = client.audio.transcriptions.create(
            model="whisper-large-v3",
            file=f,
            response_format="verbose_json",
            **({"language": language} if language and language != "auto" else {}),
        )
    segs = [{"start": s.start, "text": s.text} for s in (resp.segments or [])]
    return {"text": resp.text, "segments": segs}