import hmac, hashlib
from urllib.parse import quote
from app.config import settings

PACKAGES = {
    "starter": {"credits": 5,   "price": 10_000,  "label": "Starter (+5)"},
    "basic":   {"credits": 15,  "price": 25_000,  "label": "Basic (+15)"},
    "pro":     {"credits": 30,  "price": 45_000,  "label": "Pro (+30)"},
    "premium": {"credits": 100, "price": 120_000, "label": "Premium (+100)"},
}

def approve_token(order_id: str) -> str:
    """Token rahasia buat link approve (HMAC, gak bisa ditebak)."""
    return hmac.new(settings.jwt_secret.encode(), order_id.encode(),
                    hashlib.sha256).hexdigest()[:32]

def verify_approve(order_id: str, token: str) -> bool:
    return hmac.compare_digest(approve_token(order_id), token)

def build_wa_link(order_id: str, package: str, amount: int, user_email: str) -> str:
    p = PACKAGES[package]
    approve_url = (f"{settings.backend_public_url}/api/v1/payments/"
                   f"{order_id}/approve?token={approve_token(order_id)}")
    text = (
        "Halo RePurpose AI! 👋\nSaya sudah transfer untuk top-up kredit.\n\n"
        f"📦 Paket: {p['label']}\n"
        f"💰 Nominal: Rp{amount:,}\n"
        f"🔖 Kode Order: {order_id}\n"
        f"📧 Email user: {user_email}\n\n"
        "Mohon dicek & dikonfirmasi ya, makasih! 🙏\n\n"
        f"─── UNTUK ADMIN ───\nKlik untuk approve otomatis:\n{approve_url}"
    )
    return f"https://wa.me/{settings.wa_owner_number}?text={quote(text)}"