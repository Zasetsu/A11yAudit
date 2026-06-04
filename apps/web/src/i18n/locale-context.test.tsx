// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider, useT } from "./locale-context.js";

function mount(ui: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(<LocaleProvider>{ui}</LocaleProvider>); });
  return { container, root };
}

function Probe() {
  const { t, locale, setLocale } = useT();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="label">{t("nav.overview")}</span>
      <button onClick={() => setLocale("en")}>en</button>
    </div>
  );
}

describe("LocaleProvider", () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.lang = ""; });

  it("defaults to Turkish when storage is empty", () => {
    const { container } = mount(<Probe />);
    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe("tr");
    expect(container.querySelector('[data-testid="label"]')?.textContent).toBe("Genel Bakış");
    expect(document.documentElement.lang).toBe("tr");
  });

  it("reads a stored locale", () => {
    localStorage.setItem("a11yaudit-locale", "en");
    const { container } = mount(<Probe />);
    expect(container.querySelector('[data-testid="label"]')?.textContent).toBe("Overview");
  });

  it("falls back to Turkish for an invalid stored value", () => {
    localStorage.setItem("a11yaudit-locale", "de");
    const { container } = mount(<Probe />);
    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe("tr");
  });

  it("setLocale updates output, storage, and <html lang>", () => {
    const { container } = mount(<Probe />);
    act(() => { container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(container.querySelector('[data-testid="label"]')?.textContent).toBe("Overview");
    expect(localStorage.getItem("a11yaudit-locale")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });
});
