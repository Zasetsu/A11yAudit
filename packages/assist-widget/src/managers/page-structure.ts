export type PageStructureItem = {
  id: string;
  text: string;
  element: Element;
  level?: number;
  href?: string;
  role?: string;
};

export type PageStructure = {
  headings: PageStructureItem[];
  links: PageStructureItem[];
  landmarks: PageStructureItem[];
};

const HIGHLIGHT_ATTRIBUTE = "data-aa-assist-structure-highlight";
const GENERATED_ID_ATTRIBUTE = "data-aa-assist-structure-generated-id";
const LANDMARK_SELECTOR = [
  "main",
  "nav",
  "footer",
  "header",
  "aside",
  "search",
  "section",
  "form",
  "[role='main']",
  "[role='navigation']",
  "[role='contentinfo']",
  "[role='banner']",
  "[role='complementary']",
  "[role='search']",
  "[role='form']",
  "[role='region']"
].join(", ");

type FocusState = {
  hadTabindex: boolean;
  tabindex: string | null;
  outline: string;
  outlineOffset: string;
};

type CollectionOwner = {
  itemTargets: Map<string, Element>;
};

export function collectPageStructure(): PageStructure {
  return collectStructure();
}

export class PageStructureManager {
  private readonly generatedIds = new Set<string>();
  private readonly itemTargets = new Map<string, Element>();
  private readonly focusStates = new Map<HTMLElement, FocusState>();
  private highlightedElement: HTMLElement | null = null;

  collect(): PageStructure {
    this.itemTargets.clear();
    return collectStructure({
      itemTargets: this.itemTargets
    });
  }

  jumpTo(id: string): void {
    const target = document.getElementById(id) ?? this.itemTargets.get(id);
    if (!(target instanceof HTMLElement) || shouldIgnore(target)) return;

    this.clearHighlight();
    this.ensureTargetId(target, id);
    if (!this.focusStates.has(target)) {
      this.focusStates.set(target, {
        hadTabindex: target.hasAttribute("tabindex"),
        tabindex: target.getAttribute("tabindex"),
        outline: target.style.outline,
        outlineOffset: target.style.outlineOffset
      });
    }

    target.setAttribute("tabindex", "-1");
    target.setAttribute(HIGHLIGHT_ATTRIBUTE, "true");
    target.style.outline = "3px solid #2563eb";
    target.style.outlineOffset = "3px";
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    target.focus({ preventScroll: true });
    this.highlightedElement = target;
  }

  reset(): void {
    this.clearHighlight();

    for (const [element, state] of this.focusStates) {
      if (state.hadTabindex && state.tabindex !== null) {
        element.setAttribute("tabindex", state.tabindex);
      } else {
        element.removeAttribute("tabindex");
      }
      element.style.outline = state.outline;
      element.style.outlineOffset = state.outlineOffset;
    }
    this.focusStates.clear();

    for (const id of this.generatedIds) {
      const element = document.getElementById(id);
      if (element?.getAttribute(GENERATED_ID_ATTRIBUTE) === "true") {
        element.removeAttribute("id");
        element.removeAttribute(GENERATED_ID_ATTRIBUTE);
      }
    }
    this.generatedIds.clear();
    this.itemTargets.clear();
  }

  private clearHighlight(): void {
    if (!this.highlightedElement) return;

    const state = this.focusStates.get(this.highlightedElement);
    this.highlightedElement.removeAttribute(HIGHLIGHT_ATTRIBUTE);
    if (state) {
      this.highlightedElement.style.outline = state.outline;
      this.highlightedElement.style.outlineOffset = state.outlineOffset;
    }
    this.highlightedElement = null;
  }

  private ensureTargetId(target: HTMLElement, id: string): void {
    if (target.id) return;

    target.id = id;
    target.setAttribute(GENERATED_ID_ATTRIBUTE, "true");
    this.generatedIds.add(id);
  }
}

function collectStructure(owner?: CollectionOwner): PageStructure {
  const headings = Array.from(document.querySelectorAll<HTMLHeadingElement>("h1, h2, h3, h4, h5, h6"))
    .filter((element) => !shouldIgnore(element))
    .map((element) => ({
      id: getItemId(element, owner),
      text: normalizeText(element.textContent),
      element,
      level: Number(element.tagName.slice(1))
    }))
    .filter((item) => item.text);

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .filter((element) => !shouldIgnore(element))
    .map((element) => ({
      id: getItemId(element, owner),
      text: normalizeText(element.textContent) || element.getAttribute("href") || "",
      href: element.getAttribute("href") || "",
      element
    }))
    .filter((item) => item.text && item.href);

  const landmarks = Array.from(document.querySelectorAll<HTMLElement>(LANDMARK_SELECTOR))
    .filter((element) => !shouldIgnore(element))
    .filter(isLandmark)
    .map((element) => ({
      id: getItemId(element, owner),
      text: getLandmarkText(element),
      role: getLandmarkRole(element),
      element
    }))
    .filter((item) => item.text);

  return { headings, links, landmarks };
}

function getItemId(element: Element, owner?: CollectionOwner): string {
  if (element.id) return element.id;

  const id = `aa-assist-structure-item-${createId()}`;
  owner?.itemTargets.set(id, element);
  return id;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getLandmarkRole(element: HTMLElement): string {
  const role = element.getAttribute("role");
  if (role) return role;

  switch (element.tagName.toLowerCase()) {
    case "main":
      return "main";
    case "nav":
      return "navigation";
    case "footer":
      return "contentinfo";
    case "header":
      return "banner";
    case "aside":
      return "complementary";
    case "search":
      return "search";
    case "form":
      return "form";
    case "section":
      return "region";
    default:
      return "region";
  }
}

function isLandmark(element: HTMLElement): boolean {
  const role = element.getAttribute("role");
  if (role === "form" || role === "region") return hasAccessibleLabel(element);
  if (role) return true;

  switch (element.tagName.toLowerCase()) {
    case "section":
      return hasSectionLabel(element);
    case "form":
      return hasAccessibleLabel(element);
    default:
      return true;
  }
}

function getLandmarkText(element: HTMLElement): string {
  const label = getAccessibleLabel(element);
  if (element.tagName.toLowerCase() === "form" && label) return label;

  return getElementText(element) || label || getLandmarkRole(element);
}

function hasSectionLabel(element: HTMLElement): boolean {
  return hasAccessibleLabel(element) || Boolean(element.querySelector("h1, h2, h3, h4, h5, h6"));
}

function hasAccessibleLabel(element: HTMLElement): boolean {
  return Boolean(getAccessibleLabel(element));
}

function getAccessibleLabel(element: HTMLElement): string {
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = element.getAttribute("aria-labelledby");
  if (!labelledBy) return "";

  return labelledBy
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");
}

function normalizeText(text: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function getElementText(element: Element): string {
  const parts = Array.from(element.childNodes)
    .map((node) => normalizeText(node.textContent))
    .filter(Boolean);

  return parts.join(" ").trim();
}

function shouldIgnore(element: Element): boolean {
  return element.id === "aa-assist-root" || Boolean(element.closest("#aa-assist-root"));
}
