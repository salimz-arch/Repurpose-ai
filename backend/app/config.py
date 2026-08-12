from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── database ──
    database_url: str = "sqlite:///./repurpose.db"

    # ── LLM / Whisper (Groq) ──
    openai_api_key: str = ""
    openai_base_url: str = "https://api.groq.com/openai/v1"
    llm_model: str = "llama-3.3-70b-versatile"

    # ── storage ──
    upload_dir: str = "./uploads"

    # ── notion export ──
    notion_token: str = ""
    notion_parent_page_id: str = ""

    # ── auth ──
    jwt_secret: str = "repurpose-ai-dev-secret"
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/auth/google/callback"
    frontend_url: str = "http://localhost:3000"

    # ── email verification (SMTP) ──
    # kosong = dev mode (kode di-print di terminal backend)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = ""

    # ── pembayaran via whatsapp ──
    wa_owner_number: str = "6281234567890"
    payment_info: str = "Transfer via QRIS / DANA / OVO a.n. RePurpose AI"
    backend_public_url: str = "http://localhost:8000"

settings = Settings()
