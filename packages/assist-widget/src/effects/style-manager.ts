export class StyleManager {
  private sections = new Map<string, string>();

  constructor(private readonly styleElementId = "aa-assist-generated-styles") {}

  setSection(sectionId: string, css: string): void {
    if (css.trim().length === 0) {
      this.sections.delete(sectionId);
    } else {
      this.sections.set(sectionId, css);
    }
    this.render();
  }

  removeSection(sectionId: string): void {
    this.sections.delete(sectionId);
    this.render();
  }

  clear(): void {
    this.sections.clear();
    document.getElementById(this.styleElementId)?.remove();
  }

  private render(): void {
    if (this.sections.size === 0) {
      document.getElementById(this.styleElementId)?.remove();
      return;
    }

    let style = document.getElementById(this.styleElementId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = this.styleElementId;
      document.head.appendChild(style);
    }
    style.textContent = Array.from(this.sections.values()).join("\n\n");
  }
}
