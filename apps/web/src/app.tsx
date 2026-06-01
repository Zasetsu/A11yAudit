import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchIssues, getFindings, getProjects, getReports, getScans } from "./api/client";
import { Sidebar, TopBar } from "./design/shell";
import { activeProject, emptyProject, type Project, type ScanRun } from "./data";
import { OverviewPage } from "./pages/overview";
import { ProjectsPage } from "./pages/projects";
import { NewScanPage } from "./pages/new-scan";
import { ScanRunsPage } from "./pages/scan-runs";
import { FindingsPage } from "./pages/findings";
import { FindingDetailPage } from "./pages/finding-detail";
import { ReportsPage } from "./pages/reports";
import { SettingsPage } from "./pages/settings";
import { Button, Icon, PageHeader, Panel } from "./design/ui";

export type Route =
  | { page: "overview" }
  | { page: "projects" }
  | { page: "new-scan" }
  | { page: "scan-runs" }
  | { page: "findings" }
  | { page: "finding-detail"; findingId: string }
  | { page: "reports" }
  | { page: "settings" }
  | { page: "docs" };

export type Navigate = (route: Route) => void;

const activeScanStatuses = new Set<ScanRun["status"]>(["queued", "crawling", "auditing", "reporting"]);

function hasActiveScans(scans: ScanRun[] | undefined): boolean {
  return scans?.some((scan) => activeScanStatuses.has(scan.status)) ?? false;
}

function DocsPage() {
  return (
    <div className="content-inner fadein">
      <PageHeader
        icon="book-open"
        subtitle="Operator notes for this open-source, self-hosted MVP."
        title="Documentation"
      />
      <Panel title="MVP scope">
        <div className="doc-grid">
          <div className="note"><Icon name="info" size={14} /> A11yAudit scans public HTTP and HTTPS targets only. Authenticated scans, scheduled scans, CSV exports, and resolved-state workflows are outside this MVP.</div>
          <ul className="doc-list">
            <li>Create or select a public website project.</li>
            <li>Run a single URL scan or a same-domain crawl with max page, max depth, desktop, and mobile controls.</li>
            <li>Review findings grouped by WCAG criterion, severity, viewport, selector, screenshot, and snippet evidence.</li>
            <li>Download HTML and PDF report artifacts from completed scans.</li>
          </ul>
        </div>
      </Panel>
    </div>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>({ page: "overview" });
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = globalThis.localStorage?.getItem("a11yaudit-theme");
    return saved === "dark" ? "dark" : "light";
  });
  const contentRef = useRef<HTMLElement>(null);

  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: getProjects });
  const scansQuery = useQuery({
    queryKey: ["scans"],
    queryFn: getScans,
    refetchInterval: (query) => (hasActiveScans(query.state.data) ? 2_000 : false)
  });
  const findingsQuery = useQuery({ queryKey: ["findings"], queryFn: getFindings });
  const issuesQuery = useQuery({
    queryKey: ["issues"],
    queryFn: () => fetchIssues(),
    refetchInterval: hasActiveScans(scansQuery.data) ? 3_000 : false
  });
  const reportsQuery = useQuery({
    queryKey: ["reports"],
    queryFn: getReports,
    refetchInterval: hasActiveScans(scansQuery.data) ? 2_000 : false
  });

  const projects = projectsQuery.data ?? [activeProject()];
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProject().id);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? emptyProject();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    globalThis.localStorage?.setItem("a11yaudit-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!projects.some((project) => project.id === selectedProjectId) && projects[0] !== undefined) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const navigate = useCallback<Navigate>((nextRoute) => {
    setRoute(nextRoute);
    contentRef.current?.scrollTo({ top: 0 });
  }, []);

  const onSelectProject = useCallback((project: Project) => setSelectedProjectId(project.id), []);

  const common = {
    project: selectedProject,
    projects,
    scans: scansQuery.data ?? [],
    findings: findingsQuery.data ?? [],
    issues: issuesQuery.data ?? [],
    reports: reportsQuery.data ?? [],
    navigate
  };

  let view;
  switch (route.page) {
    case "overview":
      view = <OverviewPage {...common} />;
      break;
    case "projects":
      view = <ProjectsPage {...common} onSelectProject={onSelectProject} />;
      break;
    case "new-scan":
      view = <NewScanPage {...common} onSelectProject={onSelectProject} />;
      break;
    case "scan-runs":
      view = <ScanRunsPage {...common} />;
      break;
    case "findings":
      view = <FindingsPage {...common} />;
      break;
    case "finding-detail":
      view = <FindingDetailPage {...common} findingId={route.findingId} />;
      break;
    case "reports":
      view = <ReportsPage {...common} />;
      break;
    case "settings":
      view = <SettingsPage {...common} />;
      break;
    case "docs":
      view = <DocsPage />;
      break;
  }

  return (
    <div className="app">
      <Sidebar navigate={navigate} route={route} />
      <div className="main">
        <TopBar
          navigate={navigate}
          onSelectProject={onSelectProject}
          project={selectedProject}
          projects={projects}
          theme={theme}
          toggleTheme={() => setTheme((value) => (value === "light" ? "dark" : "light"))}
        />
        <main aria-label="Main content" className="content" ref={contentRef}>
          {projectsQuery.isError || scansQuery.isError || findingsQuery.isError || issuesQuery.isError || reportsQuery.isError ? (
            <div className="content-inner" style={{ paddingBottom: 0 }}>
              <div className="note"><Icon name="info" size={14} /> API data is unavailable, so the interface is showing local demo data.</div>
            </div>
          ) : null}
          {view}
          <div className="mobile-only" style={{ padding: "0 14px 18px" }}>
            <Button icon="scan-search" onClick={() => navigate({ page: "new-scan" })} variant="primary">New Scan</Button>
          </div>
        </main>
      </div>
    </div>
  );
}
