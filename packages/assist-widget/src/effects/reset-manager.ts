export interface Resettable {
  reset: () => void;
}

export class ResetManager {
  private resetters = new Set<Resettable>();

  add(resettable: Resettable): void {
    this.resetters.add(resettable);
  }

  resetAll(): void {
    for (const resettable of this.resetters) {
      resettable.reset();
    }
  }
}
