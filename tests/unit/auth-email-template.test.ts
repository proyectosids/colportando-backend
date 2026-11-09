import { describe, expect, it, vi } from "vitest";
import type { Transporter } from "nodemailer";
import pino from "pino";

import { renderAuthActionEmail } from "../../src/modules/auth/infrastructure/auth-email-template.js";
import { GmailActionTokenDelivery } from "../../src/modules/auth/infrastructure/gmail-action-token-delivery.js";

describe("authentication email templates", () => {
  it("renders a branded verification email with a server-controlled destination", () => {
    const email = renderAuthActionEmail({ purpose: "EMAIL_VERIFICATION", token: "secret-token", expiresAt: new Date("2026-11-09T01:00:00.000Z"), actionBaseUrl: "https://app.example/auth/" });
    expect(email.subject).toBe("Confirma tu correo en Colportando App");
    expect(email.html).toContain("Colportando App");
    expect(email.html).toContain("Confirmar mi correo");
    expect(email.html).toContain("https://app.example/auth/verify-email?token=secret-token");
    expect(email.text).toContain("sólo puede utilizarse una vez");
  });

  it("uses the branded sender identity and recipient without logging the token", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "test" });
    const transporter = { sendMail } as unknown as Transporter;
    const delivery = new GmailActionTokenDelivery({ email: "proyectos_ids@ulv.edu.mx", password: "not-real", fromName: "Colportando App", actionBaseUrl: "https://app.example/auth" }, pino({ level: "silent" }), transporter);
    await delivery.deliver({ purpose: "EMAIL_VERIFICATION", email: "recipient@example.com", token: "secret-token", expiresAt: new Date("2026-11-09T01:00:00.000Z") });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: { name: "Colportando App", address: "proyectos_ids@ulv.edu.mx" },
      to: "recipient@example.com",
      subject: "Confirma tu correo en Colportando App"
    }));
  });

  it("renders recovery-specific copy and escapes token content in HTML", () => {
    const email = renderAuthActionEmail({ purpose: "PASSWORD_RESET", token: "token&unsafe", expiresAt: new Date("2026-11-09T01:00:00.000Z"), actionBaseUrl: "https://app.example/auth" });
    expect(email.subject).toBe("Restablece tu contraseña en Colportando App");
    expect(email.html).toContain("Restablecer contraseña");
    expect(email.html).toContain("token%26unsafe");
    expect(email.html).not.toContain("token&unsafe");
  });
});
