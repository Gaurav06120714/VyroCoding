import { Resend } from 'resend';
import { env } from '../config/env.js';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetLink: string,
): Promise<{ sent: boolean; previewLink?: string }> {
  const resend = getResend();

  if (!resend) {
    console.log(`[email] DEV — password reset link for ${toEmail}:\n  ${resetLink}`);
    return { sent: false, previewLink: resetLink };
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: toEmail,
    subject: 'Reset your VyroCoding password',
    html: buildResetEmailHtml(resetLink),
    text: buildResetEmailText(resetLink),
  });

  if (error) {
    console.error('[email] Failed to send password reset email:', error);
    
    return { sent: false };
  }

  return { sent: true };
}

function buildResetEmailHtml(resetLink: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your VyroCoding password</title>
</head>
<body style="margin:0;padding:0;background:#0d0d11;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d11;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:#131318;border:1px solid #23232d;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #23232d;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#e8e8f0;letter-spacing:-0.3px;">
                🔐 VyroCoding
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#e8e8f0;">
                Reset your password
              </h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#9090a8;">
                We received a request to reset the password for your VyroCoding account.
                Click the button below to choose a new password. This link expires in
                <strong style="color:#c8c8d8;">1 hour</strong>.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#7c3aed;">
                    <a href="${resetLink}"
                       style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;
                              color:#ffffff;text-decoration:none;border-radius:8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#5a5a70;word-break:break-all;">
                Or copy this link into your browser:<br />
                <span style="color:#9090a8;">${resetLink}</span>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #23232d;">
              <p style="margin:0;font-size:12px;color:#5a5a70;">
                If you didn't request a password reset you can safely ignore this email —
                your password won't change.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildResetEmailText(resetLink: string): string {
  return `Reset your VyroCoding password

We received a request to reset the password for your account.

Reset link (expires in 1 hour):
${resetLink}

If you didn't request a password reset, ignore this email — your password won't change.

— VyroCoding`;
}
