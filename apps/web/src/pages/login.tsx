import { FormEvent, useState } from "react";
import { login, type AuthSession } from "../api/client";
import { Button, Field, PageHeader, Panel, TextInput } from "../design/ui";
import { useT } from "../i18n/locale-context.js";

export function LoginPage({ onAuthenticated, onSignup }: { onAuthenticated: (session: AuthSession) => void; onSignup: () => void }) {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    try {
      onAuthenticated(await login({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? "")
      }));
    } catch {
      setError(t("auth.signInFailed"));
    }
  }

  return (
    <main aria-label={t("app.mainContent")} className="content auth-content">
      <div className="content-inner fadein">
        <PageHeader icon="shield-check" subtitle={t("auth.signInSubtitle")} title={t("auth.signIn")} />
        <Panel title={t("auth.account")}>
          <form className="form-grid" onSubmit={submit}>
            <Field label={t("auth.email")}>
              <TextInput autoComplete="email" name="email" required type="email" />
            </Field>
            <Field label={t("auth.password")}>
              <TextInput autoComplete="current-password" name="password" required type="password" />
            </Field>
            {error ? <div className="error-text">{error}</div> : null}
            <Button type="submit" variant="primary">{t("auth.signIn")}</Button>
          </form>
        </Panel>
        <div className="note">
          {t("auth.noAccount")}
          <Button onClick={onSignup} type="button" variant="ghost">{t("auth.createAccount")}</Button>
        </div>
      </div>
    </main>
  );
}
