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

function fillInput(container: HTMLElement, label: string, value: string) {
  const labelEl = Array.from(container.querySelectorAll("label")).find(
    (l) => (l.textContent?.trim() === label || l.querySelector("span")?.textContent?.trim() === label)
  );
  if (!labelEl) throw new Error(`Label "${label}" not found`);
  // Try for= attribute first, then input inside the label element
  const input = (labelEl.htmlFor
    ? container.querySelector<HTMLInputElement>(`#${labelEl.htmlFor}`)
    : null) ?? labelEl.querySelector<HTMLInputElement>("input");
  if (!input) throw new Error(`Input for label "${label}" not found`);
  // Use the native input value setter so React's synthetic onChange fires correctly
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function clickButton(container: HTMLElement, label: string) {
  const btn = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.includes(label)
  );
  if (!btn) throw new Error(`Button "${label}" not found`);
  btn.click();
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

  it("creates an invite and shows the returned link", async () => {
    api.getSession.mockResolvedValue(ownerSession);
    api.createInvite.mockResolvedValue({
      invitation: { id: "winv-1", email: "new@example.test", role: "member", expiresAt: "2026-06-10T00:00:00.000Z", createdAt: "2026-06-03T00:00:00.000Z" },
      inviteUrl: "/invite/tok-123"
    });
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => expect(rendered.container.textContent).toContain("Invite a member"));
    await act(async () => { fillInput(rendered.container, "Email", "new@example.test"); });
    await act(async () => { clickButton(rendered.container, "Send invite"); });

    await waitFor(() => expect(api.createInvite).toHaveBeenCalledWith("acme", "new@example.test"));
    await waitFor(() => expect(rendered.container.textContent).toContain("/invite/tok-123"));
  });

  it("changes a member role", async () => {
    api.getSession.mockResolvedValue(ownerSession);
    api.listMembers.mockResolvedValue([
      { userId: "user-1", fullName: "Ada Lovelace", email: "ada@example.test", role: "owner", joinedAt: "2026-06-02T00:00:00.000Z" },
      { userId: "user-2", fullName: "Bob", email: "bob@example.test", role: "member", joinedAt: "2026-06-02T00:00:00.000Z" }
    ]);
    api.updateMemberRole.mockResolvedValue({ ok: true });
    const rendered = await renderApp();
    roots.push(rendered.root);

    let select: HTMLSelectElement | null = null;
    await waitFor(() => {
      select = rendered.container.querySelector<HTMLSelectElement>("select[aria-label='Role for bob@example.test']");
      expect(select).toBeTruthy();
    });
    await act(async () => {
      select!.value = "owner";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => expect(api.updateMemberRole).toHaveBeenCalledWith("acme", "user-2", "owner"));
  });

  it("removes a member", async () => {
    api.getSession.mockResolvedValue(ownerSession);
    api.listMembers.mockResolvedValue([
      { userId: "user-1", fullName: "Ada Lovelace", email: "ada@example.test", role: "owner", joinedAt: "2026-06-02T00:00:00.000Z" },
      { userId: "user-2", fullName: "Bob", email: "bob@example.test", role: "member", joinedAt: "2026-06-02T00:00:00.000Z" }
    ]);
    api.removeMember.mockResolvedValue({ ok: true });
    const rendered = await renderApp();
    roots.push(rendered.root);

    let bobRow: HTMLElement | null = null;
    await waitFor(() => {
      bobRow = Array.from(rendered.container.querySelectorAll("tr")).find(
        (tr) => tr.textContent?.includes("bob@example.test")
      ) ?? null;
      expect(bobRow).toBeTruthy();
    });
    await act(async () => { clickButton(bobRow!, "Remove"); });

    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith("acme", "user-2"));
  });

  it("revokes and regenerates a pending invitation", async () => {
    api.getSession.mockResolvedValue(ownerSession);
    api.listInvitations.mockResolvedValue([
      { id: "winv-1", email: "pending@example.test", role: "member", expiresAt: "2026-06-10T00:00:00.000Z", createdAt: "2026-06-03T00:00:00.000Z" }
    ]);
    api.regenerateInvitation.mockResolvedValue({ inviteUrl: "/invite/fresh-456" });
    api.revokeInvitation.mockResolvedValue({ ok: true });
    const rendered = await renderApp();
    roots.push(rendered.root);

    await waitFor(() => expect(rendered.container.textContent).toContain("pending@example.test"));
    await act(async () => { clickButton(rendered.container, "Regenerate link"); });
    await waitFor(() => expect(api.regenerateInvitation).toHaveBeenCalledWith("acme", "winv-1"));
    await waitFor(() => expect(rendered.container.textContent).toContain("/invite/fresh-456"));

    await act(async () => { clickButton(rendered.container, "Revoke"); });
    await waitFor(() => expect(api.revokeInvitation).toHaveBeenCalledWith("acme", "winv-1"));
  });

  it("shows the error banner when a mutation fails", async () => {
    api.getSession.mockResolvedValue(ownerSession);
    api.listMembers.mockResolvedValue([
      { userId: "user-1", fullName: "Ada Lovelace", email: "ada@example.test", role: "owner", joinedAt: "2026-06-02T00:00:00.000Z" },
      { userId: "user-2", fullName: "Bob", email: "bob@example.test", role: "member", joinedAt: "2026-06-02T00:00:00.000Z" }
    ]);
    api.removeMember.mockResolvedValue({ error: "Workspace must keep at least one owner" });
    const rendered = await renderApp();
    roots.push(rendered.root);

    let bobRow2: HTMLElement | null = null;
    await waitFor(() => {
      bobRow2 = Array.from(rendered.container.querySelectorAll("tr")).find(
        (tr) => tr.textContent?.includes("bob@example.test")
      ) ?? null;
      expect(bobRow2).toBeTruthy();
    });
    await act(async () => { clickButton(bobRow2!, "Remove"); });

    await waitFor(() => expect(rendered.container.textContent).toContain("Workspace must keep at least one owner"));
  });
});
