import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject, createScan } from "../api/client";
import { Button, Field, Icon, PageHeader, Panel, SelectInput, TextInput, Toggle } from "../design/ui";
import { useT } from "../i18n/locale-context.js";
import type { Project } from "../data";
import type { PageProps } from "./page-props";

type ScanMode = "single_url" | "same_domain_crawl";
type ProjectMode = "existing" | "new";

function defaultProjectMode(projects: Project[], canCreateProject: boolean): ProjectMode {
  return canCreateProject && projects.length === 0 ? "new" : "existing";
}

function defaultProjectId(project: Project, projects: Project[]): string {
  return projects.some((candidate) => candidate.id === project.id) ? project.id : projects[0]?.id ?? "";
}

export function NewScanPage({ workspaceSlug, workspaceRole, project, projects, navigate, onSelectProject }: PageProps & { onSelectProject: (project: Project) => void }) {
  const { t } = useT();
  const canCreateProject = workspaceRole === "owner";
  const [projectMode, setProjectMode] = useState<ProjectMode>(() => defaultProjectMode(projects, canCreateProject));
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

    setProjectMode(defaultProjectMode(projects, canCreateProject));
    setProjectId(nextProjectId);
    setUrl(nextSelected.url);
    setProjectName(nextSelected.name);
  }, [canCreateProject, project.id, project.name, project.url, projectsFingerprint, workspaceSlug]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (selectedViewports.length === 0) return null;

      if (projectMode === "new" && !canCreateProject) return null;

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
        subtitle={t("scan.subtitle")}
        title={t("common.newScan")}
      />
      <div className="split-grid score">
        <Panel title={t("scan.target")}>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <Field label={t("scan.projectAction")} hint={t("scan.projectActionHint")}>
              <SelectInput
                onChange={(event) => setProjectMode(event.target.value as ProjectMode)}
                value={projectMode}
              >
                <option value="existing" disabled={projects.length === 0}>{t("scan.useExisting")}</option>
                {canCreateProject ? <option value="new">{t("scan.createNew")}</option> : null}
              </SelectInput>
            </Field>
            {projectMode === "existing" ? (
              <Field label={t("scan.project")} hint={t("scan.projectHint")}>
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
              <Field label={t("scan.projectName")} hint={t("scan.projectNameHint")}>
                <TextInput onChange={(event) => setProjectName(event.target.value)} placeholder={t("scan.projectNamePlaceholder")} value={projectName} />
              </Field>
            )}
            <Field label={t("scan.publicUrl")} hint={t("scan.publicUrlHint")}>
              <TextInput className="input mono" onChange={(event) => setUrl(event.target.value)} placeholder="https://example.gov" required type="url" value={url} />
            </Field>
            <Field label={t("scan.mode")} hint={t("scan.modeHint")}>
              <SelectInput
                onChange={(event) => setScanMode(event.target.value as ScanMode)}
                value={scanMode}
              >
                <option value="single_url">{t("scan.singleUrl")}</option>
                <option value="same_domain_crawl">{t("scan.fullSite")}</option>
              </SelectInput>
            </Field>
            {scanMode === "same_domain_crawl" ? (
              <div className="form-row">
                <Field label={t("scan.maxPages")} hint={t("scan.maxPagesHint")}>
                  <TextInput min={1} max={250} onChange={(event) => setMaxPages(Number(event.target.value))} required type="number" value={maxPages} />
                </Field>
                <Field label={t("scan.maxDepth")} hint={t("scan.maxDepthHint")}>
                  <TextInput min={0} max={5} onChange={(event) => setMaxDepth(Number(event.target.value))} required type="number" value={maxDepth} />
                </Field>
              </div>
            ) : null}
            <Toggle checked={desktop} label={t("scan.desktopViewport")} onChange={setDesktop} description={t("scan.desktopViewportHint")} />
            <Toggle checked={mobile} label={t("scan.mobileViewport")} onChange={setMobile} description={t("scan.mobileViewportHint")} />
            {selectedViewports.length === 0 ? (
              <div className="note"><Icon name="info" size={14} /> {t("scan.selectViewport")}</div>
            ) : null}
            {mutation.data === null ? (
              <div className="note"><Icon name="info" size={14} /> {t("scan.apiError")}</div>
            ) : null}
            <div className="form-actions">
              <Button onClick={() => navigate({ page: "overview" })}>{t("common.cancel")}</Button>
              <Button disabled={mutation.isPending} icon="play" type="submit" variant="primary">{mutation.isPending ? t("common.starting") : t("common.startScan")}</Button>
            </div>
          </form>
        </Panel>
        <Panel title={t("scan.runProfile")}>
          <div className="kv"><span>{t("scan.scope")}</span><strong>{scanMode === "same_domain_crawl" ? t("scan.scopeCrawl") : t("scan.scopeSingle")}</strong></div>
          <div className="kv"><span>{t("scan.limits")}</span><strong>{scanMode === "same_domain_crawl" ? t("scan.limitsValue")(maxPages, maxDepth) : t("scan.onePage")}</strong></div>
          <div className="kv"><span>{t("scan.viewports")}</span><strong>{selectedViewports.join(" + ") || t("common.none")}</strong></div>
          <div className="kv"><span>{t("scan.authentication")}</span><strong>{t("scan.authNotSupported")}</strong></div>
          <div className="kv"><span>{t("scan.evidence")}</span><strong>{t("scan.evidenceValue")}</strong></div>
          <div className="kv"><span>{t("scan.reports")}</span><strong>{t("scan.reportsValue")}</strong></div>
          <div className="note" style={{ marginTop: 14 }}><Icon name="info" size={14} /> {t("scan.safetyNote")}</div>
        </Panel>
      </div>
    </div>
  );
}
