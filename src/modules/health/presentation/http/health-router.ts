import { Router, type Response } from "express";

import type { GetHealthStatus } from "../../application/get-health-status.js";
import type { HealthResponse } from "./health-schema.js";

export function createHealthRouter(getHealthStatus: GetHealthStatus): Router {
  const router = Router();

  router.get("/health", (_request, response: Response<HealthResponse>) => {
    response.status(200).json(getHealthStatus.execute());
  });

  return router;
}
