import type { Navigate } from "../app";
import type { Finding, Project, Report, ScanRun } from "../data";

export interface PageProps {
  project: Project;
  projects: Project[];
  scans: ScanRun[];
  findings: Finding[];
  reports: Report[];
  navigate: Navigate;
}
