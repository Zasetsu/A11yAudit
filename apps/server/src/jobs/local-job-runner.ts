export type LocalJobStatus = "queued" | "running" | "completed" | "failed";

export interface LocalJob<TPayload> {
  id: string;
  status: LocalJobStatus;
  payload: TPayload;
  error?: string;
}

export interface LocalJobRunnerOptions<TPayload> {
  execute?: (job: LocalJob<TPayload>) => Promise<void> | void;
}

export class LocalJobRunner<TPayload> {
  private readonly jobs = new Map<string, LocalJob<TPayload>>();
  private readonly running = new Set<Promise<void>>();

  constructor(private readonly options: LocalJobRunnerOptions<TPayload> = {}) {}

  enqueue(id: string, payload: TPayload): LocalJob<TPayload> {
    const job: LocalJob<TPayload> = { id, payload, status: "queued" };
    this.jobs.set(id, job);

    if (this.options.execute !== undefined) {
      const running = this.execute(job);
      this.running.add(running);
      running.finally(() => this.running.delete(running)).catch(() => undefined);
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
    await Promise.allSettled([...this.running]);
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
