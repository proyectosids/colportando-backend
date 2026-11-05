import type { HealthStatus } from "../domain/health-status.js";
import type { Clock } from "./ports/clock.js";

export class GetHealthStatus {
  public constructor(private readonly clock: Clock) {}

  public execute(): HealthStatus {
    return {
      status: "ok",
      service: "colportando-backend",
      timestamp: this.clock.now().toISOString()
    };
  }
}
