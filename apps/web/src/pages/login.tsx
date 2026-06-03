import { FormEvent, useState } from "react";
import { login, type AuthSession } from "../api/client";
import { Button, Field, PageHeader, Panel, TextInput } from "../design/ui";

export function LoginPage({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
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
      setError("Sign in failed. Check your email and password.");
    }
  }

  return (
    <main aria-label="Main content" className="content auth-content">
      <div className="content-inner fadein">
        <PageHeader icon="shield-check" subtitle="Sign in to your workspace." title="Sign in" />
        <Panel title="Account">
          <form className="form-grid" onSubmit={submit}>
            <Field label="Email">
              <TextInput autoComplete="email" name="email" required type="email" />
            </Field>
            <Field label="Password">
              <TextInput autoComplete="current-password" name="password" required type="password" />
            </Field>
            {error ? <div className="error-text">{error}</div> : null}
            <Button type="submit" variant="primary">Sign in</Button>
          </form>
        </Panel>
      </div>
    </main>
  );
}
