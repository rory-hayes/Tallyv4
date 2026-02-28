from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.config import get_settings


def smtp_configured() -> bool:
    settings = get_settings()
    return bool(settings.smtp_host and settings.smtp_from_email)


def send_magic_link_email(recipient_email: str, magic_link: str) -> None:
    settings = get_settings()
    if not smtp_configured():
        raise RuntimeError("SMTP is not configured")

    message = EmailMessage()
    message["Subject"] = "Your Tally secure sign-in link"
    message["From"] = settings.smtp_from_email
    message["To"] = recipient_email
    message.set_content(
        "\n".join(
            [
                "Use this secure link to sign in to Tally:",
                "",
                magic_link,
                "",
                f"This link expires in {settings.magic_link_ttl_minutes} minutes.",
            ]
        )
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as client:
        if settings.smtp_use_tls:
            client.starttls()
        if settings.smtp_username and settings.smtp_password:
            client.login(settings.smtp_username, settings.smtp_password)
        client.send_message(message)

