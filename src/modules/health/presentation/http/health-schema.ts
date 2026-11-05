import { z } from "../../../../shared/presentation/http/openapi/zod.js";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("colportando-backend"),
  timestamp: z.iso.datetime({ offset: true })
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
