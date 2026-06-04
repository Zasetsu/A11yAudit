import { formatDate } from "../data";
import { Button, PageHeader, Panel, Progress, ScoreRing } from "../design/ui";
import { useT } from "../i18n/locale-context.js";
import type { Project } from "../data";
import type { PageProps } from "./page-props";

export function ProjectsPage({ workspaceRole, projects, project, navigate, onSelectProject }: PageProps & { onSelectProject: (project: Project) => void }) {
  const { t, locale } = useT();
  return (
    <div className="content-inner fadein">
      <PageHeader
        actions={workspaceRole === "owner" ? <Button icon="plus" onClick={() => navigate({ page: "new-scan" })} variant="primary">{t("projects.newProject")}</Button> : undefined}
        icon="folder"
        subtitle={t("projects.subtitle")}
        title={t("nav.projects")}
      />
      <div className="project-grid">
        {projects.map((candidate) => (
          <button className={`project-card ${candidate.id === project.id ? "selected" : ""}`} key={candidate.id} onClick={() => { onSelectProject(candidate); navigate({ page: "overview" }); }} type="button">
            <div className="project-card-head">
              <div>
                <h2>{candidate.name}</h2>
                <p className="mono">{candidate.domain}</p>
              </div>
              <ScoreRing score={candidate.score} size={72} />
            </div>
            <div className="project-stats">
              <div><strong className="tnum">{candidate.openFindings}</strong><span>{t("projects.uniqueIssues")}</span></div>
              <div><strong className="tnum">{candidate.reports}</strong><span>{t("projects.reports")}</span></div>
              <div><strong>{candidate.viewports}</strong><span>{t("projects.viewports")}</span></div>
            </div>
            <Progress value={candidate.score} color={candidate.score >= 80 ? "var(--resolved)" : candidate.score >= 70 ? "var(--moderate)" : "var(--serious)"} />
            <div className="project-card-foot">
              <span>{t("projects.lastScan")}{formatDate(candidate.lastScan, locale, t("common.notAvailable"))}</span>
              <span>{candidate.status}</span>
            </div>
          </button>
        ))}
      </div>

      <Panel title={t("projects.modelTitle")} subtitle={t("projects.modelSub")}>
        <div className="note">{t("projects.modelBody")}</div>
      </Panel>
    </div>
  );
}
