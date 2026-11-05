import type { Request, Response } from "express";

import type { ErrorResponse } from "../schemas/error-schema.js";

export function notFoundHandler(request: Request, response: Response<ErrorResponse>): void {
  response.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: `Route ${request.method} ${request.path} was not found`,
      correlationId: response.locals.correlationId as string
    }
  });
}
