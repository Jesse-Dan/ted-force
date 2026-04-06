import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { AgentAnalytics } from "../../../entities/agent-analytics.entity";

@FragmentRepository()
export class AgentAnalyticsRepository {
  @InjectRepository(AgentAnalytics)
  private analyticsRepository!: Repository<AgentAnalytics>;

  async findByAgentId(agentId: string): Promise<AgentAnalytics | null> {
    return this.analyticsRepository.findOne({
      where: { agentId },
    });
  }

  async save(input: Partial<AgentAnalytics>): Promise<AgentAnalytics> {
    return this.analyticsRepository.save(input);
  }

  async deleteByAgentId(agentId: string): Promise<void> {
    await this.analyticsRepository.delete({ agentId });
  }
}
