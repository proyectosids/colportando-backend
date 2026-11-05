import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

const correlationIdSchema = z.uuid();

export function correlationIdMiddleware(request: Request, response: Response, next: NextFunction): void {
  const incoming = request.header("x-correlation-id");
  const parsed = correlationIdSchema.safeParse(incoming);
  const correlationId = parsed.success ? parsed.data : randomUUID();

  response.locals.correlationId = correlationId;
  response.setHeader("x-correlation-id", correlationId);
  next();
}
