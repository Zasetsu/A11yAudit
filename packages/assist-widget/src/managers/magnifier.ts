const MAGNIFIER_CLASS = "aa-assist-magnifier";

export class MagnifierManager {
  private magnifier: HTMLDivElement | null = null;
  private enabled = false;
  private pendingPointer: { target: Element | null; clientX: number; clientY: number } | null = null;
  private pointerFrame: number | null = null;

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.pendingPointer = {
      target: event.target instanceof Element ? event.target : null,
      clientX: event.clientX,
      clientY: event.clientY
    };

    if (this.pointerFrame !== null) return;
    this.pointerFrame = requestAnimationFrame(() => {
      this.pointerFrame = null;
      const pending = this.pendingPointer;
      this.pendingPointer = null;
      if (pending) this.handlePointerPreview(pending);
    });
  };

  private readonly handlePointerOut = (): void => {
    this.cancelPointerFrame();
    this.removeMagnifier();
  };

  enable(): void {
    if (this.enabled) return;

    this.enabled = true;
    document.addEventListener("pointermove", this.handlePointerMove);
    document.addEventListener("pointerout", this.handlePointerOut);
  }

  reset(): void {
    if (this.enabled) {
      document.removeEventListener("pointermove", this.handlePointerMove);
      document.removeEventListener("pointerout", this.handlePointerOut);
    }
    this.enabled = false;
    this.cancelPointerFrame();
    this.removeMagnifier();
  }

  private handlePointerPreview(event: { target: Element | null; clientX: number; clientY: number }): void {
    if (!event.target || this.shouldIgnore(event.target)) {
      this.removeMagnifier();
      return;
    }

    if (event.target instanceof HTMLImageElement) {
      this.showImagePreview(event.target, event);
      return;
    }

    const text = event.target.textContent?.trim();
    if (text) {
      this.showTextPreview(event.target, text, event);
    } else {
      this.removeMagnifier();
    }
  }

  showTextPreview(element: Element, text: string, event: Pick<MouseEvent, "clientX" | "clientY">): void {
    if (this.shouldIgnore(element)) return;

    const magnifier = this.ensureMagnifier();
    magnifier.textContent = text;
    magnifier.style.width = "";
    magnifier.style.height = "";
    magnifier.style.backgroundImage = "";
    magnifier.style.backgroundRepeat = "";
    magnifier.style.backgroundSize = "";
    magnifier.style.backgroundPosition = "";
    magnifier.style.minWidth = "180px";
    magnifier.style.maxWidth = "360px";
    magnifier.style.padding = "12px 14px";
    magnifier.style.fontSize = "24px";
    magnifier.style.lineHeight = "1.4";
    this.positionMagnifier(event);
  }

  showImagePreview(image: HTMLImageElement, event: Pick<MouseEvent, "clientX" | "clientY">): void {
    if (this.shouldIgnore(image)) return;

    const magnifier = this.ensureMagnifier();
    const imageUrl = image.currentSrc || image.src;
    magnifier.textContent = "";
    magnifier.style.width = "220px";
    magnifier.style.height = "160px";
    magnifier.style.minWidth = "";
    magnifier.style.maxWidth = "";
    magnifier.style.padding = "0";
    magnifier.style.fontSize = "";
    magnifier.style.lineHeight = "";
    magnifier.style.backgroundImage = `url("${imageUrl.replace(/["\\]/g, "\\$&")}")`;
    magnifier.style.backgroundRepeat = "no-repeat";
    magnifier.style.backgroundSize = "contain";
    magnifier.style.backgroundPosition = "center";
    this.positionMagnifier(event);
  }

  private ensureMagnifier(): HTMLDivElement {
    if (!this.magnifier) {
      this.magnifier = document.createElement("div");
      this.magnifier.className = MAGNIFIER_CLASS;
      this.magnifier.style.position = "fixed";
      this.magnifier.style.zIndex = "2147483647";
      this.magnifier.style.pointerEvents = "none";
      this.magnifier.style.boxSizing = "border-box";
      this.magnifier.style.border = "2px solid #111";
      this.magnifier.style.borderRadius = "6px";
      this.magnifier.style.backgroundColor = "#fff";
      this.magnifier.style.color = "#111";
      this.magnifier.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.24)";
      document.body.append(this.magnifier);
    }

    return this.magnifier;
  }

  private positionMagnifier(event: Pick<MouseEvent, "clientX" | "clientY">): void {
    if (!this.magnifier) return;

    this.magnifier.style.left = `${event.clientX + 16}px`;
    this.magnifier.style.top = `${event.clientY + 16}px`;
  }

  private cancelPointerFrame(): void {
    if (this.pointerFrame !== null) {
      cancelAnimationFrame(this.pointerFrame);
      this.pointerFrame = null;
    }
    this.pendingPointer = null;
  }

  private removeMagnifier(): void {
    this.magnifier?.remove();
    this.magnifier = null;
  }

  private shouldIgnore(element: Element): boolean {
    return element.id === "aa-assist-root" || Boolean(element.closest("#aa-assist-root"));
  }
}
