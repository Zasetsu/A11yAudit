// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app";
import type { AuthSession } from "../api/client";

const api = vi.hoisted(() => ({
  acceptInvite: vi.fn(),
  createInvite: vi.fn(),
  createProject: vi.fn(),
  createScan: vi.fn(),
  fetchIssues: vi.fn(),
  getFindings: vi.fn(),
  getProjects: vi.fn(),
  getReports: vi.fn(),
  getScans: vi.fn(),
  getSession: vi.fn(),
  listInvitations: vi.fn(),
  listMembers: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  regenerateInvitation: vi.fn(),
  removeMember: vi.fn(),
  revokeInvitation: vi.fn(),
  signup: vi.fn(),
  updateMemberRole: vi.fn()
}));

vi.mock("../api/client", () => api);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const ownerSession: AuthSession = {
  user: { id: "user-1", fullName: "Ada Lovelace", email: "ada@example.test" },
  workspaces: [{ id: "workspace-1", name: "Acme", slug: "acme", role: "owner" }]
};

const memberSession: AuthSession = {
  ...ownerSession,
  workspaces: [{ id: "workspace-1", name: "Acme", slug: "acme", role: "member" }]
};

async function renderApp() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
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
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    }
  }
  throw lastError;
}

describe("members page", () => {
  let roots: Root[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    api.getProjects.mockResolvedValue([]);
    api.getScans.mockResolvedValue([]);
    api.getFindings.mockResolvedValue([]);
    api.fetchIssues.mockResolvedValue([]);
    api.getReports.mockResolvedValue([]);
    api.listMembers.mockResolvedValue([
      { userId: "user-1", fullName: "Ada Lovelace", email: "ada@example.test", role: "owner", joinedAt: "2026-06-02T00:00:00.000Z" }
    ]);
    api.listInvitations.mockResolvedValue([]);
    window.history.replaceState(null, "", "/w/acme/members");
  });

  afterEach(async () => {
    for (const root of roots) {
      await act(async () => root.unmount());
    }
    roots = [];
    document.body.innerHTML = "";
  });

  it("shows the members table for an owner", async () => {
    api.getSession.mockResolvedValue(ownerSession);
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => {
      expect(rendered.container.textContent).toContain("Members");
      expect(rendered.container.textContent).toContain("ada@example.test");
    });
    expect(api.listMembers).toHaveBeenCalledWith("acme");
  });

  it("hides the Members nav entry for a member-role session", async () => {
    api.getSession.mockResolvedValue(memberSession);
    window.history.replaceState(null, "", "/w/acme/projects");
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => expect(window.location.pathname).toBe("/w/acme/projects"));
    const navButtons = Array.from(rendered.container.querySelectorAll(".sidebar button"))
      .map((button) => button.textContent ?? "");
    expect(navButtons.some((label) => label.includes("Members"))).toBe(false);
  });
});
