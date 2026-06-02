import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject, createScan } from "../api/client";
import { Button, Field, Icon, PageHeader, Panel, SelectInput, TextInput, Toggle } from "../design/ui";
import type { Project } from "../data";
import type { PageProps } from "./page-props";

type ScanMode = "single_url" | "same_domain_crawl";
type ProjectMode = "existing" | "new";

function defaultProjectMode(projects: Project[]): ProjectMode {
  return projects.length === 0 ? "new" : "existing";
}

function defaultProjectId(project: Project, projects: Project[]): string {
  return projects.some((candidate) => candidate.id === project.id) ? project.id : projects[0]?.id ?? "";
}

export function NewScanPage({ workspaceSlug, project, projects, navigate, onSelectProject }: PageProps & { onSelectProject: (project: Project) => void }) {
  const [projectMode, setProjectMode] = useState<ProjectMode>(() => defaultProjectMode(projects));
  const [projectId, setProjectId] = useState(() => defaultProjectId(project, projects));
  const selected = projects.find((candidate) => candidate.id === projectId) ?? project;
  const [url, setUrl] = useState(selected.url);
  const [projectName, setProjectName] = useState(selected.name);
  const [scanMode, setScanMode] = useState<ScanMode>("single_url");
  const [maxPages, setMaxPages] = useState(10);
  const [maxDepth, setMaxDepth] = useState(1);
  const [desktop, setDesktop] = useState(true);
  const [mobile, setMobile] = useState(true);
  const queryClient = useQueryClient();
  const selectedViewports = [desktop ? "desktop" : null, mobile ? "mobile" : null].filter(Boolean) as Array<"desktop" | "mobile">;
  const projectsFingerprint = useMemo(
    () => projects.map((candidate) => `${candidate.id}:${candidate.name}:${candidate.url}`).join("|"),
    [projects]
  );

  useEffect(() => {
    const nextProjectId = defaultProjectId(project, projects);
    const nextSelected = projects.find((candidate) => candidate.id === nextProjectId) ?? project;

    setProjectMode(defaultProjectMode(projects));
    setProjectId(nextProjectId);
    setUrl(nextSelected.url);
    setProjectName(nextSelected.name);
  }, [project.id, project.name, project.url, projectsFingerprint, workspaceSlug]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (selectedViewports.length === 0) return null;

      const scanProject = projectMode === "new"
        ? await createProject(workspaceSlug, { name: projectName.trim() === "" ? undefined : projectName, url })
        : selected;

      if (scanProject === null || scanProject.id === "") return null;

      const scan = await createScan(workspaceSlug, {
        projectId: scanProject.id,
        url,
        mode: scanMode,
        maxPages,
        maxDepth: scanMode === "single_url" ? 0 : maxDepth,
        viewports: selectedViewports
      });

      return scan === null ? null : { project: scanProject, scan };
    },
    onSuccess: (scan) => {
      if (scan === null) {
        return;
      }

      onSelectProject(scan.project);
      void queryClient.invalidateQueries({ queryKey: ["projects", workspaceSlug] });
      void queryClient.invalidateQueries({ queryKey: ["scans", workspaceSlug] });
      void queryClient.invalidateQueries({ queryKey: ["findings", workspaceSlug] });
      void queryClient.invalidateQueries({ queryKey: ["issues", workspaceSlug] });
      void queryClient.invalidateQueries({ queryKey: ["reports", workspaceSlug] });
      navigate({ page: "scan-runs" });
    }
  });

  return (
    <div className="content-inner fadein">
      <PageHeader
        icon="scan-search"
        subtitle="Create a public website project and run the same scan profile available in the CLI."
        title="New Scan"
      />
      <div className="split-grid score">
        <Panel title="Scan target">
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <Field label="Project action" hint="Use an existing project or create one from this target.">
              <SelectInput
                onChange={(event) => setProjectMode(event.target.value as ProjectMode)}
                value={projectMode}
              >
                <option value="existing" disabled={projects.length === 0}>Use existing project</option>
                <option value="new">Create new project</option>
              </SelectInput>
            </Field>
            {projectMode === "existing" ? (
              <Field label="Project" hint="Projects are local records for public websites.">
                <SelectInput
                  onChange={(event) => {
                    const next = projects.find((candidate) => candidate.id === event.target.value);
                    setProjectId(event.target.value);
                    if (next !== undefined) {
                      setUrl(next.url);
                      setProjectName(next.name);
                    }
                  }}
                  required
                  value={projectId}
                >
                  {projects.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                </SelectInput>
              </Field>
            ) : (
              <Field label="Project name" hint="Optional; defaults to the target hostname.">
                <TextInput onChange={(event) => setProjectName(event.target.value)} placeholder="Municipal portal" value={projectName} />
              </Field>
            )}
            <Field label="Public URL" hint="Authenticated pages, private networks, and local file URLs are blocked.">
              <TextInput className="input mono" onChange={(event) => setUrl(event.target.value)} placeholder="https://example.gov" required type="url" value={url} />
            </Field>
            <Field label="Mode" hint="Single URL matches CLI single-url. Full site follows same-origin links with crawl limits.">
              <SelectInput
                onChange={(event) => setScanMode(event.target.value as ScanMode)}
                value={scanMode}
              >
                <option value="single_url">Single URL</option>
                <option value="same_domain_crawl">Full site same-domain crawl</option>
              </SelectInput>
            </Field>
            {scanMode === "same_domain_crawl" ? (
              <div className="form-row">
                <Field label="Max pages" hint="CLI --max-pages">
                  <TextInput min={1} max={250} onChange={(event) => setMaxPages(Number(event.target.value))} required type="number" value={maxPages} />
                </Field>
                <Field label="Max depth" hint="CLI --max-depth">
                  <TextInput min={0} max={5} onChange={(event) => setMaxDepth(Number(event.target.value))} required type="number" value={maxDepth} />
                </Field>
              </div>
            ) : null}
            <Toggle checked={desktop} label="Desktop viewport" onChange={setDesktop} description="CLI default viewport; can be disabled like --no-desktop." />
            <Toggle checked={mobile} label="Mobile viewport" onChange={setMobile} description="CLI default viewport; can be disabled like --no-mobile." />
            {selectedViewports.length === 0 ? (
              <div className="note"><Icon name="info" size={14} /> Select at least one viewport before starting a scan.</div>
            ) : null}
            {mutation.data === null ? (
              <div className="note"><Icon name="info" size={14} /> The API did not accept the scan request. Check that the server is running and the URL is allowed.</div>
            ) : null}
            <div className="form-actions">
              <Button onClick={() => navigate({ page: "overview" })}>Cancel</Button>
              <Button disabled={mutation.isPending} icon="play" type="submit" variant="primary">{mutation.isPending ? "Starting..." : "Start Scan"}</Button>
            </div>
          </form>
        </Panel>
        <Panel title="Run profile">
          <div className="kv"><span>Scope</span><strong>{scanMode === "same_domain_crawl" ? "Same-domain crawl" : "Single public URL"}</strong></div>
          <div className="kv"><span>Limits</span><strong>{scanMode === "same_domain_crawl" ? `${maxPages} pages / depth ${maxDepth}` : "1 page"}</strong></div>
          <div className="kv"><span>Viewports</span><strong>{selectedViewports.join(" + ") || "None selected"}</strong></div>
          <div className="kv"><span>Authentication</span><strong>Not supported</strong></div>
          <div className="kv"><span>Evidence</span><strong>Screenshot + HTML snippet</strong></div>
          <div className="kv"><span>Reports</span><strong>HTML and PDF artifacts</strong></div>
          <div className="note" style={{ marginTop: 14 }}><Icon name="info" size={14} /> Full site scans obey same-origin safety, crawl limits, and robots.txt.</div>
        </Panel>
      </div>
    </div>
  );
}
