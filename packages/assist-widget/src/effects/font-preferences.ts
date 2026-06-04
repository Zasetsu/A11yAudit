import { ClassManager } from "./class-manager.js";

export type FontStep = 0 | 1 | 2 | 3;

const FONT_CLASSES = ["aa-assist-dyslexia-font", "aa-assist-readable-font"] as const;
const SKIPPED_ELEMENTS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "IFRAME",
  "CANVAS",
  "SVG",
  "MATH",
  "TEXTAREA",
  "OPTION",
  "TITLE"
]);

type BionicRewrite = {
  text: string;
  wrapper: HTMLSpanElement;
};

export class FontPreferences {
  private bionicRewrites: BionicRewrite[] = [];

  constructor(private readonly classManager: ClassManager) {}

  apply(step: FontStep): void {
    this.reset();

    if (step === 1) {
      this.classManager.addBodyClass("aa-assist-dyslexia-font");
      return;
    }

    if (step === 2) {
      this.classManager.addBodyClass("aa-assist-readable-font");
      return;
    }

    if (step === 3) {
      this.applyBionic();
    }
  }

  reset(): void {
    for (const className of FONT_CLASSES) {
      this.classManager.removeBodyClass(className);
    }

    for (const rewrite of this.bionicRewrites) {
      rewrite.wrapper.replaceWith(document.createTextNode(rewrite.text));
    }
    this.bionicRewrites = [];
  }

  private applyBionic(): void {
    const textNodes = this.collectTextNodes();

    for (const textNode of textNodes) {
      const text = textNode.nodeValue ?? "";
      if (!text.trim()) continue;

      const wrapper = document.createElement("span");
      wrapper.className = "aa-assist-bionic-text";
      wrapper.dataset.aaAssistOriginalText = text;
      wrapper.append(this.createBionicFragment(text));
      textNode.replaceWith(wrapper);
      this.bionicRewrites.push({ text, wrapper });
    }
  }

  private collectTextNodes(): Text[] {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent || this.shouldSkipElement(parent)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode()) {
      nodes.push(walker.currentNode as Text);
    }

    return nodes;
  }

  private shouldSkipElement(element: Element): boolean {
    if (element.id === "aa-assist-root" || element.closest("#aa-assist-root")) return true;
    for (let current: Element | null = element; current; current = current.parentElement) {
      if (SKIPPED_ELEMENTS.has(current.tagName.toUpperCase())) return true;
    }
    return false;
  }

  private createBionicFragment(text: string): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const parts = text.split(/(\p{L}[\p{L}\p{N}'-]*|\p{N}+)/gu);

    for (const part of parts) {
      if (!part) continue;

      if (/^(\p{L}[\p{L}\p{N}'-]*|\p{N}+)$/u.test(part)) {
        const strongLength = Math.max(1, Math.ceil(part.length * 0.4));
        const strong = document.createElement("strong");
        strong.className = "aa-assist-bionic-prefix";
        strong.textContent = part.slice(0, strongLength);
        fragment.append(strong, document.createTextNode(part.slice(strongLength)));
      } else {
        fragment.append(document.createTextNode(part));
      }
    }

    return fragment;
  }
}
