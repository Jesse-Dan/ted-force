import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { PlatformConnector } from "../../../entities/platform-connector.entity";

@FragmentRepository()
export class PlatformConnectorRepository {
  @InjectRepository(PlatformConnector)
  private platformConnectorRepository!: Repository<PlatformConnector>;

  async listAll(): Promise<PlatformConnector[]> {
    return this.platformConnectorRepository.find({
      order: {
        updatedAt: "DESC",
      },
    });
  }

  async listActive(): Promise<PlatformConnector[]> {
    return this.platformConnectorRepository.find({
      where: {
        isActive: true,
      },
      order: {
        name: "ASC",
      },
    });
  }

  async findByProvider(provider: string): Promise<PlatformConnector | null> {
    return this.platformConnectorRepository.findOne({
      where: {
        provider,
      },
    });
  }

  async findById(connectorId: string): Promise<PlatformConnector | null> {
    return this.platformConnectorRepository.findOne({
      where: { id: connectorId },
    });
  }

  async findByKey(key: string): Promise<PlatformConnector | null> {
    return this.platformConnectorRepository.findOne({
      where: { key },
    });
  }

  async save(connector: Partial<PlatformConnector>): Promise<PlatformConnector> {
    return this.platformConnectorRepository.save(connector);
  }

  async deleteById(connectorId: string): Promise<void> {
    await this.platformConnectorRepository.delete(connectorId);
  }
}
