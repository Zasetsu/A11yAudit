// @vitest-environment happy-dom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, parsePath } from "../app";
import { LoginPage } from "./login";
import { LocaleProvider } from "../i18n/locale-context.js";
import { renderWithLocale } from "../test-utils/render-with-locale.js";
import type { AuthSession } from "../api/client";
import type { Project, ScanRun } from "../data";

const api = vi.hoisted(() => ({
  acceptInvite: vi.fn(),
  createProject: vi.fn(),
  createScan: vi.fn(),
  fetchIssues: vi.fn(),
  getFindings: vi.fn(),
  getProjects: vi.fn(),
  getReports: vi.fn(),
  getScans: vi.fn(),
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  signup: vi.fn()
}));

vi.mock("../api/client", () => api);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const acmeSession: AuthSession = {
  user: { id: "user-1", fullName: "Ada Lovelace", email: "ada@example.test" },
  workspaces: [{ id: "workspace-1", name: "Acme", slug: "acme", role: "owner" }]
};

const multiWorkspaceSession: AuthSession = {
  ...acmeSession,
  workspaces: [
    { id: "workspace-1", name: "Acme", slug: "acme", role: "owner" },
    { id: "workspace-2", name: "Beta", slug: "beta", role: "member" }
  ]
};

const memberSession: AuthSession = {
  ...acmeSession,
  workspaces: [{ id: "workspace-1", name: "Acme", slug: "acme", role: "member" }]
};

function project(overrides: Pick<Project, "id" | "name" | "url" | "domain">): Project {
  return {
    score: 100,
    createdAt: "2026-06-02T00:00:00.000Z",
    lastScan: null,
    openFindings: 0,
    reports: 0,
    status: "active",
    crawlLimit: 10,
    viewports: "Desktop + mobile",
    ...overrides
  };
}

const acmeProject = project({
  id: "project-acme",
  name: "Acme Portal",
  url: "https://acme.example.test/",
  domain: "acme.example.test"
});

const betaProject = project({
  id: "project-beta",
  name: "Beta Portal",
  url: "https://beta.example.test/",
  domain: "beta.example.test"
});

const newProject = project({
  id: "project-new",
  name: "New Portal",
  url: "https://new.example.test/",
  domain: "new.example.test"
});

function setPath(pathname: string) {
  window.history.replaceState(null, "", pathname);
}

function mockSession(session: AuthSession | null) {
  api.getSession.mockResolvedValue(session);
}

function setupQueryMocks() {
  api.createProject.mockResolvedValue(null);
  api.createScan.mockImplementation((workspaceSlug: string, input: Partial<ScanRun>) => Promise.resolve({
    id: `scan-${workspaceSlug}`,
    projectId: input.projectId ?? "project",
    projectName: "Project",
    url: input.url ?? "https://example.test/",
    status: "queued",
    mode: input.mode ?? "single_url",
    maxPages: input.maxPages ?? 1,
    maxDepth: input.maxDepth ?? 0,
    viewports: "Desktop",
    trigger: "Manual",
    pagesQueued: 0,
    pagesScanned: 0,
    findingsTotal: 0,
    score: null,
    createdAt: "2026-06-02T00:00:00.000Z",
    startedAt: null,
    finishedAt: null,
    errorMessage: null
  }));
  api.fetchIssues.mockResolvedValue([]);
  api.getFindings.mockResolvedValue([]);
  api.getProjects.mockResolvedValue([]);
  api.getReports.mockResolvedValue([]);
  api.getScans.mockResolvedValue([]);
  api.logout.mockResolvedValue(undefined);
}

async function renderApp() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } }
  });

  await act(async () => {
    root.render(
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </LocaleProvider>
    );
  });

  return { container, queryClient, root };
}

type RenderedApp = Awaited<ReturnType<typeof renderApp>>;

const dashboardQueryNames = new Set(["projects", "scans", "findings", "issues", "reports"]);

function dashboardQueryKeys({ queryClient }: RenderedApp) {
  return queryClient.getQueryCache().getAll()
    .map((query) => query.queryKey)
    .filter((queryKey) => dashboardQueryNames.has(String(queryKey[0])));
}

async function waitFor(assertion: () => void | Promise<void>) {
  const timeoutAt = Date.now() + 1_000;
  let lastError: unknown;

  while (Date.now() < timeoutAt) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }

  throw lastError;
}

async function fillInput(container: HTMLElement, label: string, value: string) {
  let input: HTMLInputElement | null | undefined;

  await waitFor(() => {
    input = Array.from(container.querySelectorAll("label")).find((candidate) =>
      candidate.textContent?.includes(label)
    )?.querySelector("input");
    expect(input).toBeTruthy();
  });

  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, value);
    input!.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function inputValue(container: HTMLElement, label: string): Promise<string> {
  let input: HTMLInputElement | null | undefined;

  await waitFor(() => {
    input = Array.from(container.querySelectorAll("label")).find((candidate) =>
      candidate.textContent?.includes(label)
    )?.querySelector("input");
    expect(input).toBeTruthy();
  });

  return input!.value;
}

async function selectOption(container: HTMLElement, label: string, value: string) {
  let select: HTMLSelectElement | null | undefined;

  await waitFor(() => {
    select = Array.from(container.querySelectorAll("label")).find((candidate) =>
      candidate.textContent?.includes(label)
    )?.querySelector("select");
    expect(select).toBeTruthy();
  });

  await act(async () => {
    select!.value = value;
    select!.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function routeTo(pathname: string) {
  await act(async () => {
    window.history.pushState(null, "", pathname);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

async function clickButton(container: HTMLElement, label: string) {
  let button: HTMLButtonElement | undefined;

  await waitFor(() => {
    button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.trim() === label
    );
    expect(button).toBeTruthy();
  });

  await act(async () => {
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function clickButtonContaining(container: HTMLElement, label: string) {
  let button: HTMLButtonElement | undefined;

  await waitFor(() => {
    button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes(label)
    );
    expect(button).toBeTruthy();
  });

  await act(async () => {
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("auth routes", () => {
  let roots: Root[] = [];

  beforeEach(() => {
    localStorage.setItem("a11yaudit-locale", "en");
    vi.clearAllMocks();
    setupQueryMocks();
    setPath("/login");
  });

  afterEach(async () => {
    for (const root of roots) {
      await act(async () => root.unmount());
    }
    roots = [];
    document.body.innerHTML = "";
  });

  it("renders the Turkish sign-in heading when locale is tr", () => {
    const rendered = renderWithLocale(<LoginPage onAuthenticated={() => {}} onSignup={() => {}} />, "tr");
    try {
      expect(rendered.container.textContent).toContain("Giriş Yap");
    } finally {
      rendered.unmount();
    }
  });

  it("parses public and workspace browser paths", () => {
    expect(parsePath("/login")).toEqual({ page: "login" });
    expect(parsePath("/signup")).toEqual({ page: "signup" });
    expect(parsePath("/workspaces")).toEqual({ page: "workspaces" });
    expect(parsePath("/invite/token-123")).toEqual({ page: "invite", token: "token-123" });
    expect(parsePath("/w/acme/projects")).toEqual({ page: "projects", workspaceSlug: "acme" });
    expect(parsePath("/w/acme/findings/finding-1")).toEqual({
      page: "finding-detail",
      findingId: "finding-1",
      workspaceSlug: "acme"
    });
    expect(parsePath("/missing")).toEqual({ page: "login" });
  });

  it("falls back to login for malformed encoded paths", () => {
    expect(parsePath("/invite/%E0%A4%A")).toEqual({ page: "login" });
    expect(parsePath("/w/%E0%A4%A/projects")).toEqual({ page: "login" });
    expect(parsePath("/w/acme/findings/%E0%A4%A")).toEqual({ page: "login" });
  });

  it("redirects a single-workspace session to workspace projects", async () => {
    mockSession(acmeSession);
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => expect(window.location.pathname).toBe("/w/acme/projects"));
  });

  it("redirects unauthenticated workspace routes to login", async () => {
    setPath("/w/acme/projects");
    mockSession(null);
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => expect(window.location.pathname).toBe("/login"));
  });

  it("redirects multiple-workspace sessions to workspace chooser", async () => {
    mockSession(multiWorkspaceSession);
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => expect(window.location.pathname).toBe("/workspaces"));
  });

  it("does not instantiate workspace dashboard queries on public or workspace chooser routes", async () => {
    mockSession(null);
    const publicRoute = await renderApp();
    roots.push(publicRoute.root);

    await waitFor(() => expect(api.getSession).toHaveBeenCalled());
    expect(dashboardQueryKeys(publicRoute)).toEqual([]);
    expect(api.getProjects).not.toHaveBeenCalled();
    expect(api.getScans).not.toHaveBeenCalled();
    expect(api.getFindings).not.toHaveBeenCalled();
    expect(api.fetchIssues).not.toHaveBeenCalled();
    expect(api.getReports).not.toHaveBeenCalled();

    await act(async () => publicRoute.root.unmount());
    roots = roots.filter((root) => root !== publicRoute.root);
    document.body.innerHTML = "";
    vi.clearAllMocks();
    setupQueryMocks();
    setPath("/workspaces");
    mockSession(multiWorkspaceSession);
    const workspaceChooser = await renderApp();
    roots.push(workspaceChooser.root);

    await waitFor(() => expect(window.location.pathname).toBe("/workspaces"));
    expect(dashboardQueryKeys(workspaceChooser)).toEqual([]);
    expect(api.getProjects).not.toHaveBeenCalled();
    expect(api.getScans).not.toHaveBeenCalled();
    expect(api.getFindings).not.toHaveBeenCalled();
    expect(api.fetchIssues).not.toHaveBeenCalled();
    expect(api.getReports).not.toHaveBeenCalled();
  });

  it("submits login and redirects to the workspace route", async () => {
    mockSession(null);
    api.login.mockResolvedValue(acmeSession);
    const rendered = await renderApp();
    roots.push(rendered.root);

    await fillInput(rendered.container, "Email", "ada@example.test");
    await fillInput(rendered.container, "Password", "secret");
    await clickButton(rendered.container, "Sign in");

    await waitFor(() => expect(api.login).toHaveBeenCalledWith({ email: "ada@example.test", password: "secret" }));
    await waitFor(() => expect(window.location.pathname).toBe("/w/acme/projects"));
  });

  it("submits signup and redirects to the workspace route", async () => {
    setPath("/signup");
    mockSession(null);
    api.signup.mockResolvedValue(acmeSession);
    const rendered = await renderApp();
    roots.push(rendered.root);

    await fillInput(rendered.container, "Full name", "Ada Lovelace");
    await fillInput(rendered.container, "Email", "ada@example.test");
    await fillInput(rendered.container, "Password", "secret");
    await fillInput(rendered.container, "Workspace name", "Acme");
    await clickButton(rendered.container, "Create account");

    await waitFor(() => expect(api.signup).toHaveBeenCalledWith({
      email: "ada@example.test",
      fullName: "Ada Lovelace",
      password: "secret",
      workspaceName: "Acme"
    }));
    await waitFor(() => expect(window.location.pathname).toBe("/w/acme/projects"));
  });

  it("submits invite acceptance with token and redirects to the workspace route", async () => {
    setPath("/invite/token-123");
    mockSession(null);
    api.acceptInvite.mockResolvedValue(acmeSession);
    const rendered = await renderApp();
    roots.push(rendered.root);

    await fillInput(rendered.container, "Full name", "Ada Lovelace");
    await fillInput(rendered.container, "Email", "ada@example.test");
    await fillInput(rendered.container, "Password", "secret");
    await clickButton(rendered.container, "Accept invite");

    await waitFor(() => expect(api.acceptInvite).toHaveBeenCalledWith("token-123", {
      email: "ada@example.test",
      fullName: "Ada Lovelace",
      password: "secret"
    }));
    await waitFor(() => expect(window.location.pathname).toBe("/w/acme/projects"));
  });

  it("keeps a logged-in user on the invite page instead of redirecting to the dashboard", async () => {
    setPath("/invite/token-123");
    mockSession(acmeSession);
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => {
      const acceptButton = Array.from(rendered.container.querySelectorAll("button")).find((candidate) =>
        candidate.textContent?.includes("Accept invite")
      );
      expect(acceptButton).toBeTruthy();
    });
    expect(window.location.pathname).toBe("/invite/token-123");
  });

  it("signs out from the top bar and returns to login", async () => {
    setPath("/w/acme/projects");
    mockSession(acmeSession);
    api.getProjects.mockResolvedValue([acmeProject]);
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => expect(rendered.container.querySelector(".content")?.textContent).toContain("Projects"));

    let logoutButton: HTMLButtonElement | null = null;
    await waitFor(() => {
      logoutButton = rendered.container.querySelector<HTMLButtonElement>("[aria-label='Sign out']");
      expect(logoutButton).toBeTruthy();
    });

    await act(async () => {
      logoutButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(api.logout).toHaveBeenCalled());
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
  });

  it("does not retain new scan state when switching workspace routes", async () => {
    setPath("/w/acme/new-scan");
    mockSession(multiWorkspaceSession);
    api.getProjects.mockImplementation((workspaceSlug: string) => Promise.resolve(
      workspaceSlug === "beta" ? [betaProject] : [acmeProject]
    ));
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(async () => expect(await inputValue(rendered.container, "Public URL")).toBe(acmeProject.url));

    await routeTo("/w/beta/new-scan");

    await waitFor(async () => expect(await inputValue(rendered.container, "Public URL")).toBe(betaProject.url));
    await clickButton(rendered.container, "Start Scan");

    await waitFor(() => expect(api.createScan).toHaveBeenCalledWith("beta", expect.objectContaining({
      projectId: betaProject.id,
      url: betaProject.url
    })));
    expect(api.createScan).not.toHaveBeenCalledWith("beta", expect.objectContaining({
      projectId: acmeProject.id,
      url: acmeProject.url
    }));
  });

  it("members can start scans but cannot create projects", async () => {
    setPath("/w/acme/projects");
    mockSession(memberSession);
    api.getProjects.mockResolvedValue([acmeProject]);
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => {
      expect(rendered.container.querySelector(".content")?.textContent).toContain("Projects");
    });

    const buttons = Array.from(rendered.container.querySelectorAll("button"));
    expect(buttons.some((button) => /new project/i.test(button.textContent ?? ""))).toBe(false);
    const newScanButton = buttons.find((button) => /new scan/i.test(button.textContent ?? ""));
    expect(newScanButton).toBeTruthy();
    expect(newScanButton?.disabled).toBe(false);

    await routeTo("/w/acme/new-scan");

    await waitFor(() => {
      const projectActionLabel = Array.from(rendered.container.querySelectorAll("label")).find((candidate) =>
        candidate.textContent?.includes("Project action")
      );
      const actionSelect = projectActionLabel?.querySelector("select");
      expect(actionSelect?.value).toBe("existing");
      expect(Array.from(actionSelect?.querySelectorAll("option") ?? []).some((option) => option.value === "new")).toBe(false);
    });

    await clickButton(rendered.container, "Start Scan");

    await waitFor(() => expect(api.createScan).toHaveBeenCalledWith("acme", expect.objectContaining({
      projectId: acmeProject.id,
      url: acmeProject.url
    })));
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it("owners can create a project and start a scan from the new scan page", async () => {
    setPath("/w/acme/new-scan");
    mockSession(acmeSession);
    api.getProjects.mockResolvedValue([acmeProject]);
    api.createProject.mockResolvedValue(newProject);
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(async () => expect(await inputValue(rendered.container, "Public URL")).toBe(acmeProject.url));
    await selectOption(rendered.container, "Project action", "new");
    await fillInput(rendered.container, "Project name", newProject.name);
    await fillInput(rendered.container, "Public URL", newProject.url);
    await clickButton(rendered.container, "Start Scan");

    await waitFor(() => expect(api.createProject).toHaveBeenCalledWith("acme", {
      name: newProject.name,
      url: newProject.url
    }));
    await waitFor(() => expect(api.createScan).toHaveBeenCalledWith("acme", expect.objectContaining({
      projectId: newProject.id,
      url: newProject.url
    })));
    expect(api.createProject.mock.invocationCallOrder[0]).toBeLessThan(api.createScan.mock.invocationCallOrder[0]);
  });

  it("switches workspaces from the top bar and scopes API calls to the selected workspace", async () => {
    setPath("/w/acme/projects");
    mockSession(multiWorkspaceSession);
    api.getProjects.mockImplementation((workspaceSlug: string) => Promise.resolve(
      workspaceSlug === "beta" ? [betaProject] : [acmeProject]
    ));
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => expect(api.getProjects).toHaveBeenCalledWith("acme"));
    expect(dashboardQueryKeys(rendered).some((queryKey) => queryKey[1] === null || queryKey[1] === "")).toBe(false);
    expect(dashboardQueryKeys(rendered)).toContainEqual(["projects", "acme"]);
    await clickButtonContaining(rendered.container, "/acme");
    await clickButtonContaining(rendered.container, "/beta");

    await waitFor(() => expect(window.location.pathname).toBe("/w/beta/projects"));
    await waitFor(() => expect(api.getProjects).toHaveBeenCalledWith("beta"));
    expect(dashboardQueryKeys(rendered)).toContainEqual(["projects", "beta"]);
  });
});
