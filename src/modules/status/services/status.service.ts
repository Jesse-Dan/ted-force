import { Autowired, Service } from "fragment-ts";
import { JobRuntimeService } from "../../jobs/services/job-runtime.service";

@Service()
export class StatusService {
  @Autowired()
  private jobRuntimeService!: JobRuntimeService;

  async getStatus() {
    return {
      service: "digitwhale_tuul_service_v2",
      transport: "sse-first",
      status: "ok",
      jobs: await this.jobRuntimeService.listLatest(),
    };
  }
}
