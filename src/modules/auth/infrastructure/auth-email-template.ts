import type { ActionPurpose } from "../application/ports/auth-store.js";

export type RenderedAuthEmail = Readonly<{ subject: string; html: string; text: string }>;

type EmailCopy = Readonly<{ subject: string; heading: string; introduction: string; action: string; path: string }>;

const copyByPurpose: Record<ActionPurpose, EmailCopy> = {
  EMAIL_VERIFICATION: {
    subject: "Confirma tu correo en Colportando App",
    heading: "Confirma tu correo",
    introduction: "Activa tu cuenta para continuar tu proceso y acceder de forma segura a Colportando App.",
    action: "Confirmar mi correo",
    path: "verify-email"
  },
  PASSWORD_RESET: {
    subject: "Restablece tu contraseña en Colportando App",
    heading: "Crea una nueva contraseña",
    introduction: "Recibimos una solicitud para recuperar el acceso a tu cuenta. Usa este enlace seguro para elegir una nueva contraseña.",
    action: "Restablecer contraseña",
    path: "reset-password"
  },
  CLUB_INVITATION: {
    subject: "Tu invitación a Colportando App",
    heading: "Tienes una invitación",
    introduction: "Un club te invitó a iniciar tu proceso como aspirante en Colportando App.",
    action: "Revisar invitación",
    path: "accept-invitation"
  }
};

function actionUrl(baseUrl: string, path: string, token: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/${path}?token=${encodeURIComponent(token)}`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function cleanInline(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function renderAuthActionEmail(input: Readonly<{ purpose: ActionPurpose; token: string; expiresAt: Date; actionBaseUrl: string; context?: Readonly<{ clubName: string; institutionName: string }> }>): RenderedAuthEmail {
  const baseCopy = copyByPurpose[input.purpose];
  const clubName = input.context === undefined ? "" : cleanInline(input.context.clubName);
  const institutionName = input.context === undefined ? "" : cleanInline(input.context.institutionName);
  const copy = input.purpose === "CLUB_INVITATION" && input.context !== undefined
    ? { ...baseCopy, subject: `Invitación a ${clubName} en Colportando App`, heading: `Únete a ${clubName}`, introduction: `${institutionName} te invita a registrarte como aspirante y comenzar tu proceso en Colportando App.` }
    : baseCopy;
  const url = actionUrl(input.actionBaseUrl, copy.path, input.token);
  const safeUrl = escapeHtml(url);
  const safeSubject = escapeHtml(copy.subject);
  const safeHeading = escapeHtml(copy.heading);
  const safeIntroduction = escapeHtml(copy.introduction);
  const expiration = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" }).format(input.expiresAt);
  const preheader = `${copy.heading}. Este enlace es personal y vence el ${expiration}.`;
  const safePreheader = escapeHtml(preheader);

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeSubject}</title></head>
<body style="margin:0;padding:0;background:#f4f6f1;color:#18312b;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6f1;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #dbe4dc;border-radius:16px;overflow:hidden;">
        <tr><td style="height:8px;background:#c99a3d;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:38px 44px 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="46" valign="middle"><div style="width:42px;height:42px;line-height:42px;border-radius:50%;background:#174f3a;color:#ffffff;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:bold;">C</div></td>
            <td valign="middle" style="padding-left:12px;color:#174f3a;font-size:16px;font-weight:700;letter-spacing:.1px;">Colportando App</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:8px 44px 0;">
          <h1 style="margin:0;color:#18312b;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.13;font-weight:400;letter-spacing:-.4px;">${safeHeading}</h1>
          <p style="margin:22px 0 0;color:#50655f;font-size:16px;line-height:1.65;">${safeIntroduction}</p>
        </td></tr>
        <tr><td style="padding:28px 44px 12px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#174f3a" style="border-radius:8px;">
            <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:15px;line-height:20px;font-weight:700;">${copy.action}</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:18px 44px 38px;">
          <p style="margin:0;color:#6c7d77;font-size:13px;line-height:1.6;">Este enlace vence el ${expiration} y sólo puede utilizarse una vez.</p>
          <div style="height:1px;background:#e6ece7;margin:24px 0;"></div>
          <p style="margin:0;color:#6c7d77;font-size:13px;line-height:1.6;">Si no solicitaste esta acción, puedes ignorar el mensaje. No reenvíes ni compartas este enlace.</p>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;color:#75847f;font-size:12px;line-height:1.5;">Colportando App · Universidad Linda Vista</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${copy.heading}\n\n${copy.introduction}\n\n${copy.action}: ${url}\n\nEste enlace vence el ${expiration} y sólo puede utilizarse una vez.\n\nSi no solicitaste esta acción, ignora este mensaje y no compartas el enlace.\n\nColportando App · Universidad Linda Vista`;
  return { subject: copy.subject, html, text };
}
