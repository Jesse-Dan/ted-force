import { Autowired, Service } from "fragment-ts";
import { DataSourceRepository } from "../repositories/data-source.repository";

@Service()
export class DataSourceQueryService {
  @Autowired()
  private dataSourceRepository!: DataSourceRepository;

  async getAgentDataSources(agentId: string) {
    return this.dataSourceRepository.findByAgentId(agentId);
  }
}
