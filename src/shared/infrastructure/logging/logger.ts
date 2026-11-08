import pino, { type Logger } from "pino";

import type { AppConfig } from "../config/env.js";

export function createLogger(config: AppConfig): Logger {
  return pino({
    level: config.logLevel,
    base: null,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.currentPassword",
        "req.body.newPassword",
        "req.body.token",
        "req.body.refreshToken",
        "req.body.accessToken",
        "password",
        "token",
        "refreshToken"
      ],
      censor: "[REDACTED]"
    }
  });
}
