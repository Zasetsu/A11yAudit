import type { Navigate } from "../app";
import type { Finding, Issue, Project, Report, ScanRun } from "../data";

export interface PageProps {
  project: Project;
  projects: Project[];
  scans: ScanRun[];
  findings: Finding[];
  issues: Issue[];
  reports: Report[];
  navigate: Navigate;
}
