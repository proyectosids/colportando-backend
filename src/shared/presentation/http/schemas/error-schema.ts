import { z } from "../openapi/zod.js";

export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().min(1),
      message: z.string().min(1),
      details: z.unknown().optional(),
      correlationId: z.uuid()
    })
  })
  .meta({ id: "ErrorResponse" });

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
