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
import { useT } from "../i18n/locale-context.js";
import { isWorkspaceOwner, type PageProps } from "./page-props";

function inviteLink(inviteUrl: string): string {
  return `${window.location.origin}${inviteUrl}`;
}

export function MembersPage({ workspaceSlug, workspaceRole }: PageProps) {
  const { t, locale } = useT();
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
        <PageHeader icon="shield-check" subtitle={t("members.workspaceMembership")} title={t("nav.members")} />
        <Panel title={t("members.ownerRequired")}>
          <div className="note"><Icon name="info" size={14} /> {t("members.ownerRequiredBody")}</div>
        </Panel>
      </div>
    );
  }

  const members: WorkspaceMember[] = membersQuery.data ?? [];
  const invitations: WorkspaceInvitation[] = invitationsQuery.data ?? [];

  return (
    <div className="content-inner fadein">
      <PageHeader icon="shield-check" subtitle={t("members.manage")} title={t("nav.members")} />

      {error !== null ? (
        <div className="note"><Icon name="alert-triangle" size={14} /> {error}</div>
      ) : null}

      <Panel title={t("members.invite")}>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            inviteMutation.mutate();
          }}
        >
          <label>
            <span>{t("table.email")}</span>
            <input
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("members.emailPlaceholder")}
              type="email"
              value={email}
            />
          </label>
          <Button icon="plus" type="submit" variant="primary">{t("members.sendInvite")}</Button>
        </form>
        {latestLink !== null ? (
          <div className="note">
            <Icon name="info" size={14} /> {t("members.inviteOnce")}
            <code className="mono"> {latestLink}</code>
            <Button
              icon="arrow-right"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                  void navigator.clipboard.writeText(latestLink);
                }
              }}
              variant="ghost"
            >
              {t("common.copy")}
            </Button>
          </div>
        ) : null}
      </Panel>

      <Panel title={t("nav.members")}>
        <table className="data-table">
          <thead>
            <tr><th>{t("table.name")}</th><th>{t("table.email")}</th><th>{t("table.role")}</th><th>{t("table.actions")}</th></tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.userId}>
                <td>{member.fullName}</td>
                <td className="mono">{member.email}</td>
                <td>
                  <select
                    aria-label={t("members.roleFor")(member.email)}
                    onChange={(event) => roleMutation.mutate({ userId: member.userId, role: event.target.value as "owner" | "member" })}
                    value={member.role}
                  >
                    <option value="owner">{t("members.roleOwner")}</option>
                    <option value="member">{t("members.roleMember")}</option>
                  </select>
                </td>
                <td>
                  <Button
                    icon="alert-octagon"
                    onClick={() => removeMutation.mutate(member.userId)}
                    variant="ghost"
                  >
                    {t("common.remove")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title={t("members.pending")}>
        {invitations.length === 0 ? (
          <div className="note"><Icon name="info" size={14} /> {t("members.pendingEmpty")}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>{t("table.email")}</th><th>{t("table.expires")}</th><th>{t("table.actions")}</th></tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td className="mono">{invitation.email}</td>
                  <td>{new Date(invitation.expiresAt).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB")}</td>
                  <td>
                    <Button icon="arrow-right" onClick={() => regenerateMutation.mutate(invitation.id)} variant="ghost">{t("members.regenerate")}</Button>
                    <Button icon="alert-octagon" onClick={() => revokeMutation.mutate(invitation.id)} variant="ghost">{t("members.revoke")}</Button>
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
