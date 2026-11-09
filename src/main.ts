import "dotenv/config";

import { createApp } from "./composition/create-app.js";
import { AuthService } from "./modules/auth/application/auth-service.js";
import { InvitationService } from "./modules/auth/application/invitation-service.js";
import type { ActionTokenDelivery } from "./modules/auth/application/ports/auth-crypto.js";
import { ArgonPasswordHasher } from "./modules/auth/infrastructure/argon-password-hasher.js";
import { DisabledActionTokenDelivery } from "./modules/auth/infrastructure/disabled-action-token-delivery.js";
import { GmailActionTokenDelivery } from "./modules/auth/infrastructure/gmail-action-token-delivery.js";
import { JoseAuthTokenCodec } from "./modules/auth/infrastructure/jose-auth-token-codec.js";
import { MssqlAuthStore } from "./modules/auth/infrastructure/mssql-auth-store.js";
import { MssqlInvitationStore } from "./modules/auth/infrastructure/mssql-invitation-store.js";
import { loadConfig } from "./shared/infrastructure/config/env.js";
import { createConnectionPool } from "./shared/infrastructure/database/connection-pool.js";
import { loadDatabaseConfig } from "./shared/infrastructure/database/database-config.js";
import { createLogger } from "./shared/infrastructure/logging/logger.js";

const config = loadConfig();
const logger = createLogger(config);
const pool = createConnectionPool(loadDatabaseConfig());
await pool.connect();
let actionTokenDelivery: ActionTokenDelivery = new DisabledActionTokenDelivery(logger);
if (config.mail.adapter === "gmail") {
  if (config.mail.email === undefined || config.mail.password === undefined) {
    throw new Error("Gmail delivery configuration is incomplete");
  }
  actionTokenDelivery = new GmailActionTokenDelivery(
    { email: config.mail.email, password: config.mail.password, fromName: config.mail.fromName, actionBaseUrl: config.mail.actionBaseUrl },
    logger
  );
}
const authStore = new MssqlAuthStore(pool);
const passwordHasher = new ArgonPasswordHasher();
const tokenCodec = new JoseAuthTokenCodec(config.auth.jwtAccessSecret, config.auth.tokenPepper, config.auth.jwtIssuer, config.auth.jwtAudience);
const authService = new AuthService(
  authStore,
  passwordHasher,
  tokenCodec,
  actionTokenDelivery,
  config.auth
);
const invitationService = new InvitationService(new MssqlInvitationStore(pool), authStore, passwordHasher, tokenCodec, actionTokenDelivery, config.auth);
const app = createApp({ config, logger, authService, invitationService });

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, environment: config.nodeEnv }, "HTTP server listening");
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, "Shutting down HTTP server");
  server.close((error) => {
    if (error !== undefined) {
      logger.error({ err: error }, "HTTP server shutdown failed");
      process.exitCode = 1;
    }
    void pool.close();
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
