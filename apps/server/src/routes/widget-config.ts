import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/session.js";
import type { SqliteDatabase } from "../db/client.js";
import {
  getWidgetConfigForWorkspaceProject,
  upsertWidgetConfigForWorkspaceProject
} from "../repositories/widget-config.js";
import {
  requireWorkspaceMembership,
  requireWorkspaceOwner,
  workspaceParamsSchema
} from "./workspace-access.js";

const paramsSchema = workspaceParamsSchema.extend({
  projectId: z.string().trim().min(1)
});

const brandSchema = z
  .object({
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    theme: z.enum(["light", "dark", "auto"]).optional(),
    launcherLabel: z.string().max(60).optional(),
    launcherIcon: z.string().optional()
  })
  .strict()
  .optional();

const configPayloadSchema = z
  .object({
    enabledSections: z.array(z.string()).optional(),
    disabledFeatures: z.array(z.string()).optional(),
    position: z
      .enum(["bottom-right", "bottom-left", "top-right", "top-left"])
      .optional(),
    language: z.enum(["tr", "en"]).optional(),
    brand: brandSchema,
    customCss: z.string().optional()
  })
  .strict();

export interface WidgetConfigRouteOptions {
  db: SqliteDatabase;
}

export async function registerWidgetConfigRoutes(
  app: FastifyInstance,
  options: WidgetConfigRouteOptions
): Promise<void> {
  const { db } = options;

  app.get(
    "/api/workspaces/:workspaceSlug/projects/:projectId/widget-config",
    async (request, reply) => {
      const user = await requireAuth(request, reply);
      if (!user) return undefined;

      const params = paramsSchema.safeParse(request.params);
      if (!params.success) {
        return reply
          .code(400)
          .send({ error: "Invalid parameters", issues: params.error.issues });
      }

      const context = await requireWorkspaceMembership(
        db,
        user.id,
        params.data.workspaceSlug,
        reply
      );
      if (!context) return undefined;

      try {
        const config = getWidgetConfigForWorkspaceProject(
          db,
          params.data.workspaceSlug,
          params.data.projectId
        );
        return reply.send({ config });
      } catch {
        return reply.code(404).send({ error: "Project not found" });
      }
    }
  );

  app.put(
    "/api/workspaces/:workspaceSlug/projects/:projectId/widget-config",
    async (request, reply) => {
      const user = await requireAuth(request, reply);
      if (!user) return undefined;

      const params = paramsSchema.safeParse(request.params);
      if (!params.success) {
        return reply
          .code(400)
          .send({ error: "Invalid parameters", issues: params.error.issues });
      }

      const context = await requireWorkspaceMembership(
        db,
        user.id,
        params.data.workspaceSlug,
        reply
      );
      if (!context) return undefined;

      if (!requireWorkspaceOwner(context, reply)) return undefined;

      const payload = configPayloadSchema.safeParse(request.body);
      if (!payload.success) {
        return reply
          .code(400)
          .send({ error: "Invalid widget config", issues: payload.error.issues });
      }

      try {
        const config = upsertWidgetConfigForWorkspaceProject(
          db,
          params.data.workspaceSlug,
          params.data.projectId,
          payload.data
        );
        return reply.send({ config });
      } catch {
        return reply.code(404).send({ error: "Project not found" });
      }
    }
  );
}
