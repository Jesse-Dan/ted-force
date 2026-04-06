import { Autowired, Service } from "fragment-ts";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { CreateAgentEnvironmentDto } from "../dto/create-agent-environment.dto";
import { UpdateAgentEnvironmentDto } from "../dto/update-agent-environment.dto";
import { AgentEnvironmentRepository } from "../repositories/agent-environment.repository";

@Service()
export class EnvironmentService {
  @Autowired()
  private agentEnvironmentRepository!: AgentEnvironmentRepository;

  @Autowired()
  private agentRepository!: AgentRepository;

  async getAgentEnvironments(agentId: string) {
    return this.agentEnvironmentRepository.findByAgentId(agentId);
  }

  async createAgentEnvironment(agentId: string, payload: CreateAgentEnvironmentDto) {
    const agent = await this.agentRepository.findById(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    return this.agentEnvironmentRepository.save({
      agentId,
      key: payload.key.trim(),
      value: payload.value,
      isSecret: payload.isSecret ?? true,
      description: payload.description?.trim() ?? null,
    });
  }

  async updateAgentEnvironment(
    environmentVariableId: string,
    payload: UpdateAgentEnvironmentDto,
  ) {
    const existing = await this.agentEnvironmentRepository.findById(environmentVariableId);

    if (!existing) {
      throw new Error(`Environment variable ${environmentVariableId} not found.`);
    }

    return this.agentEnvironmentRepository.save({
      ...existing,
      key: payload.key?.trim() ?? existing.key,
      value: payload.value ?? existing.value,
      isSecret: payload.isSecret ?? existing.isSecret,
      description:
        payload.description === undefined
          ? existing.description
          : payload.description?.trim() ?? null,
    });
  }

  async deleteAgentEnvironment(environmentVariableId: string) {
    const existing = await this.agentEnvironmentRepository.findById(environmentVariableId);

    if (!existing) {
      throw new Error(`Environment variable ${environmentVariableId} not found.`);
    }

    await this.agentEnvironmentRepository.deleteById(environmentVariableId);
    return { id: environmentVariableId, deleted: true };
  }
}
