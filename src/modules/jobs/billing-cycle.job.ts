import { Autowired, Cron, Job, ScheduledJob } from "fragment-ts";
import type { JobContext } from "fragment-ts";
import { BillingAutomationService } from "../billing/services/billing-automation.service";
import { JobRuntimeService } from "./services/job-runtime.service";

@Job()
export class BillingCycleJob extends ScheduledJob {
  @Autowired()
  private billingAutomationService!: BillingAutomationService;

  @Autowired()
  private jobRuntimeService!: JobRuntimeService;

  @Cron("0 * * * *")
  protected async handle(payload: any, context: JobContext): Promise<void> {
    const execution = await this.jobRuntimeService.markRunning("billing-cycle");
    try {
      const result = await this.billingAutomationService.runBillingCycle();
      await this.jobRuntimeService.markCompleted(execution.id, result);
    } catch (error) {
      await this.jobRuntimeService.markFailed(execution.id, error);
      throw error;
    }
  }
}
