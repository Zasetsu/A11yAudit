import { formatDate } from "../data";
import { Button, PageHeader, Panel, Progress, ScoreRing } from "../design/ui";
import type { Project } from "../data";
import type { PageProps } from "./page-props";

export function ProjectsPage({ projects, project, navigate, onSelectProject }: PageProps & { onSelectProject: (project: Project) => void }) {
  return (
    <div className="content-inner fadein">
      <PageHeader
        actions={<Button icon="plus" onClick={() => navigate({ page: "new-scan" })} variant="primary">Add Public URL</Button>}
        icon="folder"
        subtitle="Public websites configured for local A11yAudit scans."
        title="Projects"
      />
      <div className="project-grid">
        {projects.map((candidate) => (
          <button className={`project-card ${candidate.id === project.id ? "selected" : ""}`} key={candidate.id} onClick={() => onSelectProject(candidate)} type="button">
            <div className="project-card-head">
              <div>
                <h2>{candidate.name}</h2>
                <p className="mono">{candidate.domain}</p>
              </div>
              <ScoreRing score={candidate.score} size={72} />
            </div>
            <div className="project-stats">
              <div><strong className="tnum">{candidate.openFindings}</strong><span>unique issues</span></div>
              <div><strong className="tnum">{candidate.reports}</strong><span>reports</span></div>
              <div><strong>{candidate.viewports}</strong><span>viewports</span></div>
            </div>
            <Progress value={candidate.score} color={candidate.score >= 80 ? "var(--resolved)" : candidate.score >= 70 ? "var(--moderate)" : "var(--serious)"} />
            <div className="project-card-foot">
              <span>Last scan {formatDate(candidate.lastScan)}</span>
              <span>{candidate.status}</span>
            </div>
          </button>
        ))}
      </div>

      <Panel title="Project model" subtitle="The MVP stores project targets locally.">
        <div className="note">Projects are self-hosted records for public HTTP or HTTPS targets. They are not tenant accounts, billing entities, or subscriptions.</div>
      </Panel>
    </div>
  );
}
