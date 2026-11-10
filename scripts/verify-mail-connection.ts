import "dotenv/config";

import pino from "pino";

import { GmailActionTokenDelivery } from "../src/modules/auth/infrastructure/gmail-action-token-delivery.js";
import { loadConfig } from "../src/shared/infrastructure/config/env.js";

const config = loadConfig();
if (config.mail.adapter !== "gmail" || config.mail.email === undefined || config.mail.password === undefined) {
  throw new Error("Gmail delivery is not fully configured");
}

const delivery = new GmailActionTokenDelivery({ email: config.mail.email, password: config.mail.password, fromName: config.mail.fromName }, pino({ level: "silent" }));
await delivery.verifyConnection();
process.stdout.write("Gmail SMTP connection verified. No email was sent.\n");
