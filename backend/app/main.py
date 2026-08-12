import uuid, threading, datetime as dt
from urllib.parse import urlencode

import requests
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, RedirectResponse
from pydantic import BaseModel
from fastapi.responses import Response, RedirectResponse, HTMLResponse
from app.config import settings
from app.services import mailer
from app.models import Base, engine, SessionLocal, Project, ProjectStatus, User, Payment, PaymentStatus
from app.workers.tasks import process_project
from app.services import notion_export, pack_export, auth as authsvc, payment as pay_svc

Base.metadata.create_all(engine)

# ── Auto-migration (SQLite) ──────────────────────
def _migrate_sqlite():
    from sqlalchemy import inspect, text
    if not settings.database_url.startswith("sqlite"):
        return
    insp = inspect(engine)
    if insp.has_table("projects"):
        cols = {c["name"] for c in insp.get_columns("projects")}
        if "user_id" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE projects ADD COLUMN user_id VARCHAR"))
            print("🔧 Migration: added column projects.user_id")
_migrate_sqlite()

app = FastAPI(title="RePurpose AI API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ══════════ PYDANTIC MODELS ══════════
class ProjectCreate(BaseModel):
    url: str
    language: str = "id"
    tone: str = "santai"

class NotionExportPayload(BaseModel):
    kind: str = "all"

class AuthPayload(BaseModel):
    email: str
    password: str
    name: str | None = None

class VerifyPayload(BaseModel):
    email: str
    code: str

class EmailPayload(BaseModel):
    email: str

class ResetPayload(BaseModel):
    email: str
    code: str
    new_password: str

class PaymentCreate(BaseModel):
    package: str

# ══════════ AUTH DEPENDENCY ══════════
def get_user_id(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Login required.")
    uid = authsvc.decode_token(authorization.removeprefix("Bearer ").strip())
    if not uid:
        raise HTTPException(401, "Invalid token.")
    return uid

# ══════════ AUTH ENDPOINTS ══════════
@app.post("/api/v1/auth/register")
def register(p: AuthPayload):
    db = SessionLocal()
    try:
        email = p.email.strip().lower()
        if "@" not in email or "." not in email:
            raise HTTPException(400, "Invalid email format.")
        if len(p.password) < 6:
            raise HTTPException(400, "Password must be at least 6 characters.")
        if db.query(User).filter_by(email=email).first():
            raise HTTPException(400, "Email already registered. Please login.")
        code = authsvc.start_verification(
            email, p.name or email.split("@")[0], authsvc.hash_password(p.password))
        sent = mailer.send_code(email, code)
        return {"pending": True, "email": email, "dev_mode": not sent}
    finally:
        db.close()

@app.post("/api/v1/auth/verify")
def verify(p: VerifyPayload):
    email = p.email.strip().lower()
    rec, err = authsvc.check_code(email, p.code)
    if not rec:
        raise HTTPException(400, err)
    db = SessionLocal()
    try:
        if db.query(User).filter_by(email=email).first():
            authsvc.pop_pending(email)
            raise HTTPException(400, "Email already registered. Please login.")
        u = User(id=uuid.uuid4().hex, email=email, name=rec["name"],
                 password_hash=rec["pw"], credits=3)
        db.add(u); db.commit()
        authsvc.pop_pending(email)
        return {"token": authsvc.make_token(u.id), "email": u.email, "name": u.name, "credits": u.credits}
    finally:
        db.close()

@app.post("/api/v1/auth/resend")
def resend(p: EmailPayload):
    email = p.email.strip().lower()
    if email not in authsvc.PENDING:
        raise HTTPException(400, "No pending registration.")
    if not authsvc.can_resend(email):
        raise HTTPException(429, "Please wait 60 seconds before resending.")
    rec = authsvc.PENDING[email]
    code = authsvc.start_verification(email, rec["name"], rec["pw"])
    sent = mailer.send_code(email, code)
    return {"ok": True, "dev_mode": not sent}

@app.post("/api/v1/auth/forgot")
def forgot(p: EmailPayload):
    email = p.email.strip().lower()
    db = SessionLocal()
    try:
        u = db.query(User).filter_by(email=email).first()
    finally:
        db.close()
    dev = False
    if u and u.password_hash:
        if not authsvc.can_resend_reset(email):
            raise HTTPException(429, "Please wait 60 seconds before resending.")
        code = authsvc.start_reset(email)
        dev = not mailer.send_code(email, code, purpose="reset")
    return {"ok": True, "dev_mode": dev}

@app.post("/api/v1/auth/reset")
def reset_password(p: ResetPayload):
    if len(p.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    email = p.email.strip().lower()
    rec, err = authsvc.check_reset(email, p.code)
    if not rec:
        raise HTTPException(400, err)
    db = SessionLocal()
    try:
        u = db.query(User).filter_by(email=email).first()
        if not u:
            raise HTTPException(400, "Account not found.")
        u.password_hash = authsvc.hash_password(p.new_password)
        db.commit()
        authsvc.pop_reset(email)
        return {"ok": True}
    finally:
        db.close()

@app.post("/api/v1/auth/login")
def login(p: AuthPayload):
    db = SessionLocal()
    try:
        u = db.query(User).filter_by(email=p.email).first()
        if not u or not u.password_hash or not authsvc.verify_password(p.password, u.password_hash):
            raise HTTPException(401, "Wrong email or password.")
        return {"token": authsvc.make_token(u.id), "email": u.email, "name": u.name, "credits": u.credits}
    finally:
        db.close()

@app.get("/api/v1/auth/google")
def google_login():
    if not settings.google_client_id:
        raise HTTPException(400, "Google OAuth not configured.")
    params = urlencode({
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "prompt": "select_account",
    })
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")

@app.get("/api/v1/auth/google/callback")
def google_callback(code: str):
    r = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "code": code, "grant_type": "authorization_code",
        "redirect_uri": settings.google_redirect_uri,
    }, timeout=15)
    if r.status_code != 200:
        raise HTTPException(400, f"Google OAuth failed: {r.text[:200]}")
    toks = r.json()
    info = requests.get("https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {toks.get('access_token')}"},
                        timeout=15).json()
    email, name = info.get("email"), info.get("name")
    if not email:
        raise HTTPException(400, "Google did not return email.")
    db = SessionLocal()
    try:
        u = db.query(User).filter_by(email=email).first()
        if not u:
            u = User(id=uuid.uuid4().hex, email=email, name=name, credits=3)
            db.add(u); db.commit()
        return RedirectResponse(f"{settings.frontend_url}/dashboard?token={authsvc.make_token(u.id)}")
    finally:
        db.close()

@app.get("/api/v1/me")
def me(uid: str = Depends(get_user_id)):
    db = SessionLocal()
    try:
        u = db.get(User, uid)
        if not u:
            raise HTTPException(401, "User not found.")
        return {"email": u.email, "name": u.name, "credits": u.credits}
    finally:
        db.close()

# ══════════ PAYMENTS (WhatsApp) ══════════
@app.get("/api/v1/payments/packages")
def list_packages():
    return {"packages": pay_svc.PACKAGES, "payment_info": settings.payment_info}

@app.post("/api/v1/payments/create")
def create_payment(payload: PaymentCreate, uid: str = Depends(get_user_id)):
    if payload.package not in pay_svc.PACKAGES:
        raise HTTPException(400, "Invalid package.")
    p = pay_svc.PACKAGES[payload.package]
    order_id = f"RP-{uuid.uuid4().hex[:8].upper()}"
    db = SessionLocal()
    try:
        u = db.get(User, uid)
        if not u:
            raise HTTPException(401, "User not found.")
        db.add(Payment(id=order_id, user_id=uid, package=payload.package,
                       amount=p["price"], credits=p["credits"]))
        db.commit()
        return {
            "order_id": order_id, "package": payload.package,
            "amount": p["price"], "credits": p["credits"],
            "payment_info": settings.payment_info,
            "wa_link": pay_svc.build_wa_link(order_id, payload.package, p["price"], u.email),
        }
    finally:
        db.close()

@app.get("/api/v1/payments/{order_id}/approve", response_class=HTMLResponse)
def approve_page(order_id: str, token: str):
    """Halaman konfirmasi — link preview/bot gak akan nge-klik tombol."""
    if not pay_svc.verify_approve(order_id, token):
        return HTMLResponse("<h1>❌ Invalid token</h1>", status_code=403)
    db = SessionLocal()
    try:
        p = db.get(Payment, order_id)
        if not p:
            return HTMLResponse("<h1>❌ Order not found</h1>", status_code=404)
        if p.status == PaymentStatus.success:
            return HTMLResponse("<h1>✅ Already approved</h1>")
        u = db.get(User, p.user_id)
        return HTMLResponse(f"""
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{{font-family:sans-serif;background:#0f172a;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;margin:0}}
.card{{background:#1e293b;padding:28px;border-radius:16px;max-width:340px;text-align:center}}
button{{background:#f59e0b;border:0;padding:14px 24px;border-radius:12px;font-weight:700;font-size:16px;margin-top:16px;cursor:pointer}}
</style></head><body><div class="card">
<h2>💎 Approve Payment?</h2>
<p>Order <b>{p.id}</b><br>{p.package} • Rp{p.amount:,}<br>+{p.credits} credits → {u.email if u else "?"}</p>
<form method="post" action="/api/v1/payments/{p.id}/approve/confirm?token={token}">
<button>✅ YES — uang sudah masuk</button></form>
<p style="font-size:12px;color:#94a3b8">Klik HANYA setelah cek mutasi bank/e-wallet.</p>
</div></body></html>""")
    finally:
        db.close()

@app.post("/api/v1/payments/{order_id}/approve/confirm")
def approve_confirm(order_id: str, token: str):
    """Eksekusi approve — cuma lewat tombol form, bukan link."""
    if not pay_svc.verify_approve(order_id, token):
        raise HTTPException(403, "Invalid approval token.")
    db = SessionLocal()
    try:
        p = db.get(Payment, order_id)
        if not p:
            raise HTTPException(404, "Payment not found.")
        if p.status == PaymentStatus.pending:
            p.status = PaymentStatus.success
            p.paid_at = dt.datetime.utcnow()
            u = db.get(User, p.user_id)
            if u:
                u.credits += p.credits
            db.commit()
            print(f"✅ WA payment approved: {order_id} → +{p.credits} credits")
        return HTMLResponse("<h1>✅ Approved! Credits added.</h1>")
    finally:
        db.close()
# ══════════ PROJECTS ══════════
@app.post("/api/v1/projects")
def create_project(payload: ProjectCreate, uid: str = Depends(get_user_id)):
    db = SessionLocal()
    try:
        u = db.get(User, uid)
        if not u:
            raise HTTPException(401, "User not found.")
        if u.credits <= 0:
            raise HTTPException(402, "Out of credits! Upgrade to keep generating. 💳")
        u.credits -= 1
        pid = uuid.uuid4().hex
        db.add(Project(id=pid, source_url=payload.url,
                       language=payload.language, tone=payload.tone, user_id=uid))
        db.commit()
        threading.Thread(target=process_project, args=(pid,), daemon=True).start()
        return {"id": pid, "status": "queued", "credits": u.credits}
    finally:
        db.close()

@app.get("/api/v1/projects")
def list_projects(uid: str = Depends(get_user_id)):
    db = SessionLocal()
    try:
        rows = db.query(Project).filter_by(user_id=uid).order_by(Project.created_at.desc()).limit(100).all()
        out = []
        for p in rows:
            title = None
            if isinstance(p.results, dict):
                title = (p.results.get("blog_seo") or {}).get("title")
            out.append({
                "id": p.id, "source_url": p.source_url,
                "status": p.status.value if hasattr(p.status, "value") else p.status,
                "tone": p.tone, "language": p.language,
                "created_at": (p.created_at.isoformat() + "Z") if p.created_at else None,
                "title": title,
            })
        return {"projects": out}
    finally:
        db.close()

@app.get("/api/v1/projects/{pid}")
def get_project(pid: str):
    db = SessionLocal()
    try:
        p = db.get(Project, pid)
        if not p:
            raise HTTPException(404, "Project not found")
        return {"id": p.id, "status": p.status, "results": p.results,
                "error": p.error, "source_url": p.source_url}
    finally:
        db.close()

@app.delete("/api/v1/projects/{pid}")
def delete_project(pid: str, uid: str = Depends(get_user_id)):
    db = SessionLocal()
    try:
        p = db.get(Project, pid)
        if not p:
            raise HTTPException(404, "Project not found")
        if p.user_id and p.user_id != uid:
            raise HTTPException(403, "Not your project.")
        db.delete(p); db.commit()
        return {"ok": True}
    finally:
        db.close()

# ══════════ PUBLIC (share link) ══════════
@app.get("/api/v1/public/{pid}")
def public_project(pid: str):
    db = SessionLocal()
    try:
        p = db.get(Project, pid)
        if not p or p.status != ProjectStatus.done or not p.results:
            raise HTTPException(404, "Invalid link or project not completed.")
        return {
            "id": p.id, "source_url": p.source_url, "tone": p.tone, "language": p.language,
            "created_at": (p.created_at.isoformat() + "Z") if p.created_at else None,
            "title": (p.results.get("blog_seo") or {}).get("title") if isinstance(p.results, dict) else None,
            "results": p.results,
        }
    finally:
        db.close()

# ══════════ CONTENT LIBRARY ══════════
@app.get("/api/v1/library")
def list_library_types(uid: str = Depends(get_user_id)):
    """Return semua jenis konten yang tersedia."""
    types = ["instagram", "tiktok", "youtube", "twitter", "blog", "scripts", "summaries", "thumbnail"]
    return {"types": types}

@app.get("/api/v1/library/{content_type}")
def get_library_content(content_type: str, uid: str = Depends(get_user_id)):
    """Return semua konten dari type tertentu dari semua project user."""
    db = SessionLocal()
    try:
        projects = db.query(Project).filter_by(user_id=uid, status=ProjectStatus.done).all()
        results = []
        
        for p in projects:
            if not p.results or not isinstance(p.results, dict):
                continue
            
            # Map content_type ke key di results
            type_map = {
                "instagram": "ig_caption",
                "tiktok": "tiktok_caption",
                "youtube": "yt_description",
                "twitter": "twitter_thread",
                "blog": "blog_seo",
                "scripts": "short_script",
                "summaries": "summary",
                "thumbnail": "thumbnail_idea",
            }
            
            key = type_map.get(content_type)
            if not key or key not in p.results:
                continue
            
            results.append({
                "project_id": p.id,
                "source_url": p.source_url,
                "created_at": (p.created_at.isoformat() + "Z") if p.created_at else None,
                "content": p.results[key],
                "title": (p.results.get("blog_seo") or {}).get("title") or "Untitled",
            })
        
        return {"content_type": content_type, "items": results}
    finally:
        db.close()
# ══════════ EXPORTS ══════════
@app.post("/api/v1/projects/{pid}/export/notion")
def export_notion(pid: str, payload: NotionExportPayload, uid: str = Depends(get_user_id)):
    db = SessionLocal()
    try:
        p = db.get(Project, pid)
        if not p or not p.results:
            raise HTTPException(400, "Project has no results yet.")
        url = notion_export.export_results(p.results, payload.kind)
        return {"url": url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))
    finally:
        db.close()

@app.get("/api/v1/projects/{pid}/export/zip")
def export_zip(pid: str, uid: str = Depends(get_user_id)):
    db = SessionLocal()
    try:
        p = db.get(Project, pid)
        if not p or not p.results:
            raise HTTPException(400, "Project has no results yet.")
        data = pack_export.build_zip(p.results, p.source_url or "")
        return Response(data, media_type="application/zip",
                        headers={"Content-Disposition": f'attachment; filename="repurpose-{pid[:8]}.zip"'})
    finally:
        db.close()