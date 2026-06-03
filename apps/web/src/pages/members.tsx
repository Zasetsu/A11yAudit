import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvite,
  listInvitations,
  listMembers,
  regenerateInvitation,
  removeMember,
  revokeInvitation,
  updateMemberRole,
  type WorkspaceInvitation,
  type WorkspaceMember
} from "../api/client";
import { Button, Icon, PageHeader, Panel } from "../design/ui";
import { isWorkspaceOwner, type PageProps } from "./page-props";

function inviteLink(inviteUrl: string): string {
  return `${window.location.origin}${inviteUrl}`;
}

export function MembersPage({ workspaceSlug, workspaceRole }: PageProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [latestLink, setLatestLink] = useState<string | null>(null);

  const canManage = isWorkspaceOwner(workspaceRole);

  const membersQuery = useQuery({
    queryKey: ["members", workspaceSlug],
    queryFn: () => listMembers(workspaceSlug),
    enabled: canManage
  });
  const invitationsQuery = useQuery({
    queryKey: ["invitations", workspaceSlug],
    queryFn: () => listInvitations(workspaceSlug),
    enabled: canManage
  });

  function refreshMembers() {
    void queryClient.invalidateQueries({ queryKey: ["members", workspaceSlug] });
  }

  function refreshInvitations() {
    void queryClient.invalidateQueries({ queryKey: ["invitations", workspaceSlug] });
  }

  const inviteMutation = useMutation({
    mutationFn: () => createInvite(workspaceSlug, email),
    onMutate: () => setError(null),
    onSuccess: (result) => {
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setEmail("");
      setLatestLink(inviteLink(result.inviteUrl));
      refreshInvitations();
    }
  });

  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; role: "owner" | "member" }) =>
      updateMemberRole(workspaceSlug, input.userId, input.role),
    onMutate: () => setError(null),
    onSuccess: (result) => {
      if ("error" in result) {
        setError(result.error);
        return;
      }
      refreshMembers();
    }
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(workspaceSlug, userId),
    onMutate: () => setError(null),
    onSuccess: (result) => {
      if ("error" in result) {
        setError(result.error);
        return;
      }
      refreshMembers();
    }
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(workspaceSlug, invitationId),
    onMutate: () => setError(null),
    onSuccess: (result) => {
      if ("error" in result) {
        setError(result.error);
        return;
      }
      refreshInvitations();
    }
  });

  const regenerateMutation = useMutation({
    mutationFn: (invitationId: string) => regenerateInvitation(workspaceSlug, invitationId),
    onMutate: () => setError(null),
    onSuccess: (result) => {
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setLatestLink(inviteLink(result.inviteUrl));
      refreshInvitations();
    }
  });

  if (!canManage) {
    return (
      <div className="content-inner fadein">
        <PageHeader icon="shield-check" subtitle="Workspace membership" title="Members" />
        <Panel title="Owner access required">
          <div className="note"><Icon name="info" size={14} /> Only workspace owners can manage members and invitations.</div>
        </Panel>
      </div>
    );
  }

  const members: WorkspaceMember[] = membersQuery.data ?? [];
  const invitations: WorkspaceInvitation[] = invitationsQuery.data ?? [];

  return (
    <div className="content-inner fadein">
      <PageHeader icon="shield-check" subtitle="Manage who can access this workspace" title="Members" />

      {error !== null ? (
        <div className="note"><Icon name="alert-triangle" size={14} /> {error}</div>
      ) : null}

      <Panel title="Invite a member">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            inviteMutation.mutate();
          }}
        >
          <label>
            <span>Email</span>
            <input
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              type="email"
              value={email}
            />
          </label>
          <Button icon="plus" type="submit" variant="primary">Send invite</Button>
        </form>
        {latestLink !== null ? (
          <div className="note">
            <Icon name="info" size={14} /> Invite link (copy now, it is shown once):
            <code className="mono"> {latestLink}</code>
          </div>
        ) : null}
      </Panel>

      <Panel title="Members">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.userId}>
                <td>{member.fullName}</td>
                <td className="mono">{member.email}</td>
                <td>
                  <select
                    aria-label={`Role for ${member.email}`}
                    onChange={(event) => roleMutation.mutate({ userId: member.userId, role: event.target.value as "owner" | "member" })}
                    value={member.role}
                  >
                    <option value="owner">owner</option>
                    <option value="member">member</option>
                  </select>
                </td>
                <td>
                  <Button
                    icon="alert-octagon"
                    onClick={() => removeMutation.mutate(member.userId)}
                    variant="ghost"
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Pending invitations">
        {invitations.length === 0 ? (
          <div className="note"><Icon name="info" size={14} /> No pending invitations.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Email</th><th>Expires</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td className="mono">{invitation.email}</td>
                  <td>{new Date(invitation.expiresAt).toLocaleDateString()}</td>
                  <td>
                    <Button icon="arrow-right" onClick={() => regenerateMutation.mutate(invitation.id)} variant="ghost">Regenerate link</Button>
                    <Button icon="alert-octagon" onClick={() => revokeMutation.mutate(invitation.id)} variant="ghost">Revoke</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
