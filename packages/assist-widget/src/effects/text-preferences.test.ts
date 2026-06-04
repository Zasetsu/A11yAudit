import { afterEach, describe, expect, it } from "vitest";
import { ClassManager } from "./class-manager.js";
import { StyleManager } from "./style-manager.js";
import {
  TEXT_ALIGNMENT_CSS,
  applyLineHeight,
  applyTextAlignment,
  applyTextSize,
  applyTextSpacing
} from "./text-preferences.js";

type TestStyleElement = {
  id: string;
  textContent: string;
  remove: () => void;
};

function createTestClassList() {
  const classes = new Set<string>();
  return {
    add: (className: string) => {
      classes.add(className);
    },
    remove: (className: string) => {
      classes.delete(className);
    },
    contains: (className: string) => classes.has(className)
  };
}

const originalDocument = globalThis.document;

function installTestDocument(): void {
  const elements = new Map<string, TestStyleElement>();

  globalThis.document = {
    createElement: (tagName: string) => {
      if (tagName !== "style") throw new Error(`Unexpected tag ${tagName}`);
      return {
        id: "",
        textContent: "",
        remove() {
          elements.delete(this.id);
        }
      };
    },
    getElementById: (id: string) => elements.get(id) ?? null,
    body: {
      classList: createTestClassList()
    },
    documentElement: {
      classList: createTestClassList()
    },
    head: {
      appendChild: (element: TestStyleElement) => {
        elements.set(element.id, element);
        return element;
      }
    }
  } as unknown as Document;
}

afterEach(() => {
  globalThis.document = originalDocument;
});

describe("text preference effects", () => {
  it("injects line height styles through StyleManager and removes them on clear", () => {
    installTestDocument();
    const manager = new StyleManager();

    applyLineHeight(manager, 2);
    const css = document.getElementById("aa-assist-generated-styles")?.textContent ?? "";
    manager.clear();

    expect(css).toContain("line-height: 1.75");
    expect(css).toContain("#aa-assist-root");
    expect(document.getElementById("aa-assist-generated-styles")).toBeNull();
  });

  it("injects text size and spacing sections with configured step values", () => {
    installTestDocument();
    const manager = new StyleManager();

    applyTextSize(manager, 3);
    applyTextSpacing(manager, 2);
    const css = document.getElementById("aa-assist-generated-styles")?.textContent ?? "";

    expect(css).toContain("font-size: 1.45em");
    expect(css).toContain("letter-spacing: 0.24em");
    expect(css).toContain("word-spacing: 0.32em");
    expect(css).toContain("margin-bottom: 2.5em");
  });

  it("provides alignment CSS that can be owned by StyleManager", () => {
    installTestDocument();
    const manager = new StyleManager();

    manager.setSection("text-alignment", TEXT_ALIGNMENT_CSS);
    const css = document.getElementById("aa-assist-generated-styles")?.textContent ?? "";

    expect(css).toContain("aa-assist-align-center");
    expect(css).toContain("text-align: center");
    expect(css).toContain("#aa-assist-root");
  });

  it("clears existing alignment classes before applying the selected alignment", () => {
    installTestDocument();
    const classManager = new ClassManager();

    applyTextAlignment(classManager, 1);
    applyTextAlignment(classManager, 2);

    expect(document.body.classList.contains("aa-assist-align-start")).toBe(false);
    expect(document.body.classList.contains("aa-assist-align-center")).toBe(true);
    expect(document.body.classList.contains("aa-assist-align-end")).toBe(false);

    applyTextAlignment(classManager, 0);

    expect(document.body.classList.contains("aa-assist-align-center")).toBe(false);
  });
});
