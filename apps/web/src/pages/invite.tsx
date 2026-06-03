import { FormEvent, useState } from "react";
import { acceptInvite, type AuthSession } from "../api/client";
import { Button, Field, PageHeader, Panel, TextInput } from "../design/ui";

export function InvitePage({ token, onAuthenticated }: { token: string; onAuthenticated: (session: AuthSession) => void }) {
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    try {
      onAuthenticated(await acceptInvite(token, {
        fullName: String(formData.get("fullName") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? "")
      }));
    } catch {
      setError("Invite acceptance failed. Check the invite and try again.");
    }
  }

  return (
    <main aria-label="Main content" className="content auth-content">
      <div className="content-inner fadein">
        <PageHeader icon="shield-check" subtitle="Join a workspace with your invitation." title="Accept invite" />
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
            {error ? <div className="error-text">{error}</div> : null}
            <Button type="submit" variant="primary">Accept invite</Button>
          </form>
        </Panel>
      </div>
    </main>
  );
}
