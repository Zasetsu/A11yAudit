import type { AuthSession } from "../api/client";
import { Button, Icon, PageHeader, Panel } from "../design/ui";

export function WorkspacesPage({
  session,
  onSelectWorkspace
}: {
  session: AuthSession;
  onSelectWorkspace: (slug: string) => void;
}) {
  return (
    <main aria-label="Main content" className="content auth-content">
      <div className="content-inner fadein">
        <PageHeader icon="folder" subtitle="Choose the workspace you want to open." title="Workspaces" />
        <Panel title="Your workspaces">
          <div className="project-list">
            {session.workspaces.map((workspace) => (
              <div className="project-row" key={workspace.id}>
                <div>
                  <div className="project-name">{workspace.name}</div>
                  <div className="mono sub">/{workspace.slug} · {workspace.role}</div>
                </div>
                <Button iconRight="arrow-right" onClick={() => onSelectWorkspace(workspace.slug)} variant="primary">Open</Button>
              </div>
            ))}
            {session.workspaces.length === 0 ? (
              <div className="note"><Icon name="info" size={14} /> No workspaces are available for this account.</div>
            ) : null}
          </div>
        </Panel>
      </div>
    </main>
  );
}
