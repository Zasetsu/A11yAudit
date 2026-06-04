import { useEffect, useRef, useState } from "react";
import { activeProject, type Project } from "../data";
import { Button, Icon, type IconName } from "./ui";
import type { Navigate, Route } from "../app";
import type { AuthSession } from "../api/client";
import { isWorkspaceOwner, type WorkspaceRole } from "../pages/page-props";
import { useT } from "../i18n/locale-context.js";
import type { Messages } from "../i18n/messages.js";

type TopLevelPage = Exclude<Route["page"], "finding-detail" | "scan-run-detail">;

type StringMessageKey = { [K in keyof Messages]: Messages[K] extends string ? K : never }[keyof Messages];

const navItems: Array<{ id: TopLevelPage; labelKey: StringMessageKey; icon: IconName }> = [
  { id: "overview", labelKey: "nav.overview", icon: "layout-dashboard" },
  { id: "projects", labelKey: "nav.projects", icon: "folder" },
  { id: "new-scan", labelKey: "nav.newScan", icon: "scan-search" },
  { id: "scan-runs", labelKey: "nav.scanRuns", icon: "activity" },
  { id: "findings", labelKey: "nav.findings", icon: "list" },
  { id: "reports", labelKey: "nav.reports", icon: "file-text" }
];

const configItems: Array<{ id: TopLevelPage; labelKey: StringMessageKey; icon: IconName }> = [
  { id: "settings", labelKey: "nav.settings", icon: "settings" }
];

function isActive(route: Route, id: Route["page"]): boolean {
  return route.page === id
    || (id === "findings" && route.page === "finding-detail")
    || (id === "scan-runs" && route.page === "scan-run-detail");
}

function NavButton({ item, route, navigate }: { item: { id: TopLevelPage; labelKey: StringMessageKey; icon: IconName }; route: Route; navigate: Navigate }) {
  const { t } = useT();
  const active = isActive(route, item.id);
  return (
    <button aria-current={active ? "page" : undefined} className={active ? "on" : ""} onClick={() => navigate({ page: item.id })} type="button">
      <Icon name={item.icon} size={16} />
      <span>{t(item.labelKey)}</span>
    </button>
  );
}

export function Sidebar({ route, navigate, workspaceRole }: { route: Route; navigate: Navigate; workspaceRole: WorkspaceRole }) {
  const { t } = useT();
  return (
    <nav aria-label={t("shell.primaryNav")} className="sidebar">
      <div className="brand">
        <img alt="" className="brand-mark" height={28} src="/favicon.svg" width={28} />
        <div className="name">Audera<small>{t("shell.brandSub")}</small></div>
      </div>
      <div className="nav-list">
        {navItems.map((item) => <NavButton item={item} key={item.id} navigate={navigate} route={route} />)}
        <div className="nav-section">{t("nav.configure")}</div>
        {isWorkspaceOwner(workspaceRole) ? (
          <NavButton item={{ id: "members", labelKey: "nav.members", icon: "shield-check" }} navigate={navigate} route={route} />
        ) : null}
        {configItems.map((item) => <NavButton item={item} key={item.id} navigate={navigate} route={route} />)}
      </div>
      <div className="sidebar-foot">
        <span className="health-dot" />
        <div>
          <div className="foot-title">{t("shell.selfHosted")}</div>
          <div className="mono foot-copy">{t("shell.localApi")}</div>
        </div>
      </div>
    </nav>
  );
}

function ProjectSelector({ project, projects, onSelect }: { project: Project; projects: Project[]; onSelect: (project: Project) => void }) {
  const { t } = useT();
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
          <div className="menu-label">{t("shell.switchProject")}</div>
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
  const { t } = useT();
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
          <div className="menu-label">{t("shell.switchWorkspace")}</div>
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
  const { t, locale, setLocale } = useT();
  const selectedProject = project ?? activeProject();

  return (
    <header className="topbar">
      <WorkspaceSelector currentWorkspaceSlug={currentWorkspaceSlug} onSelect={onSelectWorkspace} workspaces={workspaces} />
      <ProjectSelector onSelect={onSelectProject} project={selectedProject} projects={projects} />
      <Button className="topbar-scan" icon="scan-search" onClick={() => navigate({ page: "new-scan" })} variant="primary">{t("common.newScan")}</Button>
      <label className="global-search">
        <span className="sr-only">{t("shell.searchLabel")}</span>
        <Icon name="search" size={15} />
        <input placeholder={t("shell.searchPlaceholder")} type="search" />
      </label>
      <div className="top-spacer" />
      <div className="lang-switch" role="group" aria-label={t("shell.language")}>
        {(["tr", "en"] as const).map((code) => (
          <button
            key={code}
            type="button"
            aria-pressed={locale === code}
            className={locale === code ? "on" : ""}
            onClick={() => setLocale(code)}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>
      <Button aria-label={theme === "light" ? t("shell.switchThemeDark") : t("shell.switchThemeLight")} className="topbar-theme" icon={theme === "light" ? "moon" : "sun"} onClick={toggleTheme} variant="ghost" />
      <button aria-label={t("shell.repoNotConfigured")} className="icon-link" disabled title={t("shell.repoNotConfigured")} type="button">
        <Icon name="github" size={17} />
      </button>
      <Button aria-label={t("shell.signOut")} className="topbar-logout" icon="log-out" onClick={onLogout} variant="ghost" />
      <div className="local-status"><span className="health-dot" /> {t("shell.local")}</div>
    </header>
  );
}
