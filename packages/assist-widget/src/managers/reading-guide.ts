const GUIDE_CLASS = "aa-assist-reading-guide";

export class ReadingGuideManager {
  private guide: HTMLDivElement | null = null;
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
    this.ensureGuide();
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
    this.guide?.remove();
    this.guide = null;
  }

  private ensureGuide(): HTMLDivElement {
    if (!this.guide) {
      this.guide = document.createElement("div");
      this.guide.className = GUIDE_CLASS;
      this.guide.setAttribute("aria-hidden", "true");
      this.guide.style.position = "fixed";
      this.guide.style.left = "0";
      this.guide.style.width = "100vw";
      this.guide.style.height = "12px";
      this.guide.style.background = "rgba(250, 204, 21, 0.75)";
      this.guide.style.pointerEvents = "none";
      this.guide.style.zIndex = "2147483647";
      document.body.append(this.guide);
    }

    return this.guide;
  }

  private updatePosition(): void {
    const guide = this.ensureGuide();
    const top = Math.max(6, Math.min(this.lastY - 6, window.innerHeight - 18));
    guide.style.top = `${top}px`;
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
