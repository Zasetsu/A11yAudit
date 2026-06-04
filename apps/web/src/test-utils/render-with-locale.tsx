import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LocaleProvider } from "../i18n/locale-context.js";
import type { Locale } from "../i18n/messages.js";

export interface RenderResult {
  container: HTMLElement;
  root: Root;
  unmount: () => void;
}

// Renders `ui` inside a LocaleProvider forced to `locale` (default "en" so
// existing English-asserting tests keep working). Sets localStorage before
// mount so the provider picks up the requested locale.
export function renderWithLocale(ui: React.ReactNode, locale: Locale = "en"): RenderResult {
  localStorage.setItem("a11yaudit-locale", locale);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<LocaleProvider>{ui}</LocaleProvider>);
  });
  return {
    container,
    root,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    }
  };
}
