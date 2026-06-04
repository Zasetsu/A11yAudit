import type { AuthSession } from "../api/client";
import { Button, Icon, PageHeader, Panel } from "../design/ui";
import { useT } from "../i18n/locale-context.js";

export function WorkspacesPage({
  session,
  onSelectWorkspace
}: {
  session: AuthSession;
  onSelectWorkspace: (slug: string) => void;
}) {
  const { t } = useT();
  return (
    <main aria-label="Main content" className="content auth-content">
      <div className="content-inner fadein">
        <PageHeader icon="folder" subtitle={t("workspaces.subtitle")} title={t("workspaces.title")} />
        <Panel title={t("workspaces.your")}>
          <div className="project-list">
            {session.workspaces.map((workspace) => (
              <div className="project-row" key={workspace.id}>
                <div>
                  <div className="project-name">{workspace.name}</div>
                  <div className="mono sub">/{workspace.slug} · {workspace.role}</div>
                </div>
                <Button iconRight="arrow-right" onClick={() => onSelectWorkspace(workspace.slug)} variant="primary">{t("common.open")}</Button>
              </div>
            ))}
            {session.workspaces.length === 0 ? (
              <div className="note"><Icon name="info" size={14} /> {t("workspaces.empty")}</div>
            ) : null}
          </div>
        </Panel>
      </div>
    </main>
  );
}
