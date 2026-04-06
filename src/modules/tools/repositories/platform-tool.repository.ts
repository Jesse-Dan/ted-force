import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { PlatformTool } from "../../../entities/platform-tool.entity";

@FragmentRepository()
export class PlatformToolRepository {
  @InjectRepository(PlatformTool)
  private platformToolRepository!: Repository<PlatformTool>;

  async listAll(): Promise<PlatformTool[]> {
    return this.platformToolRepository.find({
      order: {
        name: "ASC",
      },
    });
  }

  async listSystemEnabled(): Promise<PlatformTool[]> {
    return this.platformToolRepository.find({
      where: {
        systemEnabled: true,
      },
      order: {
        name: "ASC",
      },
    });
  }

  async findByKey(key: string): Promise<PlatformTool | null> {
    return this.platformToolRepository.findOne({
      where: { key },
    });
  }

  async save(input: Partial<PlatformTool>): Promise<PlatformTool> {
    return this.platformToolRepository.save(input);
  }
}
