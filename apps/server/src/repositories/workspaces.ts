import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";

import type { SqliteDatabase } from "../db/client.js";
import { users, workspaceInvitations, workspaceMembers, workspaces } from "../db/schema.js";

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

export function countWorkspaceOwners(db: SqliteDatabase, workspaceId: string): number {
  return db
    .select({ count: sql<number>`count(*)` })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, "owner")))
    .get()?.count ?? 0;
}

export function isLastOwner(db: SqliteDatabase, workspaceId: string, member: { role: WorkspaceRole }): boolean {
  return member.role === "owner" && countWorkspaceOwners(db, workspaceId) === 1;
}

export function getWorkspaceMember(
  db: SqliteDatabase,
  workspaceId: string,
  userId: string
): { id: string; role: WorkspaceRole } | null {
  const row = db
    .select({ id: workspaceMembers.id, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .get();

  return row ?? null;
}

export function updateMemberRole(db: SqliteDatabase, workspaceId: string, userId: string, role: WorkspaceRole): void {
  db.update(workspaceMembers)
    .set({ role })
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .run();
}

export function removeMember(db: SqliteDatabase, workspaceId: string, userId: string): void {
  db.delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .run();
}

export function emailIsWorkspaceMember(db: SqliteDatabase, workspaceId: string, email: string): boolean {
  const row = db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(users.email, email)))
    .get();

  return row !== undefined;
}

export function pendingInvitationExists(
  db: SqliteDatabase,
  workspaceId: string,
  email: string,
  now: string
): boolean {
  const row = db
    .select({ id: workspaceInvitations.id })
    .from(workspaceInvitations)
    .where(and(
      eq(workspaceInvitations.workspaceId, workspaceId),
      eq(workspaceInvitations.email, email),
      isNull(workspaceInvitations.acceptedAt),
      isNull(workspaceInvitations.revokedAt),
      gt(workspaceInvitations.expiresAt, now)
    ))
    .get();

  return row !== undefined;
}

export interface PendingInvitationRow {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  createdAt: string;
}

export function listPendingInvitations(db: SqliteDatabase, workspaceId: string, now: string): PendingInvitationRow[] {
  return db
    .select({
      id: workspaceInvitations.id,
      email: workspaceInvitations.email,
      role: workspaceInvitations.role,
      expiresAt: workspaceInvitations.expiresAt,
      createdAt: workspaceInvitations.createdAt
    })
    .from(workspaceInvitations)
    .where(and(
      eq(workspaceInvitations.workspaceId, workspaceId),
      isNull(workspaceInvitations.acceptedAt),
      isNull(workspaceInvitations.revokedAt),
      gt(workspaceInvitations.expiresAt, now)
    ))
    .orderBy(asc(workspaceInvitations.createdAt))
    .all();
}
