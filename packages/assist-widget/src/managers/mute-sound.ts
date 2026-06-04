type MediaState = {
  muted: boolean;
  volume: number;
  paused: boolean;
};

type AudioContextConstructor = {
  new (...args: unknown[]): AudioContext;
};

type ManagedAudioContext = AudioContext & {
  resume?: () => Promise<void>;
};

export class MuteSoundManager {
  private enabled = false;
  private observer: MutationObserver | null = null;
  private readonly mediaStates = new Map<HTMLMediaElement, MediaState>();
  private readonly managedAudioContexts = new Set<ManagedAudioContext>();
  private originalAudioContext: AudioContextConstructor | undefined;
  private originalWebkitAudioContext: AudioContextConstructor | undefined;
  private patchedAudioContext: AudioContextConstructor | undefined;
  private patchedWebkitAudioContext: AudioContextConstructor | undefined;

  enable(): void {
    if (this.enabled) return;

    this.enabled = true;
    this.muteMediaIn(document.body);
    this.patchAudioContexts();

    if (typeof MutationObserver === "undefined") return;

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof Element) this.muteMediaIn(node);
        }
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  disable(): void {
    this.reset();
  }

  reset(): void {
    this.enabled = false;
    this.observer?.disconnect();
    this.observer = null;

    for (const [media, state] of this.mediaStates) {
      media.muted = state.muted;
      media.volume = state.volume;
      if (!state.paused) {
        try {
          void media.play();
        } catch {
          // Browsers can reject autoplay restoration; muted/volume state is still restored.
        }
      }
    }
    this.mediaStates.clear();
    this.resumeAudioContexts();
    this.restoreAudioContexts();
  }

  private muteMediaIn(root: Element): void {
    if (root instanceof HTMLMediaElement) this.muteMedia(root);

    for (const media of Array.from(root.querySelectorAll<HTMLMediaElement>("audio, video"))) {
      this.muteMedia(media);
    }
  }

  private muteMedia(media: HTMLMediaElement): void {
    if (!this.mediaStates.has(media)) {
      this.mediaStates.set(media, {
        muted: media.muted,
        volume: media.volume,
        paused: media.paused
      });
    }

    media.muted = true;
    media.volume = 0;
    try {
      media.pause();
    } catch {
      // Some browser media implementations can reject pause for detached elements.
    }
  }

  private patchAudioContexts(): void {
    const win = window as Window & {
      AudioContext?: AudioContextConstructor;
      webkitAudioContext?: AudioContextConstructor;
    };

    this.originalAudioContext = win.AudioContext;
    this.originalWebkitAudioContext = win.webkitAudioContext;

    if (win.AudioContext) {
      this.patchedAudioContext = this.createMutedAudioContext(win.AudioContext);
      win.AudioContext = this.patchedAudioContext;
    }

    if (win.webkitAudioContext) {
      this.patchedWebkitAudioContext = this.createMutedAudioContext(win.webkitAudioContext);
      win.webkitAudioContext = this.patchedWebkitAudioContext;
    }
  }

  private restoreAudioContexts(): void {
    const win = window as Window & {
      AudioContext?: AudioContextConstructor;
      webkitAudioContext?: AudioContextConstructor;
    };

    if (this.originalAudioContext && win.AudioContext === this.patchedAudioContext) {
      win.AudioContext = this.originalAudioContext;
    }

    if (this.originalWebkitAudioContext && win.webkitAudioContext === this.patchedWebkitAudioContext) {
      win.webkitAudioContext = this.originalWebkitAudioContext;
    }

    this.originalAudioContext = undefined;
    this.originalWebkitAudioContext = undefined;
    this.patchedAudioContext = undefined;
    this.patchedWebkitAudioContext = undefined;
  }

  private createMutedAudioContext(OriginalContext: AudioContextConstructor): AudioContextConstructor {
    const managedAudioContexts = this.managedAudioContexts;
    return class extends OriginalContext {
      constructor(...args: unknown[]) {
        super(...args);
        managedAudioContexts.add(this as ManagedAudioContext);
        try {
          void this.suspend();
        } catch {
          // AudioContext can be unavailable or already closed in constrained browsers.
        }
      }
    };
  }

  private resumeAudioContexts(): void {
    for (const context of this.managedAudioContexts) {
      try {
        void context.resume?.();
      } catch {
        // Some contexts can be closed or otherwise non-resumable.
      }
    }
    this.managedAudioContexts.clear();
  }
}
