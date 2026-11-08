import type { Logger } from "pino";

import type { ActionTokenDelivery } from "../application/ports/auth-crypto.js";

export class DisabledActionTokenDelivery implements ActionTokenDelivery {
  public constructor(private readonly logger: Logger) {}

  public deliver(input: Parameters<ActionTokenDelivery["deliver"]>[0]): Promise<void> {
    this.logger.warn({ purpose: input.purpose }, "Action token delivery provider is not configured");
    return Promise.resolve();
  }
}
