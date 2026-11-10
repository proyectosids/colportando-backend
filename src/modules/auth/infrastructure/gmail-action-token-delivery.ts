import nodemailer, { type Transporter } from "nodemailer";
import type { Logger } from "pino";

import type { ActionTokenDelivery } from "../application/ports/auth-crypto.js";
import { renderAuthActionEmail } from "./auth-email-template.js";

export type GmailDeliveryConfig = Readonly<{ email: string; password: string; fromName: string; actionBaseUrl?: string }>;

export class GmailActionTokenDelivery implements ActionTokenDelivery {
  private readonly transporter: Transporter;

  public constructor(private readonly config: GmailDeliveryConfig, private readonly logger: Logger, transporter?: Transporter) {
    this.transporter = transporter ?? nodemailer.createTransport({ service: "gmail", auth: { user: config.email, pass: config.password } });
  }

  public async deliver(input: Parameters<ActionTokenDelivery["deliver"]>[0]): Promise<void> {
    const message = renderAuthActionEmail({ purpose: input.purpose, code: input.code, expiresAt: input.expiresAt, ...(input.context === undefined ? {} : { context: input.context }) });
    try {
      await this.transporter.sendMail({
        from: { name: this.config.fromName, address: this.config.email },
        to: input.email,
        subject: message.subject,
        text: message.text,
        html: message.html
      });
      this.logger.info({ purpose: input.purpose }, "Authentication email accepted by provider");
    } catch (error) {
      this.logger.error({ err: error, purpose: input.purpose }, "Authentication email delivery failed");
    }
  }

  public async verifyConnection(): Promise<void> {
    await this.transporter.verify();
  }
}
