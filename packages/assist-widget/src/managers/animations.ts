const ORIGINAL_STYLE_ATTRIBUTE = "data-aa-assist-original-style";
const ORIGINAL_ANIMATION_ATTRIBUTE = "data-aa-assist-original-animation";
const ORIGINAL_ANIMATION_PRIORITY_ATTRIBUTE = "data-aa-assist-original-animation-priority";
const ORIGINAL_TRANSITION_ATTRIBUTE = "data-aa-assist-original-transition";
const ORIGINAL_TRANSITION_PRIORITY_ATTRIBUTE = "data-aa-assist-original-transition-priority";
const ORIGINAL_TRANSFORM_ATTRIBUTE = "data-aa-assist-original-transform";
const ORIGINAL_TRANSFORM_PRIORITY_ATTRIBUTE = "data-aa-assist-original-transform-priority";
const DISABLED_CLASS = "aa-assist-animation-stopped";
const STYLE_ID = "aa-assist-stop-animation-styles";
const STOP_ANIMATION_CSS = `
.${DISABLED_CLASS} {
  animation: none !important;
  transition: none !important;
  transform: none !important;
}
`;
const MANAGED_PROPERTIES = [
  { property: "animation", attribute: ORIGINAL_ANIMATION_ATTRIBUTE, priorityAttribute: ORIGINAL_ANIMATION_PRIORITY_ATTRIBUTE },
  {
    property: "transition",
    attribute: ORIGINAL_TRANSITION_ATTRIBUTE,
    priorityAttribute: ORIGINAL_TRANSITION_PRIORITY_ATTRIBUTE
  },
  { property: "transform", attribute: ORIGINAL_TRANSFORM_ATTRIBUTE, priorityAttribute: ORIGINAL_TRANSFORM_PRIORITY_ATTRIBUTE }
] as const;

export class StopAnimationsManager {
  private observer: MutationObserver | null = null;
  private enabled = false;

  enable(): void {
    if (this.enabled) return;

    this.enabled = true;
    this.ensureStopAnimationStyles();
    this.disableAnimationsIn(document.body);

    if (typeof MutationObserver === "undefined") return;

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node instanceof Element) this.disableAnimationsIn(node);
          }
        }

        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          this.captureHostStyleChange(mutation.target);
        }
      }
    });
    this.observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style"],
      childList: true,
      subtree: true
    });
  }

  disable(): void {
    this.reset();
  }

  reset(): void {
    this.enabled = false;
    this.observer?.disconnect();
    this.observer = null;

    for (const element of Array.from(document.querySelectorAll<HTMLElement>(`[${ORIGINAL_STYLE_ATTRIBUTE}]`))) {
      if (this.shouldIgnore(element)) continue;

      for (const { property, attribute, priorityAttribute } of MANAGED_PROPERTIES) {
        if (!this.isWidgetManagedValue(element, property)) {
          this.captureProperty(element, property, attribute, priorityAttribute);
        }

        const originalValue = element.getAttribute(attribute) ?? "";
        const originalPriority = element.getAttribute(priorityAttribute) ?? "";
        if (originalValue) {
          element.style.setProperty(property, originalValue, originalPriority);
        } else {
          element.style.removeProperty(property);
        }
        element.removeAttribute(attribute);
        element.removeAttribute(priorityAttribute);
      }

      element.removeAttribute(ORIGINAL_STYLE_ATTRIBUTE);
      element.classList.remove(DISABLED_CLASS);
    }
    this.removeStopAnimationStyles();
  }

  private disableAnimationsIn(root: Element): void {
    this.disableElement(root);
    for (const element of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
      this.disableElement(element);
    }
  }

  private disableElement(element: Element): void {
    if (!(element instanceof HTMLElement) || this.shouldIgnore(element)) return;

    if (!element.hasAttribute(ORIGINAL_STYLE_ATTRIBUTE)) {
      element.setAttribute(ORIGINAL_STYLE_ATTRIBUTE, "true");
      for (const { property, attribute, priorityAttribute } of MANAGED_PROPERTIES) {
        this.captureProperty(element, property, attribute, priorityAttribute);
      }
    }

    element.classList.add(DISABLED_CLASS);
    this.forceInlineImportantValues(element);
  }

  private captureHostStyleChange(element: Element): void {
    if (!(element instanceof HTMLElement) || this.shouldIgnore(element) || !element.hasAttribute(ORIGINAL_STYLE_ATTRIBUTE)) {
      return;
    }

    for (const { property, attribute, priorityAttribute } of MANAGED_PROPERTIES) {
      if (!this.isWidgetManagedValue(element, property)) {
        this.captureProperty(element, property, attribute, priorityAttribute);
      }
    }
    this.forceInlineImportantValues(element);
  }

  private shouldIgnore(element: Element): boolean {
    return element.id === "aa-assist-root" || Boolean(element.closest("#aa-assist-root"));
  }

  private isWidgetManagedValue(element: HTMLElement, property: (typeof MANAGED_PROPERTIES)[number]["property"]): boolean {
    return element.style.getPropertyValue(property) === "none" && element.style.getPropertyPriority(property) === "important";
  }

  private captureProperty(
    element: HTMLElement,
    property: (typeof MANAGED_PROPERTIES)[number]["property"],
    attribute: string,
    priorityAttribute: string
  ): void {
    element.setAttribute(attribute, element.style.getPropertyValue(property));
    element.setAttribute(priorityAttribute, element.style.getPropertyPriority(property));
  }

  private forceInlineImportantValues(element: HTMLElement): void {
    for (const { property } of MANAGED_PROPERTIES) {
      if (element.style.getPropertyPriority(property) === "important" && element.style.getPropertyValue(property) !== "none") {
        element.style.setProperty(property, "none", "important");
      }
    }
  }

  private ensureStopAnimationStyles(): void {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STOP_ANIMATION_CSS;
    document.head.append(style);
  }

  private removeStopAnimationStyles(): void {
    document.getElementById(STYLE_ID)?.remove();
  }
}
