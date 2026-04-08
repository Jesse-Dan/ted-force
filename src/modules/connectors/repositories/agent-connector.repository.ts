import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { AgentConnector } from "../../../entities/agent-connector.entity";

@FragmentRepository()
export class AgentConnectorRepository {
  @InjectRepository(AgentConnector)
  private agentConnectorRepository!: Repository<AgentConnector>;

  async listByAgentId(agentId: string): Promise<AgentConnector[]> {
    return this.agentConnectorRepository.find({
      where: { agentId },
      relations: {
        platformConnector: true,
      },
      order: {
        updatedAt: "DESC",
      },
    });
  }

  async listLiveByAgentId(agentId: string): Promise<AgentConnector[]> {
    return this.agentConnectorRepository.find({
      where: {
        agentId,
        isLive: true,
      },
      relations: {
        platformConnector: true,
      },
      order: {
        updatedAt: "DESC",
      },
    });
  }

  async listPublicLiveByAgentId(agentId: string): Promise<AgentConnector[]> {
    return this.agentConnectorRepository.find({
      where: {
        agentId,
        isLive: true,
        isPublic: true,
      },
      relations: {
        platformConnector: true,
      },
      order: {
        updatedAt: "DESC",
      },
    });
  }

  async findById(connectorId: string): Promise<AgentConnector | null> {
    return this.agentConnectorRepository.findOne({
      where: { id: connectorId },
      relations: {
        platformConnector: true,
      },
    });
  }

  async findByIdAndAgentId(
    connectorId: string,
    agentId: string,
  ): Promise<AgentConnector | null> {
    return this.agentConnectorRepository.findOne({
      where: {
        id: connectorId,
        agentId,
      },
      relations: {
        platformConnector: true,
      },
    });
  }

  async findByAgentAndSlug(
    agentId: string,
    slug: string,
  ): Promise<AgentConnector | null> {
    return this.agentConnectorRepository.findOne({
      where: {
        agentId,
        slug,
      },
      relations: {
        platformConnector: true,
      },
    });
  }

  async save(connector: Partial<AgentConnector>): Promise<AgentConnector> {
    return this.agentConnectorRepository.save(connector);
  }

  async saveMany(connectors: Partial<AgentConnector>[]): Promise<AgentConnector[]> {
    if (!connectors.length) {
      return [];
    }
    return this.agentConnectorRepository.save(connectors);
  }

  async deleteByAgentId(agentId: string): Promise<void> {
    await this.agentConnectorRepository.delete({ agentId });
  }

  async deleteById(connectorId: string): Promise<void> {
    await this.agentConnectorRepository.delete(connectorId);
  }
}
