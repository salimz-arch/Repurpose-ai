import smtplib
import socket
from email.mime.text import MIMEText
from app.config import settings

# ── Paksa IPv4: Railway kadang gak punya rute IPv6 ke Gmail ──
# (menghindari "[Errno 101] Network is unreachable")
_orig_getaddrinfo = socket.getaddrinfo

def _ipv4_only(host, port, family=0, type=0, proto=0, flags=0):
    return _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)

socket.getaddrinfo = _ipv4_only


def send_code(email: str, code: str, purpose: str = "verify") -> bool:
    """purpose: "verify" (register) atau "reset" (forgot password)."""
    label = "Reset" if purpose == "reset" else "Verification"
    if not settings.smtp_user or not settings.smtp_pass:
        print(f"\n📧 [DEV MODE] {label} code for {email}: {code}\n")
        return False
    try:
        msg = MIMEText(
            f"Your RePurpose AI {'password reset' if purpose == 'reset' else 'verification'} code is: {code}\n\n"
            f"It expires in 10 minutes. If you didn't request this, ignore this email."
        )
        msg["Subject"] = f"⚡ RePurpose AI — {label} Code"
        msg["From"] = settings.smtp_from or settings.smtp_user
        msg["To"] = email
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as s:
            s.starttls()
            s.login(settings.smtp_user, settings.smtp_pass)
            s.send_message(msg)
        print(f"\n✅ {label} email sent to {email}\n")
        return True
    except Exception as e:
        print(f"\n⚠️ SMTP gagal ({e}). Fallback ke dev mode.")
        print(f"📧 [DEV MODE] {label} code for {email}: {code}\n")
        return False