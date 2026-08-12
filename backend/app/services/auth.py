import hashlib, os, datetime, random, time
import jwt
from app.config import settings

# ── password hashing ──
def hash_password(pw: str, salt: str | None = None) -> str:
    salt = salt or os.urandom(16).hex()
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), 100_000).hex()
    return f"{salt}${h}"

def verify_password(pw: str, stored: str) -> bool:
    try:
        salt, _ = stored.split("$")
    except ValueError:
        return False
    return hash_password(pw, salt) == stored

# ── jwt ──
def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30)}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

def decode_token(token: str) -> str | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])["sub"]
    except Exception:
        return None

# ── pending registrations (email verification) ──
PENDING: dict = {}

def start_verification(email: str, name: str | None, password_hash: str | None) -> str:
    code = f"{random.randint(0, 999999):06d}"
    PENDING[email] = {
        "code": code, "exp": time.time() + 600, "attempts": 0,
        "last_sent": time.time(), "name": name, "pw": password_hash,
    }
    return code

def check_code(email: str, code: str):
    rec = PENDING.get(email)
    if not rec:
        return None, "No pending registration. Please register first."
    if time.time() > rec["exp"]:
        return None, "Code expired. Please resend a new code."
    if rec["attempts"] >= 5:
        return None, "Too many wrong attempts. Please resend a new code."
    if rec["code"] != code.strip():
        rec["attempts"] += 1
        return None, f"Wrong code. {5 - rec['attempts']} attempts left."
    return rec, ""

def pop_pending(email: str):
    return PENDING.pop(email, None)

def can_resend(email: str) -> bool:
    rec = PENDING.get(email)
    if not rec:
        return True
    return (time.time() - rec["last_sent"]) > 60

# ── password reset (forgot password) ──
RESETS: dict = {}

def start_reset(email: str) -> str:
    code = f"{random.randint(0, 999999):06d}"
    RESETS[email] = {"code": code, "exp": time.time() + 600, "attempts": 0, "last_sent": time.time()}
    return code

def check_reset(email: str, code: str):
    rec = RESETS.get(email)
    if not rec:
        return None, "No reset request found. Please request a new code."
    if time.time() > rec["exp"]:
        return None, "Code expired. Please request a new code."
    if rec["attempts"] >= 5:
        return None, "Too many wrong attempts. Please request a new code."
    if rec["code"] != code.strip():
        rec["attempts"] += 1
        return None, f"Wrong code. {5 - rec['attempts']} attempts left."
    return rec, ""

def pop_reset(email: str):
    return RESETS.pop(email, None)

def can_resend_reset(email: str) -> bool:
    rec = RESETS.get(email)
    if not rec:
        return True
    return (time.time() - rec["last_sent"]) > 60