import os
import smtplib
import socket
from email.mime.text import MIMEText

import requests

from app.config import settings

# ── Paksa IPv4 (Railway kadang gak punya rute IPv6) ──
_orig_getaddrinfo = socket.getaddrinfo

def _ipv4_only(host, port, family=0, type=0, proto=0, flags=0):
    return _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)

socket.getaddrinfo = _ipv4_only


def _send_via_brevo(email: str, subject: str, body: str) -> None:
    """Kirim lewat Brevo HTTP API (port 443 — kebal blokir SMTP)."""
    sender_email = os.getenv("BREVO_SENDER") or settings.smtp_from or settings.smtp_user
    resp = requests.post(
        "https://api.brevo.com/v3/transactional/emails",
        headers={
            "api-key": os.getenv("BREVO_API_KEY", ""),
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={
            "sender": {"name": "RePurpose AI", "email": sender_email},
            "to": [{"email": email}],
            "subject": subject,
            "textContent": body,
        },
        timeout=20,
    )
    resp.raise_for_status()


def _send_via_smtp(email: str, subject: str, body: str) -> None:
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = email
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as s:
        s.starttls()
        s.login(settings.smtp_user, settings.smtp_pass)
        s.send_message(msg)


def send_code(email: str, code: str, purpose: str = "verify") -> bool:
    """purpose: "verify" (register) atau "reset" (forgot password)."""
    label = "Reset" if purpose == "reset" else "Verification"
    subject = f"⚡ RePurpose AI — {label} Code"
    body = (
        f"Your RePurpose AI {'password reset' if purpose == 'reset' else 'verification'} code is: {code}\n\n"
        f"It expires in 10 minutes. If you didn't request this, ignore this email."
    )

    if not os.getenv("BREVO_API_KEY") and not (settings.smtp_user and settings.smtp_pass):
        print(f"\n📧 [DEV MODE] {label} code for {email}: {code}\n")
        return False

    try:
        if os.getenv("BREVO_API_KEY"):
            _send_via_brevo(email, subject, body)
        else:
            _send_via_smtp(email, subject, body)
        print(f"\n✅ {label} email sent to {email}\n")
        return True
    except Exception as e:
        print(f"\n⚠️ Email gagal ({e}). Fallback ke dev mode.")
        print(f"📧 [DEV MODE] {label} code for {email}: {code}\n")
        return False