import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from backend.app.models.settings import StoreSettings

def send_invoice_email(
    email_to: str,
    invoice_no: str,
    pdf_path: str,
    settings: StoreSettings
):
    smtp_host = settings.smtp_host or os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_user = settings.smtp_user or os.getenv("SMTP_USER", "mysmartstoreai@gmail.com")
    smtp_password = settings.smtp_password or os.getenv("SMTP_PASSWORD") or os.getenv("GMAIL_APP_PASS")
    smtp_port = int(settings.smtp_port or os.getenv("SMTP_PORT", 465))

    if not smtp_host or not smtp_user or not smtp_password:
        print("[Email Service] Email delivery skipped: SMTP credentials (smtp_user / smtp_password) missing.")
        return

    # Check if PDF file exists
    if not os.path.exists(pdf_path):
        print(f"[Email Service] PDF attachment not found at {pdf_path}. Cannot send invoice email.")
        return

    try:
        sender_email = settings.smtp_sender or smtp_user
        
        # 1. Create message container
        msg = MIMEMultipart()
        msg['From'] = f"{settings.store_name} <{sender_email}>"
        msg['To'] = email_to
        msg['Subject'] = f"Tax Invoice {invoice_no} - {settings.store_name}"

        # 2. Design HTML email body
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <h2 style="color: #4f46e5; margin-bottom: 20px; text-align: center;">Thank you for your purchase!</h2>
                <p>Hello,</p>
                <p>Thank you for shopping at <strong>{settings.store_name}</strong>. Your transaction has been successfully completed.</p>
                
                <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr>
                            <td style="padding: 4px 0; color: #64748b;">Invoice Reference:</td>
                            <td style="padding: 4px 0; font-family: monospace; font-weight: bold; text-align: right; color: #1e293b;">{invoice_no}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0; color: #64748b;">Date & Time:</td>
                            <td style="padding: 4px 0; text-align: right; color: #1e293b;">{datetime.now().strftime("%d-%m-%Y %I:%M %p")}</td>
                        </tr>
                    </table>
                </div>

                <p>Your digital PDF tax receipt is attached to this email for your records.</p>
                <p>If you have any questions about this purchase, please contact us at {settings.contact_info or 'our store'}.</p>
                
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
                <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
                    {settings.store_name} • {settings.address or ''}<br/>
                    Powered by Smart Store Ai POS
                </p>
            </div>
        </body>
        </html>
        """
        
        # Attach body
        msg.attach(MIMEText(html_body, 'html'))

        # 3. Attach PDF document
        with open(pdf_path, 'rb') as f:
            pdf_attachment = MIMEApplication(f.read(), _subtype="pdf")
            pdf_attachment.add_header('Content-Disposition', 'attachment', filename=os.path.basename(pdf_path))
            msg.attach(pdf_attachment)

        # 4. Clean sender email and password
        cleaned_user = smtp_user.strip()
        cleaned_password = smtp_password.replace(" ", "").strip()
        
        import re
        email_regex = r'^[\w\.-]+@[\w\.-]+\.\w+$'
        if sender_email and not re.match(email_regex, sender_email.strip()):
            print(f"[Email Service] Invalid sender_email '{sender_email}' provided, falling back to SMTP user: {cleaned_user}")
            sender_email = cleaned_user
        else:
            sender_email = sender_email.strip() if sender_email else cleaned_user

        # Re-set msg['From'] with cleaned sender
        msg['From'] = f"{settings.store_name} <{sender_email}>"

        # 5. Connect and Send via SMTP
        port = int(smtp_port)
        if port == 465:
            # SSL
            server = smtplib.SMTP_SSL(smtp_host, port)
        else:
            # TLS/StartTLS
            server = smtplib.SMTP(smtp_host, port)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(cleaned_user, cleaned_password)
        server.sendmail(sender_email, email_to, msg.as_string())
        server.close()

        print(f"[Email Service] Invoice email for {invoice_no} sent successfully to {email_to}")
    except Exception as e:
        print(f"[Email Service] Failed to send email to {email_to}: {str(e)}")
