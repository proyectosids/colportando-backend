import "dotenv/config";

import { createApp } from "./composition/create-app.js";
import { loadConfig } from "./shared/infrastructure/config/env.js";
import { createLogger } from "./shared/infrastructure/logging/logger.js";

const config = loadConfig();
const logger = createLogger(config);
const app = createApp({ config, logger });

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
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
