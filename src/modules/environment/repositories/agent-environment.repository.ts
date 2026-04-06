import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { AgentEnvironmentVariable } from "../../../entities/agent-environment-variable.entity";

@FragmentRepository()
export class AgentEnvironmentRepository {
  @InjectRepository(AgentEnvironmentVariable)
  private environmentRepository!: Repository<AgentEnvironmentVariable>;

  async findByAgentId(agentId: string): Promise<AgentEnvironmentVariable[]> {
    return this.environmentRepository.find({
      where: { agentId },
      order: {
        key: "ASC",
      },
    });
  }

  async save(
    environmentVariable: Partial<AgentEnvironmentVariable>,
  ): Promise<AgentEnvironmentVariable> {
    return this.environmentRepository.save(environmentVariable);
  }

  async findById(environmentVariableId: string): Promise<AgentEnvironmentVariable | null> {
    return this.environmentRepository.findOne({
      where: { id: environmentVariableId },
    });
  }

  async deleteById(environmentVariableId: string): Promise<void> {
    await this.environmentRepository.delete(environmentVariableId);
  }
}
