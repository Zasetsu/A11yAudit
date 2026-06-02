export type LocalJobStatus = "queued" | "running" | "completed" | "failed";

export interface LocalJob<TPayload> {
  id: string;
  status: LocalJobStatus;
  payload: TPayload;
  error?: string;
}

export interface LocalJobRunnerOptions<TPayload> {
  execute?: (job: LocalJob<TPayload>) => Promise<void> | void;
  maxConcurrentJobs?: number;
}

export class LocalJobRunner<TPayload> {
  private readonly jobs = new Map<string, LocalJob<TPayload>>();
  private readonly running = new Set<Promise<void>>();
  private readonly queue: Array<LocalJob<TPayload>> = [];
  private readonly maxConcurrentJobs: number;
  private readonly idleWaiters: Array<() => void> = [];

  constructor(private readonly options: LocalJobRunnerOptions<TPayload> = {}) {
    const requestedConcurrency = options.maxConcurrentJobs ?? 1;
    this.maxConcurrentJobs = Number.isFinite(requestedConcurrency) && requestedConcurrency > 0
      ? Math.floor(requestedConcurrency)
      : 1;
  }

  enqueue(id: string, payload: TPayload): LocalJob<TPayload> {
    const job: LocalJob<TPayload> = { id, payload, status: "queued" };
    this.jobs.set(id, job);

    if (this.options.execute !== undefined) {
      this.queue.push(job);
      this.drainQueue();
    }

    return job;
  }

  get(id: string): LocalJob<TPayload> | undefined {
    return this.jobs.get(id);
  }

  list(): LocalJob<TPayload>[] {
    return [...this.jobs.values()];
  }

  async waitForIdle(): Promise<void> {
    if (this.running.size === 0 && this.queue.length === 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  private drainQueue(): void {
    while (this.running.size < this.maxConcurrentJobs) {
      const job = this.queue.shift();
      if (job === undefined) {
        break;
      }

      const running = this.execute(job);
      this.running.add(running);
      running.finally(() => {
        this.running.delete(running);
        this.drainQueue();
        this.notifyIdle();
      }).catch(() => undefined);
    }
  }

  private notifyIdle(): void {
    if (this.running.size > 0 || this.queue.length > 0) {
      return;
    }

    for (const resolve of this.idleWaiters.splice(0)) {
      resolve();
    }
  }

  private async execute(job: LocalJob<TPayload>): Promise<void> {
    job.status = "running";
    job.error = undefined;

    try {
      await this.options.execute?.(job);
      job.status = "completed";
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
    }
  }
}
