import smtplib
import os
import logging
import asyncio
from email.message import EmailMessage

logger = logging.getLogger(__name__)

SMTP_HOST = os.environ.get("SMTP_HOST", os.environ.get("SMTP_SERVER", "smtp.gmail.com"))
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER", os.environ.get("SMTP_USERNAME", ""))
SMTP_PASS = os.environ.get("SMTP_PASS", os.environ.get("SMTP_PASSWORD", ""))
SMTP_FROM = os.environ.get("SMTP_FROM", os.environ.get("SMTP_FROM_EMAIL", SMTP_USER or "no-reply@smartstore.ai"))

def _send_sync_email(to_email: str, subject: str, html_body: str) -> bool:
    """Synchronous helper function to send email via SMTP."""
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = SMTP_FROM
    msg['To'] = to_email
    msg.set_content("Please enable HTML to view this message.")
    msg.add_alternative(html_body, subtype='html')

    try:
        if not SMTP_USER or not SMTP_PASS:
            logger.warning(
                f"[MAILER] SMTP credentials not configured (SMTP_USER/SMTP_PASS). "
                f"Email dispatch to {to_email} skipped. Logged OTP securely for system debugging."
            )
            return False

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        logger.info(f"[MAILER] Email successfully sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"[MAILER] Failed to send email to {to_email}: {str(e)}")
        return False

async def send_otp_email(to_email: str, otp_code: str) -> bool:
    """Asynchronously sends a password reset OTP email."""
    subject = "SmartStore AI - Password Reset OTP Code"
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
          <div class="title">Password Reset OTP Request</div>
        </div>
        <p>Hello,</p>
        <p>You requested a password reset for your <strong>SmartStore AI</strong> store owner account.</p>
        <div class="otp-box">
          <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">Your 6-Digit Security OTP</div>
          <div class="otp-code">{otp_code}</div>
        </div>
        <p style="font-size: 13px; color: #475569;">
          This OTP code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.
        </p>
        <div class="footer">
          If you did not request this password reset, please ignore this email or contact support.<br>
          &copy; 2026 SmartStore AI ERP System. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    """

    return await asyncio.to_thread(_send_sync_email, to_email, subject, html_body)
