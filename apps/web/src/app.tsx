import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchIssues, getFindings, getProjects, getReports, getScans, getSession, type AuthSession } from "./api/client";
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
import { LoginPage } from "./pages/login";
import { SignupPage } from "./pages/signup";
import { InvitePage } from "./pages/invite";
import { WorkspacesPage } from "./pages/workspaces";
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

export type WorkspacePage = Route["page"];

export type AppRoute =
  | { page: "login" }
  | { page: "signup" }
  | { page: "invite"; token: string }
  | { page: "workspaces" }
  | (Route & { workspaceSlug: string });

const activeScanStatuses = new Set<ScanRun["status"]>(["queued", "crawling", "auditing", "reporting"]);
const workspacePages = new Set<Exclude<WorkspacePage, "finding-detail">>([
  "overview",
  "projects",
  "new-scan",
  "scan-runs",
  "findings",
  "reports",
  "settings",
  "docs"
]);

function routePath(route: AppRoute): string {
  if (route.page === "login") return "/login";
  if (route.page === "signup") return "/signup";
  if (route.page === "workspaces") return "/workspaces";
  if (route.page === "invite") return `/invite/${encodeURIComponent(route.token)}`;
  if (route.page === "finding-detail") {
    return `/w/${encodeURIComponent(route.workspaceSlug)}/findings/${encodeURIComponent(route.findingId)}`;
  }

  return `/w/${encodeURIComponent(route.workspaceSlug)}/${route.page}`;
}

function isWorkspaceRoute(route: AppRoute): route is Route & { workspaceSlug: string } {
  return "workspaceSlug" in route;
}

function dashboardRoute(route: Route & { workspaceSlug: string }): Route {
  if (route.page === "finding-detail") return { page: "finding-detail", findingId: route.findingId };
  return { page: route.page };
}

function destinationForSession(session: AuthSession): AppRoute {
  if (session.workspaces.length === 1) {
    return { page: "projects", workspaceSlug: session.workspaces[0].slug };
  }

  return { page: "workspaces" };
}

function workspaceIsAllowed(session: AuthSession | null | undefined, workspaceSlug: string): boolean {
  return session?.workspaces.some((workspace) => workspace.slug === workspaceSlug) ?? false;
}

function safeDecodePathPart(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function parsePath(pathname: string): AppRoute {
  if (pathname === "/login") return { page: "login" };
  if (pathname === "/signup") return { page: "signup" };
  if (pathname === "/workspaces") return { page: "workspaces" };
  const invite = pathname.match(/^\/invite\/([^/]+)$/);
  if (invite) {
    const token = safeDecodePathPart(invite[1]);
    return token === null ? { page: "login" } : { page: "invite", token };
  }
  const finding = pathname.match(/^\/w\/([^/]+)\/findings\/([^/]+)$/);
  if (finding) {
    const workspaceSlug = safeDecodePathPart(finding[1]);
    const findingId = safeDecodePathPart(finding[2]);
    if (workspaceSlug === null || findingId === null) return { page: "login" };

    return {
      page: "finding-detail",
      findingId,
      workspaceSlug
    };
  }
  const workspace = pathname.match(/^\/w\/([^/]+)\/([^/]+)$/);
  if (workspace && workspacePages.has(workspace[2] as Exclude<WorkspacePage, "finding-detail">)) {
    const workspaceSlug = safeDecodePathPart(workspace[1]);
    if (workspaceSlug === null) return { page: "login" };

    return {
      page: workspace[2] as Exclude<WorkspacePage, "finding-detail">,
      workspaceSlug
    };
  }
  return { page: "login" };
}

function hasActiveScans(scans: ScanRun[] | undefined): boolean {
  return scans?.some((scan) => activeScanStatuses.has(scan.status)) ?? false;
}

function latestScanForProject(scans: ScanRun[] | undefined, projectId: string): ScanRun | undefined {
  return scans?.reduce<ScanRun | undefined>((latest, scan) => {
    if (scan.projectId !== projectId) return latest;
    if (latest === undefined) return scan;

    return scan.createdAt > latest.createdAt ? scan : latest;
  }, undefined);
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
  const [appRoute, setAppRoute] = useState<AppRoute>(() => parsePath(window.location.pathname));
  const [authenticatedSession, setAuthenticatedSession] = useState<AuthSession | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const storage = globalThis.localStorage;
    const saved = typeof storage?.getItem === "function" ? storage.getItem("a11yaudit-theme") : null;
    return saved === "dark" ? "dark" : "light";
  });
  const contentRef = useRef<HTMLElement>(null);
  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: getSession
  });
  const session: AuthSession | null = authenticatedSession ?? sessionQuery.data ?? null;
  const sessionLoaded = !sessionQuery.isLoading;
  const currentWorkspaceSlug = isWorkspaceRoute(appRoute) ? appRoute.workspaceSlug : null;
  const hasWorkspaceAccess = currentWorkspaceSlug !== null && workspaceIsAllowed(session, currentWorkspaceSlug);
  const dashboardQueriesEnabled = sessionLoaded && session !== null && hasWorkspaceAccess && currentWorkspaceSlug !== null;

  const projectsQuery = useQuery({
    queryKey: ["projects", currentWorkspaceSlug],
    queryFn: () => getProjects(currentWorkspaceSlug ?? ""),
    enabled: dashboardQueriesEnabled
  });
  const scansQuery = useQuery({
    queryKey: ["scans", currentWorkspaceSlug],
    queryFn: () => getScans(currentWorkspaceSlug ?? ""),
    enabled: dashboardQueriesEnabled,
    refetchInterval: (query) => (hasActiveScans(query.state.data) ? 2_000 : false)
  });
  const findingsQuery = useQuery({
    queryKey: ["findings", currentWorkspaceSlug],
    queryFn: () => getFindings(currentWorkspaceSlug ?? ""),
    enabled: dashboardQueriesEnabled
  });
  const projects = projectsQuery.data ?? [activeProject()];
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProject().id);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? emptyProject();
  const selectedScan = useMemo(
    () => latestScanForProject(scansQuery.data, selectedProject.id),
    [scansQuery.data, selectedProject.id]
  );
  const issuesQuery = useQuery({
    queryKey: ["issues", currentWorkspaceSlug, selectedProject.id, selectedScan?.id ?? null],
    queryFn: () => fetchIssues(
      currentWorkspaceSlug ?? "",
      selectedScan === undefined
        ? { projectId: selectedProject.id }
        : { projectId: selectedProject.id, scanRunId: selectedScan.id }
    ),
    enabled: dashboardQueriesEnabled,
    refetchInterval: hasActiveScans(scansQuery.data) ? 3_000 : false
  });
  const reportsQuery = useQuery({
    queryKey: ["reports", currentWorkspaceSlug],
    queryFn: () => getReports(currentWorkspaceSlug ?? ""),
    enabled: dashboardQueriesEnabled,
    refetchInterval: hasActiveScans(scansQuery.data) ? 2_000 : false
  });

  const setBrowserRoute = useCallback((nextRoute: AppRoute, mode: "push" | "replace" = "push") => {
    setAppRoute(nextRoute);
    const nextPath = routePath(nextRoute);
    if (window.location.pathname !== nextPath) {
      if (mode === "replace") {
        window.history.replaceState(null, "", nextPath);
      } else {
        window.history.pushState(null, "", nextPath);
      }
    }
  }, []);

  const routeAfterAuth = useCallback((nextSession: AuthSession) => {
    setAuthenticatedSession(nextSession);
    setBrowserRoute(destinationForSession(nextSession), "replace");
  }, [setBrowserRoute]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const storage = globalThis.localStorage;
    if (typeof storage?.setItem === "function") {
      storage.setItem("a11yaudit-theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    function onPopState() {
      setAppRoute(parsePath(window.location.pathname));
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!sessionLoaded) return;

    if (isWorkspaceRoute(appRoute)) {
      if (session === null) {
        setBrowserRoute({ page: "login" }, "replace");
        return;
      }

      if (!workspaceIsAllowed(session, appRoute.workspaceSlug)) {
        setBrowserRoute({ page: "workspaces" }, "replace");
      }
      return;
    }

    if (appRoute.page === "workspaces") {
      if (session === null) {
        setBrowserRoute({ page: "login" }, "replace");
      } else if (session.workspaces.length === 1) {
        setBrowserRoute(destinationForSession(session), "replace");
      }
      return;
    }

    if (session !== null) {
      setBrowserRoute(destinationForSession(session), "replace");
    }
  }, [appRoute, session, sessionLoaded, setBrowserRoute]);

  useEffect(() => {
    if (!projects.some((project) => project.id === selectedProjectId) && projects[0] !== undefined) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const navigate = useCallback<Navigate>((nextRoute) => {
    if (currentWorkspaceSlug !== null) {
      setBrowserRoute({ ...nextRoute, workspaceSlug: currentWorkspaceSlug });
    }
    contentRef.current?.scrollTo({ top: 0 });
  }, [currentWorkspaceSlug, setBrowserRoute]);

  const onSelectProject = useCallback((project: Project) => setSelectedProjectId(project.id), []);

  if (!sessionLoaded) {
    return (
      <main aria-label="Main content" className="content auth-content">
        <div className="content-inner fadein">
          <Panel title="Loading">Preparing your session.</Panel>
        </div>
      </main>
    );
  }

  if (appRoute.page === "login") {
    return <LoginPage onAuthenticated={routeAfterAuth} />;
  }

  if (appRoute.page === "signup") {
    return <SignupPage onAuthenticated={routeAfterAuth} />;
  }

  if (appRoute.page === "invite") {
    return <InvitePage onAuthenticated={routeAfterAuth} token={appRoute.token} />;
  }

  if (appRoute.page === "workspaces") {
    if (session === null) return null;
    return <WorkspacesPage onSelectWorkspace={(slug) => setBrowserRoute({ page: "projects", workspaceSlug: slug })} session={session} />;
  }

  if (session === null || currentWorkspaceSlug === null || !hasWorkspaceAccess) {
    return null;
  }

  const route = dashboardRoute(appRoute);

  const common = {
    workspaceSlug: currentWorkspaceSlug,
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
