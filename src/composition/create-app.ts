import cors from "cors";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";

import { GetHealthStatus } from "../modules/health/application/get-health-status.js";
import type { AuthService } from "../modules/auth/application/auth-service.js";
import type { InvitationService } from "../modules/auth/application/invitation-service.js";
import { createAuthRouter } from "../modules/auth/presentation/http/auth-router.js";
import { SystemClock } from "../modules/health/infrastructure/system-clock.js";
import { createHealthRouter } from "../modules/health/presentation/http/health-router.js";
import type { TrainingService } from "../modules/training/application/training-service.js";
import type { MemberTransitionService } from "../modules/training/application/member-transition-service.js";
import { createTrainingRouter } from "../modules/training/presentation/http/training-router.js";
import type {CampaignOperationsService} from "../modules/operations/application/campaign-operations-service.js";
import {createOperationsRouter} from "../modules/operations/presentation/http/operations-router.js";
import type { InventoryService } from "../modules/inventory/application/inventory-service.js";
import { createInventoryRouter } from "../modules/inventory/presentation/http/inventory-router.js";
import type { WorkspaceService } from "../modules/workspace/application/workspace-service.js";
import { createWorkspaceRouter } from "../modules/workspace/presentation/http/workspace-router.js";
import type { AppConfig } from "../shared/infrastructure/config/env.js";
import { AppError } from "../shared/presentation/http/errors/app-error.js";
import { createErrorHandler } from "../shared/presentation/http/middleware/error-handler.js";
import { correlationIdMiddleware } from "../shared/presentation/http/middleware/correlation-id.js";
import { notFoundHandler } from "../shared/presentation/http/middleware/not-found.js";
import { createOpenApiDocument } from "../shared/presentation/http/openapi/document.js";

export type CreateAppDependencies = Readonly<{
  config: AppConfig;
  logger: Logger;
  authService?: AuthService;
  invitationService?: InvitationService;
  trainingService?: TrainingService;
  memberTransitionService?:MemberTransitionService;
  campaignOperationsService?:CampaignOperationsService;
  inventoryService?: InventoryService;
  workspaceService?: WorkspaceService;
}>;

export function createApp({ config, logger, authService, invitationService, trainingService, memberTransitionService,campaignOperationsService,inventoryService,workspaceService }: CreateAppDependencies): Express {
  const app = express();
  const openApiDocument = createOpenApiDocument();
  const getHealthStatus = new GetHealthStatus(new SystemClock());

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(correlationIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (_request, response) => response.getHeader("x-correlation-id") as string
    })
  );
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (origin === undefined || config.corsAllowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new AppError(403, "CORS_ORIGIN_DENIED", "Origin is not allowed"));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(
    "/api/v1",
    rateLimit({
      windowMs: 60_000,
      limit: 100,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler(_request, response) {
        response.status(429).json({
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests",
            correlationId: response.locals.correlationId as string
          }
        });
      }
    }),
    createHealthRouter(getHealthStatus),
    ...(authService === undefined ? [] : [createAuthRouter(authService, invitationService)]),
    ...(authService === undefined || trainingService === undefined ? [] : [createTrainingRouter(authService, trainingService,memberTransitionService)]),
    ...(authService===undefined||campaignOperationsService===undefined?[]:[createOperationsRouter(authService,campaignOperationsService)]),
    ...(authService === undefined || inventoryService === undefined ? [] : [createInventoryRouter(authService, inventoryService)]),
    ...(authService === undefined || workspaceService === undefined ? [] : [createWorkspaceRouter(authService, workspaceService)])
  );

  if (config.swaggerEnabled) {
    app.get("/api/openapi.json", (_request, response) => {
      response.status(200).json(openApiDocument);
    });
    app.use(
      "/api/docs",
      swaggerUi.serve,
      swaggerUi.setup(openApiDocument, {
        swaggerOptions: {
          persistAuthorization: false,
          displayRequestDuration: true
        }
      })
    );
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
