import { useEffect, useRef, useState } from "react";
import { activeProject, type Project } from "../data";
import { Button, Icon, type IconName } from "./ui";
import type { Navigate, Route } from "../app";
import type { AuthSession } from "../api/client";
import { isWorkspaceOwner, type WorkspaceRole } from "../pages/page-props";

type TopLevelPage = Exclude<Route["page"], "finding-detail">;

const navItems: Array<{ id: TopLevelPage; label: string; icon: IconName }> = [
  { id: "overview", label: "Overview", icon: "layout-dashboard" },
  { id: "projects", label: "Projects", icon: "folder" },
  { id: "new-scan", label: "New Scan", icon: "scan-search" },
  { id: "scan-runs", label: "Scan Runs", icon: "activity" },
  { id: "findings", label: "Findings", icon: "list" },
  { id: "reports", label: "Reports", icon: "file-text" }
];

const configItems: Array<{ id: TopLevelPage; label: string; icon: IconName }> = [
  { id: "settings", label: "Settings", icon: "settings" },
  { id: "docs", label: "Documentation", icon: "book-open" }
];

function isActive(route: Route, id: Route["page"]): boolean {
  return route.page === id || (id === "findings" && route.page === "finding-detail");
}

function NavButton({ item, route, navigate }: { item: { id: TopLevelPage; label: string; icon: IconName }; route: Route; navigate: Navigate }) {
  const active = isActive(route, item.id);
  return (
    <button aria-current={active ? "page" : undefined} className={active ? "on" : ""} onClick={() => navigate({ page: item.id })} type="button">
      <Icon name={item.icon} size={16} />
      <span>{item.label}</span>
    </button>
  );
}

export function Sidebar({ route, navigate, workspaceRole }: { route: Route; navigate: Navigate; workspaceRole: WorkspaceRole }) {
  return (
    <nav aria-label="Primary" className="sidebar">
      <div className="brand">
        <div className="logo"><Icon name="shield-check" size={16} /></div>
        <div className="name">A11yAudit<small>WCAG 2.2 Console</small></div>
      </div>
      <div className="nav-list">
        {navItems.map((item) => <NavButton item={item} key={item.id} navigate={navigate} route={route} />)}
        <div className="nav-section">Configure</div>
        {isWorkspaceOwner(workspaceRole) ? (
          <NavButton item={{ id: "members", label: "Members", icon: "shield-check" }} navigate={navigate} route={route} />
        ) : null}
        {configItems.map((item) => <NavButton item={item} key={item.id} navigate={navigate} route={route} />)}
      </div>
      <div className="sidebar-foot">
        <span className="health-dot" />
        <div>
          <div className="foot-title">Self-hosted instance</div>
          <div className="mono foot-copy">local API · v0.1.0</div>
        </div>
      </div>
    </nav>
  );
}

function ProjectSelector({ project, projects, onSelect }: { project: Project; projects: Project[]; onSelect: (project: Project) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="project-select-wrap" ref={ref}>
      <button aria-expanded={open} aria-haspopup="listbox" className="project-select" onClick={() => setOpen((value) => !value)} type="button">
        <span className="project-logo">{project.name.slice(0, 1)}</span>
        <span className="project-text">
          <span>{project.name}</span>
          <small className="mono">{project.domain}</small>
        </span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open ? (
        <div className="project-menu" role="listbox">
          <div className="menu-label">Switch project</div>
          {projects.map((candidate) => (
            <button
              aria-selected={candidate.id === project.id}
              className={candidate.id === project.id ? "selected" : ""}
              key={candidate.id}
              onClick={() => {
                onSelect(candidate);
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              <span className="project-logo">{candidate.name.slice(0, 1)}</span>
              <span className="project-text">
                <span>{candidate.name}</span>
                <small className="mono">{candidate.domain}</small>
              </span>
              {candidate.id === project.id ? <Icon name="check" size={14} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceSelector({
  currentWorkspaceSlug,
  workspaces,
  onSelect
}: {
  currentWorkspaceSlug: string;
  workspaces: AuthSession["workspaces"];
  onSelect: (workspaceSlug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentWorkspace = workspaces.find((workspace) => workspace.slug === currentWorkspaceSlug) ?? workspaces[0];

  useEffect(() => {
    function close(event: MouseEvent) {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (currentWorkspace === undefined) return null;

  return (
    <div className="project-select-wrap" ref={ref}>
      <button aria-expanded={open} aria-haspopup="listbox" className="project-select" onClick={() => setOpen((value) => !value)} type="button">
        <span className="project-logo">{currentWorkspace.name.slice(0, 1)}</span>
        <span className="project-text">
          <span>{currentWorkspace.name}</span>
          <small className="mono">/{currentWorkspace.slug} · {currentWorkspace.role}</small>
        </span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open ? (
        <div className="project-menu" role="listbox">
          <div className="menu-label">Switch workspace</div>
          {workspaces.map((workspace) => (
            <button
              aria-selected={workspace.slug === currentWorkspace.slug}
              className={workspace.slug === currentWorkspace.slug ? "selected" : ""}
              key={workspace.id}
              onClick={() => {
                onSelect(workspace.slug);
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              <span className="project-logo">{workspace.name.slice(0, 1)}</span>
              <span className="project-text">
                <span>{workspace.name}</span>
                <small className="mono">/{workspace.slug} · {workspace.role}</small>
              </span>
              {workspace.slug === currentWorkspace.slug ? <Icon name="check" size={14} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TopBar({
  project,
  projects,
  onSelectProject,
  currentWorkspaceSlug,
  workspaces,
  onSelectWorkspace,
  navigate,
  theme,
  toggleTheme,
  onLogout
}: {
  project: Project;
  projects: Project[];
  onSelectProject: (project: Project) => void;
  currentWorkspaceSlug: string;
  workspaces: AuthSession["workspaces"];
  onSelectWorkspace: (workspaceSlug: string) => void;
  navigate: Navigate;
  theme: "light" | "dark";
  toggleTheme: () => void;
  onLogout: () => void;
}) {
  const selectedProject = project ?? activeProject();

  return (
    <header className="topbar">
      <WorkspaceSelector currentWorkspaceSlug={currentWorkspaceSlug} onSelect={onSelectWorkspace} workspaces={workspaces} />
      <ProjectSelector onSelect={onSelectProject} project={selectedProject} projects={projects} />
      <Button className="topbar-scan" icon="scan-search" onClick={() => navigate({ page: "new-scan" })} variant="primary">New Scan</Button>
      <label className="global-search">
        <span className="sr-only">Search findings, URLs, and WCAG criteria</span>
        <Icon name="search" size={15} />
        <input placeholder="Search findings, URLs, WCAG criteria..." type="search" />
      </label>
      <div className="top-spacer" />
      <Button aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} className="topbar-theme" icon={theme === "light" ? "moon" : "sun"} onClick={toggleTheme} variant="ghost" />
      <button aria-label="Repository link is not configured" className="icon-link" disabled title="Repository link is not configured" type="button">
        <Icon name="github" size={17} />
      </button>
      <Button aria-label="Sign out" className="topbar-logout" icon="log-out" onClick={onLogout} variant="ghost" />
      <div className="local-status"><span className="health-dot" /> Local</div>
    </header>
  );
}
