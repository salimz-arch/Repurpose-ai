"""Email service — Resend + dev mode fallback."""
import os
import requests

RESEND_URL = "https://api.resend.com/emails"


def _send_resend(email: str, subject: str, body: str) -> None:
    resp = requests.post(
        RESEND_URL,
        headers={
            "Authorization": f"Bearer {os.environ['RESEND_API_KEY']}",
            "Content-Type": "application/json",
        },
        json={
            "from": "RePurpose AI <onboarding@resend.dev>",
            "to": [email],
            "subject": subject,
            "text": body,
        },
        timeout=20,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Resend {resp.status_code}: {resp.text[:300]}")


def send_code(email: str, code: str, purpose: str = "verify") -> bool:
    label = "Reset" if purpose == "reset" else "Verification"
    subject = f"⚡ RePurpose AI — {label} Code"
    body = (
        f"Your RePurpose AI {'password reset' if purpose == 'reset' else 'verification'} "
        f"code is: {code}\n\nIt expires in 10 minutes. "
        f"If you didn't request this, ignore this email."
    )

    if not os.environ.get("RESEND_API_KEY"):
        print(f"\n📧 [DEV MODE] {label} code for {email}: {code}\n")
        return False

    try:
        _send_resend(email, subject, body)
        print(f"\n✅ {label} email sent to {email}\n")
        return True
    except Exception as e:
        print(f"\n⚠️ Email gagal ({e}). Fallback ke dev mode.")
        print(f"📧 [DEV MODE] {label} code for {email}: {code}\n")
        return False