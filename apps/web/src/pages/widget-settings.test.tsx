// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app";
import { LocaleProvider } from "../i18n/locale-context.js";
import type { AuthSession } from "../api/client";

const MOCK_CONFIG = {
  enabledSections: ["content", "navigation", "color"],
  disabledFeatures: [],
  position: "bottom-right",
  language: "tr",
  brand: { accent: "#2b56b0", theme: "light", launcherIcon: "default" },
  customCss: ""
};

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
  getWidgetConfig: vi.fn(),
  listInvitations: vi.fn(),
  listMembers: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  regenerateInvitation: vi.fn(),
  removeMember: vi.fn(),
  revokeInvitation: vi.fn(),
  signup: vi.fn(),
  updateMemberRole: vi.fn(),
  updateWidgetConfig: vi.fn()
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
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </LocaleProvider>
    );
  });
  return { container, root };
}

async function waitFor(assertion: () => void) {
  const timeoutAt = Date.now() + 2_000;
  let lastError: unknown;
  while (Date.now() < timeoutAt) {
    try {
      assertion();
      return;
    } catch (err) {
      lastError = err;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
    }
  }
  throw lastError;
}

describe("widget-settings page", () => {
  let roots: Root[] = [];

  beforeEach(() => {
    localStorage.setItem("a11yaudit-locale", "en");
    vi.clearAllMocks();
    api.getProjects.mockResolvedValue([{ id: "p1", name: "P", domain: "x.com", score: 0, createdAt: "2026-01-01", lastScan: null, openFindings: 0, reports: 0, status: "active", crawlLimit: 250, viewports: "2", url: "https://x.com" }]);
    api.getScans.mockResolvedValue([]);
    api.getFindings.mockResolvedValue([]);
    api.fetchIssues.mockResolvedValue([]);
    api.getReports.mockResolvedValue([]);
    api.getWidgetConfig.mockResolvedValue(MOCK_CONFIG);
    api.updateWidgetConfig.mockResolvedValue({
      ...MOCK_CONFIG,
      enabledSections: ["content"],
      position: "top-left"
    });
    window.history.replaceState(null, "", "/w/acme/widget-settings");
  });

  afterEach(async () => {
    for (const root of roots) {
      await act(async () => root.unmount());
    }
    roots = [];
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("owner: shows embed snippet and save button calls updateWidgetConfig", async () => {
    api.getSession.mockResolvedValue(ownerSession);
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => {
      expect(rendered.container.textContent).toContain("/assist/p1.js");
    });

    const saveBtn = Array.from(rendered.container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Save")
    );
    expect(saveBtn).toBeTruthy();

    await act(async () => { saveBtn!.click(); });

    await waitFor(() => {
      expect(api.updateWidgetConfig).toHaveBeenCalledWith("acme", "p1", expect.any(Object));
    });
  });

  it("member: shows ownerOnly message", async () => {
    api.getSession.mockResolvedValue(memberSession);
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => {
      expect(rendered.container.textContent).toMatch(/Only the workspace owner|yalnızca workspace sahibi/i);
    });
  });
});
