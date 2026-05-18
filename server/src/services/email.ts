import { Resend } from 'resend';
import { config, emailEnabled } from '../config.js';
import type { Role } from '../types.js';

const resend = emailEnabled ? new Resend(config.resendApiKey) : null;

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrateur',
  analyste: 'Analyste ventes',
  distributeur: 'Référent distributeur',
  invite: 'Invité · lecture seule',
};

interface InvitationEmailInput {
  to: string;
  role: Role;
  token: string;
  invitedByName: string;
  expiresAt: Date;
}

function invitationHtml(input: InvitationEmailInput, link: string): string {
  const expire = input.expiresAt.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  // Email sobre, monochrome — cohérent avec la charte de la plateforme.
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border:0.5px solid #e5e5e5;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:28px 32px 0;">
            <div style="font-size:17px;font-weight:600;letter-spacing:-0.03em;">
              silverlit<span style="color:#e30613;">.</span>
              <span style="font-size:10px;letter-spacing:0.18em;color:#737373;font-weight:500;text-transform:uppercase;">&nbsp;&nbsp;Analytics</span>
            </div>
          </td></tr>
          <tr><td style="padding:22px 32px 0;">
            <h1 style="margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em;">
              Vous êtes invité·e sur Silverlit Analytics
            </h1>
            <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#525252;">
              ${escapeHtml(input.invitedByName)} vous a invité·e à rejoindre la plateforme de
              pilotage des ventes Silverlit, avec le rôle
              <strong>${ROLE_LABELS[input.role]}</strong>.
            </p>
            <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#525252;">
              Cliquez ci-dessous pour créer votre compte. Ce lien est personnel et valable
              jusqu'au <strong>${expire}</strong>.
            </p>
          </td></tr>
          <tr><td style="padding:24px 32px;">
            <a href="${link}"
               style="display:inline-block;background:#e30613;color:#ffffff;text-decoration:none;
                      font-size:14px;font-weight:600;padding:12px 22px;border-radius:10px;">
              Créer mon compte
            </a>
            <p style="margin:16px 0 0;font-size:12px;color:#737373;word-break:break-all;">
              Ou copiez ce lien : ${link}
            </p>
          </td></tr>
          <tr><td style="padding:18px 32px;border-top:0.5px solid #e5e5e5;">
            <p style="margin:0;font-size:11px;color:#737373;">
              Si vous n'attendiez pas cette invitation, ignorez simplement cet email.
              Silverlit Analytics · usage interne confidentiel.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

export interface SendResult {
  sent: boolean;
  link: string;
}

// Envoie l'email d'invitation. Si Resend n'est pas configuré, le lien est
// renvoyé (et loggé) sans envoi — la plateforme reste utilisable en démo.
export async function sendInvitationEmail(input: InvitationEmailInput): Promise<SendResult> {
  const link = `${config.frontendUrl}/invitation?token=${input.token}`;

  if (!resend) {
    console.log(`[email] Resend non configuré — lien d'invitation pour ${input.to} : ${link}`);
    return { sent: false, link };
  }

  try {
    await resend.emails.send({
      from: config.emailFrom,
      to: input.to,
      subject: 'Votre invitation à Silverlit Analytics',
      html: invitationHtml(input, link),
    });
    console.log(`[email] invitation envoyée à ${input.to}`);
    return { sent: true, link };
  } catch (err) {
    console.error(`[email] échec d'envoi à ${input.to} :`, err);
    return { sent: false, link };
  }
}
