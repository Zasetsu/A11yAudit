// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { mountAssistWidget } from "./widget.js";

afterEach(() => {
  document.getElementById("aa-assist-root")?.remove();
  document.getElementById("aa-assist-page-effect-styles")?.remove();
});

it("applies accent, custom css, launcher label and hides disabled features", () => {
  const instance = mountAssistWidget({
    config: {
      enabledSections: ["content"],
      disabledFeatures: ["magnifier"],
      position: "bottom-right",
      language: "tr",
      brand: { accent: "#123456", theme: "light", launcherLabel: "Erişilebilirlik", launcherIcon: "default" },
      customCss: ".aa-custom-probe{color:rgb(1,2,3)}"
    }
  });
  const root = document.getElementById("aa-assist-root")!;
  const shadow = root.shadowRoot!;
  expect((shadow.host as HTMLElement).style.getPropertyValue("--aa-acc")).toBe("#123456");
  expect(shadow.querySelector("style[data-aa-custom]")?.textContent).toContain("aa-custom-probe");
  expect(shadow.querySelector(".aa-assist-launcher")?.getAttribute("aria-label")).toBe("Erişilebilirlik");
  expect(shadow.querySelector('[data-aa-feature="magnifier"]')).toBeNull();
  instance.unmount();
});

it("applies dark theme via a data-theme attribute on the host", () => {
  const instance = mountAssistWidget({
    config: { enabledSections: ["content"], disabledFeatures: [], position: "bottom-right", language: "tr", brand: { accent: "#2b56b0", theme: "dark", launcherIcon: "default" }, customCss: "" }
  });
  const root = document.getElementById("aa-assist-root")!;
  expect(root.getAttribute("data-theme")).toBe("dark");
  instance.unmount();
});
