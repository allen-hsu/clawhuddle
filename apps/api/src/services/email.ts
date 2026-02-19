import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'ClawTeam <noreply@clawteam.dev>';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export async function sendInvitationEmail(opts: {
  to: string;
  orgName: string;
  invitedByName: string;
  role: string;
  token: string;
}) {
  const inviteUrl = `${APP_URL}/invite/${opts.token}`;
  const client = getResend();

  if (!client) {
    console.log(`[email] RESEND_API_KEY not set, skipping email to ${opts.to}`);
    console.log(`[email] Invite link: ${inviteUrl}`);
    return;
  }

  console.log(`[email] Sending invitation email to ${opts.to} from ${FROM_EMAIL}`);

  const result = await client.emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: `Join ${opts.orgName} on ClawTeam`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 8px;">
          You're invited to ${opts.orgName}
        </h2>
        <p style="color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          ${opts.invitedByName} has invited you to join <strong>${opts.orgName}</strong> as a <strong>${opts.role}</strong> on ClawTeam.
        </p>
        <a href="${inviteUrl}"
           style="display: inline-block; background: #c7944a; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Accept Invitation
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">
          This invitation expires in 7 days. If you didn't expect this, you can ignore this email.
        </p>
      </div>
    `,
  });

  if (result.error) {
    console.error(`[email] Resend API error:`, result.error);
    throw new Error(`Email send failed: ${result.error.message}`);
  }

  console.log(`[email] Email sent successfully, id: ${result.data?.id}`);
}
