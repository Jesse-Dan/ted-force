import { Autowired, Service } from "fragment-ts";
import { JobExecutionRepository } from "../repositories/job-execution.repository";

@Service()
export class JobRuntimeService {
  @Autowired()
  private jobExecutionRepository!: JobExecutionRepository;

  async markRunning(name: string, meta?: Record<string, unknown>) {
    return this.jobExecutionRepository.save({
      jobName: name,
      status: "running",
      startedAt: new Date(),
      completedAt: null,
      failedAt: null,
      lastError: null,
      meta: meta ?? null,
    });
  }

  async markCompleted(id: string, meta?: Record<string, unknown>) {
    return this.jobExecutionRepository.save({
      id,
      status: "completed",
      completedAt: new Date(),
      lastError: null,
      meta: meta ?? null,
    });
  }

  async markFailed(id: string, error: unknown, meta?: Record<string, unknown>) {
    return this.jobExecutionRepository.save({
      id,
      status: "failed",
      failedAt: new Date(),
      lastError: error instanceof Error ? error.message : String(error),
      meta: meta ?? null,
    });
  }

  async listLatest() {
    const jobNames = [
      "billing-cycle",
      "debt-recovery",
      "organization-health-sync",
    ];

    const latest = await Promise.all(
      jobNames.map((jobName) =>
        this.jobExecutionRepository.findLatestByJobName(jobName),
      ),
    );

    return latest.map((record, index) => ({
      name: jobNames[index],
      status: record?.status ?? "idle",
      lastStartedAt: record?.startedAt?.toISOString(),
      lastCompletedAt: record?.completedAt?.toISOString(),
      lastFailedAt: record?.failedAt?.toISOString(),
      lastError: record?.lastError ?? null,
      meta: record?.meta ?? null,
    }));
  }
}
