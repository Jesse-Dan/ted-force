import { Autowired, Service } from "fragment-ts";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { UpsertAgentAnalyticsDto } from "../dto/upsert-agent-analytics.dto";
import { AgentAnalyticsRepository } from "../repositories/agent-analytics.repository";

@Service()
export class AnalyticsCommandService {
  @Autowired()
  private analyticsRepository!: AgentAnalyticsRepository;

  @Autowired()
  private agentRepository!: AgentRepository;

  async upsertAgentAnalytics(agentId: string, payload: UpsertAgentAnalyticsDto) {
    const agent = await this.agentRepository.findById(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    const existing = await this.analyticsRepository.findByAgentId(agentId);

    return this.analyticsRepository.save({
      ...existing,
      agentId,
      apiCallsToday: payload.apiCallsToday ?? existing?.apiCallsToday ?? 0,
      errorRate: payload.errorRate ?? existing?.errorRate ?? 0,
      avgResponseTime: payload.avgResponseTime ?? existing?.avgResponseTime ?? 0,
      activeUsers: payload.activeUsers ?? existing?.activeUsers ?? 0,
      weeklyUsage: payload.weeklyUsage ?? existing?.weeklyUsage ?? null,
      responseTimeTrend: payload.responseTimeTrend ?? existing?.responseTimeTrend ?? null,
      functionUsage: payload.functionUsage ?? existing?.functionUsage ?? null,
    });
  }

  async deleteAgentAnalytics(agentId: string) {
    await this.analyticsRepository.deleteByAgentId(agentId);
    return { agentId, deleted: true };
  }
}
