import { and, asc, eq } from "drizzle-orm";

import type { SqliteDatabase } from "../db/client.js";
import { users, workspaceMembers, workspaces } from "../db/schema.js";

export type WorkspaceRole = "owner" | "member";

export interface WorkspaceMembership {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface WorkspaceAuthContext {
  workspaceId: string;
  workspaceSlug: string;
  role: WorkspaceRole;
}

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
}

export interface SessionPayload {
  user: SessionUser;
  workspaces: WorkspaceMembership[];
}

export class WorkspaceRoleError extends Error {
  constructor() {
    super("Insufficient workspace role");
  }
}

export async function listMemberships(db: SqliteDatabase, userId: string): Promise<WorkspaceMembership[]> {
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      role: workspaceMembers.role
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaces.createdAt))
    .all();
}

export async function getAuthorizedWorkspaceBySlug(
  db: SqliteDatabase,
  userId: string,
  slug: string
): Promise<WorkspaceAuthContext | null> {
  const row = db
    .select({
      workspaceId: workspaces.id,
      workspaceSlug: workspaces.slug,
      role: workspaceMembers.role
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(
      eq(workspaceMembers.userId, userId),
      eq(workspaces.slug, slug)
    ))
    .get();

  return row ?? null;
}

export function requireWorkspaceRole(context: WorkspaceAuthContext, roles: WorkspaceRole[]): void {
  if (!roles.includes(context.role)) {
    throw new WorkspaceRoleError();
  }
}

export async function buildSessionPayload(db: SqliteDatabase, user: SessionUser): Promise<SessionPayload> {
  return {
    user,
    workspaces: await listMemberships(db, user.id)
  };
}

export interface WorkspaceMemberRow {
  userId: string;
  fullName: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export async function listWorkspaceMembers(db: SqliteDatabase, workspaceId: string): Promise<WorkspaceMemberRow[]> {
  return db
    .select({
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.createdAt
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(workspaceMembers.createdAt))
    .all();
}
