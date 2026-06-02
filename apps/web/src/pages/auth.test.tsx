// @vitest-environment happy-dom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, parsePath } from "../app";
import type { AuthSession } from "../api/client";

const api = vi.hoisted(() => ({
  acceptInvite: vi.fn(),
  fetchIssues: vi.fn(),
  getFindings: vi.fn(),
  getProjects: vi.fn(),
  getReports: vi.fn(),
  getScans: vi.fn(),
  getSession: vi.fn(),
  login: vi.fn(),
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

function setPath(pathname: string) {
  window.history.replaceState(null, "", pathname);
}

function mockSession(session: AuthSession | null) {
  api.getSession.mockResolvedValue(session);
}

function setupQueryMocks() {
  api.fetchIssues.mockResolvedValue([]);
  api.getFindings.mockResolvedValue([]);
  api.getProjects.mockResolvedValue([]);
  api.getReports.mockResolvedValue([]);
  api.getScans.mockResolvedValue([]);
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
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );
  });

  return { container, root };
}

async function waitFor(assertion: () => void) {
  const timeoutAt = Date.now() + 1_000;
  let lastError: unknown;

  while (Date.now() < timeoutAt) {
    try {
      assertion();
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
    input!.value = value;
    input!.dispatchEvent(new Event("input", { bubbles: true }));
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

describe("auth routes", () => {
  let roots: Root[] = [];

  beforeEach(() => {
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
});
