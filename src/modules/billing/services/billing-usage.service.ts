import {
  InjectRepository,
  Repository,
  Service,
} from "fragment-ts";
import { Agent } from "../../../entities/agent.entity";
import { AgentEnvironmentVariable } from "../../../entities/agent-environment-variable.entity";
import { AgentInstance } from "../../../entities/agent-instance.entity";
import { AgentTool } from "../../../entities/agent-tool.entity";
import { Asset } from "../../../entities/asset.entity";
import { AwarenessRecord } from "../../../entities/awareness-record.entity";
import { DataSourceConnection } from "../../../entities/data-source-connection.entity";
import { BillableItem } from "../../../entities/enums/billable-item.enum";
import { AgentStatus } from "../../../entities/enums/agent-status.enum";
import { InstanceProjection } from "../../../entities/enums/instance-projection.enum";
import { ExternalResource } from "../../../entities/external-resource.entity";
import { Organization } from "../../../entities/organization.entity";

export type UsageRecord = Record<BillableItem, number>;

@Service()
export class BillingUsageService {
  @InjectRepository(Agent)
  private agentRepository!: Repository<Agent>;

  @InjectRepository(AgentInstance)
  private agentInstanceRepository!: Repository<AgentInstance>;

  @InjectRepository(AgentTool)
  private agentToolRepository!: Repository<AgentTool>;

  @InjectRepository(DataSourceConnection)
  private dataSourceRepository!: Repository<DataSourceConnection>;

  @InjectRepository(AgentEnvironmentVariable)
  private envVarRepository!: Repository<AgentEnvironmentVariable>;

  @InjectRepository(AwarenessRecord)
  private awarenessRepository!: Repository<AwarenessRecord>;

  @InjectRepository(Asset)
  private assetRepository!: Repository<Asset>;

  @InjectRepository(ExternalResource)
  private externalResourceRepository!: Repository<ExternalResource>;

  async getUsage(organization: Organization): Promise<UsageRecord> {
    const [
      publicInstances,
      createdInstances,
      tools,
      dataSources,
      mcpServers,
      seats,
      agents,
      agentAssets,
      agentResources,
      visualInput,
      audioInput,
      envVars,
      memoryAndAwareness,
      aiHelper,
    ] = await Promise.all([
      this.getPublicInstances(organization.id),
      this.getCreatedInstances(organization.id),
      this.getTools(organization.id),
      this.getDataSources(organization.id),
      this.getMcpServers(organization.id),
      Promise.resolve(organization.memberships?.length ?? 0),
      this.getAgents(organization.id),
      this.getAssets(organization.id),
      this.getResources(organization.id),
      this.getVisualInput(organization.id),
      this.getAudioInput(organization.id),
      this.getEnvVars(organization.id),
      this.getMemoryAndAwareness(organization.id),
      this.getAiHelper(organization.id),
    ]);

    return {
      [BillableItem.PUBLIC_INSTANCES]: publicInstances,
      [BillableItem.CREATED_INSTANCES]: createdInstances,
      [BillableItem.TOOLS]: tools,
      [BillableItem.DATASOURCES]: dataSources,
      [BillableItem.MCP_SERVERS]: mcpServers,
      [BillableItem.SEATS]: seats,
      [BillableItem.AGENTS]: agents,
      [BillableItem.AGENT_ASSETS]: agentAssets,
      [BillableItem.AGENT_RESOURCES]: agentResources,
      [BillableItem.VISUAL_INPUT]: visualInput,
      [BillableItem.AUDIO_INPUT]: audioInput,
      [BillableItem.ENV_VARS]: envVars,
      [BillableItem.MEMORY_AND_AWARENESS]: memoryAndAwareness,
      [BillableItem.AI_HELPER]: aiHelper,
    };
  }

  private async getPublicInstances(organizationId: string): Promise<number> {
    void organizationId;
    return 0;
  }

  private async getCreatedInstances(organizationId: string): Promise<number> {
    return this.agentInstanceRepository
      .createQueryBuilder("instance")
      .innerJoin("instance.agent", "agent")
      .where("agent.organizationId = :organizationId", { organizationId })
      .andWhere("instance.projection = :projection", {
        projection: InstanceProjection.CURRENT,
      })
      .getCount();
  }

  private async getTools(organizationId: string): Promise<number> {
    return this.agentToolRepository
      .createQueryBuilder("tool")
      .innerJoin("tool.agent", "agent")
      .where("agent.organizationId = :organizationId", { organizationId })
      .andWhere("tool.enabled = true")
      .andWhere("tool.commitHash IS NULL")
      .getCount();
  }

  private async getDataSources(organizationId: string): Promise<number> {
    return this.dataSourceRepository
      .createQueryBuilder("connection")
      .innerJoin("connection.agent", "agent")
      .where("agent.organizationId = :organizationId", { organizationId })
      .getCount();
  }

  private async getMcpServers(_organizationId: string): Promise<number> {
    return 0;
  }

  private async getAgents(organizationId: string): Promise<number> {
    return this.agentRepository.count({
      where: {
        organizationId,
        status: AgentStatus.ACTIVE,
      },
    });
  }

  private async getAssets(organizationId: string): Promise<number> {
    return this.assetRepository
      .createQueryBuilder("asset")
      .innerJoin("asset.agent", "agent")
      .where("agent.organizationId = :organizationId", { organizationId })
      .getCount();
  }

  private async getResources(organizationId: string): Promise<number> {
    return this.externalResourceRepository
      .createQueryBuilder("resource")
      .innerJoin("resource.agent", "agent")
      .where("agent.organizationId = :organizationId", { organizationId })
      .getCount();
  }

  private async getVisualInput(_organizationId: string): Promise<number> {
    return 0;
  }

  private async getAudioInput(_organizationId: string): Promise<number> {
    return 0;
  }

  private async getEnvVars(organizationId: string): Promise<number> {
    return this.envVarRepository
      .createQueryBuilder("env")
      .innerJoin("env.agent", "agent")
      .where("agent.organizationId = :organizationId", { organizationId })
      .getCount();
  }

  private async getMemoryAndAwareness(organizationId: string): Promise<number> {
    const records = await this.awarenessRepository
      .createQueryBuilder("awareness")
      .innerJoin("awareness.agent", "agent")
      .where("agent.organizationId = :organizationId", { organizationId })
      .select(["awareness.used"])
      .getMany();

    return records.reduce((total, record) => {
      return total + Math.floor((record.used ?? 0) / 100);
    }, 0);
  }

  private async getAiHelper(organizationId: string): Promise<number> {
    return this.agentInstanceRepository
      .createQueryBuilder("instance")
      .innerJoin("instance.agent", "agent")
      .where("agent.organizationId = :organizationId", { organizationId })
      .andWhere("instance.status IN (:...statuses)", {
        statuses: ["running", "upgrading"],
      })
      .getCount();
  }
}
