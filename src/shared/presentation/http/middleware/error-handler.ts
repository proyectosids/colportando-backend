import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";

import { AppError } from "../errors/app-error.js";
import type { ErrorResponse } from "../schemas/error-schema.js";

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _request, response, next): void => {
    void next;
    const correlationId = response.locals.correlationId as string;

    if (error instanceof AppError) {
      const body: ErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          correlationId,
          ...(error.details === undefined ? {} : { details: error.details })
        }
      };
      response.status(error.statusCode).json(body);
      return;
    }

    if (
      error instanceof SyntaxError &&
      "type" in error &&
      error.type === "entity.parse.failed"
    ) {
      response.status(400).json({
        error: {
          code: "INVALID_JSON",
          message: "Request body contains invalid JSON",
          correlationId
        }
      } satisfies ErrorResponse);
      return;
    }

    logger.error({ err: error, correlationId }, "Unhandled request error");
    response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        correlationId
      }
    } satisfies ErrorResponse);
  };
}
