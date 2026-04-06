import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { DataSourceConnection } from "../../../entities/data-source-connection.entity";

@FragmentRepository()
export class DataSourceRepository {
  @InjectRepository(DataSourceConnection)
  private dataSourceRepository!: Repository<DataSourceConnection>;

  async findByAgentId(agentId: string): Promise<DataSourceConnection[]> {
    return this.dataSourceRepository.find({
      where: { agentId },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async save(input: Partial<DataSourceConnection>): Promise<DataSourceConnection> {
    return this.dataSourceRepository.save(input);
  }

  async saveMany(
    inputs: Partial<DataSourceConnection>[],
  ): Promise<DataSourceConnection[]> {
    return this.dataSourceRepository.save(inputs);
  }

  async findById(dataSourceId: string): Promise<DataSourceConnection | null> {
    return this.dataSourceRepository.findOne({
      where: { id: dataSourceId },
    });
  }

  async deleteById(dataSourceId: string): Promise<void> {
    await this.dataSourceRepository.delete(dataSourceId);
  }

  async deleteByAgentId(agentId: string): Promise<void> {
    await this.dataSourceRepository.delete({ agentId });
  }
}
