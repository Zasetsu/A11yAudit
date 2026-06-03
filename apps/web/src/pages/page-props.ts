import type { Navigate } from "../app";
import type { Finding, Issue, Project, Report, ScanRun } from "../data";

export type WorkspaceRole = "owner" | "member";

export function isWorkspaceOwner(role: WorkspaceRole): boolean {
  return role === "owner";
}

export interface PageProps {
  workspaceSlug: string;
  workspaceRole: WorkspaceRole;
  project: Project;
  projects: Project[];
  scans: ScanRun[];
  findings: Finding[];
  issues: Issue[];
  reports: Report[];
  navigate: Navigate;
}
