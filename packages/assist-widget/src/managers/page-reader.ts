export type PageReaderSpeed = 0 | 1 | 2 | 3;

const HIGHLIGHT_ATTRIBUTE = "data-aa-assist-speech-highlight";
const SPEED_RATES: Record<Exclude<PageReaderSpeed, 0>, number> = {
  1: 0.8,
  2: 1,
  3: 1.2
};

type HighlightState = {
  outline: string;
  outlineOffset: string;
};

export class PageReaderManager {
  private enabled = false;
  private speed: PageReaderSpeed = 0;
  private highlightedElement: HTMLElement | null = null;
  private highlightState: HighlightState | null = null;
  private speechVersion = 0;

  private readonly handleClick = (event: MouseEvent): void => {
    if (!(event.target instanceof Element) || this.shouldIgnore(event.target)) return;

    const text = this.getReadableText(event.target);
    if (!text) return;

    this.speak(text, event.target);
  };

  enable(speed: PageReaderSpeed): void {
    if (speed === 0) {
      this.disable();
      return;
    }

    this.speed = speed;
    if (!this.enabled) {
      this.enabled = true;
      document.addEventListener("click", this.handleClick);
    }
    this.speak("Page reader enabled. Click the text you want to read.");
  }

  disable(): void {
    if (this.enabled) {
      document.removeEventListener("click", this.handleClick);
    }
    this.enabled = false;
    this.speed = 0;
    this.cancelSpeech();
    this.clearHighlight();
  }

  reset(): void {
    this.disable();
  }

  private speak(text: string, highlightedElement?: Element): void {
    this.cancelSpeech();
    this.clearHighlight();
    const speechVersion = ++this.speechVersion;

    if (highlightedElement instanceof HTMLElement) {
      this.highlightElement(highlightedElement);
    }

    if (typeof SpeechSynthesisUtterance === "undefined" || typeof speechSynthesis === "undefined") return;

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.speed !== 0) utterance.rate = SPEED_RATES[this.speed];
    utterance.onend = () => {
      if (speechVersion === this.speechVersion) this.clearHighlight();
    };
    utterance.onerror = () => {
      if (speechVersion === this.speechVersion) this.clearHighlight();
    };
    speechSynthesis.speak(utterance);
  }

  private cancelSpeech(): void {
    this.speechVersion += 1;
    if (typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
  }

  private getReadableText(element: Element): string {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return (element.value || element.placeholder || "").trim();
    }

    if (element instanceof HTMLImageElement) {
      return (element.alt || "Image").trim();
    }

    return (element.textContent ?? "").trim();
  }

  private highlightElement(element: HTMLElement): void {
    this.highlightedElement = element;
    this.highlightState = {
      outline: element.style.outline,
      outlineOffset: element.style.outlineOffset
    };
    element.setAttribute(HIGHLIGHT_ATTRIBUTE, "true");
    element.style.outline = "3px solid #2563eb";
    element.style.outlineOffset = "3px";
  }

  private clearHighlight(): void {
    if (!this.highlightedElement) return;

    this.highlightedElement.removeAttribute(HIGHLIGHT_ATTRIBUTE);
    if (this.highlightState) {
      this.highlightedElement.style.outline = this.highlightState.outline;
      this.highlightedElement.style.outlineOffset = this.highlightState.outlineOffset;
    }
    this.highlightedElement = null;
    this.highlightState = null;
  }

  private shouldIgnore(element: Element): boolean {
    return element.id === "aa-assist-root" || Boolean(element.closest("#aa-assist-root"));
  }
}
