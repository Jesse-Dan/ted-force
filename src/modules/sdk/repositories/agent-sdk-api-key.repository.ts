import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { IsNull } from "typeorm";
import { AgentSdkApiKey } from "../../../entities/agent-sdk-api-key.entity";

@FragmentRepository()
export class AgentSdkApiKeyRepository {
  @InjectRepository(AgentSdkApiKey)
  private repository!: Repository<AgentSdkApiKey>;

  async findActiveByAgentId(agentId: string): Promise<AgentSdkApiKey[]> {
    return this.repository.find({
      where: {
        agentId,
        revokedAt: IsNull(),
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findActiveByAgentIdAndHash(
    agentId: string,
    tokenHash: string,
  ): Promise<AgentSdkApiKey | null> {
    return this.repository.findOne({
      where: {
        agentId,
        tokenHash,
        revokedAt: IsNull(),
      },
    });
  }

  async findByIdAndAgentId(id: string, agentId: string): Promise<AgentSdkApiKey | null> {
    return this.repository.findOne({
      where: {
        id,
        agentId,
      },
    });
  }

  async save(payload: Partial<AgentSdkApiKey>): Promise<AgentSdkApiKey> {
    return this.repository.save(payload);
  }
}
