import { FormEvent, useState } from "react";
import { signup, type AuthSession } from "../api/client";
import { Button, Field, PageHeader, Panel, TextInput } from "../design/ui";

export function SignupPage({ onAuthenticated, onLogin }: { onAuthenticated: (session: AuthSession) => void; onLogin: () => void }) {
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
      setError("Account creation failed. Check the details and try again.");
    }
  }

  return (
    <main aria-label="Main content" className="content auth-content">
      <div className="content-inner fadein">
        <PageHeader icon="shield-check" subtitle="Create an account and workspace." title="Create account" />
        <Panel title="Account details">
          <form className="form-grid" onSubmit={submit}>
            <Field label="Full name">
              <TextInput autoComplete="name" name="fullName" required />
            </Field>
            <Field label="Email">
              <TextInput autoComplete="email" name="email" required type="email" />
            </Field>
            <Field label="Password">
              <TextInput autoComplete="new-password" name="password" required type="password" />
            </Field>
            <Field label="Workspace name">
              <TextInput name="workspaceName" required />
            </Field>
            {error ? <div className="error-text">{error}</div> : null}
            <Button type="submit" variant="primary">Create account</Button>
          </form>
        </Panel>
        <div className="note">
          Already have an account?
          <Button onClick={onLogin} type="button" variant="ghost">Sign in</Button>
        </div>
      </div>
    </main>
  );
}
