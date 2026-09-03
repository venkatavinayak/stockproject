import smtplib
import ssl
import os
import logging
import asyncio
import urllib.request
import json
from email.message import EmailMessage
from typing import Optional

logger = logging.getLogger(__name__)

# System Sender Credentials
DEFAULT_GMAIL_APP_PASS = os.environ.get("SMTP_PASS", os.environ.get("SMTP_PASSWORD", "rxwdvtatiamhtzel")).replace(" ", "")
DEFAULT_SMTP_USER = os.environ.get("SMTP_USER", os.environ.get("SMTP_USERNAME", "mysmartstoreai@gmail.com"))
DEFAULT_SMTP_HOST = os.environ.get("SMTP_HOST", os.environ.get("SMTP_SERVER", "smtp.gmail.com"))

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")

def _send_via_https_api(to_email: str, subject: str, html_body: str) -> bool:
    """Dispatches email via HTTPS REST API (Port 443) for 100% cloud deliverability on Render."""
    resend_key = RESEND_API_KEY or os.environ.get("RESEND_API_KEY", "")
    if resend_key:
        try:
            url = "https://api.resend.com/emails"
            payload = {
                "from": "SmartStore AI <onboarding@resend.dev>",
                "to": [to_email],
                "subject": subject,
                "html": html_body
            }
            headers = {
                "Authorization": f"Bearer {resend_key.strip()}",
                "Content-Type": "application/json"
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status in (200, 201, 202):
                    logger.info(f"[MAILER] Resend HTTPS API delivered email to {to_email}")
                    return True
        except Exception as e:
            logger.warning(f"[MAILER] Resend HTTPS API failed: {e}")

    brevo_key = BREVO_API_KEY or os.environ.get("BREVO_API_KEY", "")
    if brevo_key:
        try:
            url = "https://api.brevo.com/v3/smtp/email"
            payload = {
                "sender": {"name": "SmartStore AI", "email": "mysmartstoreai@gmail.com"},
                "to": [{"email": to_email}],
                "subject": subject,
                "htmlContent": html_body
            }
            headers = {
                "api-key": brevo_key.strip(),
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status in (200, 201, 202):
                    logger.info(f"[MAILER] Brevo HTTPS API delivered email to {to_email}")
                    return True
        except Exception as e:
            logger.warning(f"[MAILER] Brevo HTTPS API failed: {e}")

    return False

def _send_sync_email(to_email: str, subject: str, html_body: str, smtp_config: Optional[dict] = None) -> bool:
    """Synchronous helper function to send email via HTTPS REST API or Gmail SMTP App Password."""
    # 1. Try HTTPS REST API over Port 443 first
    if _send_via_https_api(to_email, subject, html_body):
        return True

    # 2. Try Gmail SMTP (SSL Port 465 & TLS Port 587)
    cfg = smtp_config or {}
    password = (cfg.get("smtp_password") or DEFAULT_GMAIL_APP_PASS).replace(" ", "")
    auth_user = cfg.get("smtp_user") or DEFAULT_SMTP_USER

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = f"SmartStore AI <{auth_user}>"
    msg['To'] = to_email
    msg['Reply-To'] = auth_user
    msg['X-Mailer'] = "SmartStoreAI-ERP/2.0"
    msg['Auto-Submitted'] = "auto-generated"
    msg.set_content("Please enable HTML to view this message.")
    msg.add_alternative(html_body, subtype='html')

    context = ssl.create_default_context()

    # Try SSL Port 465
    try:
        logger.info(f"[MAILER] Dispatching OTP to {to_email} via Gmail SSL (smtp.gmail.com:465) using {auth_user}")
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context, timeout=12) as server:
            server.login(auth_user, password)
            server.send_message(msg)
        logger.info(f"[MAILER] OTP email successfully delivered to {to_email} via Port 465 SSL")
        return True
    except Exception as e:
        logger.warning(f"[MAILER] Gmail SSL Port 465 failed: {str(e)}")

    # Fallback to TLS Port 587
    try:
        logger.info(f"[MAILER] Dispatching OTP to {to_email} via Gmail TLS (smtp.gmail.com:587) using {auth_user}")
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=12) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(auth_user, password)
            server.send_message(msg)
        logger.info(f"[MAILER] OTP email successfully delivered to {to_email} via Port 587 TLS")
        return True
    except Exception as e:
        logger.error(f"[MAILER] Gmail TLS Port 587 failed: {str(e)}")

    return False

async def send_otp_email(to_email: str, otp_code: str, smtp_config: Optional[dict] = None) -> bool:
    """Asynchronously sends a password reset OTP email to any user."""
    subject = "SmartStore AI - Password Reset Security OTP Code"
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>SmartStore AI OTP Code</title>
      <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }}
        .container {{ max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }}
        .header {{ text-align: center; margin-bottom: 24px; }}
        .badge {{ display: inline-block; padding: 4px 12px; background-color: #e0e7ff; color: #4338ca; font-size: 11px; font-weight: 800; text-transform: uppercase; border-radius: 9999px; letter-spacing: 1px; }}
        .title {{ font-size: 20px; font-weight: 800; margin-top: 12px; color: #0f172a; }}
        .otp-box {{ background: #f1f5f9; border: 2px dashed #6366f1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }}
        .otp-code {{ font-size: 32px; font-weight: 900; font-family: 'Courier New', monospace; letter-spacing: 8px; color: #4f46e5; }}
        .footer {{ font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; line-height: 1.5; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="badge">Security Alert</span>
          <div class="title">Password Reset Security OTP</div>
        </div>
        <p>Hello,</p>
        <p>You requested a password reset for your <strong>SmartStore AI</strong> store account.</p>
        <div class="otp-box">
          <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">Your 6-Digit Security OTP</div>
          <div class="otp-code">{otp_code}</div>
        </div>
        <p style="font-size: 13px; color: #475569;">
          This OTP code is valid for <strong>10 minutes</strong>. Please enter this code on the password reset page.
        </p>
        <div class="footer">
          If you did not request this password reset, please ignore this email or contact support.<br>
          &copy; 2026 SmartStore AI ERP System. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    """

    return await asyncio.to_thread(_send_sync_email, to_email, subject, html_body, smtp_config)
