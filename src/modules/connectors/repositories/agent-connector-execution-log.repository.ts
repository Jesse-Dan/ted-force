import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { AgentConnectorExecutionLog } from "../../../entities/agent-connector-execution-log.entity";

@FragmentRepository()
export class AgentConnectorExecutionLogRepository {
  @InjectRepository(AgentConnectorExecutionLog)
  private repository!: Repository<AgentConnectorExecutionLog>;

  async save(
    payload: Partial<AgentConnectorExecutionLog>,
  ): Promise<AgentConnectorExecutionLog> {
    return this.repository.save(payload);
  }

  async listByConnector(
    connectorId: string,
    limit = 50,
  ): Promise<AgentConnectorExecutionLog[]> {
    return this.repository.find({
      where: { connectorId },
      order: { createdAt: "DESC" },
      take: Math.max(1, Math.min(limit, 200)),
    });
  }
}
