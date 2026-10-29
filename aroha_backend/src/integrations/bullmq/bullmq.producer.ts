import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class BullmqProducer {
  constructor(
    @InjectQueue("default")
    private readonly defaultQueue: Queue,
  ) {}

  async scheduleRecurring(name: string, everyMs: number): Promise<void> {
    await this.defaultQueue.upsertJobScheduler(name, { every: everyMs }, { name, data: {}, opts: { attempts: 5, backoff: { type: "exponential", delay: 5_000 }, removeOnComplete: 100, removeOnFail: 1000 } });
  }

  async enqueue<TPayload>(
    name: string,
    payload: TPayload,
    opts?: { jobId?: string; delayMs?: number; retryFinished?: boolean },
  ): Promise<void> {
    const job = await this.defaultQueue.add(name, payload, {
      jobId: opts?.jobId ? toBullmqSafeJobId(opts.jobId) : undefined,
      delay: opts?.delayMs,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 5_000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    // Reconciliation can find committed PENDING rows whose old job finished
    // before its database update. Retained job IDs otherwise prevent recovery.
    if (opts?.retryFinished) {
      const state = await job.getState();
      if (state === "completed" || state === "failed") await job.retry(state);
    }
  }
}

export function toBullmqSafeJobId(jobId: string): string {
  return jobId.replace(/:/g, "__");
}
