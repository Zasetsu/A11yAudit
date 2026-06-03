# SaaS Member and Invite Management UI Design

Date: 2026-06-02

## Goal

A11yAudit already has workspace tenancy with backend invite create/revoke/accept (Phase 1) and web auth + workspace routing (Phase 2). What is missing is the operator surface for managing who belongs to a workspace: a page where a workspace owner can see members, change their roles, remove them, invite new members, and manage pending invitations.

This is Phase 3 of the SaaS auth/tenancy effort. It builds on the existing auth, session, CSRF, and workspace-scoped authorization layers and introduces no new database tables.

## Scope

In scope:

- A dedicated, owner-only `Members` page per workspace.
- Member list with role management (promote/demote) and removal.
- Pending invitation list with revoke and link regeneration.
- Invite creation with a one-time copyable invite link.
- New backend read/write endpoints for members and invitation listing/regeneration.

Out of scope (unchanged from the parent design's non-goals):

- Email delivery of invitations (link/token only).
- OAuth, magic link, password reset.
- Project-level access control.
- API tokens, CLI upload.
- Workspace slug editing, billing, quotas.

## Design Decisions

These were resolved during brainstorming and override the parent spec where they differ:

- **Placement**: a dedicated `/w/:workspaceSlug/members` page with its own nav entry, not a Settings sub-section. Matches the existing workspace-aware route pattern.
- **Page visibility**: the entire page is **owner-only**. The `Members` nav entry is shown only when the active workspace role is `owner`; members never see the page. (The parent spec's "members can view" note is intentionally narrowed here.)
- **Member management depth**: full management — owner can change a member's role (`owner`/`member`) and remove members. This expands the parent spec's original "list + role display" read-only intent.
- **Invite link re-access**: the invite token is stored only as a hash and is never reproducible. The plaintext link is shown once at creation. To get a fresh link for a still-pending invite, the owner uses **regenerate**, which revokes the old token and issues a new one.

## Authorization Model

Every endpoint below requires, in order:

1. an active session (`requireAuth`);
2. membership of the workspace slug (`requireWorkspaceMembership`);
3. the `owner` role (`requireWorkspaceOwner`).

This reuses the existing helpers in `routes/workspaces.ts`. No endpoint trusts a path id alone — the workspace scope is always resolved from the authenticated user's membership.

## Backend Endpoints

All under `/api/workspaces/:workspaceSlug`, all owner-only, all returning the `{ data: ... }` envelope.

```
GET    /members                              -> { data: { members: Member[] } }
PATCH  /members/:userId           { role }   -> { data: { member: Member } }
DELETE /members/:userId                      -> { data: { ok: true } }

GET    /invitations                          -> { data: { invitations: Invitation[] } }
POST   /invitations               { email }  -> { data: { invitation, inviteUrl } }   (exists)
DELETE /invitations/:invitationId            -> { data: { ok: true } }                (exists)
POST   /invitations/:invitationId/regenerate -> { data: { invitation, inviteUrl } }
```

Shapes:

```ts
interface Member {
  userId: string;
  fullName: string;
  email: string;
  role: "owner" | "member";
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: "member";
  expiresAt: string;
  createdAt: string;
  status: "pending"; // list returns only pending (unaccepted, unrevoked, unexpired)
}
```

`regenerate` operates on a non-accepted invitation: it issues a fresh `randomBytes(32)` token (stored hashed), resets `expiresAt` (7 days) and clears `revokedAt`, keeps the same invitation id, email, and role, and returns the new `inviteUrl` (`/invite/<token>`) exactly once.

## Server-Side Guards

These are enforced in the route/repository layer, not the UI:

- **At least one owner**: demoting an owner to member, or removing an owner, fails with `409` when the workspace has exactly one owner. Message: `"Workspace must keep at least one owner"`.
- **No self-target**: an owner cannot change their own role or remove themselves (`400`). Another owner must perform the action. This prevents accidental self-lockout and keeps the rule simple.
- **Duplicate invite**: creating an invitation fails with `409` when the email already belongs to a workspace member, or when a pending (unaccepted, unrevoked, unexpired) invitation already exists for that email. The owner uses regenerate to refresh an existing pending invite.
- **Target existence**: a member/invitation that does not belong to this workspace returns `404`.
- Emails are normalized (trim + lowercase) before comparison, matching the existing auth code.

## Repository Functions

Added to `repositories/workspaces.ts` (kept in the existing module; no premature split):

- `listWorkspaceMembers(db, workspaceId): Member[]` — join `workspaceMembers` × `users`.
- `countWorkspaceOwners(db, workspaceId): number` — for the last-owner invariant.
- `updateMemberRole(db, workspaceId, userId, role): Member` — guarded by caller.
- `removeMember(db, workspaceId, userId): void`.
- `listPendingInvitations(db, workspaceId): Invitation[]` — filters revoked/accepted/expired out.
- `regenerateInvitation(db, workspaceId, invitationId): { invitation, token }`.

## Web Layer

- `api/client.ts`: add `listMembers`, `updateMemberRole`, `removeMember`, `listInvitations`, `createInvite`, `revokeInvitation`, `regenerateInvitation`, plus `WorkspaceMember` and `WorkspaceInvitation` types. Reuse the existing `apiFetch` (automatic CSRF header on unsafe methods, `credentials: "include"`) and `{ data }` parsing.
- `pages/members.tsx` (new, owner-only):
  - **Members** table — name, email, role selector, remove button. The current user's own row and the last remaining owner have role/remove controls disabled, mirroring the server guards.
  - **Pending invitations** table — email, expiry, revoke button, regenerate button (regenerate reveals a fresh copyable link).
  - **Invite** form — email input → create → shows the one-time copyable invite link.
- `design/shell.tsx`: add a `Members` nav entry rendered only when the active workspace role is `owner`.
- `app.tsx`: register `/w/:workspaceSlug/members`; redirect non-owners away (defense-in-depth; the server already enforces owner-only).
- `pages/page-props.ts`: ensure `workspaceSlug` and the active `role` reach the page.

The UI guards are convenience only. The server is the trust boundary and re-checks every rule.

## Error Handling

- Client surfaces server `409`/`400`/`404` messages inline near the relevant control (e.g. "Workspace must keep at least one owner" under the role selector).
- Mutations refetch the member/invitation lists on success.
- A one-time invite link that the user navigates away from is gone; the UI states this and offers regenerate.

## Testing

Server (`app.test.ts`, extending existing workspace authorization coverage):

- Owner can list/patch/delete members and list/create/revoke/regenerate invitations.
- A `member` receives `403` on every management endpoint.
- Demoting or removing the last owner returns `409`.
- An owner targeting themselves (role change or removal) returns `400`.
- Creating a duplicate invitation (existing member or existing pending invite) returns `409`.
- Regenerate revokes the previous token (old link no longer accepts) and the new token accepts successfully.
- Cross-workspace access (owner of workspace A acting on workspace B) is rejected.

Web:

- Members page renders member and pending-invite tables for an owner.
- The `Members` nav entry is hidden for a member-role session.
- The invite flow displays a copyable link after creation.
- Role-change and remove controls invoke the corresponding client calls and are disabled for the self row and last owner.

## Files Touched

- `apps/server/src/routes/workspaces.ts` — new member + invitation-list + regenerate handlers.
- `apps/server/src/repositories/workspaces.ts` — new repository functions.
- `apps/server/src/app.test.ts` — regression coverage.
- `apps/web/src/api/client.ts` — client functions and types.
- `apps/web/src/pages/members.tsx` — new page.
- `apps/web/src/design/shell.tsx` — nav entry (owner-gated).
- `apps/web/src/app.tsx` — route + redirect.
- `apps/web/src/pages/page-props.ts` — role/slug props.
- Web test file for the members page.

No schema changes; `workspaceMembers` and `workspaceInvitations` already hold everything required.
