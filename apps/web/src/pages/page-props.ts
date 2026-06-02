import type { Navigate } from "../app";
import type { Finding, Issue, Project, Report, ScanRun } from "../data";

export interface PageProps {
  workspaceSlug: string;
  project: Project;
  projects: Project[];
  scans: ScanRun[];
  findings: Finding[];
  issues: Issue[];
  reports: Report[];
  navigate: Navigate;
}
