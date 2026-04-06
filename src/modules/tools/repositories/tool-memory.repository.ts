import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { ToolMemoryEntry } from "../../../entities/tool-memory-entry.entity";

@FragmentRepository()
export class ToolMemoryRepository {
  @InjectRepository(ToolMemoryEntry)
  private toolMemoryRepository!: Repository<ToolMemoryEntry>;

  async findByMemoryId(sharedMemoryId: string) {
    return this.toolMemoryRepository.findOne({
      where: { sharedMemoryId },
      relations: {
        agentTool: true,
      },
    });
  }

  async findByAgentToolId(agentToolId: string) {
    return this.toolMemoryRepository.findOne({
      where: { agentToolId },
      relations: {
        agentTool: true,
      },
    });
  }

  async findById(id: string) {
    return this.toolMemoryRepository.findOne({
      where: { id },
      relations: {
        agentTool: true,
      },
    });
  }

  async save(entry: Partial<ToolMemoryEntry>) {
    return this.toolMemoryRepository.save(entry);
  }
}
