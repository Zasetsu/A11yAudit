import { Field, Icon, PageHeader, Panel, SelectInput, TextInput, Toggle } from "../design/ui";
import type { PageProps } from "./page-props";

export function SettingsPage({ project }: PageProps) {
  return (
    <div className="content-inner fadein">
      <PageHeader
        icon="settings"
        subtitle="Local instance controls for the self-hosted MVP."
        title="Settings"
      />
      <div className="split-grid two">
        <Panel title="Scan defaults">
          <div className="form-grid">
            <Field label="Default project URL">
              <TextInput className="input mono" readOnly value={project.url} />
            </Field>
            <Field label="Crawl limit">
              <TextInput min={1} type="number" value={project.crawlLimit} readOnly />
            </Field>
            <Field label="Report format">
              <SelectInput disabled value="html-pdf">
                <option value="html-pdf">HTML + PDF</option>
              </SelectInput>
            </Field>
            <Field label="Artifact output">
              <TextInput className="input mono" readOnly value="Local server storage" />
            </Field>
          </div>
        </Panel>
        <Panel title="Evidence retention">
          <Toggle checked disabled label="Store HTML snippets" onChange={() => undefined} description="Keeps selector context for technical review." />
          <Toggle checked disabled label="Store screenshots" onChange={() => undefined} description="Screenshots are attached to finding detail pages when findings exist." />
          <Toggle checked={false} disabled label="Authenticated scan storage" onChange={() => undefined} description="Not supported in the MVP." />
          <div className="note"><Icon name="info" size={14} /> The CLI --out option maps to local CLI storage. The web UI uses the server artifact store and exposes downloads through Reports and Finding evidence.</div>
        </Panel>
      </div>
    </div>
  );
}
