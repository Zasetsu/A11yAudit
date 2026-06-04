const TOOLTIP_ID = "aa-assist-hint-tooltip";
const TOOLTIP_CLASS = "aa-assist-hint-tooltip";

export class HintsManager {
  private tooltip: HTMLDivElement | null = null;
  private enabled = false;

  private readonly handlePointerOver = (event: PointerEvent): void => {
    if (!(event.target instanceof Element) || this.shouldIgnore(event.target)) return;

    const hint = this.getHintText(event.target);
    if (hint) {
      this.showTooltip(hint, event);
    }
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.tooltip) this.positionTooltip(event);
  };

  private readonly handlePointerOut = (): void => {
    this.removeTooltip();
  };

  enable(): void {
    if (this.enabled) return;

    this.enabled = true;
    document.addEventListener("pointerover", this.handlePointerOver);
    document.addEventListener("pointermove", this.handlePointerMove);
    document.addEventListener("pointerout", this.handlePointerOut);
  }

  reset(): void {
    if (this.enabled) {
      document.removeEventListener("pointerover", this.handlePointerOver);
      document.removeEventListener("pointermove", this.handlePointerMove);
      document.removeEventListener("pointerout", this.handlePointerOut);
    }
    this.enabled = false;
    this.removeTooltip();
  }

  getHintText(element: Element): string | null {
    if (this.shouldIgnore(element)) return null;

    const directHint = [
      element.getAttribute("alt"),
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("aria-description")
    ].find((value) => value?.trim());

    if (directHint?.trim()) return directHint.trim();

    const describedBy = element.getAttribute("aria-describedby");
    if (!describedBy) return null;

    const resolved = describedBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ")
      .trim();

    return resolved || null;
  }

  private showTooltip(text: string, event: PointerEvent): void {
    if (!this.tooltip) {
      this.tooltip = document.createElement("div");
      this.tooltip.id = TOOLTIP_ID;
      this.tooltip.className = TOOLTIP_CLASS;
      this.tooltip.style.position = "fixed";
      this.tooltip.style.zIndex = "2147483647";
      this.tooltip.style.pointerEvents = "none";
      this.tooltip.style.boxSizing = "border-box";
      this.tooltip.style.maxWidth = "320px";
      this.tooltip.style.border = "1px solid rgba(17, 24, 39, 0.22)";
      this.tooltip.style.borderRadius = "6px";
      this.tooltip.style.padding = "8px 10px";
      this.tooltip.style.background = "rgba(255, 255, 255, 0.96)";
      this.tooltip.style.color = "#111827";
      this.tooltip.style.boxShadow = "0 8px 24px rgba(17, 24, 39, 0.18)";
      this.tooltip.style.font = "600 14px/1.35 system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";
      this.tooltip.style.overflowWrap = "break-word";
      document.body.append(this.tooltip);
    }

    this.tooltip.textContent = text;
    this.positionTooltip(event);
  }

  private positionTooltip(event: PointerEvent): void {
    if (!this.tooltip) return;

    this.tooltip.style.left = `${event.clientX + 12}px`;
    this.tooltip.style.top = `${event.clientY + 12}px`;
  }

  private removeTooltip(): void {
    this.tooltip?.remove();
    this.tooltip = null;
  }

  private shouldIgnore(element: Element): boolean {
    return element.id === "aa-assist-root" || Boolean(element.closest("#aa-assist-root"));
  }
}
