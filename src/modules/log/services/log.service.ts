import { Autowired, Service } from "fragment-ts";
import { ApiCallLogRepository } from "../../api/repositories/api-call-log.repository";
import { ActivityLogRepository } from "../repositories/activity-log.repository";

@Service()
export class LogService {
  @Autowired()
  private activityLogRepository!: ActivityLogRepository;

  @Autowired()
  private apiCallLogRepository!: ApiCallLogRepository;

  async getAgentActivity(agentId: string) {
    return this.activityLogRepository.findByAgentId(agentId);
  }

  async getAgentApiCalls(agentId: string) {
    return this.apiCallLogRepository.findByAgentId(agentId);
  }
}
