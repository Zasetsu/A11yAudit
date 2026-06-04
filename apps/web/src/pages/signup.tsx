import { FormEvent, useState } from "react";
import { signup, type AuthSession } from "../api/client";
import { Button, Field, PageHeader, Panel, TextInput } from "../design/ui";
import { useT } from "../i18n/locale-context.js";

export function SignupPage({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    try {
      onAuthenticated(await signup({
        fullName: String(formData.get("fullName") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        workspaceName: String(formData.get("workspaceName") ?? "")
      }));
    } catch {
      setError(t("auth.signupFailed"));
    }
  }

  return (
    <main aria-label={t("app.mainContent")} className="content auth-content">
      <div className="content-inner fadein">
        <PageHeader icon="shield-check" subtitle={t("auth.createSubtitle")} title={t("auth.createAccount")} />
        <Panel title={t("auth.accountDetails")}>
          <form className="form-grid" onSubmit={submit}>
            <Field label={t("auth.fullName")}>
              <TextInput autoComplete="name" name="fullName" required />
            </Field>
            <Field label={t("auth.email")}>
              <TextInput autoComplete="email" name="email" required type="email" />
            </Field>
            <Field label={t("auth.password")}>
              <TextInput autoComplete="new-password" name="password" required type="password" />
            </Field>
            <Field label={t("auth.workspaceName")}>
              <TextInput name="workspaceName" required />
            </Field>
            {error ? <div className="error-text">{error}</div> : null}
            <Button type="submit" variant="primary">{t("auth.createAccount")}</Button>
          </form>
        </Panel>
      </div>
    </main>
  );
}
