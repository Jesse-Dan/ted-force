import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { AgentRepositoryConnection } from "../../../entities/agent-repository-connection.entity";

@FragmentRepository()
export class AgentRepositoryConnectionRepository {
  @InjectRepository(AgentRepositoryConnection)
  private repository!: Repository<AgentRepositoryConnection>;

  async findByAgentId(
    agentId: string,
  ): Promise<AgentRepositoryConnection | null> {
    return this.repository.findOne({
      where: { agentId },
      relations: {
        agent: true,
      },
    });
  }

  async save(
    input: Partial<AgentRepositoryConnection>,
  ): Promise<AgentRepositoryConnection> {
    return this.repository.save(input);
  }
}
