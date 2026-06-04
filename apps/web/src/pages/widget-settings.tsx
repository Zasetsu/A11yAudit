import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWidgetConfig, updateWidgetConfig } from "../api/client";
import { Button, Icon, PageHeader, Panel } from "../design/ui";
import { useT } from "../i18n/locale-context.js";
import { isWorkspaceOwner, type PageProps } from "./page-props";
import {
  DEFAULT_WIDGET_CONFIG,
  ASSIST_SECTIONS,
  CONTENT_FEATURES,
  NAVIGATION_FEATURES,
  COLOR_FEATURES,
  type WidgetConfig
} from "@a11yaudit/assist-widget/widget-config";
import { WidgetPreview } from "./widget-preview.js";

export function WidgetSettingsPage({ workspaceSlug, workspaceRole, project }: PageProps) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const canEdit = isWorkspaceOwner(workspaceRole);
  const [draft, setDraft] = useState<WidgetConfig>({ ...DEFAULT_WIDGET_CONFIG });
  const [savedMsg, setSavedMsg] = useState(false);

  const query = useQuery({
    queryKey: ["widget-config", workspaceSlug, project.id],
    queryFn: () => getWidgetConfig(workspaceSlug, project.id)
  });

  useEffect(() => {
    if (query.data) {
      setDraft(query.data);
    }
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => updateWidgetConfig(workspaceSlug, project.id, draft),
    onSuccess: (saved) => {
      setDraft(saved);
      void queryClient.invalidateQueries({ queryKey: ["widget-config", workspaceSlug, project.id] });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    }
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const embedSnippet = `<script src="${origin}/assist/${project.id}.js" defer></script>`;

  function toggleSection(id: string) {
    setDraft((prev) => {
      const has = prev.enabledSections.includes(id as never);
      return {
        ...prev,
        enabledSections: has
          ? prev.enabledSections.filter((s) => s !== id)
          : [...prev.enabledSections, id as never]
      };
    });
  }

  function toggleFeature(id: string) {
    setDraft((prev) => {
      const disabled = prev.disabledFeatures.includes(id);
      return {
        ...prev,
        disabledFeatures: disabled
          ? prev.disabledFeatures.filter((f) => f !== id)
          : [...prev.disabledFeatures, id]
      };
    });
  }

  return (
    <div className="content-inner fadein">
      <PageHeader
        icon="settings"
        subtitle={t("widget.subtitle")}
        title={t("widget.title")}
      />

      {!canEdit ? (
        <Panel title={t("widget.ownerOnly")}>
          <div className="note">
            <Icon name="info" size={14} /> {t("widget.ownerOnly")}
          </div>
        </Panel>
      ) : null}

      <Panel title={t("widget.title")}>
        <fieldset disabled={!canEdit} style={{ border: "none", padding: 0, margin: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600 }}>{t("widget.sections")}</label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
              {ASSIST_SECTIONS.map((id) => (
                <label key={id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    checked={draft.enabledSections.includes(id)}
                    disabled={!canEdit}
                    onChange={() => toggleSection(id)}
                    type="checkbox"
                  />
                  {id}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600 }}>{t("widget.features")}</label>
            <div style={{ marginTop: 6 }}>
              {[...CONTENT_FEATURES, ...NAVIGATION_FEATURES, ...COLOR_FEATURES].map((id) => (
                <label key={id} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 10, marginBottom: 4 }}>
                  <input
                    checked={!draft.disabledFeatures.includes(id)}
                    disabled={!canEdit}
                    onChange={() => toggleFeature(id)}
                    type="checkbox"
                  />
                  {id}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 16 }}>
            <label>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>{t("widget.position")}</span>
              <select
                disabled={!canEdit}
                onChange={(e) => setDraft((prev) => ({ ...prev, position: e.target.value as WidgetConfig["position"] }))}
                value={draft.position}
              >
                <option value="bottom-right">bottom-right</option>
                <option value="bottom-left">bottom-left</option>
                <option value="top-right">top-right</option>
                <option value="top-left">top-left</option>
              </select>
            </label>

            <label>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>{t("widget.language")}</span>
              <select
                disabled={!canEdit}
                onChange={(e) => setDraft((prev) => ({ ...prev, language: e.target.value as WidgetConfig["language"] }))}
                value={draft.language}
              >
                <option value="tr">tr</option>
                <option value="en">en</option>
              </select>
            </label>

            <label>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>{t("widget.theme")}</span>
              <select
                disabled={!canEdit}
                onChange={(e) => setDraft((prev) => ({ ...prev, brand: { ...prev.brand, theme: e.target.value as WidgetConfig["brand"]["theme"] } }))}
                value={draft.brand.theme}
              >
                <option value="light">{t("widget.themeLight")}</option>
                <option value="dark">{t("widget.themeDark")}</option>
                <option value="auto">{t("widget.themeAuto")}</option>
              </select>
            </label>

            <label>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>{t("widget.accent")}</span>
              <input
                disabled={!canEdit}
                onChange={(e) => setDraft((prev) => ({ ...prev, brand: { ...prev.brand, accent: e.target.value } }))}
                type="color"
                value={draft.brand.accent}
              />
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>{t("widget.launcherLabel")}</span>
              <input
                disabled={!canEdit}
                onChange={(e) => setDraft((prev) => ({ ...prev, brand: { ...prev.brand, launcherLabel: e.target.value || undefined } }))}
                type="text"
                value={draft.brand.launcherLabel ?? ""}
              />
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>{t("widget.launcherIcon")}</span>
              <textarea
                disabled={!canEdit}
                onChange={(e) => setDraft((prev) => ({ ...prev, brand: { ...prev.brand, launcherIcon: e.target.value.trim() || "default" } }))}
                rows={4}
                style={{ width: "100%", fontFamily: "monospace" }}
                value={draft.brand.launcherIcon === "default" ? "" : draft.brand.launcherIcon}
              />
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>{t("widget.customCss")}</span>
              <textarea
                disabled={!canEdit}
                onChange={(e) => setDraft((prev) => ({ ...prev, customCss: e.target.value }))}
                rows={6}
                style={{ width: "100%", fontFamily: "monospace" }}
                value={draft.customCss}
              />
            </label>
          </div>
        </fieldset>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <Button
            disabled={!canEdit || save.isPending}
            onClick={() => save.mutate()}
            variant="primary"
          >
            {t("widget.save")}
          </Button>
          {savedMsg ? <span>{t("widget.saved")}</span> : null}
        </div>
      </Panel>

      <Panel title={t("widget.embed")}>
        <p style={{ marginBottom: 8 }}>{t("widget.embed")}</p>
        <code style={{ display: "block", background: "var(--surface2, #f4f4f5)", padding: "10px 14px", borderRadius: 6, fontFamily: "monospace", fontSize: 13, marginBottom: 10, wordBreak: "break-all" }}>
          {embedSnippet}
        </code>
        <Button
          onClick={() => {
            void navigator.clipboard.writeText(embedSnippet);
          }}
          variant="default"
        >
          {t("widget.embedCopy")}
        </Button>
      </Panel>

      <Panel title={t("widget.preview")}>
        <WidgetPreview config={draft} />
      </Panel>
    </div>
  );
}
