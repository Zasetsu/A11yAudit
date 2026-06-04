export class ClassManager {
  private ownedHtmlClasses = new Set<string>();
  private ownedBodyClasses = new Set<string>();

  addHtmlClass(className: string): void {
    document.documentElement.classList.add(className);
    this.ownedHtmlClasses.add(className);
  }

  removeHtmlClass(className: string): void {
    document.documentElement.classList.remove(className);
    this.ownedHtmlClasses.delete(className);
  }

  addBodyClass(className: string): void {
    document.body.classList.add(className);
    this.ownedBodyClasses.add(className);
  }

  removeBodyClass(className: string): void {
    document.body.classList.remove(className);
    this.ownedBodyClasses.delete(className);
  }

  clearOwnedClasses(): void {
    for (const className of this.ownedHtmlClasses) {
      document.documentElement.classList.remove(className);
    }
    for (const className of this.ownedBodyClasses) {
      document.body.classList.remove(className);
    }
    this.ownedHtmlClasses.clear();
    this.ownedBodyClasses.clear();
  }
}
