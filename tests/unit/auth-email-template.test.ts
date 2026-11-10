import { describe, expect, it, vi } from "vitest";
import type { Transporter } from "nodemailer";
import pino from "pino";

import { renderAuthActionEmail } from "../../src/modules/auth/infrastructure/auth-email-template.js";
import { GmailActionTokenDelivery } from "../../src/modules/auth/infrastructure/gmail-action-token-delivery.js";

describe("authentication email templates", () => {
  it("renders a branded verification email with a one-time code and no link", () => {
    const email = renderAuthActionEmail({ purpose: "EMAIL_VERIFICATION", code: "48271936", expiresAt: new Date("2026-11-09T01:00:00.000Z") });
    expect(email.subject).toBe("Confirma tu correo en Colportando App");
    expect(email.html).toContain("Colportando App");
    expect(email.html).toContain("48271936");
    expect(email.html).not.toContain("href=");
    expect(email.text).toContain("sólo puede utilizarse una vez");
  });

  it("uses the branded sender identity and recipient without logging the token", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "test" });
    const transporter = { sendMail } as unknown as Transporter;
    const delivery = new GmailActionTokenDelivery({ email: "proyectos_ids@ulv.edu.mx", password: "not-real", fromName: "Colportando App", actionBaseUrl: "https://app.example/auth" }, pino({ level: "silent" }), transporter);
    await delivery.deliver({ purpose: "EMAIL_VERIFICATION", email: "recipient@example.com", code: "48271936", expiresAt: new Date("2026-11-09T01:00:00.000Z") });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: { name: "Colportando App", address: "proyectos_ids@ulv.edu.mx" },
      to: "recipient@example.com",
      subject: "Confirma tu correo en Colportando App"
    }));
  });

  it("renders a club-specific invitation without elevated-role language", () => {
    const email = renderAuthActionEmail({ purpose: "CLUB_INVITATION", code: "K7M2-P9Q4-X6RT", expiresAt: new Date("2026-11-15T20:00:00.000Z"), context: { clubName: "Club Central", institutionName: "Universidad Linda Vista" } });
    expect(email.subject).toBe("Invitación a Club Central en Colportando App");
    expect(email.html).toContain("Únete a Club Central");
    expect(email.html).toContain("registrarte como aspirante");
    expect(email.html).not.toMatch(/administrador|COLPORTOR|\brol\b/i);
  });

  it("sanitizes organization names used in invitation headers and HTML", () => {
    const email = renderAuthActionEmail({ purpose: "CLUB_INVITATION", code: "K7M2-P9Q4-X6RT", expiresAt: new Date("2026-11-15T20:00:00.000Z"), context: { clubName: "Club\r\nBcc: attacker@example.com", institutionName: "Universidad <script>" } });
    expect(email.subject).not.toContain("\r");
    expect(email.subject).not.toContain("\n");
    expect(email.html).toContain("Universidad &lt;script&gt;");
    expect(email.html).not.toContain("Universidad <script>");
  });

  it("renders recovery-specific copy and escapes code content in HTML", () => {
    const email = renderAuthActionEmail({ purpose: "PASSWORD_RESET", code: "12&34567", expiresAt: new Date("2026-11-09T01:00:00.000Z") });
    expect(email.subject).toBe("Restablece tu contraseña en Colportando App");
    expect(email.html).toContain("12&amp;34567");
    expect(email.html).not.toContain("12&34567");
  });
});
