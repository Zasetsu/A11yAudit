import { Field, Icon, PageHeader, Panel, SelectInput, TextInput, Toggle } from "../design/ui";
import { useT } from "../i18n/locale-context.js";
import type { PageProps } from "./page-props";

export function SettingsPage({ project }: PageProps) {
  const { t } = useT();
  return (
    <div className="content-inner fadein">
      <PageHeader
        icon="settings"
        subtitle={t("settings.subtitle")}
        title={t("nav.settings")}
      />
      <div className="split-grid two">
        <Panel title={t("settings.scanDefaults")}>
          <div className="form-grid">
            <Field label={t("settings.defaultUrl")}>
              <TextInput className="input mono" readOnly value={project.url} />
            </Field>
            <Field label={t("settings.crawlLimit")}>
              <TextInput min={1} type="number" value={project.crawlLimit} readOnly />
            </Field>
            <Field label={t("settings.reportFormat")}>
              <SelectInput disabled value="html-pdf">
                <option value="html-pdf">{t("settings.reportFormatValue")}</option>
              </SelectInput>
            </Field>
            <Field label={t("settings.artifactOutput")}>
              <TextInput className="input mono" readOnly value={t("settings.artifactOutputValue")} />
            </Field>
          </div>
        </Panel>
        <Panel title={t("settings.evidenceRetention")}>
          <Toggle checked disabled label={t("settings.storeSnippets")} onChange={() => undefined} description={t("settings.storeSnippetsHint")} />
          <Toggle checked disabled label={t("settings.storeScreenshots")} onChange={() => undefined} description={t("settings.storeScreenshotsHint")} />
          <Toggle checked={false} disabled label={t("settings.authStorage")} onChange={() => undefined} description={t("settings.authStorageHint")} />
          <div className="note"><Icon name="info" size={14} /> {t("settings.storageNote")}</div>
        </Panel>
      </div>
    </div>
  );
}
