import { Autowired, Service } from "fragment-ts";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { CreateDataSourceDto } from "../dto/create-data-source.dto";
import { UpdateDataSourceDto } from "../dto/update-data-source.dto";
import { DataSourceRepository } from "../repositories/data-source.repository";

@Service()
export class DataSourceCommandService {
  @Autowired()
  private dataSourceRepository!: DataSourceRepository;

  @Autowired()
  private agentRepository!: AgentRepository;

  async createDataSource(agentId: string, payload: CreateDataSourceDto) {
    await this.ensureAgent(agentId);

    return this.dataSourceRepository.save({
      agentId,
      name: payload.name.trim(),
      type: payload.type,
      config: payload.config ?? null,
    });
  }

  async updateDataSource(dataSourceId: string, payload: UpdateDataSourceDto) {
    const existing = await this.dataSourceRepository.findById(dataSourceId);

    if (!existing) {
      throw new Error(`Data source ${dataSourceId} not found.`);
    }

    return this.dataSourceRepository.save({
      ...existing,
      name: payload.name?.trim() ?? existing.name,
      type: payload.type ?? existing.type,
      config: payload.config === undefined ? existing.config : payload.config,
    });
  }

  async deleteDataSource(dataSourceId: string) {
    const existing = await this.dataSourceRepository.findById(dataSourceId);

    if (!existing) {
      throw new Error(`Data source ${dataSourceId} not found.`);
    }

    await this.dataSourceRepository.deleteById(dataSourceId);
    return { id: dataSourceId, deleted: true };
  }

  private async ensureAgent(agentId: string) {
    const agent = await this.agentRepository.findById(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }
  }
}
