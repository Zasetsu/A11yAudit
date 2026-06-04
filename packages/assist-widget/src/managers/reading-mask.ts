const TOP_MASK_CLASS = "aa-assist-reading-mask-top";
const BOTTOM_MASK_CLASS = "aa-assist-reading-mask-bottom";
const READING_HEIGHT = 80;

export class ReadingMaskManager {
  private topMask: HTMLDivElement | null = null;
  private bottomMask: HTMLDivElement | null = null;
  private enabled = false;
  private lastY = Math.round(window.innerHeight / 2);
  private pendingFrame: number | null = null;

  private readonly handleMouseMove = (event: MouseEvent): void => {
    this.lastY = event.clientY;
    this.scheduleUpdate();
  };

  private readonly handleViewportChange = (): void => {
    this.scheduleUpdate();
  };

  enable(): void {
    if (this.enabled) return;

    this.enabled = true;
    this.ensureMasks();
    document.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("resize", this.handleViewportChange);
    window.addEventListener("scroll", this.handleViewportChange, true);
    this.updatePosition();
  }

  disable(): void {
    this.reset();
  }

  reset(): void {
    if (this.enabled) {
      document.removeEventListener("mousemove", this.handleMouseMove);
      window.removeEventListener("resize", this.handleViewportChange);
      window.removeEventListener("scroll", this.handleViewportChange, true);
    }
    this.enabled = false;
    this.cancelScheduledUpdate();
    this.topMask?.remove();
    this.bottomMask?.remove();
    this.topMask = null;
    this.bottomMask = null;
  }

  private ensureMasks(): void {
    if (!this.topMask) {
      this.topMask = this.createMask(TOP_MASK_CLASS);
      document.body.append(this.topMask);
    }

    if (!this.bottomMask) {
      this.bottomMask = this.createMask(BOTTOM_MASK_CLASS);
      document.body.append(this.bottomMask);
    }
  }

  private createMask(className: string): HTMLDivElement {
    const mask = document.createElement("div");
    mask.className = className;
    mask.setAttribute("aria-hidden", "true");
    mask.style.position = "fixed";
    mask.style.left = "0";
    mask.style.width = "100vw";
    mask.style.background = "rgba(15, 23, 42, 0.58)";
    mask.style.pointerEvents = "none";
    mask.style.zIndex = "2147483646";
    return mask;
  }

  private updatePosition(): void {
    this.ensureMasks();
    if (!this.topMask || !this.bottomMask) return;

    const bandTop = Math.max(0, Math.min(this.lastY - READING_HEIGHT / 2, window.innerHeight - READING_HEIGHT));
    const bandBottom = bandTop + READING_HEIGHT;

    this.topMask.style.top = "0";
    this.topMask.style.height = `${bandTop}px`;
    this.bottomMask.style.top = `${bandBottom}px`;
    this.bottomMask.style.height = `${Math.max(0, window.innerHeight - bandBottom)}px`;
  }

  private scheduleUpdate(): void {
    if (this.pendingFrame !== null) return;

    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = null;
      if (this.enabled) this.updatePosition();
    });
  }

  private cancelScheduledUpdate(): void {
    if (this.pendingFrame !== null) {
      cancelAnimationFrame(this.pendingFrame);
      this.pendingFrame = null;
    }
  }
}
