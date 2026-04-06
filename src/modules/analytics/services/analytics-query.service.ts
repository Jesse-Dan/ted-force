import { Autowired, Service } from "fragment-ts";
import { AgentAnalyticsRepository } from "../repositories/agent-analytics.repository";

@Service()
export class AnalyticsQueryService {
  @Autowired()
  private analyticsRepository!: AgentAnalyticsRepository;

  async getAgentAnalytics(agentId: string) {
    return this.analyticsRepository.findByAgentId(agentId);
  }
}
