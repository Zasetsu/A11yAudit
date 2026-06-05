import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWidgetConfig, updateWidgetConfig } from "../api/client";
import { Button, Field, Icon, PageHeader, Panel, SelectInput, TextInput, Toggle } from "../design/ui";
import { useT } from "../i18n/locale-context.js";
import { isWorkspaceOwner, type PageProps } from "./page-props";
import { DEFAULT_WIDGET_CONFIG, type WidgetConfig } from "@a11yaudit/assist-widget/widget-config";
import { WIDGET_SECTION_GROUPS, featureLabel, positionLabel, sectionLabel } from "./widget-feature-labels.js";
import { WidgetPreview } from "./widget-preview.js";

const POSITIONS: WidgetConfig["position"][] = ["bottom-right", "bottom-left", "top-right", "top-left"];
const THEMES: WidgetConfig["brand"]["theme"][] = ["light", "dark", "auto"];

export function WidgetSettingsPage({ workspaceSlug, workspaceRole, project }: PageProps) {
  const { t, locale } = useT();
  const queryClient = useQueryClient();
  const canEdit = isWorkspaceOwner(workspaceRole);
  const [draft, setDraft] = useState<WidgetConfig>({ ...DEFAULT_WIDGET_CONFIG });
  const [savedMsg, setSavedMsg] = useState(false);
  const [copied, setCopied] = useState(false);

  const query = useQuery({
    queryKey: ["widget-config", workspaceSlug, project.id],
    queryFn: () => getWidgetConfig(workspaceSlug, project.id)
  });

  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => updateWidgetConfig(workspaceSlug, project.id, draft),
    onSuccess: (saved) => {
      setDraft(saved);
      void queryClient.invalidateQueries({ queryKey: ["widget-config", workspaceSlug, project.id] });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2400);
    }
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const embedSnippet = `<script src="${origin}/assist/${project.id}.js" defer></script>`;

  const patch = (next: Partial<WidgetConfig>) => setDraft((prev) => ({ ...prev, ...next }));
  const patchBrand = (next: Partial<WidgetConfig["brand"]>) =>
    setDraft((prev) => ({ ...prev, brand: { ...prev.brand, ...next } }));

  function setSection(id: WidgetConfig["enabledSections"][number], on: boolean) {
    setDraft((prev) => ({
      ...prev,
      enabledSections: on
        ? Array.from(new Set([...prev.enabledSections, id]))
        : prev.enabledSections.filter((s) => s !== id)
    }));
  }

  function toggleFeature(id: string) {
    setDraft((prev) => ({
      ...prev,
      disabledFeatures: prev.disabledFeatures.includes(id)
        ? prev.disabledFeatures.filter((f) => f !== id)
        : [...prev.disabledFeatures, id]
    }));
  }

  function copyEmbed() {
    void navigator.clipboard?.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="content-inner fadein">
      <PageHeader icon="settings" subtitle={t("widget.subtitle")} title={t("widget.title")} />

      {!canEdit ? (
        <div className="note" style={{ marginBottom: 16 }}>
          <Icon name="info" size={14} /> {t("widget.ownerOnly")}
        </div>
      ) : null}

      <div className="wcfg">
        <fieldset className="wcfg-main" disabled={!canEdit}>
          {/* Sections & their features */}
          <Panel subtitle={t("widget.sectionsHint")} title={t("widget.sections")}>
            <div className="wcfg-sections">
              {WIDGET_SECTION_GROUPS.map((group) => {
                const on = draft.enabledSections.includes(group.id);
                return (
                  <div className={`wcfg-section ${on ? "" : "is-off"}`} key={group.id}>
                    <div className="wcfg-section-h">
                      <div>
                        <div className="wcfg-section-name">{sectionLabel(group.id, locale)}</div>
                        <div className="wcfg-section-meta">
                          {group.features.length} {t("widget.features").toLocaleLowerCase(locale)}
                        </div>
                      </div>
                      <Toggle
                        checked={on}
                        disabled={!canEdit}
                        label={sectionLabel(group.id, locale)}
                        onChange={(value) => setSection(group.id, value)}
                      />
                    </div>
                    <div className="wcfg-feats">
                      {group.features.map((id) => {
                        const active = on && !draft.disabledFeatures.includes(id);
                        return (
                          <button
                            aria-pressed={active}
                            className={`feat ${active ? "on" : ""}`}
                            data-aa-feature={id}
                            disabled={!canEdit || !on}
                            key={id}
                            onClick={() => toggleFeature(id)}
                            type="button"
                          >
                            <span className="feat-mark">{active ? <Icon name="check" size={11} strokeWidth={2.6} /> : null}</span>
                            {featureLabel(id, locale)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Appearance & brand */}
          <Panel title={t("widget.appearance")}>
            <div className="split-grid two" style={{ marginBottom: 14 }}>
              <Field label={t("widget.position")}>
                <SelectInput
                  disabled={!canEdit}
                  onChange={(e) => patch({ position: e.target.value as WidgetConfig["position"] })}
                  value={draft.position}
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>{positionLabel(p, locale)}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label={t("widget.language")}>
                <SelectInput
                  disabled={!canEdit}
                  onChange={(e) => patch({ language: e.target.value as WidgetConfig["language"] })}
                  value={draft.language}
                >
                  <option value="tr">Türkçe</option>
                  <option value="en">English</option>
                </SelectInput>
              </Field>
            </div>

            <div className="split-grid two" style={{ marginBottom: 14 }}>
              <Field label={t("widget.theme")}>
                <div className="seg" role="group">
                  {THEMES.map((th) => (
                    <button
                      aria-pressed={draft.brand.theme === th}
                      className={draft.brand.theme === th ? "on" : ""}
                      disabled={!canEdit}
                      key={th}
                      onClick={() => patchBrand({ theme: th })}
                      type="button"
                    >
                      {t(th === "light" ? "widget.themeLight" : th === "dark" ? "widget.themeDark" : "widget.themeAuto")}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t("widget.accent")}>
                <div className="accent-row">
                  <input
                    aria-label={t("widget.accent")}
                    className="accent-swatch"
                    disabled={!canEdit}
                    onChange={(e) => patchBrand({ accent: e.target.value })}
                    type="color"
                    value={draft.brand.accent}
                  />
                  <code className="accent-hex">{draft.brand.accent.toUpperCase()}</code>
                </div>
              </Field>
            </div>

            <Field hint={t("widget.launcherLabelHint")} label={t("widget.launcherLabel")}>
              <TextInput
                disabled={!canEdit}
                maxLength={60}
                onChange={(e) => patchBrand({ launcherLabel: e.target.value || undefined })}
                placeholder={t("widget.launcherLabelPlaceholder")}
                value={draft.brand.launcherLabel ?? ""}
              />
            </Field>
          </Panel>

          {/* Advanced (collapsed) */}
          <details className="wcfg-adv">
            <summary>
              <Icon className="wcfg-adv-chev" name="chevron-down" size={14} /> {t("widget.advanced")}
            </summary>
            <div className="wcfg-adv-b">
              <Field hint={t("widget.launcherIconHint")} label={t("widget.launcherIcon")}>
                <textarea
                  className="input mono-area"
                  disabled={!canEdit}
                  onChange={(e) => patchBrand({ launcherIcon: e.target.value.trim() || "default" })}
                  placeholder="<svg viewBox=&quot;0 0 24 24&quot;>…</svg>"
                  rows={4}
                  value={draft.brand.launcherIcon === "default" ? "" : draft.brand.launcherIcon}
                />
              </Field>
              <Field hint={t("widget.customCssHint")} label={t("widget.customCss")}>
                <textarea
                  className="input mono-area"
                  disabled={!canEdit}
                  onChange={(e) => patch({ customCss: e.target.value })}
                  placeholder=".aa-assist-launcher { border-radius: 12px; }"
                  rows={6}
                  value={draft.customCss}
                />
              </Field>
            </div>
          </details>
        </fieldset>

        {/* Sticky preview + embed */}
        <aside className="wcfg-aside">
          <Panel title={t("widget.preview")}>
            <WidgetPreview config={draft} />
          </Panel>
          <Panel title={t("widget.embed")}>
            <pre className="embed-code">{embedSnippet}</pre>
            <Button icon={copied ? "check" : undefined} onClick={copyEmbed} size="sm" variant="default">
              {copied ? t("widget.embedCopied") : t("widget.embedCopy")}
            </Button>
          </Panel>
        </aside>
      </div>

      {canEdit ? (
        <div className="wcfg-savebar">
          <Button disabled={save.isPending} icon="check" onClick={() => save.mutate()} variant="primary">
            {t("widget.save")}
          </Button>
          {savedMsg ? <span className="wcfg-saved"><Icon name="check" size={13} /> {t("widget.saved")}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
